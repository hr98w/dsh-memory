/** Check the shipped Bundle against a real DSH source checkout, without user profiles or model calls.
 * Usage: node scripts/check-memory-rpc.mjs /absolute/path/to/deepseek-harness
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const script = fileURLToPath(import.meta.url)
if (process.argv[2] !== '--child') {
  assert(process.argv[2], 'Pass the DSH source checkout path')
  const result = spawnSync(process.execPath, ['--import', 'tsx/esm', script, '--child'], {
    cwd: resolve(process.argv[2]), stdio: 'inherit', timeout: 30_000,
  })
  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}

const fromDsh = path => import(pathToFileURL(resolve(path)).href)
const { Context, Inject } = await fromDsh('vendor/cordis/src/index.ts')
const { applyEntryPatches, entryListSchema } = await fromDsh('vendor/include/src/index.ts')
const { HostConnectionService } = await fromDsh('packages/client/connection/src/rpc-host.ts')
const { inject: connectionInject } = await fromDsh('packages/client/connection/src/index.ts')
const { default: yaml } = await fromDsh('node_modules/js-yaml/index.js')
const memory = await import('../lib/index.mjs')
const patches = yaml.load(readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8'), { schema: entryListSchema })
let warnings = []
const warn = (...args) => warnings.push(args)
const webEntries = applyEntryPatches([], yaml.load(readFileSync(resolve('packages/bundle/web-app/cordis.patch.yml'), 'utf8'), { schema: entryListSchema }), () => {})
const original = webEntries.find(entry => entry.id === 'connection')
assert(original, 'Standard Web Connection row must exist')
assert(original.inject.includes('webStartup'), 'Standard Web Connection row must keep its webStartup config dependency')
const patched = applyEntryPatches([original], patches, warn)
assert.equal(warnings.length, 0)
assert.deepEqual(patched[0].config, original.config, 'Preserve authentication and runtime config')
// The Bundle row replaces entry-level inject, so this also pins every dependency the DSH baseline declares.
assert.deepEqual(patched[0].inject, [...original.inject, 'webServer'])
assert.equal(patched[0].inject.includes('webRuntime'), false)

warnings = []
const headless = applyEntryPatches([], patches, warn)
assert.deepEqual(headless.map(entry => entry.id), ['dsh-memory'])
assert.equal(warnings.length, 1, 'Missing Connection is a skipped-patch warning, not a new Web entry')
warnings = []
const other = { id: 'connection', name: 'another-plugin', inject: ['custom'] }
assert.deepEqual(applyEntryPatches([other], patches, warn)[0], other, 'Do not patch an unrelated id collision')
assert.equal(warnings.length, 1)

const root = mkdtempSync(join(tmpdir(), 'dsh-memory-rpc-check-'))
process.env.DSH_HOME = root
try {
  for (const [label, entry] of [['unpatched', original], ['patched', patched[0]], ['headless', undefined]]) {
    const ctx = new Context()
    const routes = new Map()
    let inject
    try {
      if (entry) {
        await ctx.plugin({ apply(provider) {
          provider.provide('credentials', {})
          provider.provide('webStartup', { trustedHosts: [] })
          provider.provide('webServer', { register(route) {
            routes.set(route.path, route)
            return () => routes.delete(route.path)
          } })
        } })
        inject = Inject.resolve(connectionInject)
        Inject.resolve(entry.inject, inject)
        assert('credentials' in inject)
        await ctx.plugin({ inject, apply(provider) {
          // The row config is evaluated from webStartup; authentication is not invoked because this
          // check exercises registration ownership, not HTTP.
          assert.deepEqual(provider.webStartup.trustedHosts, [])
          new HostConnectionService(provider, [], {})
        } })
      }
      const fiber = ctx.plugin(memory)
      await fiber.await()
      const failures = []
      // The root may be active while an optional child failed; inspect every child explicitly.
      for (const runtime of ctx.registry.values()) for (const child of runtime.fibers) {
        if (child.state === 3) try { await child.await() } catch (error) { failures.push(error.message) }
      }
      const expectsRoute = entry !== undefined && 'webServer' in inject
      if (entry && !expectsRoute) {
        assert(failures.some(message => message.includes('webServer')))
        assert.equal(routes.has('/memory'), false)
      } else {
        assert.deepEqual(failures, [])
        assert.equal(routes.has('/memory'), expectsRoute)
      }
      assert(ctx.get('memoryStore'), 'MemoryStore must load even without Web')
      await fiber.dispose()
      assert.equal(routes.has('/memory'), false, 'RPC route must be disposed with the plugin')
      console.log(`${label}: passed`)
    } finally {
      await ctx.fiber.dispose()
    }
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}
