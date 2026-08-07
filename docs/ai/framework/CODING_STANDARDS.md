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
- Duplicate keys are not allowed for `register(...)` flows.
- Use shared `MapRegistry.register(...)` and fail fast on duplicate keys with explicit error messages.
- For bounded extension targets, use `ExtensionRegistry` rather than ad-hoc
  arrays or override flags. Declare supported strategies explicitly, return a
  cleanup function from every installer, and preserve the public structured
  error/result contract.
- `ExtensionRegistry` is package-author additive composition only
  (`before`/`after`/`append`). App-facing registration composition does not use
  a replace strategy; it uses explicit relation removal or capability
  unregister followed by ordinary definition.

## State and Mutation Standards

- Mutations with data changes must be transaction-bounded.
- Getter paths should not mutate state.
- Validation belongs to system layer, not UI-only handlers.
- Prefer one API boundary per concern (feature -> app/common API -> framework package API).
- Do not keep pre-release legacy mutation or render branches as product fallbacks; remove or migrate them per `rules/pre-release-legacy-removal.md`.

## Validation Standards

- Runtime `set/update`: valid -> write, invalid -> reject.
- Load path: invalid -> fallback to defaults/initialized value.
- Keep validation simple and explicit.

## Schema and Naming Standards

- Before adding a new data type or property key, check existing shared contracts first (`@asyra/utils` and existing package/app types) and reuse when equivalent.
- For persisted or frequently-updated model data, prefer compact property keys by default to reduce payload size.
- Use longer, descriptive names only when contract readability/interoperability clearly requires it.
- If external readability requires long names, prefer adapter/alias layers instead of expanding persisted core schema keys.

## Code Readability Standards

- Use `return` for an empty early exit when the function contract permits
  `undefined`; do not spell the statement as `return undefined`.
- Keep an explicit `undefined` only where an expression or data value is
  required, such as a property value, conditional expression, or returned
  object field.
- A conditional expression must contain only one ternary level. Never place a
  ternary inside another ternary's true or false branch.
- Express multi-branch decisions with a named value and independent `if`
  statements, an explicit `if`/`else` flow, or a focused helper so each
  condition remains directly readable.
- Root and generated-app ESLint configurations enforce this contract with
  `no-nested-ternary`.

## Render and UI Standards

- Framework render orchestration and state synchronization stay in
  `@asyra/render`.
- Engine-neutral lifecycle, command, query, handle, resource, capability,
  event, and error contracts stay in `@asyra/render-engine`.
- Pixi imports and concrete SDK behavior stay in
  `@asyra/render-engine-pixi`; it must not import `@asyra/render`.
- Concrete engines and `@asyra/render` meet only through
  `@asyra/render-engine`.
- UI and render are outputs of data/system state updates, not authoritative sources.

## App Runtime Boundary

- Production apps use Core as the entry for framework runtime capabilities
  whose lifecycle, transaction, or projection is Core-coordinated.
- Consumer-side adapters may import the side-effect-free
  `@asyra/core/contracts` subpath for public contract values and types only;
  that subpath is not a runtime facade. An app backend that requires framework
  independence owns its wire contract and must not import this subpath.
- `core.deps` is compatibility state, not an App API.
- Do not import Factory, Feature System, Input System, Reactive Events, or
  Render singletons from production App code when Core owns the lifecycle or
  exposes a facade. Add the smallest Core facade when one is missing.
- Independently composed packages may remain direct App dependencies for their
  own Provider/wire/policy contracts. If their runtime participates in Core
  startup, register a neutral lifecycle with Core rather than bypassing it.

## Test Placement Standards

- Unit, integration, and contract test files must live in a `__tests__`
  directory at the same directory level as the source or contract area they
  verify.
- Do not place `*.test.*` or `*.spec.*` files directly beside production or
  contract files.
- Dedicated Playwright suites are the exception: their `*.spec.*` files remain
  in the app's `e2e` directory.
- `scripts/__tests__/test-file-placement.test.mjs` enforces this layout across
  the monorepo, including generated app templates.

## Documentation Standards

- Every architectural rule must have one source-of-truth doc in this folder.
- Plans are concrete and implementation-ready after implementation is accepted.
- Use consistent naming: Asyra (framework), Asyra Design (reference app).

## Generated Output Standards

- Treat `create-app/*` as generated output, not primary source code.
- Do not apply manual feature/refactor fixes directly in `create-app/*`.
- Make changes in source locations (`packages/*`, `apps/*`, and generation scripts), then regenerate.
