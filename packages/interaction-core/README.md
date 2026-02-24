# @asyra/interaction-core

Deprecated compatibility package.

## Status

- Deprecated / compatibility-only
- No new runtime flow should be added here

## Migration Target

Use `@asyra/feature-system` as the runtime owner for:

- execution flow
- session lifecycle (`start/update/end/cancel`)
- priority/exclusive feature orchestration

## Notes

- This package can still exist for compatibility while migration completes.
- It emits a runtime warn-once message when initialized.
