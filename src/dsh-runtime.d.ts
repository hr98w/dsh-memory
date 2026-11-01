declare module '@deepseek-ai/dsh-agent' {
  export function installModelSelection(context: unknown): () => void
}

declare module '@deepseek-ai/dsh-llm' {
  export function createUserMessage(input: {
    content: Array<{ type: 'text'; text: string }>
    source: { kind: 'plugin'; plugin: string }
  }): unknown
}

declare module '@deepseek-ai/dsh-session' {
  export type SessionId = string & { readonly __sessionId: unique symbol }
  export function SessionId(value: string): SessionId
  export function foldSurface(events: readonly unknown[]): { nodes: number[] }
}

declare module '@deepseek-ai/schemastery' {
  interface Schema {
    default(value: unknown): Schema
    min(value: number): Schema
    step(value: number): Schema
  }

  const z: {
    object(shape: Record<string, Schema>): Schema
    string(): Schema
    number(): Schema
  }

  export default z
}
