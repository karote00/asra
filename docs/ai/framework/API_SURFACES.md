# Framework API Surfaces

This file is the fast API map for framework-level implementation requests.

## Core Facade (`@asyra/core`)

Primary import:
- `import core from '@asyra/core'`
- `import { defineFeature, importFeature, unregisterFeature, keyMap } from '@asyra/core'`

Lifecycle and integration:
- `setRenderer(renderer: IRenderer): void`
- `setPersistence(provider: IPersistenceProvider): void`
- `registerSaveHook(hook: SaveHook): void`
- `registerLoadHook(hook: LoadHook): void`
- `start(container: HTMLElement, renderOptions: RenderOptions): Promise<void>`
- `load(data: CoreRawData): void`
- `save(): Promise<CoreRawData>`

Feature/runtime wiring:
- `initFeatureSystem(packages: CorePackages): void`
- `setupInputSystem(watchedElement?: HTMLElement): void`
- `registerInteraction(eventName: string, handler: DecisionHandler): void` (compatibility path)

Render bridge:
- `registerRenderLayer(registration: RenderLayerRegistration, options?: RegisterRenderLayerOptions): void`
- `unregisterRenderLayer(name: string): boolean`
- `renderIsReady(): void`

Scene/model bridge:
- `sceneTreeInit(): void`
- `sceneTreeLoadData(data: SceneTreeRawData): void`
- `sceneTreeSaveData(): SceneTreeRawData`
- `createElement(data: CreateElementData, parent?: GroupInstanceTypes, index?: number): string`
- `changeComputedData(elementIds: string[], data: Record<string, DataTypes>): void`
- `getAllElementsBounds(): Bounds | null`
- `isContainerType(type: string): boolean`
- `selectElements(elementIds: string[]): void`

Managed property bridges:
- `registerUIProperty<T>(key: string, config: PropertyRegistration<T>): void`
- `getUIProperty<T>(key: string): T | undefined`
- `setUIProperty<T>(key: string, value: T): void`
- `getUIPropertySubject<T>(key: string): BehaviorSubject<T> | undefined`
- `onUIPropertyChange<T>(key: string, callback: (value: T) => void): () => void`
- `registerSystemProperty<T>(key: string, defaultValue: T): BehaviorSubject<T>`
- `getSystemProperty<T>(key: string): T | undefined`
- `setSystemProperty<T>(key: string, value: T): void`
- `getSystemPropertyObservable<T>(key: string): BehaviorSubject<T> | undefined`

## Package Export Map

`@asyra/core`
- default `core` singleton, `Core` class
- `defineComponent`, `unregisterComponent`
- feature-system bridge exports: `initFeatureSystem`, `getFeatureRegistry`, `getSessionManager`
- feature authoring helpers: `defineFeature`, `importFeature`, `unregisterFeature`
- input mapping helper re-export: `keyMap`
- vector types: `VectorAnchorPoint`, `VectorPathStyle`
- render layer types: `RenderLayerRegistration`, `RegisterRenderLayerOptions`

`@asyra/feature-system`
- `defineFeature(name, keyConfig, definition)`
- `importFeature(featureName)`
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

`@asyra/props-manager`
- default `propsManager` singleton, `PropsManager` class
- registries: `propertyRegistry`, `propertyDefinitionRegistry`, `stateRegistry`
- schema APIs: `registerPropertySchema`, `getPropertySchema`, `propertySchemaRegistry`

`@asyra/scene-tree`
- default scene tree singleton, `SceneTree` class
- `componentRegistry`
- `createDynamicComponent`, `createDynamicPropsClass`, `createElement`

`@asyra/selection`
- default selection manager singleton
- `SelectionManager` class

`@asyra/system-context`
- default `systemContext` singleton
- `SystemContext` class

`@asyra/ui-context`
- default `uiContext` singleton
- `UIContext` class
- `propertyRegistry`
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
- Non-render packages must not import Pixi directly.
- Model mutation requests should be transaction-bounded by caller-side API boundaries.
- Deprecated APIs stay callable during transition, but new behavior should be built on current owners.
