# Optional consolidation debug logging

## Problem

Detailed JSONL diagnostics were written for every consolidation attempt. They are valuable while diagnosing Provider and worker failures, but ordinary users do not need the extra files or error stacks. The Memory Model tab also needed to become a broader settings surface for future consolidation preferences.

## Decision

Rename the Browser tab to Settings and persist a `debug` boolean beside the consolidation model route in plugin-owned `settings.yml`. Debug logging is disabled by default and applies to new attempts. When disabled, the debug Consumer performs no directory or file write; receipts and replayable worker Sessions remain unchanged.

Keep format-1 settings readable and interpret their missing debug field as disabled. New commits write format 2 and remain revision checked. The existing Connection settings mutation validates the boolean at runtime and can change Debug without requiring the DSH model catalog when the model route itself is unchanged.

Only show a debug path for an attempt whose response says logging was enabled. Do not keep debug paths on every historical Session card.

## Alternatives considered

- Always write logs and only hide their paths. This does not reduce disk use or the amount of retained operational detail.
- Delete logs automatically when the switch is turned off. This would be destructive and could remove evidence the user still needs.
- Put the switch in DSH's global settings. The behavior and files belong specifically to dsh-memory.

## Consequences

- Ordinary consolidation creates receipts and worker Sessions but no debug JSONL files by default.
- Users must enable detailed logging before reproducing a failure they want to inspect.
- Existing debug files are preserved and can still be opened manually.
- `settings.yml` now carries a format-2 schema while retaining a deterministic migration path from format 1.
