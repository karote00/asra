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
- `CorePresetDependencies`: concrete dependency bundle returned by `core.getPresetDependencies()`

Lifecycle and integration:

- `setRenderer(renderer: IRenderer): void`
- `setPersistence(provider: IPersistenceProvider): void`
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
- `registerSaveHook(hook: SaveHook): void`
- `registerLoadHook(hook: LoadHook): void`
- `registerLoadDiagnosticsHook(hook: LoadDiagnosticsHook): () => void` (returns disposer/unsubscribe)
- `start(container: HTMLElement, renderOptions: RenderOptions): Promise<void>`
- `load(data: CoreRawData): void`
- `save(): Promise<CoreRawData>`
- `CoreRawData.systemContext?: Record<string, unknown>` (optional managed-property snapshot)

Feature/runtime wiring:

- `initFeatureSystem(packages: CorePackages): void`
- `setupInputSystem(watchedElement?: HTMLElement): void`
- `registerEvent(event: string | EventDefinition<TPayload, TOptions>): EventRegistration<TPayload, TOptions>` (register custom event channels in `@asyra/reactive-events` and get publish/subscribe handles)
- `defineSelection(type: string, selection: Selection): void` (primary declaration API for selection channel registration)
- `registerSelection(type: string, selection: Selection): void` (compatibility alias of `defineSelection`)
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
  - registration shape: `{ name: string; channel: string; onChange: (change) => void }`
- `unregisterDataChannelObserver(name: string): boolean`
- `renderIsReady(): void`

Scene/model bridge:

- `sceneTreeInit(): void`
- `sceneTreeLoadData(data: SceneTreeRawData): void`
- `sceneTreeSaveData(): SceneTreeRawData`
- `createElement(data: CreateElementData, parent?: GroupInstanceTypes, index?: number, options?: EVENT_OPTIONS): string`
- `changeComputedData(elementIds: string[], data: Record<string, DataTypes>, options?: EVENT_OPTIONS): void`
- `refreshComputedDataFromProperty(elementId: string, propertyName: string, options?: EVENT_OPTIONS): void`
- `getAllElementsBounds(): Bounds | null`
- `isContainerType(type: string): boolean`
- `selectByChannel(channel: string, ids: string[], options?: EVENT_OPTIONS): void`
- `selectElements(elementIds: string[], options?: EVENT_OPTIONS): void`
- `selectVectorPoints(pointIds: string[], options?: EVENT_OPTIONS): void`
- `selectVectorSegments(segmentIds: string[], options?: EVENT_OPTIONS): void`
  - wrapper contract: channel must be resolvable from registered selection metadata (`action`/`eventName`); no built-in fallback channel defaults

`EVENT_OPTIONS` supports `undoable`, `rollbackable`, `shared`, and
`sharedDelivery`. `undoable: false` skips ordinary history but remains
rollbackable by default. `rollbackable: false` explicitly opts out of failure
reversal, but does not opt an undoable event out of the inverse-contract
requirement; intentionally irreversible effects must also set
`undoable: false`. `sharedDelivery: 'immediate'` projects that shared change during an
active transaction while retaining it in the current undo commit; the default
is `'transaction-end'`.

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
- `updatePropertyById(propertyId: string, key: string, value: unknown, owner?: { ownerElementId: string; ownerPropertyName: string }, options?: EVENT_OPTIONS): void`
- `commitPropertyChanges(options?: EVENT_OPTIONS): void`
- `defineSystemProperty<T>(key: string, defaultValue: T): BehaviorSubject<T>` (primary declaration API)
- `defineSystemProperty<T>(key: string, defaultValue: T, options?: { runtime?: boolean; silent?: boolean; validate?: (value: unknown) => value is T }): BehaviorSubject<T>`
- `registerSystemProperty<T>(key: string, defaultValue: T): BehaviorSubject<T>` (compatibility alias of `defineSystemProperty`)
- `registerSystemProperty<T>(key: string, defaultValue: T, options?: { runtime?: boolean; silent?: boolean; validate?: (value: unknown) => value is T }): BehaviorSubject<T>` (compatibility alias)
- `getSystemProperty<T>(key: string): T | undefined`
- `setSystemProperty<T>(key: string, value: T): void`
- `getSystemPropertyObservable<T>(key: string): BehaviorSubject<T> | undefined`

## Package Export Map

`@asyra/core`

- default `core` singleton, `Core` class
- `defineComponent`, `unregisterComponent`
- `definePropertyComponent`, `unregisterPropertyComponent`
- props-manager registry re-export: `elementPropertyRegistry`
- feature-system bridge exports: `initFeatureSystem`, `getFeatureRegistry`, `getSessionManager`
- feature authoring helpers: `defineFeature`, `getFeature`, `unregisterFeature`
- input mapping helper re-export: `keyMap`
- vector types: `VectorAnchorPoint`, `VectorPathStyle`
- render layer types: `RenderLayerRegistration`, `RegisterRenderLayerOptions`
- data-channel observer helpers:
  - `defineDataChannelObserver(...)`
  - `registerDataChannelObserver(...)`
  - `unregisterDataChannelObserver(...)`
- load validation types: `LoadValidationDiagnostic`, `LoadValidationScope`, `LoadDiagnosticsHook`
- core API tier types:
  - `CoreBasicAPIs`
  - `CoreExtensionAPIs`
  - `CoreConcreteAPIs`
  - `CorePresetInstallAPIs`
  - `CorePresetDependencies`

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
- `Render({ engine?, engineFactory? })` for direct instance/factory injection;
  configuring both providers is rejected
- `RenderAdapter`: engine-neutral Core-facing `IRenderer` implementation
- `PixiJSRenderer`: deprecated compatibility alias for `RenderAdapter`; warns
  once and is scheduled for removal after the next major-release migration
  window
- `renderStrategyRegistry`
- `interactionHandlerRegistry`
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

`@asyra/render-engine`

- `RenderEngine`, `RenderEngineFactory`
- opaque `RenderEngineObjectHandle`, `RenderEngineResourceHandle`
- lifecycle: `initialize`, `startFrameLoop`, `stopFrameLoop`, `destroy`
- semantic command/query contracts: `RenderEngineCommand`,
  `RenderEngineCommandResult`, `RenderEngineQuery`, `RenderEngineQueryResult`
- normalized interaction contracts: `RenderEngineInteractionEvent`,
  `RenderEngineInteractionListener`
- capabilities: `RenderEngineCapabilities`,
  `assertRenderEngineCapabilities(...)`
- deterministic failure: `UnsupportedRenderEngineCapabilityError`
- engine-independent test adapter from `@asyra/render-engine/testing`:
  `RecordingRenderEngine`, `runRenderEngineContract(...)`

`@asyra/render-engine-pixi`

- `PixiRenderEngine`: concrete implementation of `RenderEngine`
- `createPixiRenderEngine(): RenderEngine`: fresh-engine factory used by preset
- owns Pixi application, display objects, mesh/graphics translation, resources,
  surface events, frame loop, and deterministic concrete cleanup
- does not expose framework state, render layers, or product feature behavior

`@asyra/factory`

- default `factory` singleton, `Factory` class
- Factory instance transaction runtime:
  - `startTransaction()`
  - `updateTransaction(event)`
  - `endTransaction(options?)`
  - `undo()`, `redo()`
  - `getTransactionOwner()` for explicit reactive boundary wiring
  - `registerTransactionInverter(eventName, inverter)`
  - `registerTransactionValidator(name, validator)`
  - `subscribeToTransactionStatus(listener): () => void`
- default-singleton registration helpers:
  - `registerTransactionInverter(eventName, inverter)`
  - `registerTransactionValidator(name, validator)`
  - `subscribeToTransactionStatus(listener): () => void`
- shared data channel APIs:
  - `registerSharedDataChannel(name, yArray)`
  - `unregisterSharedDataChannel(name)`
  - `hasSharedDataChannel(name)`
  - `observeSharedDataChannel(name, handler)`
  - `getYjsDataChannel(name)` (returns YJS array for a channel name from factory doc)
  - `getSharedDataChannelStrict(name)` (strict accessor; throws if not registered)
  - `getSharedDataChannel(name)` (safe accessor; returns `undefined` when missing)

`@asyra/props-manager`

- default `propsManager` singleton, `PropsManager` class
- manager id-first helpers: `getPropertyById(propertyId)`, `updatePropertyById(propertyId, key, value, options?)`
- registries: `elementPropertyRegistry`, `stateRegistry`
- schema APIs: `registerPropertySchema`, `getPropertySchema`, `propertySchemaRegistry`
- property-component APIs: `registerPropertyComponent`, `getPropertyComponent`, `propertyComponentRegistry`
- runtime primitives: `BasePropertyComponent`, `getPropertyComponentAccessor`

`@asyra/scene-tree`

- default scene tree singleton, `SceneTree` class
- `componentRegistry`
- `createDynamicComponent`, `createDynamicPropsClass`, `createElement`

`@asyra/selection`

- default selection manager singleton
- `SelectionManager` class
- `BaseSelection` class (generic metadata-driven selection runtime)

`@asyra/system-context`

- default `systemContext` singleton
- `SystemContext` class
- managed property load/save helpers: `loadManagedProperties`, `saveManagedProperties`
- package boundary is storage/validation only; default event-to-property subscription wiring is preset-owned
- managed-property `runtime` flag:
  - `runtime: true` (default) => runtime-only, excluded from save/load persistence
  - `runtime: false` => included in save/load persistence

`@asyra/preset`

- `applyPreset(core)` for explicit preset bootstrap registration and default
  injection of the `@asyra/render-engine-pixi` factory
- `applyPreset(core, dependencies)` preserves the existing explicit dependency
  bundle path
- `applyPreset(core, { renderEngineFactory, dependencies? })` replaces the
  Pixi default with a contract-compatible custom factory
- default render wiring lives here:
  - register default render YJS observers (scene-tree + selection)
  - register default render system subscriptions (`zoom`, `viewportPosition`)
- exports `InputSystemEvents` and `PresetEventNames` constants for preset-owned event namespaces
- exports `SelectionChannels` and `SelectionActions` for default canvas selection profile contracts

`@asyra/ui-context`

- default `uiContext` singleton
- `UIContext` class
- `propertyRegistry` (ui-context derived UI property registry, unrelated to props-manager element property registry)
- registration and compute types

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

## API Usage Rules

- App-level code should prefer `core.xxx` when surface exists.
- Prefer framework helper imports from `@asyra/core` when equivalent re-exports exist.
- Framework defaults are preset-owned; call `applyPreset(core)` explicitly when default builtins are required.
- Only `@asyra/render-engine-pixi` may import Pixi. Framework and app consumers
  use render/engine abstractions.
- Model mutation requests should be transaction-bounded by caller-side API boundaries.
- Transaction mutations are local by default; shared YJS append only happens when `options.shared` matches a registered data channel.
