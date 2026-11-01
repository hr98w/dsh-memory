/** Minimal DSH Host service faces consumed by this out-of-tree plugin. */

import type { MemoryRpcResult } from './protocol.ts'
import type { ConsolidationWorkerAgents, ConsolidationWorkerSessions } from './consolidation-worker.ts'
import type { MemoryLlmCatalog } from './consolidation-settings.ts'
import type { MemoryWorkspaceRegistry } from './consolidation-workspace.ts'

/** Current Agent identity made available to prompt and tool execution. */
export interface MemoryAgent {
  readonly session: { readonly header: { readonly cwd?: string } }
}

/** Prompt assembly context extended by dsh-agent. */
export interface MemoryAssembleContext {
  readonly agent?: MemoryAgent
}

/** Dynamic prompt registry used by dsh-memory. */
export interface MemorySystemPrompt {
  section(input: { name: string; order: number; text: string }): () => void
  context(input: { name: string; order: number; text: (context: MemoryAssembleContext) => string }): () => void
}

/** Tool execution context fields used to resolve the current Workspace. */
export interface MemoryToolExecution {
  readonly agent?: MemoryAgent
}

/** Tool registry used by the model-facing mutation Consumer. */
export interface MemoryToolRegistry {
  register(definition: unknown): () => void
}

/** Dedicated logical RPC registrar provided by dsh-client-connection. */
export interface MemoryHostConnection {
  readonly rpc: {
    handle(
      channel: string,
      handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<MemoryRpcResult<unknown>>,
    ): () => Promise<void>
  }
}

/** Lightweight persistence metadata used to discover consolidation candidates. */
export interface MemorySessionSnapshot {
  readonly header: {
    readonly id: string
    readonly createdAt: number
    readonly cwd?: string
  }
  readonly revision: string
}

/** Backend-neutral SessionPersistence face used by the candidate catalog. */
export interface MemorySessionSnapshotPersistence {
  listSnapshots(signal?: AbortSignal): Promise<MemorySessionSnapshot[]>
}

/** Client-visible Session projection cut used for zero-log-read list decoration. */
export interface MemorySessionProjectionSnapshot {
  readonly values: Readonly<Record<string, unknown>>
}

/** Live Session projection registry face used by the candidate catalog. */
export interface MemorySessionProjections {
  snapshot(session: unknown): MemorySessionProjectionSnapshot
}

/** Durable cold Session projection cache face used by the candidate catalog. */
export interface MemorySessionProjectionCache {
  cachedSnapshot(header: MemorySessionSnapshot['header']): MemorySessionProjectionSnapshot | undefined
}

/** Immutable logical Session view returned by the persistence service. */
export interface MemorySessionInspection {
  readonly meta: MemorySessionSnapshot['header']
  readonly events: readonly unknown[]
}

/** Backend-neutral persistence face required by Session consolidation. */
export interface MemorySessionPersistence extends MemorySessionSnapshotPersistence {
  inspect(id: string, signal?: AbortSignal): Promise<MemorySessionInspection>
}

/** Handle-based SessionPersistence face exposed by newer DSH Hosts. */
export interface MemoryHandleSessionPersistence {
  list(options?: { signal?: AbortSignal }): Promise<readonly MemorySessionSnapshot[]>
  open(id: string, access: 'read', options?: { signal?: AbortSignal }): Promise<{
    readonly header: MemorySessionSnapshot['header']
    read(offset?: number, length?: number, options?: { signal?: AbortSignal }): Promise<{
      readonly events: readonly unknown[]
    }>
    close(): Promise<void>
  }>
}

/** Live Agent lookup used to exclude sessions that are still running. */
export interface MemoryAgentRegistry {
  get(id: string): { readonly session?: unknown } | undefined
}

/** Agent registry face shared by candidate discovery and the consolidation worker. */
export type MemoryConsolidationAgents = MemoryAgentRegistry & ConsolidationWorkerAgents

declare module '@deepseek-ai/cordis' {
  interface Context {
    memoryStore: import('./memory-store.ts').MarkdownMemoryStore
    systemPrompt: MemorySystemPrompt
    tools: MemoryToolRegistry
    connection: MemoryHostConnection
    sessionPersistence: MemorySessionPersistence | MemoryHandleSessionPersistence
    agents: MemoryConsolidationAgents
    sessions: ConsolidationWorkerSessions
    llm: MemoryLlmCatalog
    sessionProjections: MemorySessionProjections
    sessionProjectionCache: MemorySessionProjectionCache
    workspaceRegistry: MemoryWorkspaceRegistry
  }
}
