# Asyra Design API Surfaces

This file is the app-level API contract map.

## Common APIs (`src/common-apis/*`)

Import boundary:

- `import { ...Apis } from 'src/common-apis'`
- `import { defineFeature, importFeature, keyMap } from '@asyra/core'` for golden-path feature/input helpers

`elementApis` (`src/common-apis/element/index.ts`)

- `isContainerType(type: string): boolean`
- `getElementIdAtWorkspacePos(workspacePos: PositionData): string | null`
- `getElementIdAtClientPos(clientPos: PositionData): string | null`
- `getElementType(elementId: string): string | undefined`
- `getElementBounds(elementId: string): { x: number; y: number; width: number; height: number } | null`
- `isPointInsideElement(elementId: string, point: PositionData, padding?: number): boolean`
- vector topology contract:
  - canonical runtime/persistence model is `points` + `segments` + `networks`
  - no runtime geometry conversion from legacy `anchorPoints` shapes
- `getVectorAnchorPoints(elementId: string): VectorAnchorPoint[]`
- `getVectorAnchorSubpaths(elementId: string): VectorAnchorPoint[][]`
- `getVectorTopology(elementId: string): { points: Record<string, VectorPointNode>; segments: Record<string, VectorSegment>; networks: Record<string, VectorNetwork> }`
- `getVectorAnchorPointAtWorkspacePos(elementId: string, workspacePos: PositionData, hitRadius?: number): { point: VectorAnchorPoint; index: number } | null`
- `getVectorAnchorPointAtClientPos(elementId: string, clientPos: PositionData): { point: VectorAnchorPoint; index: number } | null`
- `getVectorEditablePointAtWorkspacePos(elementId: string, workspacePos: PositionData, hitRadius?: number): { point: VectorAnchorPoint; index: number; target: 'anchor' | 'inHandle' | 'outHandle'; position: PositionData } | null`
- `getVectorEditablePointAtClientPos(elementId: string, clientPos: PositionData): { point: VectorAnchorPoint; index: number; target: 'anchor' | 'inHandle' | 'outHandle'; position: PositionData } | null`
- `isPointNearVectorPathAtWorkspacePos(elementId: string, workspacePos: PositionData, hitRadius?: number): boolean`
- `isPointNearVectorPathAtClientPos(elementId: string, clientPos: PositionData, hitRadius?: number): boolean`
- `getVectorAnchorPointById(elementId: string, pointId: string): { point: VectorAnchorPoint; index: number } | null`
- `appendVectorAnchorPoint(elementId: string, point: VectorAnchorPoint, options?: { startNewSubpath?: boolean }): { point: VectorAnchorPoint; index: number } | null`
- `removeLastSinglePointSubpath(elementId: string): boolean`
- `setVectorClosed(elementId: string, closed: boolean): void`
- `updateVectorAnchorPointPosition(elementId: string, pointId: string, position: PositionData): { point: VectorAnchorPoint; index: number } | null`
- `updateVectorAnchorPointType(elementId: string, pointId: string, type: 'smooth' | 'sharp'): { point: VectorAnchorPoint; index: number } | null`
- `updateVectorAnchorPointHandlePosition(elementId: string, pointId: string, target: 'inHandle' | 'outHandle', position: PositionData): { point: VectorAnchorPoint; index: number } | null`
- `updateVectorAnchorPointHandles(elementId: string, updates: { pointId: string; target: 'inHandle' | 'outHandle'; position: PositionData | null; forceSmooth?: boolean }[]): void`
- `getMousePosInWorkspace(clientPos: PositionData): PositionData | null`
- `createElement(options: { type: EntityType; clientPosition?: PositionData; points?: Record<string, VectorPointNode>; segments?: Record<string, VectorSegment>; networks?: Record<string, VectorNetwork>; closed?: boolean }, mutationOptions?: { undoable: boolean }): string | null`
- `createVectorElementFromSinglePoint(pointId: string, position: PositionData, mutationOptions?: { undoable: boolean }): string | null`
- `resetElementSize(elementId: string): void`
- `hasMovedBeyondThreshold(clientDragStart: PositionData, clientCurrentPos: PositionData, threshold?: number): boolean`
- `changeComputedData(elementIds: string[], data: Record<string, DataTypes>, options?: { undoable: boolean }): void`

`selectionApis` (`src/common-apis/selection.ts`)

- `getSelectedIds(): string[]`
- `clearSelection(options?: { undoable: boolean }): void`
- `toggleSelection(elementId: string, options?: { undoable: boolean }): void`
- `selectElements(elementIds: string[], options?: { undoable: boolean }): void`

`systemContextApis` (`src/common-apis/system-context.ts`)

- `switchPrimaryTool(tool: string): void`
- `getSystemContextSnapshot(): SystemContextSnapshot`
- `updateHoveredElementId(elementId: string | null): void`
- `getPathEditingVectorId(): string | null`
- `setPathEditingVectorId(elementId: string | null): void`
- `getPathEditingStartNewSubpath(): boolean`
- `setPathEditingStartNewSubpath(value: boolean): void`
- `getSelectedVectorPoint(): SelectedVectorPointState | null`
- `setSelectedVectorPoint(point: SelectedVectorPointState | null): void`
- `getHoveredVectorPoint(): SelectedVectorPointState | null`
- `setHoveredVectorPoint(point: SelectedVectorPointState | null): void`
- `SelectedVectorPointState` target contract:
  - `target: 'anchor' | 'inHandle' | 'outHandle'`
- `clearVectorPointState(): void`
- `enterPathEditingMode(elementId: string): void`
- `exitPathEditingMode(): void`
- compatibility aliases:
  - `getPenEditingVectorId()`
  - `setPenEditingVectorId(...)`

`viewportApis` (`src/common-apis/viewport.ts`)

- `getScale(): number`
- `getPosition(): PositionData`
- `zoomToCenter(scale: number, centerX: number, centerY: number): void`
- `panTo(x: number, y: number): void`
- `zoomFit(): void`

`historyApis` (`src/common-apis/history.ts`)

- `undo(): void`
- `redo(): void`

`renderLayerApis` (`src/common-apis/render-layer.ts`)

- `registerRenderLayer(registration: RenderLayerRegistration, options?: RegisterRenderLayerOptions): void`
- `unregisterRenderLayer(name: string): boolean`

`cursorApis` (`src/common-apis/cursor.ts`)

- `setCanvasCursor(cursor: string): void`
- `resetCanvasCursor(): void`

`transactionApis` (`src/common-apis/transaction.ts`)

- `startTransaction(): void`
- `updateTransaction(): void`
- `endTransaction(): void`

## Controller APIs (`src/controllers/*`)

`controllers/app.ts`

- `destroyRenderApp(): void`
- `setupInputSystem(canvas: HTMLElement): void`
- `renderIsReady(): void`
- `resetData(): void`
- `switchPrimaryTool(primaryTool: PrimaryToolType): void`

`controllers/element-selection.ts`

- `selectElements(elementIds: string[]): void`

`controllers/scene-tree.ts`

- `changeElementComputedData(key: string, data: DataTypes): void`

## Input and Feature Trigger Map

Input constants (`src/constants/*`):

- drag: `input.drag.start`, `input.drag.update`, `input.drag.end`
- pointer: `input.double.click`, `input.mouse.move`, `input.wheel.scroll`
- shortcuts: `input.shortcut.switchPrimaryTool`, `input.shortcut.enter`, `input.shortcut.cancel`, `input.shortcut.undoredo`, `input.shortcut.zoomPreset`
- feature IDs:
  - grouped source constants: `ToolFeatureNames`, `ElementFeatureNames`, `ViewportFeatureNames`, `HistoryFeatureNames`, `VectorPathFeatureNames`
  - flattened source of truth for usage: `FeatureNames.*`

Feature registry (`src/features/index.ts`):

- `switch-primary-tool`
- `create-element`
- `selection`
- `hover-element`
- `zoom`
- `zoom-fit`
- `pan`
- `undo-redo`
- `pen-tool`

## Feature -> API Usage Matrix (Primary)

- `switch-primary-tool`

  - `systemContextApis.switchPrimaryTool`
  - `systemContextApis.exitPathEditingMode`

- `create-element`

  - `elementApis.createElement`
  - `elementApis.changeComputedData`
  - `selectionApis.selectElements`

- `selection`

  - `elementApis.getElementIdAtClientPos`
  - `selectionApis.toggleSelection` / `selectElements` / `clearSelection`

- `hover-element`

  - `elementApis.getElementIdAtClientPos`
  - `systemContextApis.updateHoveredElementId`

- `zoom` / `pan` / `zoom-fit`

  - `viewportApis.zoomToCenter`
  - `viewportApis.panTo`
  - `viewportApis.zoomFit`

- `undo-redo`

  - `historyApis.undo` / `redo`

- `pen-tool`
  - `elementApis` vector APIs
  - `systemContextApis` path-editing and point state APIs
  - `cursorApis` for hover cursor feedback

## Usage Rules

- Feature files should call common APIs, not deep context/package internals.
- Feature files should use `FeatureNames` constants, not ad-hoc string literals.
- UI should read via providers/hooks and write via controller/common API paths.
- If API contract changes, update this file and the matching `features/*` doc in the same change.
