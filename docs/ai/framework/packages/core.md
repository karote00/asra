# Package: @asyra/core

## Responsibility

System orchestrator and lifecycle coordinator.

## Owns

- framework startup and dependency wiring
- optional app-owned collaboration-session lifecycle ordering through a
  package-neutral bridge
- renderer/read-only load-source integration entrypoints
- load/save hooks
- high-level API surface for apps
- curated facade re-exports for high-value helpers
- top-level registration entrypoints for framework extension
- request API composition across packages
- ordered coordination of already validated canonical source changes through
  the existing Props and Scene Tree owner facades
- canonical vector model tokens, discriminant guards, generated-id ordering,
  control identifiers, point-target position projection, and segment-to-anchor
  handle reference lookup; editing and presentation policy remain outside Core

## Must Not Own

- app-specific domain rules
- UI rendering details
- engine-specific graphics primitives
- concrete render-engine selection, capability inspection, or resources
- Collaboration publications, transport framing, local/remote policy,
  transaction origin, or persistence policy

## Extension Points

- register component definitions
- remove/define component-property and property-child relations
- define low-level property schema/runtime registrations and graph-aware full
  property capabilities
- read and atomically redefine complete declarative property-type definitions
  during open composition
- define/query/unregister feature registrations
- register/unregister render strategies and UI properties
- query registration nodes, owners, and relations
- register render layers
  - `RenderLayerRegistration` remains Render-owned; Core exposes the canonical
    `RegisterRenderLayer` facade callback and its override options
- register/unregister event definitions and selection channels
- register render interaction targets + handlers
- register shared-change observers with exactly one delivery mode
  (`name + channel + onChange` or `name + channel + onBatch`)
- register/query/unregister shared data channels through the injected Factory
- create fresh delivery-only local shared channels without a Y.Doc
- register UI/system managed properties
- query and unregister managed properties during open composition
- register/query one render-engine provider before startup
- register load/save hooks
- register load diagnostics hooks (with disposer return for app-level unsubscribe)
- register one optional app-owned collaboration session before startup
- register App key combinations and expose detached state/render/publication
  queries without exposing the dependency container
- expose `getCanonicalElementCount()` as the exact O(1) canonical registry
  count excluding workspace roots; diagnostics and heartbeats must use it
  instead of serializing the document or every element
- apply App-validated remote canonical slices through the injected Factory's
  remote transaction and replay owner

## API Tier Contract

- `@asyra/core/contracts` is the consumer-side, side-effect-free contract
  subpath for public events, shared-publication types, collaboration bridge
  types, and canonical property/update types. It exports no default Core
  singleton and does not instantiate Core, Input System, or Render. It does not
  make a product backend part of the framework; an independent backend owns its
  App wire contract and imports no Core surface.
- `CoreBasicAPIs` are concrete, always-available core facade methods and must not rely on optional registration checks.
- `CoreExtensionAPIs` are concrete registration/bridge APIs exposed by core for package/preset/app extensions.
- `CoreConcreteAPIs = CoreBasicAPIs + CoreExtensionAPIs`.
- `CorePresetInstallAPIs` is the strict preset-facing subset used by
  `@asyra/preset` composition installation.
- `applyCanonicalChanges(changes)` is the origin-neutral coordination facade
  for one already validated ordered canonical request. Its caller owns the one
  enclosing Factory transaction. It accepts no origin, transport, suppression,
  publication, receipt, profiling, or compatibility options.

## Instance Contract

- The package exports a default `core` instance for the common shared-runtime
  path and exports the `Core` class for consumer-owned composition.
- Consumers may isolate only the package instances they need; an all-package
  runtime container is not required.
- A custom `Core` instance must receive and consistently use the intended
  package instances and instance-bound subscription wiring.
- Shared-channel access and data-channel observer activation are owned by that
  Core's injected Factory. Different Core instances may register the same
  observer name without sharing registrations or cleanup state.
- Default singleton imports intentionally share state and subscriptions.

## Complete Runtime Handoff

`preflightLoad(data)` checks a detached target against the current trusted
composition before retirement. It shares ordinary load's synchronous migration,
normalization, schema, hierarchy and relation checks, returning detached readonly
diagnostics without package apply, version/history changes or load/diagnostic
notifications. Null remains a no-op. This is not a transferable prepared artifact
or a sandbox for hooks; trusted hooks must be pure deterministic migrations.
The successor installs the same trusted modules and validates again on load.

`resetRuntime(): Promise<Core>` terminates an exclusive Framework runtime and
returns a fresh, unstarted Core. It never reopens the old composition. Ordinary
`load()` remains canonical replacement with existing history; `destroy()` keeps
its compatibility behavior. The App stops admission, captures detached recovery
data and calls reset outside its old Feature interaction queue. In-progress
startup rejects before retirement. Repeated accepted reset calls share one
terminal result. A reset of the default Core updates the live default export
only after success; App callbacks must retain their own generation's Core.

Core closes Feature work and collaboration, awaits actual work settlement,
retires its observer/event ownership, then coordinates Input, instance/shared
Render, Factory, Scene Tree, Props, Selection, System/UI Context and registration
cleanup through public owner APIs. It awaits all retained composition cleanup
before beginning shared wiring and constructing the successor. The first failed
phase prevents handoff and throws `CoreRuntimeResetError` with `phase` and `cause`.
An uncooperative Promise cannot be declared terminated by a timeout.

`getRuntimeState()` reports `active`, `quiescing`, `retiring`, `retired` or
`failed`. Settling work may use Core during quiescence. Retired facade calls and
old Feature methods reject with `CoreRuntimeClosedError`; retained cleanup
handles cannot delete successor registrations. Observer bindings preserve
original payload/batch identity and active delivery order, not internal wrapper
function identity. This does not isolate concurrent Core runtimes or sandbox
code that retained raw package references.

`registerRuntimeCleanup(key, cleanup)` retains a unique composition-owned
synchronous or asynchronous resource cleanup; its returned handle removes only
that registration. After canonical retirement, these callbacks may inspect
registration state and release remaining bindings, not create canonical work or
reopen composition. Every registered callback is attempted before reporting
failure. `CorePresetInstallAPIs` exposes this capability optionally for older
composition adapters; only integrations that register all owned cleanup support
complete runtime replacement.

## Runtime Contracts

1. Startup contract

- a `PresetApplyResult` only means pre-start preset application succeeded; it
  does not close composition, initialize runtime, or publish ready
- Core constructs and owns an engine-neutral `RenderAdapter` by default;
  `setRenderer(...)` remains an advanced full-renderer replacement API
- `setRenderEngineProvider(...)` stores exactly one pre-start provider through
  the Core-bound Render instance without invoking it
- call the Core-owned or advanced renderer exactly once with the host container and
  engine-neutral `RenderOptions`
- complete renderer/engine initialization before data-channel observers,
  read-only source load, Feature initialization, and ready publication
- when an app registers a collaboration session, call its `prepare(bridge)`
  before renderer initialization, prefer its returned read-only checkpoint
  source for this startup, activate it after Feature initialization, and publish
  ready only after activation settles
- with the Core-owned adapter only, normalize the exact missing-provider error
  to the existing no-canvas compatibility path: no canvas/input surface, but
  observers, persistence load, Feature initialization, and ready still complete;
  this remains `core.start(container, options)` and is not a public Headless
  Core/Core Kernel lifecycle
- reject provider callback, invalid-engine, capability, engine initialization,
  and advanced-renderer failures without initializing later phases or
  publishing false ready
- remain unaware of concrete engine instances, capabilities, and resources
- `resizeRenderer(width, height)` is a basic facade that rejects nonfinite or
  nonpositive dimensions before forwarding to the active `IRenderer.resize`;
  it works for the Core-owned adapter or an advanced renderer without changing
  model data, composition locks, or camera policy. Apps own host measurement;
  renderer owners retain lifecycle and resize execution failures
- a successful `setSystemProperty(...)` delegates the state update to System
  Context and requests one ordinary frame from the Core-bound Render instance;
  Core does not interpret the property or add a second projection path, and
  Render coalesces repeated requests before the next demanded frame
- permanently close registration composition at the first `start(...)` method
  entry, even if renderer initialization later rejects
- validate every declared registration relation before renderer side effects
- `destroy()` disposes the registered collaboration session before the
  renderer; `destroyRenderer()` remains a renderer-only compatibility surface.
  Neither reopens composition

2. Registration composition contract

- app customization remains outside preset and uses ordinary Core APIs after
  `applyPreset(...)` returns and before the first `start(...)`
- registration calls fail fast on duplicate identity; Core does not silently
  skip, overwrite, or infer replacement
- `RegistrationRelationError` carries stable structured codes for closed,
  missing, duplicate relation, active-use, dangling, and cleanup failures
- Core registration methods are public delegates to the feature/property owner;
  Core does not add duplicate tolerance, semantic-equivalence ordering, or app
  policy.
- `getPropertyTypeDefinition(type)` returns a deeply detached normalized
  config-mode definition without changing ownership or relations;
  `redefinePropertyType(type, updater)` synchronously rebuilds the complete
  definition through Props Manager, then transfers only graph owner metadata to
  `{ packageName: 'app', name: type }`
- declarative redefinition is available only before the first `start()` and
  rejects constructor-mode types, active/replay-retained instances, pending
  cleanup, identity changes, invalid definitions, or schema/runtime drift
- the successful metadata-only owner transfer preserves the registration node,
  handlers, resources, and all incoming/outgoing relations; startup rejects
  stale fixed component aliases or property-child keys before renderer effects
- `removeComponentPropertyRelation` and `removePropertyChildRelation` remove one
  edge and rebuild the source registration while preserving source/target nodes
- relation define preflight rejects pending source or target cleanup; remove
  rejects a pending source but may detach from a pending target, preserving the
  retry route and owner/graph atomicity before a package runtime owner rebuilds
- `unregisterPropertyRegistration(type, scope)` remains low-level schema/runtime
  cleanup; `unregisterPropertyType(type)` is the graph-aware full-capability API
- full property unregister refuses live or replay-retained instances, detaches
  structural sources, recursively unregisters declared hard sources, and
  reports removed relations/resources in `UnregisterRegistrationSuccess`
- package definitions may carry `registration.owner` and explicit
  `registration.relations`; omitted app owners use
  `{ packageName: 'app', name: registrationKey }`
- a component definition with an inline render strategy creates a separate
  render-strategy node related to the component with `unregister-source`, so
  full component unregister removes that owned strategy; an independently
  registered same-type strategy is not inferred to be component-owned
- feature removal disposes the feature owner's pending handlers and exact event
  subscriptions; an active feature must be ended before removal
- data-channel observer registration resolves shared data by channel name, not raw YJS object instances
- Core owns one observer registry per instance and activates it through the
  injected Factory; the default Core explicitly shares its registry with the
  standalone observer helpers, while custom Core registries remain isolated
- a batch observer receives each injected Factory delivery batch once, in
  original order, without Core expanding it into single-change callbacks;
  single-change observers retain the batch-of-one convenience path
- default shared data-channel registration lifecycle is preset-owned
  (core/factory provide register/unregister APIs only)
- the strict preset install tier includes owner cleanup façades for events,
  selections, render layers, and data-channel observers; Core coordinates these
  calls but does not own preset lifetime policy

3. Load/save contract

- load: app migration hooks -> package validation/fallback -> apply state
- `setLoadSource({ name, load })` configures the read-only startup input;
  `DocumentLoadSource` intentionally has no save or clear capability
- the deprecated `setPersistence(...)` compatibility surface delegates only to
  `setLoadSource(...)`; Core never calls its provider writer
- `registerLoadHook` pipeline runs for both load-source and `core.load(...)`
- the first registered hook receives the raw document before Core normalization;
  its input type is `unknown`, so app code owns narrowing and version
  eligibility; hooks remain synchronous, instance-local, and registration
  ordered
- Core snapshots the instance registry before each load; registration during a
  hook affects only later loads, never the in-flight chain
- every hook result must satisfy `VersionedLoadDocument` (a document object with
  a string version); package fields remain raw until the complete chain reaches
  owner validation. Promise and invalid results throw the stable Core-owned
  `LoadHookExecutionError`, and Core contains an eventual rejected Promise
  behind that single synchronous failure
- Core owns hook orchestration and result enforcement only. Apps own missing
  document eligibility plus one connected linear migration chain and its domain
  transforms. The app dispatcher follows matching current-version transitions;
  when no matching version exists, the document passes through unchanged and
  Core does not enforce an app target version
- an app helper may guard one non-empty dispatcher installation per Core
  instance, but that instance-local guard remains app-owned and is not a Core
  schema registry; empty batches install nothing
- package validators (`props-manager`, `scene-tree`, `system-context`) all
  complete before Core updates the document version or applies any package state
- each validator returns an owner-issued, instance-bound, one-shot artifact;
  Core returns the complete artifact to the same package apply facade, which
  rejects fabricated/foreign/reused artifacts and does not rerun validation
- any thrown package validator stops with no canonical version or package prefix
- diagnostics hooks receive independent detached validation warnings and
  detached post-apply load evidence assembled from normalized/validated apply
  inputs and applied managed-system serialization; that evidence is not a
  canonical state artifact or state owner, and one hook's mutation, disposal,
  or throw cannot change canonical state, load success, or later current hooks.
  Core assembles evidence only when diagnostics and an observer exist; assembly
  failure skips emission and preserves load success
- save: collect package states -> compose persisted payload
- explicit `core.save()` deeply detaches its input and result around registered
  save hooks; it performs no provider I/O and is not a durability acknowledgement
- save payload may include optional `systemContext` managed-property snapshot
  - includes only managed properties registered with `runtime: false`

4. Transaction status contract

- Core does not subscribe to Factory commit capture for persistence.
- Core does not build, deeply detach, queue, or provider-save `CoreRawData`
  merely because a transaction committed.
- Core does not translate file-scoped backend durability into Factory
  `persistence-*` transaction statuses.
- Core retains raw checkpoint migration, complete package
  validation/fallback, canonical load apply, diagnostics, and explicit detached
  serialization.
- Explicit serialization remains available for export/diagnostics/tests but is
  not a persistence acknowledgement and is never an automatic commit effect.
- Socket handshake, pending-tail recovery, sequence, batching, retry,
  materialization, and durable acknowledgement remain App/server owners.

The exact implementation boundary is Inspector step
`hydrate-core-checkpoint` in:
`../../apps/asyra-design/plans/socket-authoritative-document-persistence-flow-inspector.data.cjs`.

5. Selection transaction contract

- Core selection APIs record the reversible change and apply canonical
  SelectionManager state before the transaction boundary closes, so Factory
  validators observe the final selection rather than a delayed shared projection
- selection boundaries and replay use the Factory injected into that Core; the
  Factory's instance-local replay handler restores the injected SelectionManager
  for rollback, undo, and redo without requiring preset installation
- registration-driven selection channels install that replay owner and an
  explicit selection inverter for their actual event name before their first
  mutation; custom channels are not limited to preset selection event names
- consumer-owned Factory/Selection pairs do not replay selection into the
  default runtime or another custom runtime
- selection shared channels project canonical state to Render/UI; they do not
  own a second delayed canonical selection value

6. Optional Canvas Pipeline Debugger contract

- apps create a development runtime session only through
  `@asyra/core/canvas-pipeline-debugger` and pass the intended Core instance
- the optional facade binds that Core's Render instance; it never substitutes
  the default Core or exposes `core.deps` to the app
- one non-disposed debugger may own a Render instance; disable removes its
  observer and Core-registered overlay while preserving reads, and dispose
  clears data and releases the session slot
- hidden overlay state keeps trace observation active without a registered
  layer; all registration and cleanup use the Core render-layer facade
- an overlay projection failure is recorded through the Render debugger
  projector before Core marks the session disabled and runs asynchronous layer
  cleanup; Core does not assemble or own the snapshot fault model
- root `@asyra/core` does not import or re-export the optional implementation

## App-Level Usage Rules

- App should call framework via `core.xxx` and app-level wrappers.
- `core.deps` is deprecated compatibility state, not an App API. Factory,
  Feature System, Input System, Reactive Events, and Render runtime singletons
  must stay behind Core whenever Core owns their lifecycle or exposes a facade.
- If a needed App capability is missing, add the smallest owner-aligned Core
  facade instead of exporting or importing the underlying singleton.
- Independently composed Provider/wire/transport policy may use
  `@asyra/collaboration` directly. Its runtime session registers with Core when
  it participates in Core startup/load/ready/teardown.
- Preset/app composition should prefer the concrete Core instance registration
  facade. Apply defaults, remove/define exact relations, use
  `unregisterPropertyType` only for a complete capability, then call `start`.
- Complete implementation changes use explicit
  `unregister owner registration -> define/register app implementation`; Core
  exposes no replace operation.
- App feature modules may prefer `@asyra/core` helper re-exports
  (`defineFeature`, `getFeature`, `keyMap`) for the default shared-runtime path.
- App should not import package internals when core API exists.
- Preset/app code should consume render abstractions through `core.xxx` when
  Core exposes them. Normal app bootstrap does not construct a `RenderAdapter`;
  import one only for an advanced full-renderer replacement.
- source-space interaction coordinates use
  `elementSourceToWorkspace(...)` / `workspaceToElementSource(...)`. These
  facades preserve the last successfully projected strategy source origin
  together with the current Render transform, so an App does not mix pending
  source geometry with a previous Render frame.
- Canonical element-property edits go through the plural
  `updateElementProperties(...)` replacement API or
  `patchElementProperties(...)` record-delta API. Core first obtains one
  read-only `ResolvedElementPropertyTargets` result and one
  `PreparedPropertyMutationBatch`, then applies the Props-owned batch; callers
  do not run per-field update/commit loops.
- `createElementsInParent(...)` is the canonical plural creation facade.
  Core asks Props to prepare the complete owner-property batch, builds one
  owner-id relation index, asks Scene to prepare the complete insertion, then
  applies both owners. It never rescans the full relation list for each
  element; one-element creation delegates as batch-of-one.
- A caller that already owns detached canonical source evidence may submit one
  ordered `CanonicalChange[]` through `applyCanonicalChanges(...)`. The closed
  union covers property components, raw element data, hierarchy moves,
  subtree removal/restore, and canonical element creation/removal. Core
  preserves order and delegates to the existing owner APIs. One
  `property-components` change may combine ordered structural records and
  value updates in one Props-owned mutation batch. For `subtree-restore`, Core
  first requests Scene Tree's `pending-restore` preflight, then preflights and
  restores Props before Scene Tree applies and revalidates active property
  relations. Core does not parse `SharedPublication`, choose App policy, or
  open a second transaction.
- Core/Scene bridge rule: Scene recomputes local computed projection from
  committed source-property evidence; app handlers do not duplicate that
  projection or publish computed state as canonical data.
- Cross-cutting domain logic belongs in app/common APIs, not core.

## Declarative Property Type Redefinition

`getPropertyTypeDefinition()` and `redefinePropertyType()` are the pre-start
Core facade for reading and atomically redefining one config-mode property type.
Core coordinates the permanent composition lock, graph owner metadata,
preserved relations, and final structural validation while Props Manager
remains the schema/runtime rebuild owner.

The operation is a bounded declarative exception, not a general replace
strategy. Constructor-mode types retain unregister/define composition. Render
strategies, UI properties, relations, app commands, and load migrations remain
explicit ordinary app composition.

## Validation Checklist

- Core initialization works without UI framework assumptions.
- Real renderer/engine failure does not initialize observers/features or publish
  ready; missing provider alone completes the documented no-canvas compatibility
  path without creating a public Headless Core claim.
- Core source contains no Pixi or concrete engine dependency.
- The optional Canvas Pipeline Debugger uses only the Core facade and
  engine-neutral Render subpath; no concrete engine or product-state write is
  introduced.
- Preset/default registrations are explicit via `@asyra/preset`, not implicit core side effects.
- Load/save flow executes in documented order.
