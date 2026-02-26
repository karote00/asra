# Constraints and Limitations

## Current Hard Constraints

1. Render engine coupling boundary
- Only `@asyra/render` can import Pixi.

2. UI-context scope
- Convenience layer only.
- Consumers may bypass and aggregate on their own.

3. Transaction expectations
- Data-changing APIs should be transaction-bounded.

4. Feature decision runtime
- Feature-system is primary runtime for execute/session flow.

5. Deprecated runtime path
- `@asyra/interaction-core` is compatibility-only and should not receive new runtime flows.

## Current Functional Limitations

1. Auto-layout
- Not implemented yet.
- Unit conversion hooks are preparatory only.

2. Engine portability
- API contracts are engine-agnostic, but only Pixi implementation is mature.

3. Validation diagnostics
- Package validation is active, and core can emit cross-package load diagnostics via hook.
- Diagnostics are non-blocking and focused on load-time fallback/reject visibility.

4. Registry consistency
- Shared registry utility exists; some specialized registries may still require local behavior wrappers.

5. Package coverage depth
- Some package docs are evolving while framework contracts stabilize.
- Use package files in `docs/ai/framework/packages/*` as the active reference set.

6. Preset bootstrap requirement
- Default builtins are not implicitly registered by core.
- Consumers must explicitly apply `@asyra/preset` when default framework registrations are required.

## Documentation Rule

- `docs/ai/framework/*` is the framework source-of-truth.
