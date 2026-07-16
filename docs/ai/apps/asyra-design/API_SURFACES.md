# Asyra Design API Surfaces

This file is the app-level API contract map.

## Common APIs (`src/common-apis/*`)

Import boundary:

- `import { ...Apis } from 'src/common-apis'`
- `import { defineFeature, getFeature, keyMap } from '@asyra/core'` for golden-path feature/input helpers
- preset composition imports public `applyPreset` and, when needed, its public
  engine/bundle/result/error types from `@asyra/preset`; the app never
  deep-imports preset composition internals. Custom property type constants
  remain public `@asyra/utils` imports
- app startup uses ordinary Core APIs for customization:
  `removeComponentPropertyRelation` / `defineComponentPropertyRelation` for
  structural slots, or owner-specific `unregister -> define/register` for a
  complete implementation change
- `unregisterPropertyRegistration(type, scope)` is low-level schema/runtime
  cleanup; `unregisterPropertyType(type)` removes a complete graph capability

`elementApis` (`src/common-apis/element/index.ts`)

- `isContainerType(type: string): boolean`
- `getElementIdAtWorkspacePos(workspacePos: PositionData): string | null`
- `getElementIdAtClientPos(clientPos: PositionData): string | null`
- `getElementType(elementId: string): string | undefined`
- `isElementLocked(elementId: string): boolean`
- `getElementBounds(elementId: string): { x: number; y: number; width: number; height: number } | null`
- `getElementIdsInBounds(bounds: { x: number; y: number; width: number; height: number }): string[]`
- `getElementPosition(elementId: string): { x: number; y: number } | null`
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
- `getVectorSegmentAtWorkspacePos(elementId: string, workspacePos: PositionData, hitRadius?: number): string | null`
- `getVectorSegmentAtClientPos(elementId: string, clientPos: PositionData, hitRadius?: number): string | null`
- `getVectorSegmentHitAtWorkspacePos(elementId: string, workspacePos: PositionData, hitRadius?: number): { segmentId: string; position: PositionData; t: number } | null`
- `getVectorSegmentHitAtClientPos(elementId: string, clientPos: PositionData, hitRadius?: number): { segmentId: string; position: PositionData; t: number } | null`
- `isPointNearVectorPathAtWorkspacePos(elementId: string, workspacePos: PositionData, hitRadius?: number): boolean`
- `isPointNearVectorPathAtClientPos(elementId: string, clientPos: PositionData, hitRadius?: number): boolean`
- `getVectorAnchorPointById(elementId: string, pointId: string): { point: VectorAnchorPoint; index: number } | null`
- `appendVectorAnchorPoint(elementId: string, point: VectorAnchorPoint, options?: { startNewSubpath?: boolean; continuation?: { networkId: string; pointId: string; side: VectorEndpointSide } | null }): { point: VectorAnchorPoint; index: number } | null`
- `getVectorAnchorContinuation(elementId: string, pointId: string): { networkId: string; pointId: string; side: VectorEndpointSide } | null`
- `connectVectorAnchorEndpoints(elementId: string, sourcePointId: string, targetPointId: string): { closed: boolean } | null`
- `connectVectorAnchorPoints(elementId: string, sourcePointId: string, targetPointId: string): { closed: boolean } | null`
- `removeLastSinglePointSubpath(elementId: string): boolean`
- `removeVectorAnchorPoint(elementId: string, pointId: string): boolean`
- `splitVectorSegmentAtWorkspacePos(elementId: string, segmentId: string, workspacePos: PositionData): { point: VectorAnchorPoint; index: number } | null`
- `setVectorClosed(elementId: string, closed: boolean): void`
- `updateVectorAnchorPointPosition(elementId: string, pointId: string, position: PositionData, options?: { undoable: boolean }): { point: VectorAnchorPoint; index: number } | null`
- `updateVectorAnchorPointType(elementId: string, pointId: string, type: 'smooth' | 'sharp'): { point: VectorAnchorPoint; index: number } | null`
- `getVectorAnchorPointHandleMode(elementId: string, pointId: string): VectorHandleMode`
- `setVectorAnchorPointHandleMode(elementId: string, pointId: string, mode: VectorHandleMode): { point: VectorAnchorPoint; index: number } | null`
- `updateVectorAnchorPointHandlePosition(elementId: string, pointId: string, target: 'inHandle' | 'outHandle', position: PositionData, options?: { undoable: boolean }): { point: VectorAnchorPoint; index: number } | null`
- `updateVectorAnchorPointHandles(elementId: string, updates: { pointId: string; target: 'inHandle' | 'outHandle'; position: PositionData | null; forceSmooth?: boolean }[], mutationOptions?: { undoable: boolean; skipResult?: boolean }): void`
- `getMousePosInWorkspace(clientPos: PositionData): PositionData | null`
- `createElement(options: { type: EntityType; clientPosition?: PositionData; width?: number; height?: number; points?: Record<string, VectorPointNode>; segments?: Record<string, VectorSegment>; networks?: Record<string, VectorNetwork>; closed?: boolean }, mutationOptions?: EVENT_OPTIONS): string | null`
  - initializes default `fills` payload by element type
  - omitted `width`/`height` remain absent from the creation payload so component/property initial data owns the initial dimensions
  - create-tool sessions use `sharedDelivery: 'immediate'` for the initial undoable ADD_ELEMENT so Contents and render projection become visible before pointer-up without splitting the undo commit
- `createVectorElementFromSinglePoint(pointId: string, position: PositionData, mutationOptions?: { undoable: boolean }): string | null`
- `deleteElement(elementId: string, options?: { undoable: boolean }): boolean`
- `resetElementSize(elementId: string): void`
- `setElementPositions(positionsById: Record<string, PositionData>, options?: EVENT_OPTIONS): void`
- `hasMovedBeyondThreshold(clientDragStart: PositionData, clientCurrentPos: PositionData, threshold?: number): boolean`
- `changeComputedData(elementIds: string[], data: Record<string, DataTypes>, options?: { undoable: boolean }): void`
  - `vectorGeometry` helper (exported from `src/common-apis/element`):
    - `validate(topology, label?)`
    - `addPoint(...)`, `movePoint(...)`, `splitSegment(...)`, `updatePoint(...)`, `removePoint(...)`, `connectEndpoints(...)`, `connectAnchors(...)`
    - `setHandleMode(...)`, `updateHandle(...)`, `buildPatch(topology, options?)`

`selectionApis` (`src/common-apis/selection.ts`)

- `getSelectedIds(): string[]`
- `getVectorPointSelectionIds(): string[]`
- `getVectorSegmentSelectionIds(): string[]`
- `getSelectedVectorPoints(): { elementId: string; pointId: string; target: 'anchor' | 'inHandle' | 'outHandle' }[]`
- `getSelectedVectorSegments(): { elementId: string; segmentId: string }[]`
- `clearSelection(options?: { undoable: boolean }): void`
- `toggleSelection(elementId: string, options?: { undoable: boolean }): void`
- `selectElements(elementIds: string[], options?: { undoable: boolean }): void`
- `selectVectorPoints(pointIds: string[], options?: { undoable: boolean }): void`
- `selectVectorPoint(point: { elementId: string; pointId: string; target: 'anchor' | 'inHandle' | 'outHandle' }, options?: { undoable: boolean }): void`
- `clearVectorPointSelection(options?: { undoable: boolean }): void`
- `selectVectorSegments(segmentIds: string[], options?: { undoable: boolean }): void`
- `selectVectorSegment(segment: { elementId: string; segmentId: string }, options?: { undoable: boolean }): void`
- `clearVectorSegmentSelection(options?: { undoable: boolean }): void`
- `encodeVectorPointSelectionId(...)` / `decodeVectorPointSelectionId(...)`
- `encodeVectorSegmentSelectionId(...)` / `decodeVectorSegmentSelectionId(...)`

`systemContextApis` (`src/common-apis/system-context.ts`)

- `switchPrimaryTool(tool: string): void`
- `getStrokeDebugDisableVisualOverlapCollapse(): boolean`
- `setStrokeDebugDisableVisualOverlapCollapse(enabled: boolean): void`
- `getSystemContextSnapshot(): SystemContextSnapshot`
- `updateHoveredElementId(elementId: string | null): void`
- `getAreaSelection(): { dragStart: PositionData; dragCurrent: PositionData; additive: boolean } | null`
- `setAreaSelection(selection: { dragStart: PositionData; dragCurrent: PositionData; additive: boolean } | null): void`
- `clearAreaSelection(): void`
- `getPathEditingVectorId(): string | null`
- `getPathEditingMode(): boolean`
- `setPathEditingMode(enabled: boolean): void`
- `setPathEditingVectorId(elementId: string | null): void`
- `getPathEditingStartNewSubpath(): boolean`
- `setPathEditingStartNewSubpath(value: boolean): void`
- `getSelectedVectorPoint(): SelectedVectorPointState | null`
- `setSelectedVectorPoint(point: SelectedVectorPointState | null): void`
- `getHoveredVectorPoint(): SelectedVectorPointState | null`
- `setHoveredVectorPoint(point: SelectedVectorPointState | null): void`
- `getSelectedVectorSegment(): { elementId: string; segmentId: string } | null`
- `setSelectedVectorSegment(segment: { elementId: string; segmentId: string } | null): void`
- `getHoveredVectorSegment(): { elementId: string; segmentId: string } | null`
- `setHoveredVectorSegment(segment: { elementId: string; segmentId: string } | null): void`
- `getHoveredVectorSegmentInsertPoint(): { elementId: string; segmentId: string; x: number; y: number } | null`
- `setHoveredVectorSegmentInsertPoint(point: { elementId: string; segmentId: string; x: number; y: number } | null): void`
- `getActiveGradientFill(): { elementId: string; fillId: string } | null`
- `setActiveGradientFill(fill: { elementId: string; fillId: string } | null): void`
- `getHoveredGradientHandle(): { elementId: string; fillId: string; handleIndex: 0 | 1 } | null`
- `setHoveredGradientHandle(handle: { elementId: string; fillId: string; handleIndex: 0 | 1 } | null): void`
- `getSelectedGradientHandle(): { elementId: string; fillId: string; handleIndex: 0 | 1 } | null`
- `setSelectedGradientHandle(handle: { elementId: string; fillId: string; handleIndex: 0 | 1 } | null): void`
- `clearGradientFillEditingState(): void`
- `SelectedVectorPointState` target contract:
  - `target: 'anchor' | 'inHandle' | 'outHandle'`
- `clearVectorPointState(): void`
- selection ownership note:
  - `selectedVectorPoint` is compatibility mirror state derived from `vectorPointSelection`
  - `selectedVectorSegment` is compatibility mirror state derived from `vectorSegmentSelection`
- source-of-truth for selected vector points/segments is SelectionManager channel state
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

`fillApis` (`src/common-apis/fills.ts`)

- `getCanvasBounds(): DOMRect | null`
- `getCanvasPositionFromClient(clientPos: PositionData, canvasBounds?: DOMRect | null): PositionData`
- `getFillById(elementId: string, fillId: string): FillAttrs | null`
- `getGradientHandleGeometry(elementId: string, fillId: string): { elementId: string; fillId: string; fill: FillAttrs; width: number; height: number; canvasHandles: [PositionData, PositionData] } | null`
- `getGradientHandleHitAtClientPos(elementId: string, fillId: string, clientPos: PositionData, hitRadius?: number): { handleIndex: 0 | 1 } | null`
- `getNextGradientForHandleAtClientPosition(elementId: string, fillId: string, handleIndex: 0 | 1, clientPos: PositionData): FillGradientData | null`
- `getNextGradientForHandleWithDelta(baseGradient: FillGradientData, handleIndex: 0 | 1, width: number, height: number, delta: PositionData): FillGradientData`
- `updateGradientHandleAtClientPosition(elementId: string, fillId: string, handleIndex: 0 | 1, clientPos: PositionData, options?: { undoable: boolean }): FillGradientData | null`
- `updateFillFields(...)` / `updateFillField(...)`

`transactionApis` (`src/common-apis/transaction.ts`)

- `startTransaction(): void`
- `updateTransaction(eventName, payload, options?): void`
- `endTransaction(options?): void`
- `rollbackTransaction(failure?): void`
- `runTransaction(callback, options?)`: finite synchronous/asynchronous work
  commits on success and rolls back thrown/rejected work

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

- `changeElementComputedData(key: string, data: DataTypes, options?: EVENT_OPTIONS): void`
  - numeric keys (`x`, `y`, `width`, `height`, `rotation`) reject non-finite values
  - structured keys (for example `fills`) route as-is to runtime schema validation

## Input and Feature Trigger Map

Input constants (`src/constants/*`):

- drag: `input.drag.start`, `input.drag.update`, `input.drag.end`
- pointer: `input.double.click`, `input.mouse.move`, `input.wheel.scroll`
- shortcuts: `input.shortcut.switchPrimaryTool`, `input.shortcut.enter`, `input.shortcut.cancel`, `input.shortcut.delete`, `input.shortcut.undoredo`, `input.shortcut.zoomPreset`
- feature IDs:
  - grouped source constants: `ToolFeatureNames`, `ElementFeatureNames`, `ViewportFeatureNames`, `HistoryFeatureNames`, `VectorPathFeatureNames`, `GradientFeatureNames`
  - flattened source of truth for usage: `FeatureNames.*`

Feature registry (`src/features/index.ts`):

- active drag sessions use `commit-current` for user-driven Escape, tool switch,
  pointer cancel, and conflicting new-action interruption; the current preview
  is finalized as one undoable action before the next feature executes
- handler error and timeout remain rollback outcomes

- `switch-primary-tool`
- `create-element`
- `move-elements`
- `selection`
- `delete-element`
- `delete-vector-point`
- `hover-element`
- `zoom`
- `zoom-fit`
- `pan`
- `undo-redo`
- `pen-tool`
- `gradient-fill-handles`

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

- `move-elements`

  - `selectionApis.getSelectedIds`
  - `systemContextApis.getPathEditingMode`
  - `elementApis.getElementIdAtClientPos` / `getMousePosInWorkspace` / `isElementLocked`
  - `elementApis.getElementPosition` / `setElementPositions` / `hasMovedBeyondThreshold`

- `delete-element`

  - `selectionApis.getSelectedIds` / `selectElements`
  - `systemContextApis.getPathEditingMode`
  - `elementApis.deleteElement`
  - `systemContextApis.updateHoveredElementId`

- `delete-vector-point`

  - `systemContextApis.getPathEditingVectorId` / `clearVectorPointState`
  - `selectionApis.getSelectedVectorPoints`
  - `selectionApis.clearVectorPointSelection` / `clearVectorSegmentSelection`
  - `elementApis.removeVectorAnchorPoint`
  - `selectionApis.selectElements`

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
  - `selectionApis.selectVectorPoint` / `selectVectorSegment` and channel readers
  - `systemContextApis` path-editing, hover point, and compatibility point-state APIs
  - `cursorApis` for hover cursor feedback

- `gradient-fill-handles`
  - `fillApis.getGradientHandleHitAtClientPos` / `getNextGradientForHandleAtClientPosition` / `updateGradientHandleAtClientPosition`
  - `systemContextApis` active/hovered/selected gradient-handle state
  - `selectionApis.getSelectedIds`
  - `cursorApis` for gradient-handle hover/drag cursor feedback

## Usage Rules

- Feature files should call common APIs, not deep context/package internals.
- Feature files should use `FeatureNames` constants, not ad-hoc string literals.
- UI should read via providers/hooks and write via controller/common API paths.
- If API contract changes, update this file and the matching `features/*` doc in the same change.
