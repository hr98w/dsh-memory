# Consolidation model selection

## Problem

The dedicated consolidation worker needs a user-selectable model, but dsh-memory must not duplicate Provider credentials or invent a second model registry. A configured route can also disappear after a DSH profile change, so free-form provider/model fields would permit invalid selections.

## Decision

Add a fourth Memory Settings tab named Model. The Host projects active providers and their text-capable models from the DSH LLM service, and the Browser selects only values returned by that catalog. API keys and Provider activation remain exclusively managed by DSH's Models page.

Persist only the selected provider and model in `$DSH_HOME/memory/settings.yml`. The settings file has a closed schema, revision-derived CAS, and atomic replacement. A successful selection updates the live consolidation worker for subsequent attempts; an attempt snapshots its route before starting.

Expose the catalog and mutation through runtime-validated `models/read` and `models/select` Connection RPC endpoints; the Settings surface disables them when the page is not loopback. The Host rechecks that a selected route is active before committing it.

## Alternatives considered

- Read DSH configuration files or environment variables directly. This couples the plugin to credential storage and profile internals.
- Add API-key inputs to the Memory page. This duplicates ownership of secrets and creates a second configuration source.
- Let users type arbitrary provider/model ids. This provides poor feedback and postpones simple validation until a costly attempt.
- Always inherit the current interactive Agent model. Consolidation cost and behavior would then vary implicitly between Sessions.

## Consequences

- The list follows the active DSH model catalog without exposing credentials.
- Model selection is plugin-owned configuration, not authoritative memory Markdown or model-visible context.
- If the saved route later becomes unavailable, it remains visible as the current selection but cannot be newly saved until the user chooses an active route.
- Existing attempts and receipts retain their captured provider/model identity; changing the setting affects only later attempts.
