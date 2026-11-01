import { readFileSync } from 'node:fs'
import { Context, Service } from '@deepseek-ai/cordis'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

interface PatchEntry {
  id?: string
  name?: string
  inject?: string[]
  config?: unknown
}

const patch: PatchEntry[] = parse(
  readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8'),
)
const compatibility = patch.find(entry => entry.id === 'connection')!

/** Mirrors current DSH Connection's caller-owned effect and provider-context service access.
 * Real DSH composition is additionally checked by scripts/check-memory-rpc.mjs.
 */
class ConnectionFixture extends Service {
  constructor(ctx: Context) { super(ctx, 'connection') }

  get rpc() {
    const owner = this.ctx as Context & { webServer: { register(route: { path: string }): () => void } }
    return {
      handle: (channel: string) => owner.effect(() => owner.webServer.register({ path: channel })),
    }
  }
}

/** Sibling plugins provide every service the patched Connection row declares. */
async function providerServices(ctx: Context, routes: Set<string>): Promise<void> {
  await ctx.plugin({ apply(provider: Context) {
    provider.provide('credentials', {})
    provider.provide('webStartup', { trustedHosts: [] })
    provider.provide('webServer', { register(route: { path: string }) {
      routes.add(route.path)
      return () => { routes.delete(route.path) }
    } })
  } })
}

describe('Web Connection compatibility', () => {
  it('targets only the standard Connection entry and keeps both provider dependencies', () => {
    expect(compatibility).toEqual({
      id: 'connection', name: '@deepseek-ai/dsh-client-connection', inject: ['webStartup', 'webServer'],
    })
    // The row's own config (trustedHosts and authentication) must stay bundle-owned.
    expect(compatibility.config).toBeUndefined()
    expect(compatibility.inject).not.toContain('webRuntime')
  })

  it('reads webStartup for the provider config and webServer for registration', async () => {
    const ctx = new Context()
    const routes = new Set<string>()
    try {
      await providerServices(ctx, routes)
      await ctx.plugin({
        inject: ['credentials', ...compatibility.inject!],
        apply(provider: Context) {
          // The bundle row evaluates its config from this service before providing Connection.
          expect((provider as Context & { webStartup: { trustedHosts: string[] } }).webStartup.trustedHosts).toEqual([])
          new ConnectionFixture(provider)
        },
      })
      const consumer = ctx.plugin({ inject: ['connection'], apply(client: Context) {
        client.effect(() => client.connection.rpc.handle('/memory', async () => ({ ok: true, value: null })))
      } })
      await consumer.await()
      expect([...routes]).toEqual(['/memory'])
      await consumer.dispose()
      expect(routes.size).toBe(0)
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('fails the provider config without webStartup', async () => {
    const ctx = new Context()
    const routes = new Set<string>()
    try {
      await providerServices(ctx, routes)
      const provider = ctx.plugin({
        inject: ['credentials', 'webServer'],
        apply(provider: Context) {
          (provider as Context & { webStartup: { trustedHosts: string[] } }).webStartup.trustedHosts
          new ConnectionFixture(provider)
        },
      })
      await expect(provider.await()).rejects.toThrow('cannot get property "webStartup" without inject')
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('fails generic RPC registration without webServer in the provider context', async () => {
    const ctx = new Context()
    const routes = new Set<string>()
    try {
      await providerServices(ctx, routes)
      // This is the unpatched row: module dependencies plus the bundle's webStartup only.
      await ctx.plugin({
        inject: ['credentials', 'webStartup'],
        apply(provider: Context) { new ConnectionFixture(provider) },
      })
      const consumer = ctx.plugin({ inject: ['connection'], apply(client: Context) {
        client.effect(() => client.connection.rpc.handle('/memory', async () => ({ ok: true, value: null })))
      } })
      await expect(consumer.await()).rejects.toThrow('cannot get property "webServer" without inject')
      expect(routes.size).toBe(0)
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
