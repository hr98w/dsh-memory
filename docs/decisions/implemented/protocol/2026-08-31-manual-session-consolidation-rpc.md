# Manual Session consolidation RPC

## Problem

The Browser needs to start one consolidation attempt and show its durable result without receiving Host paths, Workspace keys, model routing, or mutable revision authority. The Host must also remain loadable when Web or Session services are absent.

## Decision

Expose `sessions/consolidate` on the existing `/memory` Connection channel. The Browser submits exactly one non-empty Session id, and the Host resolves all source and target state through `SessionPersistence`, the live Agent registry, and `MemoryStore`.

Assemble the runner only in an optional Cordis child fiber that requires `sessionPersistence`, `agents`, and `sessions`. The first version waits for one attempt and propagates the Connection abort signal instead of introducing a background job system. Its closed response contains only terminal state, recovery flag, review id, attempt number, and change count. Both Host and Browser parse request and response values at runtime.

The Session list exposes only a receipt status summary. It marks whether that receipt matches the current source revision so a Session with later messages remains eligible for a new review without exposing either revision.

## Alternatives considered

- Let the Browser provide cwd, Workspace id, or expected revisions. This would move scope authority across the trust boundary.
- Return complete receipts. They contain Host-only Workspace and model-routing metadata that the UI does not need.
- Start with a background job and polling endpoints. The first real usage has not shown that the synchronous Connection call is insufficient.
- Register the runner as a hard plugin dependency. That would break Headless and profiles without Session services.

## Consequences

- Manual consolidation remains Host-authoritative; the Settings surface enables it only on a loopback page, while the channel follows Connection admission.
- Missing Session services disable only consolidation while other Memory Consumers continue to load.
- A completed action can refresh the list and distinguish current-review results from receipts for an older Session revision.
- If real Web testing shows Connection timeouts are unsuitable, a later decision may replace the synchronous response with a Host-owned job protocol.
