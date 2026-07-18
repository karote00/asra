# Package: @asyra/core

## Responsibility

System orchestrator and lifecycle coordinator.

## Owns

- framework startup and dependency wiring
- renderer/persistence integration entrypoints
- load/save hooks
- high-level API surface for apps
- curated facade re-exports for high-value helpers
- top-level registration entrypoints for framework extension
- request API composition across packages

## Must Not Own

- app-specific domain rules
- UI rendering details
- engine-specific graphics primitives
- concrete render-engine selection, capability inspection, or resources

## Extension Points

- register component definitions
- remove/define component-property and property-child relations
- define low-level property schema/runtime registrations and graph-aware full
  property capabilities
- define/query/unregister feature registrations
- register/unregister render strategies and UI properties
- query registration nodes, owners, and relations
- register render layers
- register/unregister event definitions and selection channels
- register render interaction targets + handlers
- register render YJS change observers (`name + channel + onChange`)
- register/query/unregister shared data channels through the injected Factory
- register UI/system managed properties
- query and unregister managed properties during open composition
- register/query one render-engine provider before startup
- register load/save hooks
- register load diagnostics hooks (with disposer return for app-level unsubscribe)

## API Tier Contract

- `CoreBasicAPIs` are concrete, always-available core facade methods and must not rely on optional registration checks.
- `CoreExtensionAPIs` are concrete registration/bridge APIs exposed by core for package/preset/app extensions.
- `CoreConcreteAPIs = CoreBasicAPIs + CoreExtensionAPIs`.
- `CorePresetInstallAPIs` is the strict preset-facing subset used by
  `@asyra/preset` composition installation.

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
  persistence load, Feature initialization, and ready publication
- with the Core-owned adapter only, normalize the exact missing-provider error
  to headless startup: no canvas/input surface, but observers, persistence load,
  Feature initialization, and ready still complete
- reject provider callback, invalid-engine, capability, engine initialization,
  and advanced-renderer failures without initializing later phases or
  publishing false ready
- remain unaware of concrete engine instances, capabilities, and resources
- permanently close registration composition at the first `start(...)` method
  entry, even if renderer initialization later rejects
- validate every declared registration relation before renderer side effects
- `destroyRenderer()` delegates teardown and never reopens composition

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
- default shared data-channel registration lifecycle is preset-owned
  (core/factory provide register/unregister APIs only)
- the strict preset install tier includes owner cleanup façades for events,
  selections, render layers, and data-channel observers; Core coordinates these
  calls but does not own preset lifetime policy

3. Load/save contract

- load: app migration hooks -> package validation/fallback -> apply state
- `registerLoadHook` pipeline runs for both persistence load and `core.load(...)`
- package validators (`props-manager`, `scene-tree`, `system-context`) run before state apply
- diagnostics hooks receive non-blocking validation warnings after apply
- save: collect package states -> compose persisted payload
- save payload may include optional `systemContext` managed-property snapshot
  - includes only managed properties registered with `runtime: false`

4. Transaction status contract

- each Core subscribes to the Factory instance injected into that Core, not to a
  global end-transaction event
- committed action, undo, and redo capture their provider and CoreRawData
  snapshot when the committed status arrives; provider writes then enter one
  serial persistence queue
- the captured snapshot is deeply detached before queueing; later mutations to
  nested runtime arrays/objects and references retained by save hooks cannot
  change queued provider input
- queued work writes the detached snapshot and never re-reads later committed
  state or an active uncommitted preview
- missing provider reports `persistence-skipped`; successful save reports
  `persisted`; provider failure reports `persistence-failed`
- discarded, rolled-back, and rollback-failed outcomes never request save
- persistence failure does not roll back committed runtime state and does not
  block later queued saves; Core provides no automatic retry policy

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
- Child-property edits that must refresh computed/render state should go through core props bridge APIs (`updatePropertyById` + `commitPropertyChanges`) with owner metadata rather than rewriting parent computed arrays in app code.
- Core/scene-tree bridge rule: scene-tree recompute should react to committed props transactions, not be manually duplicated in app handlers.
- Cross-cutting domain logic belongs in app/common APIs, not core.

## Validation Checklist

- Core initialization works without UI framework assumptions.
- Real renderer/engine failure does not initialize observers/features or publish
  ready; missing provider alone completes the documented headless Core path.
- Core source contains no Pixi or concrete engine dependency.
- The optional Canvas Pipeline Debugger uses only the Core facade and
  engine-neutral Render subpath; no concrete engine or product-state write is
  introduced.
- Preset/default registrations are explicit via `@asyra/preset`, not implicit core side effects.
- Load/save flow executes in documented order.
