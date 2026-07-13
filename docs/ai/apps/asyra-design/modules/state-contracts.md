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

## UI Context Keys (App Registered)

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

- `fills`
  - source: app-registered ui-context `compute` over selected elements (`computed.fills`)
  - consumers: property panel fills section via `useFills()` / `useFill()`
  - value contract:
    - no selection -> `[]`
    - single selection -> `FillRowAttrs[]` (`ids: string[]` + resolved fill values)
    - non-single selection -> `MIX`
  - write path:
    - add/remove fill rows -> `changeElementComputedData('fills', Array<string | FillAttrs>)`
    - single-fill field edits -> `core.updatePropertyById(fillId, ..., { ownerElementId, ownerPropertyName: 'fills' })` + `core.commitPropertyChanges(...)`
  - boundary rule: selection-change handling belongs to ui-context compute, not provider-local effects/subscriptions

- mirrored system keys: `zoom`, `primaryTool`, path-editing keys
  - source: system context subscription
  - consumers: toolbar and path-editing UI

## Vector Computed Geometry Keys

- `points`
  - owner: vector element computed data
  - writers: `elementApis` topology mutation helpers
  - readers: vector render strategy, vector path-editing render layer, pen/path editing queries

- `segments`
  - owner: vector element computed data
  - writers: `elementApis` topology mutation helpers
  - readers: vector render strategy, path hit-testing, vector path-editing render layer

- `networks`
  - owner: vector element computed data
  - writers: `elementApis` topology mutation helpers
  - readers: vector render strategy, path-editing subpath flow, vector path-editing render layer

- `fills`
  - owner: element computed data (via `fills` property component)
  - writers:
    - add/remove fill rows through `changeElementComputedData`
    - single-fill edits through child-property updates by `fillId`
    - active gradient-handle drag through child-property `gradient` updates by `fillId`
  - readers: preset render strategies (rect/oval/frame/vector), gradient-handles render layer

## Contract Rules

- state owner writes state; consumers must not mutate owner internals
- feature handlers write through app/common APIs where boundary exists
- UI reads derived values and writes through controllers/common APIs
