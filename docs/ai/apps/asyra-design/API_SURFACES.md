# Asyra Design API Surfaces

This file is the app-level API contract map.

## Optional AI Agent Reference

- `initApp({ ai })` defaults to AI-disabled and creates no AI runtime,
  provider, Feature, network request, listener, timer, or secret read
- `resolveAsyraDesignAiMode(window.location.search)` accepts only one exact
  `ai=mock` value; missing, empty, unknown, case-mismatched, or duplicate values
  keep the App AI-disabled
- explicit mock startup composes one deterministic provider with no
  external/model network access,
  app confirmation broker, app-root-local conversation controller, and current
  AI history projection; it reads no API key. Its same-origin VTracer demo tool
  remains inert until an explicit whole-image vectorization turn
- `composeAiAgentRuntime(...)` supports:
  - AI-disabled: no runtime and no AI Feature
  - provider-disabled: the AI Feature returns stable `unavailable` before
    context or transport
  - provider-enabled: one isolated `@asyra/ai-agent-runtime` instance
- `createAsyraDesignAiRuntimeInput(...)` composes the app-owned context,
  bounded action catalog, permission map, confirmation adapter, and common
  transaction adapter around an app-selected provider
- the reference action catalog contains only:
  - `request_drawing_detail_choice`
  - `insert_vector_composition`
  - `update_composition_elements`
  - `remove_ai_composition`
  - `set_element_visibility`
  - `select_elements`
- composition descriptors are strict, contain ordinary oval/vector elements
  inside the 2048×2048 workspace, and never accept provider-selected object
  ids or arbitrary property paths
- vector items and complete compositions have no artificial item, subpath,
  per-path point, or composition point-count ceiling; validation requires
  finite coordinates, internally consistent topology, unique semantic roles,
  and available machine resources
- `request_drawing_detail_choice` accepts no provider-selected labels, counts,
  warning copy, attachment data, or canonical ids. It resolves with registered
  App option ids and no canonical mutation; the App projects Balanced
  (7,111 elements, at least 115,000 points) and Maximum (27,471 elements,
  295,794 points) guidance and retains the original in-memory attachment for
  the selected follow-up turn
- follow-up updates consume only canonical ids projected from the preceding
  action result; each target is revalidated immediately before its common-API
  mutation
- recoverable per-object failures are returned as `partial` or `no-change`
  evidence; canonical mutation or grouping consistency failures reject the
  executor so the outer runtime transaction rolls back
- permission rules are explicit and default-deny; confirmation defaults to
  cancellation
- action executors call `src/common-apis/*` with `undoable: true`. Atomic
  mutations and composition Group/children use
  `sharedDelivery: 'transaction-end'`; non-composition progressive mutations
  retain ordinary immediate delivery. Factory, canonical owners, Render, and
  optional Collaboration retain their ordinary ownership
- composition insertion creates one canonical Group before one all-children
  `Core.createElementsInParentBatch(...)` request. Child create options carry
  the known parent workspace origin so ordinary Vector topology points remain
  in workspace coordinates while computed `x/y` are written directly in
  Group-local coordinates; no post-hoc full-composition move or geometry
  rewrite is part of the AI action
- progressive composition point budgets create publication boundaries only:
  2,048 points, then 4,096, then at most 8,192 per later slice, while one
  indivisible element may exceed the soft target. The App retains the original
  Factory delivery handle, places the Group first in the first slice, and
  completes the staged slices before that composition action returns and before
  any later ordinary immediate plan action, while remaining inside the one
  outer transaction. Slices never repeat canonical mutation or create another
  history action
- provider selection is replaceable; deterministic fake and generic HTTP
  providers use the same runtime and app action contracts
- collected App context includes a stable App-owned provider prompt that
  requires the provider to analyze the request, choose only App-registered
  image-preparation tools, pass the original or detached derived raster to the
  registered vectorizer, validate and post-process its result, estimate
  resource impact, and construct only registered action candidates. Runtime
  preflight, App impact presentation, Framework confirmation, and the ordinary
  executor remain later owners
- providers may not invent tools. The current Mock catalog exposes only
  whole-image VTracer; generic crop, segmentation, background removal, or
  reimage requirements fail before mutation. A future live provider may use
  those steps only when the App registers them, and all intermediate rasters
  remain detached from canonical state, persistence, and collaboration
- an accepted PNG, JPEG, or WebP attachment plus exact
  `Vectorize this image` or `將這張圖片轉換成可編輯向量圖形` intent invokes
  the same-origin App VTracer tool exactly once. WebP is decoded locally and
  normalized to detached in-memory PNG bytes before the tool call so VTracer
  decoder differences cannot change accepted-input behavior. The adapter
  validates the
  complete-raster SVG into deterministic generic-role ordinary Vector items
  and returns one existing `insert_vector_composition` action. A trace with one
  valid item still creates one ordinary Group containing that Vector, while an
  empty trace fails before mutation; it performs no
  semantic segmentation, background replacement, OCR, bitmap insertion,
  external/model request, or fixture fallback
- conversation progress contains only the runtime's stable operational
  summaries. Settled UI summaries never render raw arguments, provider bodies,
  canonical ids, secrets, or private chain-of-thought
- the transaction adapter correlates a newly completed canonical action id with
  the active AI turn. The Message Bar may call ordinary history APIs only while
  that id remains the applicable current AI action; later actions invalidate it
- the reference app does not read, store, or send a browser-held server API
  key. Production providers should use an app/backend endpoint that owns
  vendor credentials and authorization

## DEV Runtime Diagnostics

- `initCanvasPipelineDebugger()` dynamically imports the optional Core facade
  only when `import.meta.env.DEV` is true
- `window.__AsyraCanvasPipelineDebugger__` is a disabled-by-default
  `CanvasPipelineDebugger` console handle, independent from `__AsyraE2E__`
- the console handle's `getSnapshot().fault` retains the latest observation or
  overlay projection failure message until the debugger is re-enabled or
  disposed
- `destroyCanvasPipelineDebugger()` disposes the handle and is also registered
  for HMR cleanup
- ordinary and collaboration Playwright suites run the DEV app runtime because
  their canonical-state assertions use `window.__Core__` and
  `window.__AsyraE2E__`; production exclusion and bundling remain separate
  package/build gates
- production startup has no debugger handle, trace, layer, or optional debugger
  implementation chunk

## Public Collaboration Reference Implementation

- `ASYRA_DESIGN_APP_URL` is the one app-origin contract shared by Vite,
  ordinary Playwright, visual review, collaboration E2E, and the reference
  WebSocket server's Origin validation
- a non-empty `fileId` query parameter is the only public collaboration
  identity accepted by the reference composition
- the composition maps `fileId` to both internal document and room identity and
  generates a full UUID actor identity per page
- the collaboration lifecycle supplies that actor identity to
  `idCounter.setNamespace(...)`; element/component/property IDs generated by
  concurrent pages therefore remain distinct without a transport-owned
  same-entity-ID policy
- the app supplies `{ fileId }` as opaque provider connection metadata; the
  WebSocket adapter forwards it unchanged and reports `connected` or `failed`
- `src/collaboration/protocol.ts` is the app-owned wire
  contract shared by the browser provider and reference server; it owns message
  discriminants, named request/server message variants composed into the
  public client/server unions, and runtime parsing of untrusted JSON
- the memory-only public reference server performs no authentication or permission
  check and makes no production authorization claim
- Core load/save uses app-selected IndexedDB persistence. An ordinary URL
  retains document identity `FILE`; a non-empty `fileId` selects
  `FILE:<encoded fileId>`, so the same file shares one browser-local demo
  snapshot and different files remain isolated. An absent ordinary or
  collaboration document is initialized as an empty workspace, while an
  existing IndexedDB snapshot is not overwritten. When IndexedDB is empty, an
  eligible matching legacy localStorage snapshot is copied and its legacy key
  is removed only after the durable write succeeds. This is browser-local
  durability for the open-source reference demo, not a production shared
  database. A production product derived from Asyra Design must replace the
  App-selected provider with a server-backed database integration that owns
  authentication, authorization, backup, and migration policy
- URLs without `fileId` create no collaboration connection; production builds
  retain the dynamically loaded reference path so a deployed URL with `fileId`
  can use it without changing the persistence owner
- URL-level `document`, `room`, and `actor` parameters are not collaboration
  identity inputs
- `window.__AsyraCollaboration__` is an intentionally retained active-runtime
  diagnostic/manual-test handle exposing immutable `identity`, `getStatus()`, `disconnect()`,
  `reconnect()`, `whenIdle()`, and `dispose()`; it is absent
  when collaboration is disabled

## Common APIs (`src/common-apis/*`)

Import boundary:

- `import { ...Apis } from 'src/common-apis'`
- `import { defineFeature, getFeature, keyMap } from '@asyra/core'` for golden-path feature/input helpers
- preset composition imports public `applyPreset` and, when needed,
  `PresetProfiles`, `PresetDefaults`, `PresetCatalog`, or the public
  option/result/error types from `@asyra/preset`; the app never deep-imports
  preset composition internals. Custom property type constants remain public
  `@asyra/utils` imports
- app startup uses ordinary Core APIs for customization:
  `getPropertyTypeDefinition` / `redefinePropertyType` for one atomic
  declarative fixed-field change,
  `removeComponentPropertyRelation` / `defineComponentPropertyRelation` for
  structural slots, or owner-specific `unregister -> define/register` for a
  complete implementation change
- property redefinition does not adapt render/UI/commands or migrate stored
  documents; those app-owned consumers remain explicit and load hooks run
  before package validation
- `unregisterPropertyRegistration(type, scope)` is low-level schema/runtime
  cleanup; `unregisterPropertyType(type)` removes a complete graph capability

`hierarchyApis` (`src/common-apis/hierarchy.ts`)

- `groupElements(elementIds: readonly string[], options?: EVENT_OPTIONS): GroupOperationResult`
- `ungroupElement(groupId: string, options?: EVENT_OPTIONS): UngroupOperationResult`
- `moveElements(request: MoveHierarchyRequest, options?: EVENT_OPTIONS): MoveHierarchyResult`
- `removeSubtree(elementId: string, options?: EVENT_OPTIONS): RemoveSubtreeResult`
- The app chooses ids and any selection/UI behavior. The common API delegates
  canonical hierarchy validation to Core/Scene Tree and official Group
  coordinate/bounds behavior to Preset.

`elementApis` (`src/common-apis/element/apis.ts`)

- `isContainerType(type: string): boolean`
- `getElementIdAtWorkspacePos(workspacePos: PositionData): string | null`
- `getElementIdAtClientPos(clientPos: PositionData): string | null`
- `getRenderElementIdAtClientPos(clientPos: PositionData): string | null`
  - returns only the identity-safe Render hit and never falls back to
    workspace geometry; canvas hierarchy target resolution uses this exact
    query
- `getElementType(elementId: string): string | undefined`
- `isElementLocked(elementId: string): boolean`
- `getElementBounds(elementId: string): Rect | null`
- `getElementIdsInBounds(bounds: Rect): string[]`
- `getElementPosition(elementId: string): { x: number; y: number } | null`
- `isPointInsideElement(elementId: string, point: PositionData, padding?: number): boolean`
- vector topology contract:
  - canonical runtime/persistence model is `points` + `segments` + `networks`
  - no runtime geometry conversion from legacy `anchorPoints` shapes
- `getVectorAnchorPoints(elementId: string): VectorAnchorPoint[]`
- `getVectorAnchorSubpaths(elementId: string): VectorAnchorPoint[][]`
- `getVectorTopology(elementId: string): { points: Record<string, VectorPointNode>; segments: Record<string, VectorSegment>; networks: Record<string, VectorNetwork> }`
- `scaleVectorElementAroundCenter(elementId: string, scale: { scaleX: number; scaleY: number }, mutationOptions?: EVENT_OPTIONS): boolean`
  - scales every existing workspace anchor/control point around the vector's
    current bounds center, preserves point/segment/network ids and subpath
    topology, and commits recalculated bounds through the ordinary canonical
    vector patch route
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
- `appendVectorAnchorPoint(elementId: string, point: VectorAnchorPoint, options?: AppendVectorAnchorPointOptions): { point: VectorAnchorPoint; index: number } | null`
  - `AppendVectorAnchorPointOptions` combines subpath/continuation/structural
    intent inputs with ordinary `EVENT_OPTIONS`
  - structural intent validation owns the final `undoable` value while preserving
    caller-selected `sharedDelivery`, `shared`, and `rollbackable` mutation
    options
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
- `createElementsInParentBatch(options: readonly CreateElementOptions[], parentId: string, mutationOptions?: EVENT_OPTIONS): CanonicalElementBatchResult | null`
  - preflights and prepares the complete mixed ordinary/Vector batch before
    calling Core exactly once
  - direct non-Vector Group children require finite workspace coordinates and
    a finite parent workspace origin; Vector topology points remain in
    workspace coordinates while computed bounds become parent-local
  - returns Core's original ordered IDs, timing, and Factory-owned delivery
    handle without reconstructing them; any preparation failure returns `null`
    before Core mutation
- `createElement(options: { type: EntityType; clientPosition?: PositionData; workspacePosition?: PositionData; width?: number; height?: number; fills?: FillAttrs[]; strokes?: StrokeAttrs[]; points?: Record<string, VectorPointNode>; segments?: Record<string, VectorSegment>; networks?: Record<string, VectorNetwork>; closed?: boolean }, mutationOptions?: EVENT_OPTIONS): string | null`
  - initializes default `fills` payload by element type
  - an explicit `workspacePosition` bypasses Render/client-coordinate
    conversion and is converted only when the chosen parent requires it
  - explicit `fills` and `strokes` are forwarded unchanged for app-owned
    deterministic composition creation
  - omitted `width`/`height` remain absent from the creation payload so component/property initial data owns the initial dimensions
  - create-tool sessions use `sharedDelivery: 'immediate'` for the initial undoable ADD_ELEMENT so Contents and render projection become visible before pointer-up without splitting the undo commit
  - each applied create geometry update uses `sharedDelivery: 'immediate'`;
    pointer-up writes only a 100×100 click reset or a newer final pointer
    geometry, and the outer create session remains one undo commit
- `createVectorElementFromSinglePoint(pointId: string, position: PositionData, mutationOptions?: EVENT_OPTIONS): string | null`
- `deleteElement(elementId: string, options?: { undoable: boolean }): boolean`
  - delegates every existing non-workspace identity to the public canonical
    `removeSubtree` boundary; deleting a Group removes its complete subtree
    rather than leaving descendants attached to a missing parent
- `resetElementSize(elementId: string, options?: EVENT_OPTIONS): void`
- `setElementPositions(positionsById: Record<string, PositionData>, options?: EVENT_OPTIONS): void`
- `hasMovedBeyondThreshold(clientDragStart: PositionData, clientCurrentPos: PositionData, threshold?: number): boolean`
- `changeComputedData(elementIds: string[], data: Record<string, DataTypes>, options?: EVENT_OPTIONS): void`
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
- `createAsyraDesignAiHistoryProjection()` creates one disposable,
  app-root-local observer over canonical user-action, Undo, and Redo events
  - `beginTurn(turnId)` / `endTurn(turnId)` bracket transaction correlation
  - `getCurrentActionId()` exposes only the latest canonical action identity
  - `correlateCommittedAction(actionId)` accepts only that current identity
  - `undoCurrent()` / `redoCurrent()` fail closed when the correlated action is
    stale
  - the projection stores no history stack, inverse, canonical snapshot, or
    replay patch

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
- `getPrimaryFillColor(elementId: string): string | null`
- `getGradientHandleGeometry(elementId: string, fillId: string): { elementId: string; fillId: string; fill: FillAttrs; width: number; height: number; canvasHandles: [PositionData, PositionData] } | null`
- `getGradientHandleHitAtClientPos(elementId: string, fillId: string, clientPos: PositionData, hitRadius?: number): { handleIndex: 0 | 1 } | null`
- `getNextGradientForHandleAtClientPosition(elementId: string, fillId: string, handleIndex: 0 | 1, clientPos: PositionData): FillGradientData | null`
- `getNextGradientForHandleWithDelta(baseGradient: FillGradientData, handleIndex: 0 | 1, width: number, height: number, delta: PositionData): FillGradientData`
- `updateGradientHandleAtClientPosition(elementId: string, fillId: string, handleIndex: 0 | 1, clientPos: PositionData, options?: { undoable: boolean }): FillGradientData | null`
- `updateFillFields(...)` / `updateFillField(...)`
- `updatePrimaryFillColor(elementId: string, color: string, options?: EVENT_OPTIONS): boolean`
  - reads and updates only the first canonical fill property and returns
    `false` when the target has no fill or already has the requested color

`strokeApis` (`src/common-apis/strokes.ts`)

- `getPrimaryStrokeColor(elementId: string): string | null`
- `updatePrimaryStrokeColor(elementId: string, color: string, options?: EVENT_OPTIONS): boolean`
  - reads and updates only the first canonical stroke property and returns
    `false` when the target has no stroke or already has the requested color

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

`controllers/canvas-hierarchy-target.ts`

- `resolveCanvasHierarchyTarget(input): string | null`
  - validates the complete canonical `flattenedElementIds` /
    `elementDataMap` projection before resolving a raw Render hit
  - without `Meta`/`Ctrl`, resolves the nearest ancestor in the workspace or
    exact selected-`parentId` scopes; numerical depth is not a scope
  - with `Meta`/`Ctrl`, accepts only the existing non-Group raw Render hit
- `resolveCurrentCanvasHierarchyTarget(hitElementId, snapshot): string | null`
- `resolveCanvasHierarchyTargetAtClientPos(snapshot): string | null`
  - hover, selection, and pointer-down move share this current-state handoff;
    malformed or unmatched input fails closed without a raw-hit fallback

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
  - `elementApis.getPositionInParent`
  - `elementApis.changeElementGeometry`
  - `resolveCreateElementParentAtClientPos`
  - `selectionApis.selectElements`

- `selection`

  - `resolveCanvasHierarchyTargetAtClientPos`
  - `selectionApis.toggleSelection` / `selectElements` / `clearSelection`

- `move-elements`

  - `selectionApis.getSelectedIds`
  - `systemContextApis.getPathEditingMode`
  - `resolveCanvasHierarchyTargetAtClientPos`
  - `elementApis.getMousePosInWorkspace` / `isElementLocked`
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

  - `resolveCanvasHierarchyTargetAtClientPos` /
    `resolveCurrentCanvasHierarchyTarget`
  - `elementApis.getRenderElementIdAtClientPos` through the shared resolver
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
