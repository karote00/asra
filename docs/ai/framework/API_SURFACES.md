# Framework API Surfaces

This file is the fast API map for framework-level implementation requests.

## Core Facade (`@asyra/core`)

Primary import:

- `import core from '@asyra/core'`
- `import { defineFeature, getFeature, unregisterFeature, keyMap } from '@asyra/core'`

Core API tier types (explicit ownership contract):

- `CoreBasicAPIs`: always-concrete lifecycle/persistence facade methods on `core` (no registration prerequisite)
- `CoreExtensionAPIs`: registration/bridge APIs exposed by `core` for framework extension
- `CoreConcreteAPIs`: `CoreBasicAPIs + CoreExtensionAPIs`
- `CorePresetInstallAPIs`: strict subset required by `applyPreset(...)` (no optional `core?.api` checks)
- `CorePresetDependencies`: concrete dependency object returned by `core.getPresetDependencies()`

Lifecycle and integration:

- `setRenderer(renderer: IRenderer): void`
- `setPersistence(provider: IPersistenceProvider): void`
  - `IPersistenceProvider.load(): Promise<unknown | null>` returns raw input; a
    resolved `null` or `undefined` means no persisted document
- `definePropertyComponent(definition: PropertyComponentDefinition): PropertyComponentConstructor`
- `PropertyComponentDefinition` supports:
  - constructor mode: `{ type, constructor, options? }`
  - config mode: `{ type, defaults?, persistKeys?, valueKeys?, unitKeys?, allowDynamicKeys?, dynamicReservedKeys?, children?, options? }`
  - config defaults:
    - `persistKeys` defaults to `defaults` keys (plus `children.key` when provided)
    - `unitKeys` defaults to `persistKeys` keys ending with `Unit`
    - `valueKeys` defaults to `persistKeys - unitKeys`
  - design contract: property components should remain data-focused; app-level business behavior (auto-layout, unit-conversion workflows) belongs in app APIs/features.
- `unregisterPropertyComponent(type: string): boolean`
- `unregisterPropertyRegistration(type: string, scope?: 'all' | 'schema' | 'runtime'): PropertyRegistrationUnregisterResult`
  - removes the property schema and runtime constructor as one registration only
    when no live or replay-retained property instance still uses the type
  - returns `{ ok: false, code: 'PROPERTY_REGISTRATION_NOT_FOUND', ... }` for a
    missing type and throws `PropertyRegistrationError` with
    `PROPERTY_TYPE_IN_USE` before changing either registry when cleanup is unsafe
- `unregisterPropertyType(type: string): UnregisterRegistrationSuccess`
  - graph-aware full-capability removal; detaches structural dependents,
    recursively unregisters declared hard dependents, and cleans schema/runtime
    resources
- `getPropertyTypeDefinition<TFields>(type): Readonly<PropertyTypeDefinition<TFields>> | undefined`
  - returns a deeply detached, complete, normalized config-mode definition
    during open composition; a missing type returns `undefined`
- `redefinePropertyType<TFields>(type, updater): Readonly<PropertyTypeDefinition<TFields>>`
  - runs the updater synchronously with the complete detached definition,
    requires unchanged type identity, and returns the detached committed result
  - atomically rebuilds schema, runtime constructor/config, defaults,
    persistence keys, value projection, and unit projection through Props
    Manager, then transfers only graph owner metadata to the app
  - rejects constructor mode, active/replay-retained instances, pending cleanup,
    closed composition, schema/runtime drift, and invalid definitions without
    changing the prior definition, owner, or relations
  - startup rejects stale fixed component aliases and property-child keys;
    explicitly allowed dynamic aliases retain their dynamic-key policy
  - this is not a general registry replace path and does not rewrite relations,
    render strategies, UI properties, commands, or migrations
  - authority: `plans/completed/property-type-redefinition-plan.md`
- component relation APIs:
  - `defineComponent(definition: ComponentDefinition): void`
  - `unregisterComponent(type, options?): boolean | UnregisterComponentResult`
  - `defineComponentPropertyRelation(componentType, property): RelationOperationSuccess`
  - `removeComponentPropertyRelation(componentType, propertyName): RelationOperationSuccess`
  - `getComponentPropertyRelations(componentType): readonly ComponentPropertyRelationMetadata[]`
- property-child relation APIs:
  - `definePropertyChildRelation(parentType, relation): RelationOperationSuccess`
  - `removePropertyChildRelation(parentType, key): RelationOperationSuccess`
  - `getPropertyChildRelations(parentType): readonly PropertyChildRelationMetadata[]`
- opaque registration lifecycle:
  - `registerRenderStrategy(type, strategy, registration?): void`
  - `unregisterRenderStrategy(type): boolean`
  - `unregisterUIProperty(key): boolean`
  - an inline component `renderStrategy` receives its own render-strategy node
    and an `unregister-source` ownership relation to that component; a strategy
    registered separately remains independent
- graph metadata queries:
  - `getRegistration({ kind, key })`
  - `getRegistrations()`
  - `getRegistrationRelations()`
  - package definitions may declare optional `registration.owner` and
    `registration.relations`; ordinary app definitions may omit both and use
    `{ packageName: 'app', name: registrationKey }`
- all relation mutations and `unregisterPropertyType` are startup composition
  operations. The first `start()` call closes them permanently at method entry.
- relation definition rejects pending source or target cleanup before mutating
  a package runtime owner. Relation removal rejects a pending source but remains
  available to detach from a pending target for deterministic cleanup retry.
- `defineFeature(name, keyConfig, definition): { api: FeatureAPI; dispose: () => boolean }`
- `getFeature(name: string): FeatureAPI`
- `unregisterFeature(name: string): boolean`
  - unregister rejects an active feature with `FeatureUnregisterError` and
    otherwise removes its pending execution/session handlers plus owned input or
    reactive-event subscriptions
- `registerSaveHook(hook: SaveHook): void`
- `registerLoadHook(hook: LoadHook): void`
  - `LoadHook = (data: unknown) => VersionedLoadDocument`; app code narrows raw
    input and returns an object with a string `version`
  - hooks are instance-local and run synchronously in registration order
  - Core snapshots the registration chain at load start; hooks registered while
    it runs become eligible on the next load
  - the first hook receives the unnormalized raw document; later hooks receive
    only the previous successful result
  - each result must be a non-array `VersionedLoadDocument`; package fields
    remain subject to later package-owner validation
  - Promise results throw `LoadHookExecutionError` with
    `ASYNC_UNSUPPORTED` while Core contains an eventual rejection; other invalid
    results use `INVALID_RESULT`
  - app migration composition validates one connected linear migration chain
    and exposes it as one conditional dispatcher hook; the dispatcher follows
    the current version until no matching version remains, then passes that
    document through
  - one app helper module installs at most one non-empty dispatcher per Core
    instance; its app-owned installation guard remains isolated across Core
    instances and empty batches do not claim the slot
  - Core does not infer app version history, enforce an app target version, or
    invoke every registered transform as a fixed queue
- `registerLoadDiagnosticsHook(hook: LoadDiagnosticsHook): () => void` (returns disposer/unsubscribe)
  - runs only after successful canonical apply and only when diagnostics exist
  - every hook receives its own detached diagnostics and detached post-apply
    load evidence assembled from the normalized version, validated package
    apply inputs, and applied managed-system serialization; it is not a
    canonical state artifact or state owner
  - Core assembles evidence only when diagnostics and an observer exist;
    assembly failure skips emission without changing successful load outcome
  - mutation, disposal, or throw from one hook cannot change canonical state,
    the successful load outcome, or later hooks in the current emission
- `start(container: HTMLElement, renderOptions: RenderOptions): Promise<void>`
- `load(data: unknown): void`
  - treats every non-nullish input as raw document evidence for the app hook
    chain; direct `null` or `undefined` is the no-document bypass
  - runs the same synchronous hook/validation/apply path as provider-backed load
  - obtains Props Manager, Scene Tree, and System Context validation/fallback
    results before updating `core.version` or applying any package state
  - returns each complete owner-issued, instance-bound, one-shot artifact to its
    package apply facade; apply never accepts plain data or reruns validators
  - a thrown migration hook or package validator applies no canonical prefix
- `save(): Promise<CoreRawData>`
- `CoreRawData.systemContext?: Record<string, unknown>` (optional managed-property snapshot)

Feature/runtime wiring:

- `initFeatureSystem(packages: CorePackages): void`
- `setupInputSystem(watchedElement?: HTMLElement): void`
- `registerEvent(event: string | EventDefinition<TPayload, TOptions>): EventRegistration<TPayload, TOptions>` (register custom event channels in `@asyra/reactive-events` and get publish/subscribe handles)
- `unregisterEvent(event: string | EventDefinition): boolean`
- `defineSelection(type: string, selection: Selection): void` (primary declaration API for selection channel registration)
- `registerSelection(type: string, selection: Selection): void` (compatibility alias of `defineSelection`)
- `unregisterSelection(type: string): boolean` (disposes and removes the owned selection runtime)
- `getSelection(type: string): Selection | undefined`

Render bridge:

- `registerRenderLayer(registration: RenderLayerRegistration, options?: RegisterRenderLayerOptions): void`
- `unregisterRenderLayer(name: string): boolean`
- `createRenderGradientFillStyle(options: CreateRenderGradientFillOptions): RenderFillStyle`
- `registerRenderInteractionTargets(targets: RenderInteractionTarget | RenderInteractionTarget[], options?: { override?: boolean }): void`
- `updateRenderInteractionTarget(targetId: string, patch: Partial<RenderInteractionTarget> | ((current: RenderInteractionTarget) => Partial<RenderInteractionTarget>)): void`
- `unregisterRenderInteractionTarget(targetId: string): boolean`
- `clearRenderInteractionTargets(): void`
- `registerRenderInteractionHandler(targetId: string | RegExp, registration: RenderInteractionHandlerRegistration): void`
- `unregisterRenderInteractionHandler(targetId: string, eventType?: RenderInteractionEventType): void`
- `registerDataChannelObserver(registration: DataChannelObserverRegistration): void`
  - registration has exactly one delivery shape:
    `{ name; channel; onChange(change) }` or
    `{ name; channel; onBatch(readonlyChanges) }`
  - `onBatch` receives each injected Factory batch once and in original order;
    Core does not expand that route into single-change callbacks
- `unregisterDataChannelObserver(name: string): boolean`
- `registerSharedDataChannel(name, channel): void`
- `unregisterSharedDataChannel(name): boolean`
- `hasSharedDataChannel(name): boolean`
- `createLocalSharedDataChannel(): LocalSharedDataChannel`
  - these methods and data-channel observers route through the Factory injected
    into that Core instance; standalone observer helpers share the default
    Core's explicitly injected registry while custom Core registries remain
    isolated
  - local channels are delivery-only and retain no collaboration history;
    explicit `@asyra/collaboration` composition may transport their completed
    publications
- `renderIsReady(): void`

Scene/model bridge:

- `sceneTreeInit(): void`
- `sceneTreeLoadData(data: SceneTreeRawData): void`
- `sceneTreeSaveData(): SceneTreeRawData`
- `createElement(data: CreateElementData, parent?: GroupInstanceTypes, index?: number, options?: EVENT_OPTIONS): string`
- `createElementInParent(data: CreateElementData, parentId: string, index?: number, options?: EVENT_OPTIONS): string`
- `createElementsInParent(data: readonly CreateElementData[], parentId: string, index?: number, options?: EVENT_OPTIONS): readonly string[]`
  - this is the only plural ordinary creation API; scalar creation is its
    batch-of-one convenience
  - Core obtains the complete prepared Props property-graph batch and prepared
    Scene insertion before it asks either owner to apply, then returns only an
    isolated frozen ordered-ID result; an empty input is inert
- `createElementsInParentFromCanonicalData(elements: readonly ElementRawData[], properties: readonly PropertyComponentRawData[], parentId: string, index?: number, options?: EVENT_OPTIONS): readonly string[]`
  - Scene validates the detached canonical elements and issues the exact
    element-slot-to-property relations; Core passes those relations unchanged
    to the prepared Props exact property-graph batch before either owner
    applies
- `applyCanonicalChanges(changes: readonly CanonicalChange[]): void`
  - coordinates one already validated ordered canonical request through the
    existing origin-neutral Props and Scene Tree facades
  - `CanonicalChange` is a closed union of `property-components`,
    `element-data`, `hierarchy-moves`, `subtree-removal`, `subtree-restore`,
    `element-creation`, and `element-removal`
  - the caller owns the one enclosing Factory transaction; Core does not parse
    `SharedPublication`, start another transaction, or accept transport,
    local/remote, suppression, publication, receipt, profiling, or
    compatibility options
  - owner rejection throws through the caller-owned transaction; no partial
    observer evidence is released before Factory owner commit
- `getElementComputedData(elementId: string): Record<string, unknown> | undefined`
  - reads the current local projection only; the returned data is not canonical
    property, history, collaboration, or persistence evidence
- `moveElements(request: MoveHierarchyRequest, options?: EVENT_OPTIONS): MoveHierarchyResult`
- `removeSubtree(elementId: string, options?: EVENT_OPTIONS): RemoveSubtreeResult`
- `removeElementsFromCanonicalData(removals: readonly CanonicalElementRemoval[], options?: EVENT_OPTIONS): readonly string[]`
  - this is the origin-neutral exact flat-removal API; Core obtains the
    prepared Scene removal and any prepared Props orphan-graph batch before
    applying Scene then Props in the caller-owned transaction
- `updateLocalComputedData(updates: readonly LocalComputedDataUpdate[]): void`
- `patchLocalComputedData(updates: readonly LocalComputedDataPatchUpdate[]): void`
- `projectLocalComputedDataFromPropertyIds(propertyIds: readonly string[]): void`
  - these are mission-specific Core facades over the matching Scene Tree
    batch APIs; a one-element request uses the same batch-of-one shape and an
    empty batch is inert
  - property-ID projection reads current canonical Props values through the
    Scene-owned property-relation index; it is used when a local-only preview
    must be replaced with the current canonical projection
  - none of these APIs accepts `EVENT_OPTIONS`, mutates a property component,
    enters a Factory transaction, or creates history, shared-channel,
    Collaboration/CRDT, or persistence evidence
  - successful semantic changes are delivered as ordinary local
    `UPDATE_COMPUTED_DATA` or `UPDATE_COMPUTED_DATA_PATCH` event batches
- `getAllElementsBounds(): Bounds | null`
- `isContainerType(type: string): boolean`
- `selectByChannel(channel: string, ids: string[], options?: EVENT_OPTIONS): void`
- `selectElements(elementIds: string[], options?: EVENT_OPTIONS): void`
- `selectVectorPoints(pointIds: string[], options?: EVENT_OPTIONS): void`
- `selectVectorSegments(segmentIds: string[], options?: EVENT_OPTIONS): void`
  - wrapper contract: channel must be resolvable from registered selection metadata (`action`/`eventName`); no built-in fallback channel defaults

`EVENT_OPTIONS` supports `undoable`, `rollbackable`, `shared`, and
`sharedDelivery`; `SharedDeliveryMode` is the canonical
`'transaction-end' | 'immediate'` timing type used by both mutation options and
Factory delivery metadata. `undoable: false` skips ordinary history but remains
rollbackable by default. `rollbackable: false` explicitly opts out of failure
reversal, but does not opt an undoable event out of the inverse-contract
requirement; intentionally irreversible effects must also set
`undoable: false`. The Factory remote-apply wrapper is the exception: it forces
remote-origin changes to remain rollbackable and ignores a remote handler's
`rollbackable: false`. `sharedDelivery: 'immediate'` completes local
shared-channel delivery and optional collaboration publication during an
active transaction while retaining the change in the current undo commit; the
default is `'transaction-end'`. All shared changes made by one synchronous
immediate delivery action are one ordered publication. A pointer session may
emit several such publications without splitting its undo commit. A committed
local undo emits one ordered inverse publication and redo emits one forward
publication for channels delivered by the original action. Remote-origin
replay remains excluded.

Transaction facade exports:

- `startTransaction(): void`
- `updateTransaction(eventName: string, payload: unknown, options?: EVENT_OPTIONS): void`
- `endTransaction(options?: EndTransactionOptions): void`
- `rollbackTransaction(failure?: TransactionFailure): void`
- `runTransaction(callback, options?: RunTransactionOptions)`; supports sync
  and async callbacks
- `subscribeToSynchronousEvent(type, subscriber)`; canonical state-owner replay
  acknowledgement only, not a replacement for ordinary event observation;
  return `false` to report a semantic no-op
- `acknowledgeTransactionReplayApplied()`; call after canonical mutation when a
  synchronous replay owner can still throw before returning
- `isTransactionReplayApplied()`; Factory-facing query for whether the active
  replay context has applied a semantic mutation
- `wasTransactionReplayApplied(error)`; Factory-facing replay failure metadata
  query that preserves the original thrown value
- transaction types: `TransactionOutcome`, `TransactionOrigin`,
  `TransactionFailureKind`, `TransactionFailure`, `EndTransactionOptions`,
  `RunTransactionOptions`, `TransactionStatus`, `TransactionStatusPayload`

Managed property bridges:

- `defineUIProperty<T>(key: string, config: PropertyRegistration<T>): void` (primary declaration API)
- `registerUIProperty<T>(key: string, config: PropertyRegistration<T>): void` (compatibility alias of `defineUIProperty`)
- `getUIProperty<T>(key: string): T | undefined`
- `setUIProperty<T>(key: string, value: T): void`
- `getUIPropertySubject<T>(key: string): BehaviorSubject<T> | undefined`
- `onUIPropertyChange<T>(key: string, callback: (value: T) => void): () => void`
- `updateElementProperties(updates: readonly ElementPropertyValuesUpdate[], options?: EVENT_OPTIONS): readonly string[]`
  - replaces complete canonical property field values for one or many elements
    after one resolved Scene target set and one prepared Props mutation batch
- `patchElementProperties(patches: readonly ElementPropertyPatchUpdate[], options?: EVENT_OPTIONS): readonly string[]`
  - applies typed ordered record set/remove deltas through the same prepared
    owner boundary; both plural APIs return only isolated frozen ordered
    element IDs
- `defineSystemProperty<T>(key: string, defaultValue: T): BehaviorSubject<T>` (primary declaration API)
- `defineSystemProperty<T>(key: string, defaultValue: T, options?: { runtime?: boolean; silent?: boolean; validate?: (value: unknown) => value is T }): BehaviorSubject<T>`
- `registerSystemProperty<T>(key: string, defaultValue: T): BehaviorSubject<T>` (compatibility alias of `defineSystemProperty`)
- `registerSystemProperty<T>(key: string, defaultValue: T, options?: { runtime?: boolean; silent?: boolean; validate?: (value: unknown) => value is T }): BehaviorSubject<T>` (compatibility alias)
- `getSystemProperty<T>(key: string): T | undefined`
- `setSystemProperty<T>(key: string, value: T): void`
  - after a successful managed-state update, requests one ordinary frame from
    the Core-bound Render instance; Render coalesces repeated requests
- `getSystemPropertyObservable<T>(key: string): BehaviorSubject<T> | undefined`

## Package Export Map

`@asyra/ai-agent-runtime` (optional runtime)

- composition: `createAiAgentRuntime(...)`, `AiAgentRuntime`,
  `CreateAiAgentRuntimeInput`, `AiRunRequest`, and `AiRuntimeOptions`
- terminal output: `AiRuntimeResult`, `AiRuntimeExecutedResult`,
  `AiRuntimeCancelledResult`, `AiRuntimeFailedResult`, `AiRuntimeStage`, and
  `AiRuntimeFailureCode`
- registry/actions: `createAiActionRegistry()`, `AiActionRegistry`,
  `AiActionDefinition`, and `AiActionDescription`
  - every definition has one JSON-compatible backend-facing `inputSchema` and
    one app-owned `execute(args, { signal })`
- provider: `AiProvider`, `AiProviderInput`, `AiActionBatch`,
  `AiActionBatchAction`, `AiProviderError`, and
  `createGenericHttpAiProvider(...)`
  - `AiProvider.requestActionBatch(input, { signal })` is the only provider
    request and returns one server-prepared action batch identified by
    `batchId`
- action-batch resolution: the runtime instance exposes
  `resolveAiActionBatch(batch, { signal })` and returns
  `ResolvedAiActionBatch`; permission produces
  `PermissionReadyAiActionBatch`
  - Runtime checks only the small control envelope and registered action names
  - Runtime never traverses, validates, normalizes, clones, or freezes action
    arguments; permission and execution receive the exact server-prepared
    arguments identity
  - there is no top-level resolution helper, client model-preparation API,
    compatibility wrapper, or alternate payload mode
- evidence: `redactAiValue(...)`, `createAiRuntimeAudit(...)`, summary-only
  `AiActionBatchPreview`, execution-summary, audit, and redaction types;
  confirmation and terminal preview redact only bounded summaries and never
  retain complete action arguments or geometry
- importing the package is inert; apps explicitly compose the provider,
  context, actions, permission, confirmation, transaction, and owned resources
- the generic HTTP adapter uses an app-selected HTTPS or same-origin endpoint;
  it reads no API key or implicit browser credential source
- one runtime invocation completes its provider request before one accepted
  transaction; provider retry never repeats a transaction or executor

`@asyra/collaboration` (optional runtime)

- composition: `createCollaboration(...)`, `Collaboration`,
  `CreateCollaborationInput`, `CollaborationFactory`,
  `ProcessRemotePublication`, `CollaborationResourceOwnershipMap`,
  `CollaborationPublicationOutcome`, `DisposalError`;
  `ProcessRemotePublication` returns `void | Promise<void>`, and inbound FIFO
  advancement/outcome reporting wait for its settlement
- lifecycle: `start`, `disconnect`, `reconnect`, `whenIdle`, `dispose`
- provider contract: `Provider`, `ProviderIdentity`, `ProviderStatus`,
  `ProviderFailure`, `PROVIDER_FAILURE_CODES`,
  `isProviderFailureCode(...)`, `createProviderIdentitySnapshot(...)`,
  `MemoryHub`, and `MemoryProvider`
  - Provider exposes exactly one required ordered publication send path and one
    required exclusive async receive path
  - wire framing, grouping, encode/decode, queue capacity, and backpressure are
    concrete Provider internals; they do not add framework publication modes
- Awareness: `Awareness`, `AwarenessOptions`, validation/observation/state
  types, and collaboration `updateAwareness`, `leaveAwareness`,
  `expireAwareness`; `AwarenessStateInput` accepts app-selected JSON-safe
  fields and reserves `heartbeatAt` for runtime liveness
- publication outcomes: immutable local sent/skipped/send-failed and remote
  processed/process-failed observations
- importing this root entry creates no collaboration, provider, room,
  Awareness state, or network connection; Core and
  Preset do not re-export it

See `packages/collaboration.md` and
`../../examples/network-collaboration-transport.mjs`.

`@asyra/core`

- default `core` singleton, `Core` class
- `defineComponent`, `unregisterComponent`
- `definePropertyComponent`, `unregisterPropertyComponent`
- property registration lifecycle helpers: `unregisterPropertySchema`,
  `unregisterPropertyRegistration`, `PropertyRegistrationError`
- declarative property definition contract: `PropertyTypeDefinition`,
  `PropertyTypeFieldDefinition`, `PropertyTypeDefinitionError`, and
  `PROPERTY_TYPE_DEFINITION_ERROR_CODES`
- registration composition types: `RegistrationDefinitionMetadata`,
  `RegistrationRef`, `RegistrationNodeMetadata`,
  `RegistrationRelationDeclaration`, `RegistrationRelationMetadata`,
  `RelationOperationSuccess`, `UnregisterRegistrationSuccess`, and
  `RegistrationRelationError`
- props-manager registry re-export: `elementPropertyRegistry`
- feature-system bridge exports: `initFeatureSystem`, `getFeatureRegistry`, `getSessionManager`
- feature authoring helpers: `defineFeature`, `getFeature`, `unregisterFeature`
- feature lifecycle error: `FeatureUnregisterError`
- input mapping helper re-export: `keyMap`
- vector types: `VectorAnchorPoint`, `VectorPathStyle`
- render layer types: `RenderLayerRegistration`, `RegisterRenderLayerOptions`
- data-channel observer helpers:
  - `defineDataChannelObserver(...)`
  - `registerDataChannelObserver(...)`
  - `unregisterDataChannelObserver(...)`
- load validation types: `LoadValidationDiagnostic`, `LoadValidationScope`, `LoadDiagnosticsHook`
- load-hook failure contract: `LoadHookExecutionError`,
  `LoadHookExecutionErrorCode`, and `LOAD_HOOK_EXECUTION_ERROR_CODES`
- core API tier types:
  - `CoreBasicAPIs`
  - `CoreExtensionAPIs`
  - `CoreConcreteAPIs`
  - `CorePresetInstallAPIs`
  - `CorePresetDependencies`
- render lifecycle facade:
  - `setRenderEngineProvider(provider)`
  - `hasRenderEngineProvider()`
  - `setRenderer(renderer)` for advanced full-renderer replacement
  - `destroyRenderer()`
- managed-property lifecycle queries used by fixed preset installers:
  - `hasSystemProperty(key)`
  - `unregisterSystemProperty(key)`

`@asyra/core/canvas-pipeline-debugger` (optional DEV runtime surface)

- `createCanvasPipelineDebugger(core, options?)`
- options: `enabled` defaults to `false`, `traceCapacity` defaults to `256`,
  and `overlay` accepts `visible` plus `focusedElementIds`
- handle methods: `enable`, `disable`, `isEnabled`, `setOverlayVisible`,
  `setFocusedElementIds`, `getSnapshot`, `getTrace`, `clearTrace`, `dispose`
- `getSnapshot().fault` is `null` before failure and otherwise retains the latest
  observation, normalization, subscriber, or overlay projection failure message;
  re-enabling clears it
- exported trace/snapshot/focused projection types and stable disposed/duplicate
  session errors
- the root Core entry does not import or re-export this subpath

`@asyra/feature-system`

- `defineFeature(name, keyConfig, definition)`
- `getFeature(featureName)`
- `unregisterFeature(featureName)`
- `getFeatureRegistry()`
- `getSessionManager()`
- `setCorePackages(packages)`
- runtime classes: `FeatureRegistry`, `SessionManager`, `InteractionQueue`
- default interaction queue: `interactionQueue`
- identifiable handler error: `FeatureHandlerTimeoutError`
- public `SessionManager` start, update, end, and cancel operations are
  serialized with one-shot command execution by the default transaction
  owner's queue; all instances share one active session runtime, so a new
  registered session start finalizes the previously active session according to
  its cancel policy before opening the next boundary

`@asyra/render`

- default `render` singleton, `Render` class
- `Render({ engine?, engineProvider? })` for direct instance/provider injection;
  configuring both providers is rejected
- `setEngineProvider(provider)` stores a reversible instance-local provider
  without invoking it
- `Render.getProjectedElementCount()` returns the exact number of ordinary
  viewport RenderLayer entries as an O(1) read-only scalar; it exposes neither
  the layer map nor engine objects
- `MissingRenderEngineProviderError` and
  `InvalidRenderEngineProviderResultError` distinguish provider absence from an
  invalid provider result
- `RenderAdapter`: engine-neutral Core-facing `IRenderer` implementation
- renderer initialization and `getInstance()` preserve the selected engine's
  opaque runtime identity without adding a concrete SDK type to this package
- `PixiJSRenderer`: deprecated compatibility alias for `RenderAdapter`; warns
  once and is scheduled for removal after the next major-release migration
  window
- `renderStrategyRegistry`
- `EngineNeutralRenderStrategy<TAppData>` receives
  `RenderElementData & TAppData`; the app strategy owns custom-field drawing
  semantics and Render adds no engine-specific type or fallback behavior
- `prepareEvenOddShape(shape)` prepares the shared engine-neutral segment
  representation used by even-odd raster and hit-test consumers
- `isPointInsidePreparedEvenOddShape(point, preparedShape)` evaluates the same
  prepared even-odd geometry without reconstructing the intersection algorithm
- `createEvenOddFillStyle(options)` rasterizes that canonical even-odd geometry
  into an engine-neutral resource descriptor
- overlay helper: `createOverlayLayerRegistration(...)`
- overlay interaction helpers:
  - `createRenderInteractionPointTarget(...)`
  - `createRenderInteractionCircleTarget(...)`
  - `createRenderInteractionSegmentTarget(...)`
  - `createRenderInteractionPolylineTarget(...)`
- interaction registries:
  - `interactionTargetRegistry`
  - `renderInteractionHandlerRegistry`
- render stores (for default/preset wiring):
  - `renderSceneTreeStore`
  - `renderSelectionStore`

`@asyra/render/canvas-pipeline-debugger` (optional Core-facade support surface)

- `createCanvasPipelineDebuggerAdapter(render, options)` owns bounded trace,
  immutable snapshot/HUD data, and focused expected-geometry projection
- `CanvasPipelineDebuggerAdapter.reportFault(error)` records a Core-routed
  overlay failure in the snapshot read model without adding a trace entry
- `createCanvasPipelineDebuggerOverlay(adapter, options?)` creates one
  non-interactive graphics-only layer registration; the Core optional facade
  owns registering and unregistering it
- this subpath is not an app-facing bypass; apps use
  `@asyra/core/canvas-pipeline-debugger`
- no root Render export imports the optional implementation

`@asyra/render-engine`

- `RenderEngine`, `RenderEngineProvider`
- opaque `RenderEngineObjectHandle`, `RenderEngineResourceHandle`
- lifecycle: `initialize`, `requestFrame`, `cancelFrame`, `destroy`
  - `requestFrame` has one one-shot scheduling slot; a delivered callback is
    consumed before invocation, `cancelFrame` prevents the pending callback,
    and concrete drawing occurs only through the explicit `flush` command
- `RenderEngineInitializeResult.runtime`: opaque compatibility runtime identity
- semantic command/query contracts: `RenderEngineCommand`,
  `RenderEngineCommandResult`, `RenderEngineQuery`, `RenderEngineQueryResult`
- engine-neutral Graphics draw operations include ordered `poly` points with an
  explicit close flag for one linear path; curved paths retain the ordered
  move/line/Bézier operations
- normalized interaction contracts: `RenderEngineInteractionEvent`,
  `RenderEngineInteractionListener`
- capabilities: `RenderEngineCapabilities`,
  `assertRenderEngineCapabilities(...)`
- deterministic failure: `UnsupportedRenderEngineCapabilityError`
- engine-independent test adapter from `@asyra/render-engine/testing`:
  `RecordingRenderEngine`, `runRenderEngineContract(...)`

`@asyra/render-engine-pixi`

- `PixiRenderEngine`: concrete implementation of `RenderEngine`
- `createPixiRenderEngine(): RenderEngine`: fresh engine creator used by the
  preset-owned `2D` provider
- owns Pixi application, display objects, mesh/graphics translation, resources,
  surface events, one reusable standalone scheduling ticker, and deterministic
  concrete cleanup; it never starts `Application.ticker`, and only explicit
  `flush` invokes `Application.render()`
- does not expose framework state, render layers, or product feature behavior

`@asyra/factory`

- default `factory` singleton, `Factory` class
- Factory instance transaction runtime:
  - `startTransaction()`
  - `updateTransaction(event)`
  - `endTransaction(options?)`
  - `undo()`, `redo()`
  - `getUndoHistoryDepth()` (read-only exact depth of this Factory instance's
    local undo history; it does not expose mutable history entries)
  - `runRemoteTransaction(callback)` (rollbackable, non-undoable remote origin)
  - `applyRemoteEvent(event, apply)` (one detached event forwarded unchanged to
    the registered state-owner apply callback)
  - `isRemoteAsyncHandlerError(error)`
  - `getTransactionOwner()` for explicit reactive boundary wiring
  - `registerTransactionInverter(eventName, inverter)`
  - `registerTransactionValidator(name, validator)`
  - `subscribeToTransactionStatus(listener): () => void`
  - registered bulk actions use this same journal and Undo stack; Factory does
    not expose an AI/bulk-specific forward/inverse history artifact or a
    parallel applied-result payload mirror
  - successful state-owner apply does not invoke a second document
    save/equality/finalize/evidence-clone pass to reconstruct History
- default-singleton registration helpers:
  - `registerTransactionInverter(eventName, inverter)`
  - `registerTransactionValidator(name, validator)`
  - `subscribeToTransactionStatus(listener): () => void`
- shared data channel APIs:
  - `registerSharedDataChannel(name, channel)`
  - `unregisterSharedDataChannel(name)`
  - `hasSharedDataChannel(name)`
  - `observeSharedDataChannel(name, handler)`
  - `createLocalSharedDataChannel()` (fresh delivery-only local channel)
  - `getSharedDataChannelStrict(name)` (strict accessor; throws if not registered)
  - `getSharedDataChannel(name)` (safe accessor; returns `undefined` when missing)
  - `subscribeToSharedDelivery(handler)` (detached delivery metadata for
    local projection observation; observer failure cannot alter commit)
  - `subscribeToSharedPublication(handler)` (one immutable minimal
    `SharedPublication` per synchronous immediate delivery action or committed
    transaction-end batch; the hierarchy is publication → ordered slices →
    channel batches → ordered payload deliveries; `artifactId` is opaque
    transport correlation and not a local History-artifact reference)
  - ordinary transaction observer evidence is buffered until transaction-owner
    finalization succeeds, then released once as one ordered batch across owner
    evidence batches; rollback or owner-finalization failure releases no prefix

`@asyra/props-manager`

- default `propsManager` singleton, `PropsManager` class
- load pipeline: `validateLoadData(raw)` returns an owner-issued artifact;
  `applyValidatedLoad(result)` consumes that artifact once without revalidation
- manager id-first helpers: `getPropertyById(propertyId)`, `updatePropertyById(propertyId, key, value, options?)`
- `resolvePropertyAncestorIds(propertyIds: readonly string[]): readonly string[]`
  - read-only, ordered, deduplicated closure containing each requested active
    property ID and every Props-owned ancestor reached through the
    property-child graph
  - invalid IDs, relationship cycles, or inconsistent relationship indexes
    reject without changing Props state
- registries: `elementPropertyRegistry`, `stateRegistry`
- schema APIs: `registerPropertySchema`, `getPropertySchema`, `propertySchemaRegistry`
- property-component APIs: `registerPropertyComponent`, `getPropertyComponent`, `propertyComponentRegistry`
- runtime primitives: `BasePropertyComponent`, `getPropertyComponentAccessor`

`@asyra/scene-tree`

- default scene tree singleton, `SceneTree` class
- load pipeline: `validateLoadData(raw)` returns an owner-issued artifact;
  `applyValidatedLoad(result)` consumes that artifact once without revalidation
- `componentRegistry`
- `createDynamicComponent`, `createDynamicPropsClass`, `createElement`
- ordinary descriptor creation:
  - `addNewElement(...)`
  - `addNewElements(...)` (`addNewElement` delegates to this same ordinary
    batch owner as a batch of one)
- lifecycle preparation:
  - `prepareElementInsertion(...)` validates ordinary Scene insertion evidence
  - `prepareCanonicalElementInsertion(...)` validates detached canonical
    insertion and issues exact `ownerRelations`
  - `prepareCanonicalElementRemoval(...)` and `prepareSubtreeRemoval(...)`
    validate exact flat or child-first removal evidence without inspecting
    active Props state
  - `applyPreparedElementMutation(...)` is the one Scene map, raw-state,
    relation, and hierarchy apply owner for those prepared mutations
  - `preflightLoadPropertyRelations(...)` validates Scene relations against
    detached validated Props data before load apply
- local computed projection:
  - `updateLocalComputedData(updates: readonly LocalComputedDataUpdate[]): void`
  - `patchLocalComputedData(updates: readonly LocalComputedDataPatchUpdate[]): void`
  - `projectLocalComputedDataFromPropertyIds(propertyIds: readonly string[]): void`
  - all three accept only plural batch shapes, accept no `EVENT_OPTIONS`, and
    emit only ordinary local
    `UPDATE_COMPUTED_DATA` or `UPDATE_COMPUTED_DATA_PATCH` event batches
  - direct value/patch mutation preflights the complete batch before mutation;
    property-ID projection resolves current canonical values through the
    complete ordered relation closure
  - property-ID projection resolves the ordered Props ancestor closure and
    replaces affected local computed values from current canonical Props; it
    does not mutate canonical data
  - canonical `UPDATE_PROPERTY` evidence is expanded through Props
    `resolvePropertyAncestorIds(...)`, then Scene's component-to-element
    reverse relation index projects the current canonical property values to
    every related element
  - computed data is local Render/UI projection only; it is excluded from
    Scene serialization, Factory history/rollback evidence, shared channels,
    Collaboration/CRDT publications, and persistence
- direct Scene removal retains Props; a complete element-plus-property
  lifecycle is coordinated by Core from the Scene-issued release/orphan
  evidence. No Scene API is selected by local/remote origin.

`@asyra/selection`

- default selection manager singleton
- `SelectionManager` class
- `BaseSelection` class (generic metadata-driven selection runtime)

`@asyra/system-context`

- default `systemContext` singleton
- `SystemContext` class
- managed property load/save helpers: `loadManagedProperties`, `saveManagedProperties`
- split Core orchestration helpers:
  `validateManagedProperties(data)` returns sanitized data plus diagnostics
  without mutation, and `applyValidatedManagedProperties(result)` consumes that
  owner-issued artifact once; fabricated/foreign/reused results are rejected
  before mutation and apply does not rerun validators
- package boundary is storage/validation only; default event-to-property subscription wiring is preset-owned
- managed-property `runtime` flag:
  - `runtime: true` (default) => runtime-only, excluded from save/load persistence
  - `runtime: false` => included in save/load persistence

`@asyra/preset`

- `PresetProfiles`: stable `2D`, `3D`, `HYBRID`, and `CUSTOM` ids; only `2D`
  and `CUSTOM` are currently available
- `PresetDefaults`: eight official selectable default ids
- grouped `ViewportSystemPropertyKeys`, `InputSystemPropertyKeys`,
  `SelectionSystemPropertyKeys`, and `VectorEditingSystemPropertyKeys`, plus
  flattened `PresetSystemPropertyKeys` and `PRESET_SYSTEM_PROPERTY_KEYS`, form
  the typed contract for official Preset-managed property keys
- deeply frozen `PresetCatalog` with separate profile/default availability and
  public dependency metadata
- `applyPreset(core, { profile?, defaults? })`; omitted options mean `2D` plus
  all defaults, omitted defaults mean all, and `defaults: []` means none
- explicit defaults are canonicalized as a set, expanded by public dependencies,
  and installed in catalog order independently of profile
- `PresetApplyResult` is detached and deeply frozen, with `profile`,
  `presetEngineId`, `selectedDefaults`, and `appliedDefaults`; it exposes no
  disposer or application handle
- `PresetApplyError` plus `PRESET_APPLY_ERROR_CODES` covers strict validation,
  provider conflict, default installation, and retryable cleanup failure
- shared channels and data-channel observers are installed through the supplied
  Core instance; failed apply rollback retries only pending cleanup before a
  later apply on that Core
- exports pure component definitions and separate render strategies for
  Rectangle, Oval, Vector, Frame, and Group; importing preset modules has no
  component-registration side effect
- exports official Group operation APIs:
  `prepareGroupOperation`, `prepareUngroupOperation`, `groupElements`,
  `ungroupElement`, `moveElementsWithGroupGeometry`, `deriveGroupBounds`, and
  `normalizeGroupsForElements`
- exports `PRESET_REGISTRATION_OWNER` for metadata inspection; daily app
  customization does not require owner input or preset target keys
- app customization uses ordinary Core relation/registration APIs after
  `applyPreset(core)`, including bounded declarative property redefinition;
  preset exposes no app extension object, target manifest, or replace strategy
- preset completion does not start Core or publish runtime readiness; the first
  `core.start()` remains the permanent composition closure/runtime owner
- default render wiring lives here:
  - register default shared-data observers for canonical scene-tree structure
    and selection
  - register one ordinary local computed-event batch consumer that projects
    each computed change to Render and flushes affected UI Context entries once
    per observer batch; no shared computed observer remains
  - register default render system subscriptions (`zoom`, `viewportPosition`)
- exports `InputSystemEvents` and `PresetEventNames` constants for preset-owned event namespaces
- exports `SelectionChannels` and `SelectionActions` for default canvas selection profile contracts
- custom engines never pass through preset: select `CUSTOM`, then call
  `core.setRenderEngineProvider(provider)` before `core.start()`

`@asyra/ui-context`

- default `uiContext` singleton
- `UIContext` class
- `propertyRegistry` (ui-context derived UI property registry, unrelated to props-manager element property registry)
- `PropertyComputeContext<TElementData>.elements` exposes
  `ComputedAttrs & TElementData` to app callbacks
- `PropertyRegistration<TValue, TElementData>` remains assignable through the
  default Core UI-property facade; UI Context remains derived-only

`@asyra/input-system`

- default `inputSystem` singleton
- `InputSystem`, `InputSystemRegistry`, `InputEventCombo`

## `defineFeature` Contract (Authoritative)

`defineFeature(name, keyConfig, definition)`

- `name: string`
- `keyConfig: string | undefined`
- `definition.api?: API`
- `definition.execution?: (snapshot) => unknown`
- `definition.session?: { onStart?, onUpdate?, onEnd?, onCancel? }`
- `definition.task?: (input, { signal }) => unknown | Promise<unknown>`
- `definition.priority?: number`
- `definition.exclusive?: boolean`
- `definition.cancelPolicy?: 'rollback' | 'commit-current' | 'feature-defined'`

Execution mode:

- registers one-shot handlers for `keyConfig`

Session mode:

- uses event triplet:
  - `${keyConfig}.start`
  - `${keyConfig}.update`
  - `${keyConfig}.end`
- user-driven cancellation defaults to `commit-current` and runs the normal
  `onEnd` finalization with `detail.cancelled = true`
- explicit `rollback` cancellation and failure cleanup use `onCancel`, with
  `onEnd` as the legacy fallback when no `onCancel` exists
- `feature-defined` requires `onCancel` and a returned `rollback` or
  `commit-current` outcome
- session snapshots expose `detail.signal`; async handlers must check it after
  awaited work before performing mutations
- handler errors/timeouts override cancel policy and roll back

Programmatic task mode:

- `invokeFeatureTask(name, input, { signal? })` runs the named Feature task
  without opening a reactive-events transaction
- the Feature System creates the handler signal and forwards optional caller
  abort into it
- a second active invocation of the same Feature rejects with
  `FeatureTaskActiveError` (`FEATURE_TASK_ACTIVE`) instead of entering another
  queue
- `cancelFeatureTask(name, reason?)` aborts the active Feature-owned signal
- settlement removes external abort listeners and active ownership on success
  or failure
- active task ownership blocks `unregisterFeature(name)` with the existing
  `FeatureUnregisterError` (`FEATURE_IN_USE`)
- programmatic tasks are for detached, non-mutating async preparation;
  canonical mutation still requires the ordinary app transaction/common-API
  path

## API Usage Rules

- App-level code should prefer `core.xxx` when surface exists.
- Prefer framework helper imports from `@asyra/core` when equivalent re-exports exist.
- Framework defaults are preset-owned; call `applyPreset(core)` explicitly when default builtins are required.
- Only `@asyra/render-engine-pixi` may import Pixi. Framework and app consumers
  use render/engine abstractions.
- Model mutation requests should be transaction-bounded by caller-side API boundaries.
- Transaction mutations are local by default; shared YJS append only happens when `options.shared` matches a registered data channel.
