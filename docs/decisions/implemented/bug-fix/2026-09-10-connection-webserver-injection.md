# Restore the standard Web Connection provider dependencies

## Problem

The current DSH Web bundle composes the standard `connection` row with `inject: [webStartup]`: that row evaluates its `trustedHosts` config from `webStartup`. The Connection module itself declares only `credentials`, while generic `connection.rpc.handle()` still reads `webServer` through the provider context to register an HTTP route.

The v0.1.4 Bundle override set the row's entry-level `inject` to `[webRuntime, webServer]`. Current DSH no longer provides `webRuntime`, so Connection waits for a missing service and the Web startup aborts with `connection (required) missing webRuntime`. The same override also dropped `webStartup`, so the row config could not be evaluated. Removing the override entirely keeps Web booting but leaves the memory RPC child failing with `cannot get property "webServer" without inject`; unmatched POST requests then reach the static fallback and return HTTP 405.

Root-provided service mocks hide the registration failure. The reproduction requires sibling provider plugins and explicitly awaiting failed child fibers, not just the parent entry.

## Decision

Keep a Bundle override guarded by both the standard `connection` id and `@deepseek-ai/dsh-client-connection` package name, with entry-level `inject: [webStartup, webServer]`: retain the config service the current row needs and restore HTTP registration access. Loader still merges module-level dependencies such as `credentials`. Do not modify DSH source, user configuration, authentication, RPC envelopes, or memory semantics.

Adapt the affected Host APIs to their current shapes: `connection.rpc.handle(channel, handler)` has no per-channel authority argument, so the memory channel inherits Connection's standard Host/Origin and browser-auth fence; the Browser surface still gates Memory operations on `connection.isLoopback`. `installModelSelection(agentCtx)` takes only the Agent context and reads the step selection from DSH.

Keep a Cordis regression test and a separate real-DSH source-checkout check using the shipped YAML, official patch algorithm, actual `HostConnectionService`, and built memory entry. Cover missing/mismatched targets, credentials/config preservation, failing unpatched registration, successful patched registration, disposal, and Headless loading.

## Alternatives considered

- Adding `webServer` only to the memory consumer does not repair the provider-context access.
- Removing the Bundle override leaves generic registration broken under the current DSH baseline.
- Direct HTTP registration would duplicate transport and security responsibilities.
- An upstream fix is preferable long-term, but this repair must stay within this repository.

## Consequences

Restart Web to recompose the Bundle. A Headless composition without Connection emits a skipped-patch warning but gains no Web dependency. This workaround targets the standard Web row; a renamed row is not patched. Because entry `inject` is replaced, deployments with custom extra dependencies must retain them in a later user patch. The real-DSH check pins the patched `inject` to the current web-bundle dependencies plus `webServer`, so a future bundle dependency change fails the check instead of being silently dropped.

Remove the override once the supported DSH baseline fixes generic registration ownership and passes the same sibling-provider regression. Keep using the host's existing authentication and admission policy; the plugin does not add a separate loopback check or change older host interpretations of an authority option.
