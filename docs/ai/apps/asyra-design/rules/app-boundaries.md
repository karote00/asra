# Rule: App Boundaries

## Feature Boundary

- Features should orchestrate behavior, not own low-level data internals.
- Reusable logic belongs in `src/common-apis/*`.

## API Boundary

- UI components and feature handlers should prefer controllers/common APIs for writes.
- Keep write paths centralized to reduce duplicate mutation logic.

## Framework Boundary

### Core is the App runtime entry

- Production App code uses `@asyra/core` or the App's default Core context as
  the only entry to framework-owned runtime and lifecycle capabilities.
- Frontend adapters that only need public event, publication, or collaboration
  contract types may import `@asyra/core/contracts`. This side-effect-free
  subpath does not instantiate Core, Input System, or Render, and does not
  authorize runtime access around Core.
- `core.deps` is an internal/compatibility dependency container, not an App
  API. App code must not read or mutate it.
- Factory, Feature System, Input System, Reactive Events, Render runtime
  singletons, and other capabilities whose startup, transaction, projection,
  or teardown is coordinated by Core must be reached through a Core facade.
- If a required facade is missing, add the smallest owner-aligned Core facade;
  do not bypass Core by importing or exposing the package singleton.
- `@asyra/collaboration` remains independently composable for Provider, wire,
  transport, and App policy types. A collaboration session that participates
  in framework startup must register its neutral lifecycle with Core; Core
  owns prepare -> load -> feature initialization -> activation -> ready and
  collaboration-before-renderer teardown ordering.
- Package-level integration tests may declare an owner package as an explicit
  dev dependency. That exception does not authorize production App imports or
  runtime dependencies.
- `apps/asyra-design/__tests__/framework-runtime-boundary.test.mjs` is the
  executable production-import and dependency guard for this rule.

## Backend Boundary

- The App backend and socket server depend only on App-owned HTTP, WebSocket,
  document, and Agent protocols. They must not import any `@asyra/*` package,
  including type-only imports or `@asyra/core/contracts`.
- The frontend is the sole adapter between those App protocols and the
  framework. It subscribes to Core-provided publication/event surfaces and
  submits validated remote data only through Core facades.
- Backend sequencing, dedupe, authorization, model execution, document
  materialization, and storage remain App/backend responsibilities. They do not
  create a Core, call Factory, or participate in framework lifecycle.
- The boundary test also inspects collaboration-server and document-backend
  bundle module graphs so an App-owned shared module cannot pull framework code
  into a backend indirectly.

## Registry Boundary

- Official reusable UI/system properties belong to the responsible
  `@asyra/preset` default.
- App-only registrations belong to an explicit pre-start app composition
  module when needed; do not scatter them across feature or UI files.
