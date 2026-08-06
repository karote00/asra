# Asyra Design API Surfaces

This file is the app-level API contract map.

## Socket-Authoritative Document Session

- `fileId` opens one mandatory socket document session for both one-Actor
  and multi-Actor use.
- The socket handshake provides one backend checkpoint, durable/head
  sequences, and the exact pending publication tail before authoritative
  reconciliation begins.
- The browser sends the existing Factory `SharedPublication` document changes
  and performs no persistence `PUT`, `DELETE`, receiver-side save,
  or commit-triggered full snapshot capture.
- The App retains unaccepted local publications in its durable IndexedDB
  outbox, remains locally editable while disconnected, and retries the socket
  once every 30 seconds without per-operation toast spam.
- The socket server assigns document sequence, fans out live publications, and
  flushes one ordered backend batch on a fixed three-second dirty window.
  The interval may be configured only between one and three seconds and is not
  a sliding debounce.
- The backend owns idempotent ordered materialization and returns the highest
  contiguous durable sequence.

Semantic authority:
`specs/socket-authoritative-document-session.md`.

Completed plan:
`plans/completed/socket-authoritative-document-persistence-plan.md`.

## AI Agent Reference

- `startApp(...)` requires one non-empty `fileId` as document and Collaboration
  session identity, then initializes the App without reading, seeding, or
  preloading any Agent action payload
- the required `fileId` selects the ordinary socket document session. Core
  loads the handshake checkpoint through its load-only boundary; local actions,
  Agent actions, Undo, and Redo publish their actual canonical changes through
  Factory, while accepted remote apply creates no receiver Undo or outbound
  echo
- `createServerActionBatchProvider(...)` is the single production
  provider composition. Its only request method is
  `requestActionBatch(input, { signal })`, which performs one same-origin HTTP
  request after Actor A presses Send and returns one server-prepared
  `AiActionBatch`
- that request carries the submitted intent, exact image attachment, App
  context, registered backend-facing action descriptions, attempt number, and
  abort ownership; no fileId, URL parameter, startup branch, resident batch, or
  IndexedDB response inbox selects its payload
- the checked-in `samples/crdt-7076` reference contains its exact input image,
  instruction text, and one ordered versioned `AiActionBatch` instruction file
  as its only drawing authority. Its backend accepts only the exact sample
  input, reads that instruction file directly, and returns its prepared Group
  plus 7,075 ordered Vector children for 7,076 total canonical elements. The
  sample retains no SVG, alternate drawing source, regeneration fallback, or
  request-time geometry reconstruction
- production startup always composes that provider, the confirmation broker,
  app-root-local conversation controller, current AI history projection, and
  one isolated `@asyra/ai-agent-runtime` instance. There is no URL activation
  switch or second provider execution route
- `createAiRuntimeInput(...)` composes the app-owned context,
  bounded action catalog, permission map, confirmation adapter, and common
  transaction adapter around the formal provider
- `runtime.run()` requests one `AiActionBatch`, and
  `runtime.resolveAiActionBatch(batch, { signal })` is the only Runtime
  resolution entry
- `AiActionBatch` contains one `batchId`, optional explanation, and ordered
  actions. Each action contains one id, registered name, server-prepared
  arguments, and bounded redaction-ready summary
- Runtime validates only the small control envelope: non-empty `batchId`,
  optional explanation type, non-empty actions, action id/name presence,
  duplicate action ids, and registered action names. It does not traverse or
  reinterpret item, path, point, style, bounds, coordinate, or geometry
  arguments
- resolution returns one `ResolvedAiActionBatch`; permission receives one
  `PermissionReadyAiActionBatch`; confirmation and terminal presentation
  receive one `AiActionBatchPreview`. Every stage preserves `batchId`
- Runtime does not recursively clone or freeze server-prepared arguments.
  Permission and execution receive the exact same arguments identity.
  `AiActionBatchPreview` retains and redacts only bounded summaries, never the
  complete arguments or composition geometry
- the reference action catalog contains only:
  - `request_drawing_detail_choice`
  - `insert_vector_composition`
  - `update_composition_elements`
  - `remove_ai_composition`
  - `set_element_visibility`
  - `select_elements`
- every registered action definition exposes exactly one backend-facing
  `inputSchema` plus one `execute(args, context)` function. `inputSchema`
  describes what the server must prepare; the frontend does not run it against
  returned action arguments and exposes no client model-prepare or
  model-validation path
- the production provider owns preparation of accepted/skipped roles, bounds,
  styles, paths, points, and one `PreparedDrawingArtifact` before returning the
  `AiActionBatch`. The 7,076 sample stores that already-prepared result in its
  ordered instruction file, so request handling performs no geometry
  preparation
- `insert_vector_composition` receives one server-prepared Group descriptor and
  ordered child descriptor slices with complete source creation data, exact
  loading bounds, stable ids, relationships, point counts, roles, and skipped
  evidence. The frontend passes those prepared descriptor identities directly
  to the App common API and plural Core route
- canonical topology and IDs remain owned by the ordinary App common API and
  plural Core route. The server-prepared artifact creates no canonical,
  Render, history, shared-data, or CRDT state directly
- provider-prepared compositions have no artificial item, subpath, per-path
  point, or composition point-count ceiling; acceptance is bounded only by the
  formal server contract and available machine resources
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
  `sharedDelivery: 'transaction-end'`; progressive composition batches and
  non-composition progressive mutations use ordinary immediate delivery inside
  the same outer transaction. Factory, canonical owners, Render, and optional
  Collaboration retain their ordinary ownership
- after the provider returns server-prepared loading bounds, the App sets one
  runtime-only `aiDrawingProgress` System Context value and
  commits an exact-bounds DOM compositor overlay, then crosses a browser paint
  opportunity before its first canonical mutation. CSS loading activity changes
  only transform and opacity; it has no JavaScript per-frame loop. The state is
  not canonical, persistent, shared, Render-owned, or an AI-only renderer and
  clears on success, failure, cancellation, or teardown
- composition insertion consumes one server-prepared Group descriptor followed
  by deterministic ordered server-prepared descriptor slices through the same
  plural `Core.createElementsInParent(...)` route. The App does not rebuild,
  validate, normalize, clone, or freeze a second geometry graph. Each successful
  slice completes ordinary projection and actual progress, then the single
  serialized action loop crosses a browser paint before the next slice. Vector
  topology remains in the server-issued coordinate space; no post-hoc
  full-composition move or geometry rewrite is part of the AI action
- in this progressive mode, each prepared slice uses a point count limit of
  2,048 and an element count limit of 32. One indivisible element may exceed
  only the point-count limit. No range is independently scheduled with a timer,
  and a pure microtask is not a cooperative host yield. Every slice uses the
  same plural Core surface; Core, Props Manager, and Scene Tree receive no AI
  mode, loading, progress, slice-size, or host-yield parameter
- the Group and every child batch remain inside one outer App transaction and
  create one intended Undo action. A fatal failure or Feature-owned
  cancellation rejects the action so ordinary transaction rollback removes the
  complete composition; already-visible immediate evidence uses Factory's
  ordinary compensation path
- the registered bulk action reuses the existing Factory transaction journal
  and Undo stack. Props and Scene owners emit their ordinary reversible
  before/after or add/remove changes once; no AI/bulk-specific forward/inverse
  history artifact or parallel applied-result mirror is created
- after successful canonical owner apply, the production action path performs
  no `save`, `isEqual`, finalize-save, full-document comparison, or evidence
  clone. Render/UI observes the ordinary canonical owner batch, while
  Collaboration receives only the minimal `SharedPublication`; its
  `artifactId` is wire correlation rather than a History reference
- Scene Tree and Props perform the one semantic data admission for the original
  local mutation. Factory creates `SharedPublication` only from accepted
  canonical evidence; after that handoff its payload is trusted product data.
  Transport validates security and wire integrity but does not recursively
  revalidate the product payload. The codec rejects unsupported or malformed
  wire values during its own encode/decode traversal rather than through a
  separate `isJsonTransportValue(payload)` pre-walk
- the live socket server sequences, deduplicates by publication identity plus
  encoded-byte digest, queues, and relays original opaque publication bytes
  without an admission document, product-payload decode, decoded deep equality,
  or re-encode. The backend decodes once for ordered atomic materialization
- a receiving client routes the decoded trusted publication into its recorded
  source slices. Factory keeps one progressive remote rollback journal open,
  Core receives one ordered canonical request per source slice, and the
  framework scheduler crosses a cooperative host-and-paint boundary between
  slices. The receiver creates no Undo, outbound echo, or browser save
- the App AI transaction runner acquires one document-interaction lock before
  opening that outer transaction and releases it only after commit or rollback
  plus history correlation. While locked, wheel input on the marked viewport
  continues through the ordinary pan/zoom Features and the marked Agent Cancel
  control remains available; every other DOM interaction is stopped before it
  can enter a Feature, UI mutation handler, canonical API, or History. Viewport
  navigation may cross its ordinary Feature transaction wrapper but produces no
  canonical or history evidence. The lock is a fixed App policy, not a second
  event bus, progress-state side effect, framework mode, or downstream API
  parameter
- collected App context supplies the App-owned prompt, registered action
  descriptions, and registered image-tool descriptors as provider request
  input. The server owns tool selection, model work, resource analysis, and
  construction of the returned action batch; the frontend response route does
  not execute image preparation while resolving that batch
- providers may use only App-registered tools. Intermediate image data remains
  outside canonical state, persistence, and collaboration, and the final
  server result must still enter the ordinary registered action executor
- conversation progress contains only the runtime's stable operational
  summaries. Settled UI summaries never render raw arguments, provider bodies,
  canonical ids, secrets, or private chain-of-thought
- the transaction adapter correlates a newly completed canonical action id with
  the active AI turn. The Message Bar may call ordinary history APIs only while
  that id remains the applicable current AI action; later actions invalidate it
- the reference app does not read, store, or send a browser-held server API
  key. Production providers should use an app/backend endpoint that owns
  vendor credentials and authorization
- Actor B never executes Actor A's resident server response. It receives the
  resulting drawing only through Actor A's canonical publications and the
  ordinary CRDT apply route

## DEV Runtime Diagnostics

- the explicit `aiPerformance=profile` diagnostic installs the human-only
  `window.__AiDrawingPerformance__`; retained counter and phase samples use
  independent 16,384-entry circular buffers, while scalar counter totals and
  release-eligibility facts remain exact after older samples are evicted.
  Profiling observes demanded frames and never schedules a frame itself
- `initCanvasPipelineDebugger()` dynamically imports the optional Core facade
  only when `import.meta.env.DEV` is true
- `window.__CanvasPipelineDebugger__` is a disabled-by-default
  `CanvasPipelineDebugger` console handle
- the console handle's `getSnapshot().fault` retains the latest observation or
  overlay projection failure message until the debugger is re-enabled or
  disposed
- `destroyCanvasPipelineDebugger()` disposes the handle and is also registered
  for HMR cleanup
- ordinary and collaboration Playwright suites use imported test access and a
  fixed document-event diagnostic operation whitelist. `window.__Core__`,
  `window.__Collaboration__`, `window.__CanvasPipelineDebugger__`, and
  `window.__AiDrawingPerformance__` exist only for a human in DevTools; product
  code and automation never consume them
- production startup has no debugger handle, trace, layer, or optional debugger
  implementation chunk

## Public Collaboration Reference Implementation

Accepted socket-authoritative target:

- the Asyra Design collaboration lifecycle owns a native IndexedDB outbox of
  immutable local `SharedPublication` values awaiting socket acceptance; this
  is transport recovery, not Core document persistence
- the lifecycle uses the outbox's explicit Factory-owned append boundary for
  immutable local publication evidence. The in-memory record retains that
  owner identity without a second source-side clone or recursive freeze, while
  the IndexedDB durable `put` still completes before socket send; the generic
  outbox append boundary still snapshots mutable input
- the server retains at most 256 publications and 256 MiB of accepted
  publication evidence behind one in-flight persistence request. Durable HTTP
  requests drain one contiguous prefix within an 8 MiB soft wire-byte limit,
  while one larger indivisible publication may travel alone; reaching the
  bounded admission limit pauses the source without closing its socket
- server canonical deletion materialization keeps the exact owned-property
  closure and persistence evidence, using one monotonic reference-queue cursor
  plus the existing visited set so large shared or cyclic property graphs do
  not incur repeated array-head compaction
- connection state and sync state remain distinct; disconnected local editing
  continues, fixed reconnect attempts occur at most once every 30 seconds, and
  ordinary toasts are limited to disconnected/reconnected transitions
- the server's 2 MiB connected-Peer frame queue remains live backpressure only;
  it is cleared on disconnect and never substitutes for the App outbox
- reconnect performs the authoritative checkpoint/tail handshake and
  reconciles pending local publications in server sequence before removing
  acknowledged outbox records

Semantic authority:
`specs/socket-authoritative-document-session.md`.

- The Asyra Design toolbar always exposes `Reset document` before the primary
  tool controls for every `fileId`. This control is permanent unless the
  product owner explicitly requests its removal.
- `resetStoredDocument()` is a standalone stored-document utility, not an App
  controller or Feature API. It reads the required `fileId`, sends
  `DELETE /api/documents/{encoded fileId}`, and always calls
  `window.location.reload()` after that request attempt settles. A missing,
  unreachable, or non-success backend still reports its error but cannot block
  refresh; a storage-free demo therefore returns to the formal empty App.
- Ordinary Vite development proxies that same-origin document route to
  `DOCUMENT_PERSISTENCE_BACKEND_URL`; the `ASYRA_E2E_DOCUMENT_BACKEND_URL`
  override remains test-only and takes precedence when explicitly configured.
- The document backend handles that DELETE by replacing the stored record with
  the formal empty checkpoint at durable sequence zero. Reset performs no Core
  mutation, transaction, History, Undo/Redo, Factory publication, CRDT,
  Selection, or Collaboration operation.

- `APP_URL` is the one app-origin contract shared by Vite,
  ordinary Playwright, visual review, collaboration E2E, and the reference
  WebSocket server's Origin validation
- one non-empty `fileId` is required to open the App document; it selects the
  App-owned document session identity and is future server authorization input,
  but it is never a Collaboration activation flag
- RenderApp prepares Collaboration before Core for every required `fileId`,
  including `crdt-7076-sample`, using configured
  `VITE_COLLABORATION_WS_URL` or same-origin `/collaboration`
- the composition maps `fileId` to both internal document and room identity and
  generates a full UUID actor identity per page
- one connected Actor is the single-Actor execution case; when another Actor
  opens the same configured document session, the same capability becomes the
  two-Actor CRDT execution case without changing App APIs or URL state
- the collaboration lifecycle supplies that actor identity to
  `idCounter.setNamespace(...)`; element/component/property IDs generated by
  concurrent pages therefore remain distinct without a transport-owned
  same-entity-ID policy
- the app supplies `{ fileId }` as opaque provider connection metadata; the
  WebSocket adapter forwards it unchanged and reports `connected` or `failed`
- `src/collaboration/protocol.ts` is the app-owned wire
  contract shared by the browser provider and reference server; it owns message
  discriminants, named request/server message variants composed into the
  public client/server unions, and runtime parsing of untrusted JSON. Binary
  publication frames encode and decode the exact minimal
  publication → slices → channel batches → deliveries hierarchy; decode does
  not reconstruct Factory records, inverse/history evidence, or removed
  top-level aliases
- remote Factory replay metadata remains transaction-control evidence only.
  Before Core canonical apply, the App reconstructs subtree-removal evidence
  from the exact canonical fields and does not forward replay mutation options
  into Scene Tree's exact-evidence comparison; there is no legacy payload
  branch or alias fallback
- the repository socket server performs no authentication or permission check
  and makes no production authorization claim; it delegates ordered
  materialization to the configured App backend
- Current startup requires `fileId`, opens the ordinary socket
  checkpoint/tail handshake, supplies its checkpoint through Core's load-only
  source, applies the bootstrap tail, and then activates live Collaboration.
  Core no longer persists local actions, Agent actions, Undo, or Redo; accepted
  remote apply also creates no receiver persistence save. Session failure
  starts from the formal provisional document, retains local publications in
  the App outbox, and reconciles them after a fresh handshake
- production builds retain the dynamically loaded collaboration path, but that
  loading boundary is an implementation split rather than an activation flag
- URL-level `document`, `room`, and `actor` parameters are not identity inputs;
  `fileId` is the one required document identity
- `window.__Collaboration__` is an intentionally retained human DevTools
  diagnostic/manual-test handle exposing immutable `identity`, `getStatus()`, `disconnect()`,
  `reconnect()`, `whenIdle()`, and `dispose()` after Collaboration startup

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
  - this transform optimization does not migrate, reformat, or rewrite
    persisted Vector values
- `getVectorAnchorPoints(elementId: string): VectorAnchorPoint[]`
- `getVectorAnchorSubpaths(elementId: string): VectorAnchorPoint[][]`
- `getVectorTopology(elementId: string): { points: Record<string, VectorPointNode>; segments: Record<string, VectorSegment>; networks: Record<string, VectorNetwork> }`
- `scaleVectorElementAroundCenter(elementId: string, scale: { scaleX: number; scaleY: number }, mutationOptions?: EVENT_OPTIONS): boolean`
  - applies the existing scale-around-center behavior through the ordinary
    canonical vector route
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
- `discardTransientVectorPreviews(elementIds: readonly string[]): void`
  - preflights the complete ordered vector batch, clears only App-owned
    transient topology/computed caches, then asks Core once to reproject the
    affected canonical Props into local computed data
  - this is forced-rollback cleanup, not a canonical mutation: it creates no
    Undo, shared publication, CRDT, or persistence evidence
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
- `createElementsInParent(options: readonly CreateElementOptions[], parentId: string, mutationOptions?: EVENT_OPTIONS): readonly string[] | null`
  - preflights and prepares the complete mixed ordinary/Vector batch before
    calling Core exactly once
  - direct non-Vector Group children require finite workspace coordinates and
    a finite parent workspace origin; Vector topology points retain their
    existing values while computed bounds become parent-local
  - returns an isolated frozen copy of Core's ordered canonical IDs; any
    preparation failure returns `null` before Core mutation
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
  - writes one continuous-gesture `x/y` sample for ordinary and Vector elements
    without inspecting or patching Vector topology
  - child-only moves do not normalize ancestor Groups or rebase siblings at
    any pointer sample or gesture finalization
- `hasMovedBeyondThreshold(clientDragStart: PositionData, clientCurrentPos: PositionData, threshold?: number): boolean`
- `updateElementProperties(elementIds: readonly string[], values: Readonly<Record<string, DataTypes>>, options?: EVENT_OPTIONS): void`
  - submits one plural canonical Core property replacement for the explicit
    targets inside one transaction
  - child-only geometry values do not project ancestor Group or sibling
    updates; an explicit official Group target may use the Group operation
    boundary required by its own contract
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

- `undo(options?: CooperativeRenderOptions): Promise<void>`
- `redo(options?: CooperativeRenderOptions): Promise<void>`
  - `mode` defaults to `progressive`; `mode: 'atomic'` is an explicit opt-out
    from intermediate host/paint yields
  - progressive mode defaults `maxItemsPerSlice` to 1,024 distinct canonical
    ids; callers may provide another positive safe-integer render budget
- `createAiHistoryProjection()` creates one disposable,
  app-root-local observer over canonical user-action, Undo, and Redo events
  - `beginTurn(turnId)` / `endTurn(turnId)` bracket transaction correlation
  - `getCurrentActionId()` exposes only the latest canonical action identity
  - `correlateCommittedAction(actionId)` accepts only that current identity
  - `undoCurrent()` / `redoCurrent()` return `Promise<boolean>`, fail closed
    when the correlated action is stale or another replay is pending, and
    resolve only after canonical completion
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
- `configureSharedDeliverySequence(sequence): void`: delegates an
  already-decided delivery sequence to the active Factory transaction and
  fails when no transaction is active. Create, move, and Pen sessions use
  `batchPublications: false` before their first mutation; Factory retains the
  actual source-delivery order for Undo/Redo without splitting the action's
  History entry

## Controller APIs (`src/controllers/*`)

`controllers/app.ts`

- `destroyRenderApp(): void`
- `setupInputSystem(canvas: HTMLElement): void`
- `renderIsReady(): void`
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

- `updateSelectedElementProperties(key: string, data: DataTypes, options?: EVENT_OPTIONS): void`
  - numeric keys (`x`, `y`, `width`, `height`, `rotation`) reject non-finite values
  - structured keys (for example `fills`) route through the same plural
    canonical property replacement and runtime schema validation

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
  - no Group normalization for child-only gesture samples or finalization

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
  - `elementApis.discardTransientVectorPreviews` only from forced-rollback
    `onCancel`; ordinary `commit-current` interruption finalizes through
    `onEnd`
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
