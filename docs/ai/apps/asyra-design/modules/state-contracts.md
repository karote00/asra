# Module: State Contracts

This file defines app-level state keys, owners, and primary consumers.

## System Context Keys

- `primaryTool`

  - owner: system-context
  - writers: tool switch feature, app controller wrappers
  - readers: toolbar provider, creation/selection/pen features

- `zoom`

  - owner: system-context
  - writers: viewport APIs/features
  - readers: toolbar zoom provider, render

- `viewportPosition`

  - owner: system-context
  - writers: viewport APIs/features
  - readers: render

- `hoveredElementId`

  - owner: system-context
  - writers: hover-element feature
  - readers: selection feature (hit target), content panel hover row state, selection overlay render layer

- `areaSelection`

  - owner: system-context
  - writers: selection feature (empty-canvas drag)
  - readers: area selection render layer
  - value contract: `{ dragStart, dragCurrent, additive } | null`

- `pathEditingVectorId`

  - owner: system-context
  - writers: pen/enter/cancel/switch-tool features
  - readers: pen feature, properties panel visibility logic

- `pathEditingMode`

  - owner: system-context
  - writers: pen/enter/cancel/switch-tool features
  - readers: delete/selection/switch-tool mode guards

- `pathEditingStartNewSubpath`

  - owner: system-context
  - writers: pen append/connect flow and enter/exit path editing helpers
  - readers: pen feature subpath/preview logic
  - pen source-select contract: `true` means the next anchor click chooses a
    continuation source without connecting; after that click, it becomes
    `false` and connected-preview can append or connect from the selected
    anchor

- `selectedVectorPoint`

  - owner: system-context
  - writers: selection compatibility init bridge (`init/derived-state/init-selection-compatibility`)
  - readers: vector-point property panel
  - state shape includes target type: `anchor` | `inHandle` | `outHandle`
  - source-of-truth: derived compatibility mirror from `vectorPointSelection` selection channel

- `hoveredVectorPoint`

  - owner: system-context
  - writers: hover-vector-point flow
  - readers: vector-point selection and cursor behavior
  - state shape includes target type: `anchor` | `inHandle` | `outHandle`
  - pen-mode contract: all anchors on the edited vector are hoverable in both
    source-select and connected-preview modes; handle hover remains disabled
    while pen is active

- `selectedVectorSegment`

  - owner: system-context
  - writers: selection compatibility init bridge (`init/derived-state/init-selection-compatibility`)
  - readers: vector path-editing render layer
  - source-of-truth: derived compatibility mirror from `vectorSegmentSelection` selection channel

- `hoveredVectorSegment`

  - owner: system-context
  - writers: hover-vector-point flow (segment hit fallback)
  - readers: vector path-editing render layer

- `hoveredVectorSegmentInsertPoint`

  - owner: system-context
  - writers: hover-vector-point flow (only in pen `segment-insert-preview` mode)
  - readers: vector path-editing render layer ghost insert-point preview
  - visibility rule: hidden while pen connected preview segment is active

- `activeGradientFill`

  - owner: system-context
  - writers: fills properties-panel editing flow
  - readers: gradient-handles render layer, gradient-handle hover/drag features
  - value contract: `{ elementId, fillId } | null`

- `hoveredGradientHandle`

  - owner: system-context
  - writers: gradient-handle hover feature
  - readers: gradient-handles render layer
  - value contract: `{ elementId, fillId, handleIndex } | null`

- `selectedGradientHandle`
  - owner: system-context
  - writers: gradient-handle drag feature
  - readers: gradient-handles render layer
  - value contract: `{ elementId, fillId, handleIndex } | null`

## UI Context Keys (Preset Registered)

- `elementSelection`

  - source: selection state
  - consumers: properties panel, content panel logic

- `vectorPointSelection`

  - source: selection state (`SelectionManager` `VECTOR_POINT` channel)
  - consumers: vector point/segment property and path-editing UI adapters

- `vectorSegmentSelection`

  - source: selection state (`SelectionManager` `VECTOR_SEGMENT` channel)
  - consumers: vector point/segment property and path-editing UI adapters

- `flattenedElementIds`

  - source: scene-tree
  - consumers: content panel list rendering

- aggregate layout keys: `x`, `y`, `width`, `height`, `rotation`

  - source: aggregate registration over selected elements
  - consumers: property panel inputs
  - when the single selected element is an official Group, Preset substitutes
    current descendant content bounds during the read-only selection
    UI-context recompute; it does not write those values to Core
  - child-only mutations while another element is selected do not derive,
    write, publish, or persist Group aggregate values

- `fills`

  - source: Preset UI-context `compute` over selected elements
    (`computed.fills`)
  - consumers: property panel fills section via `useFills()` / `useFill()`
  - value contract:
    - no selection -> `[]`
    - single selection -> `FillRowAttrs[]` (`ids: string[]` + resolved fill values)
    - non-single selection -> `MIX`
  - write path:
    - add/remove fill rows -> one plural complete-field replacement through
      `elementApis.updateElementProperties(...)` and
      `core.updateElementProperties(...)`
    - single-fill field edits -> one typed
      `core.patchElementProperties(...)` complete-record replacement
  - boundary rule: selection-change handling belongs to ui-context compute, not provider-local effects/subscriptions

- `strokes`

  - source: Preset UI-context `compute` over selected elements
    (`computed.strokes`)
  - consumers: property panel strokes section via `useStrokes()` /
    `useStroke()`
  - value contract:
    - no selection -> `[]`
    - single selection -> `StrokeRowAttrs[]` (`ids: string[]` + resolved
      stroke values)
    - non-single selection -> `MIX`
  - write path:
    - add/remove stroke rows -> one plural complete-field replacement through
      `elementApis.updateElementProperties(...)` and
      `core.updateElementProperties(...)`
    - single-stroke field edits -> one typed
      `core.patchElementProperties(...)` complete-record replacement
  - boundary rule: selection-change handling belongs to ui-context compute, not provider-local effects/subscriptions

- mirrored system keys: `zoom`, `primaryTool`, path-editing keys
  - source: system context subscription
  - consumers: toolbar and path-editing UI

## AI Bulk Geometry Data Boundary

- one registered bulk drawing action remains one App action and one existing
  Factory Undo entry, but it does not merge all requested shapes into one
  element record
- a bulk action containing 100 Vector items creates 100 independently
  addressable Vector element data records; when grouping is requested, the
  Group is one additional element record
- the data-owner layer calls these records canonical geometry data. Complete
  render topology is the Render-side projection built from that geometry data;
  Props/Scene preparation must not be described as constructing Render
  topology
- successful ordinary owner apply is trusted. No AI/bulk-specific
  forward/inverse history artifact, post-action save/equality/finalize pass, or
  evidence clone is part of this state boundary

## Vector Computed Geometry Keys

- `pointCoordinateSpace`

  - canonical owner: the Vector property component
  - persisted values retain their existing document contract; Render does not
    require a new marker or migrate this property for transform caching

- `points`

  - canonical owner: the vector element `points` property component; Scene
    derives its computed projection
  - canonical writers: `elementApis` geometry-data mutation helpers commit through
    the plural Core property patch route
  - transient drag writer: active Pen/vector-point drag uses the local computed
    preview route only; pointer-up commits canonical Props, while forced
    rollback clears the transient cache and reprojects canonical Props
  - readers: vector render strategy, vector path-editing render layer, pen/path editing queries

- `segments`

  - canonical owner: the vector element `segments` property component; Scene
    derives its computed projection
  - canonical writers: `elementApis` geometry-data mutation helpers commit through
    the plural Core property patch route
  - transient drag writer: local computed preview only; it produces no history,
    shared publication, CRDT data, or persistence snapshot
  - readers: vector render strategy, path hit-testing, vector path-editing render layer

- `networks`

  - canonical owner: the vector element `networks` property component; Scene
    derives its computed projection
  - canonical writers: `elementApis` geometry-data mutation helpers commit through
    the plural Core property patch route
  - transient drag writer: local computed preview only; cancellation restores
    the current canonical property projection
  - readers: vector render strategy, path-editing subpath flow, vector path-editing render layer

- `x`, `y`, `width`, `height`, `rotation`, and affine Render inputs

  - canonical owner: ordinary element property components
  - whole-element move, dimension, rotation, scale, skew, explicit
    Group/Ungroup normalization, and reparent operations update only
    element/hierarchy values
  - child-only geometry writes never add ancestor Group or sibling property
    updates
  - these operations never patch, clone, translate, or rebase `points`,
    `segments`, or `networks`
  - Render retains derived engine-local geometry across transform-only deltas;
    the retained projection is never canonical state

- `fills`

  - canonical owner: the element `fills` property component; Scene derives the
    corresponding local computed projection
  - writers:
    - add/remove fill rows through
      `elementApis.updateElementProperties(..., { fills })`
    - single-fill edits through `core.patchElementProperties(...)` by `fillId`
    - active gradient-handle drag through the same typed record patch by
      `fillId`
  - readers: preset render strategies (rect/oval/frame/vector), gradient-handles render layer

- `strokes`
  - canonical owner: the element `strokes` property component; Scene derives
    the corresponding local computed projection
  - writers:
    - add/remove stroke rows through
      `elementApis.updateElementProperties(..., { strokes })`
    - single-stroke edits through `core.patchElementProperties(...)` by
      `strokeId`
  - readers: preset render strategies and the strokes property section

## Contract Rules

- state owner writes state; consumers must not mutate owner internals
- feature handlers write through app/common APIs where boundary exists
- UI reads derived values and writes through controllers/common APIs
