# Host and Client foundation

## Problem

The first implementation needed to prove that a standalone DSH Bundle can own durable Markdown memory, expose model-facing behavior in Headless, and add a management surface in Web without binding storage semantics to either Consumer.

## Decision

Build the first vertical slice around a Host `MemoryStore` Service. The Host entry mounts dynamic prompt context and `memory_update` through optional Cordis inject fibers, and mounts a dedicated Connection RPC channel only when Web provides `connection`. The Browser entry registers an independent Settings section, gates Memory operations on `connection.isLoopback`, and parses every Host response again.

The first UI milestone implements Status and Global editing. Workspaces and Sessions retain visible navigation seats but do not claim functional data flows until their Host endpoints and lifecycle tests exist.

## Alternatives considered

- Direct file access from the Browser was rejected because Browser and Host are separate runtimes and the Browser must not receive filesystem authority.
- A Typert `/api` Remote was rejected because it would expose memory administration through the shared Gateway surface instead of a dedicated channel the Browser gates on loopback.
- Building Session consolidation before the online read/write path was rejected because it would introduce a second writer before revision, validation, and index publication were proven.

## Consequences

Headless can use memory without loading Web services. Web administration shares the same storage invariants as the model tool. The repository already has a useful, testable slice, but its README and UI must continue to mark Workspace management and Session consolidation as incomplete until their real flows land.
