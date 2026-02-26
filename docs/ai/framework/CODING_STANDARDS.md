# Coding Standards (Framework)

## Import Boundaries

1. Cross-package imports
- Always use `@asyra/package-name`.
- Never use deep relative imports across packages.

2. Same-package imports
- Use relative imports.

3. App-level dependency rule
- App code should call framework via exposed APIs (`core` and app wrappers).
- Prefer `@asyra/core` facade re-exports for common feature/input helpers when available.
- Avoid direct manipulation of package internals.

## Registry and Extension Standards

- Prefer shared registry utility for map-like register/get/has/unregister behavior.
- Registry names must reflect ownership, not UI assumptions.
- If behavior is package-specific, wrap shared utility rather than forking patterns.

## State and Mutation Standards

- Mutations with data changes must be transaction-bounded.
- Getter paths should not mutate state.
- Validation belongs to system layer, not UI-only handlers.
- Prefer one API boundary per concern (feature -> app/common API -> framework package API).

## Validation Standards

- Runtime `set/update`: valid -> write, invalid -> reject.
- Load path: invalid -> fallback to defaults/initialized value.
- Keep validation simple and explicit.

## Render and UI Standards

- Render engine abstractions stay in `@asyra/render`.
- UI and render are outputs of data/system state updates, not authoritative sources.

## Documentation Standards

- Every architectural rule must have one source-of-truth doc in this folder.
- Plans are concrete and implementation-ready after implementation is accepted.
- Use consistent naming: Asyra (framework), Asyra Design (reference app).

## Generated Output Standards

- Treat `create-app/*` as generated output, not primary source code.
- Do not apply manual feature/refactor fixes directly in `create-app/*`.
- Make changes in source locations (`packages/*`, `apps/*`, and generation scripts), then regenerate.
