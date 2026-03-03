# Framework API Surfaces

This file is the fast API map for framework-level implementation requests.

## Core Facade (`@asyra/core`)

Primary import:

- `import core from '@asyra/core'`
- `import { defineFeature, getFeature, unregisterFeature, keyMap } from '@asyra/core'`

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
- `registerInteraction(eventName: string, handler: DecisionHandler): void` (compatibility path)
- `registerEvent(event: string | EventDefinition<TPayload, TOptions>): EventRegistration<TPayload, TOptions>` (register custom event channels in `@asyra/reactive-events` and get publish/subscribe handles)

Render bridge:

- `registerRenderLayer(registration: RenderLayerRegistration, options?: RegisterRenderLayerOptions): void`
- `unregisterRenderLayer(name: string): boolean`
- `registerRenderYjsChangeObserver(registration: RenderYjsChangeObserverRegistration): void`
  - registration shape: `{ name: string; channel: string; onChange: (change) => void }`
- `unregisterRenderYjsChangeObserver(name: string): boolean`
- `renderIsReady(): void`

Scene/model bridge:

- `sceneTreeInit(): void`
- `sceneTreeLoadData(data: SceneTreeRawData): void`
- `sceneTreeSaveData(): SceneTreeRawData`
- `createElement(data: CreateElementData, parent?: GroupInstanceTypes, index?: number, options?: { undoable?: boolean; shared?: string }): string`
- `changeComputedData(elementIds: string[], data: Record<string, DataTypes>, options?: { undoable?: boolean; shared?: string }): void`
- `getAllElementsBounds(): Bounds | null`
- `isContainerType(type: string): boolean`
- `selectElements(elementIds: string[], options?: { undoable?: boolean; shared?: string }): void`

Managed property bridges:

- `registerUIProperty<T>(key: string, config: PropertyRegistration<T>): void`
- `getUIProperty<T>(key: string): T | undefined`
- `setUIProperty<T>(key: string, value: T): void`
- `getUIPropertySubject<T>(key: string): BehaviorSubject<T> | undefined`
- `onUIPropertyChange<T>(key: string, callback: (value: T) => void): () => void`
- `registerSystemProperty<T>(key: string, defaultValue: T): BehaviorSubject<T>`
- `registerSystemProperty<T>(key: string, defaultValue: T, options?: { runtime?: boolean; silent?: boolean; validate?: (value: unknown) => value is T }): BehaviorSubject<T>`
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
- render YJS observer helpers:
  - `defineRenderYjsChangeObserver(...)`
  - `registerRenderYjsChangeObserver(...)`
  - `unregisterRenderYjsChangeObserver(...)`
- load validation types: `LoadValidationDiagnostic`, `LoadValidationScope`, `LoadDiagnosticsHook`

`@asyra/feature-system`

- `defineFeature(name, keyConfig, definition)`
- `getFeature(featureName)`
- `unregisterFeature(featureName)`
- `getFeatureRegistry()`
- `getSessionManager()`
- `setCorePackages(packages)`
- runtime classes: `FeatureRegistry`, `SessionManager`

`@asyra/render`

- default `render` singleton, `Render` class
- `PixiJSRenderer`
- `renderRegistry`
- `interactionHandlerRegistry`
- overlay helper: `createOverlayLayerRegistration(...)`
- render stores (for default/preset wiring):
  - `renderSceneTreeStore`
  - `renderSelectionStore`

`@asyra/factory`

- default `factory` singleton, `Factory` class
- transaction runtime bridge:
  - `startTransaction()`
  - `updateTransaction(event)`
  - `endTransaction()`
  - `undo()`, `redo()`
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
- `ElementSelection`, `VectorPointSelection`, `VectorSegmentSelection` classes

`@asyra/system-context`

- default `systemContext` singleton
- `SystemContext` class
- managed property load/save helpers: `loadManagedProperties`, `saveManagedProperties`
- managed-property `runtime` flag:
  - `runtime: true` (default) => runtime-only, excluded from save/load persistence
  - `runtime: false` => included in save/load persistence

`@asyra/preset`

- `applyPreset(core)` for explicit preset bootstrap registration (builtin components, property components, props schemas, render layers, selections, and default UI/system property wiring)
- default render wiring lives here:
  - register default render YJS observers (scene-tree + selection)
  - register default render system subscriptions (`zoom`, `viewportPosition`)
- exports `InputSystemEvents` and `PresetEventNames` constants for preset-owned event namespaces

`@asyra/ui-context`

- default `uiContext` singleton
- `UIContext` class
- `propertyRegistry` (ui-context derived UI property registry, unrelated to props-manager element property registry)
- registration and compute types

`@asyra/input-system`

- default `inputSystem` singleton
- `InputSystem`, `InputSystemRegistry`, `InputEventCombo`

`@asyra/interaction-core` (deprecated)

- still exported for compatibility
- not runtime owner of execute/session/cancel

## `defineFeature` Contract (Authoritative)

`defineFeature(name, keyConfig, definition)`

- `name: string`
- `keyConfig: string | undefined`
- `definition.api?: API`
- `definition.execution?: (snapshot) => unknown`
- `definition.session?: { onStart?, onUpdate?, onEnd? }`
- `definition.priority?: number`
- `definition.exclusive?: boolean`

Execution mode:

- registers one-shot handlers for `keyConfig`

Session mode:

- uses event triplet:
  - `${keyConfig}.start`
  - `${keyConfig}.update`
  - `${keyConfig}.end`

## API Usage Rules

- App-level code should prefer `core.xxx` when surface exists.
- Prefer framework helper imports from `@asyra/core` when equivalent re-exports exist.
- Framework defaults are preset-owned; call `applyPreset(core)` explicitly when default builtins are required.
- Non-render packages must not import Pixi directly.
- Model mutation requests should be transaction-bounded by caller-side API boundaries.
- Transaction mutations are local by default; shared YJS append only happens when `options.shared` matches a registered data channel.
- Deprecated APIs stay callable during transition, but new behavior should be built on current owners.
