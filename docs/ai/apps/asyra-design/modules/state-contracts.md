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
  - writers: pen cancel and append-point flow
  - readers: pen feature escape/subpath logic

- `selectedVectorPoint`
  - owner: system-context
  - writers: selection compatibility init bridge (`init-selection-compatibility`)
  - readers: vector-point property panel
  - state shape includes target type: `anchor` | `inHandle` | `outHandle`
  - source-of-truth: derived compatibility mirror from `vectorPointSelection` selection channel

- `hoveredVectorPoint`
  - owner: system-context
  - writers: hover-vector-point flow
  - readers: vector-point selection and cursor behavior
  - state shape includes target type: `anchor` | `inHandle` | `outHandle`
  - pen-mode contract: only endpoint anchors are hoverable in connected-preview mode; split-preview mode suppresses point hover

- `selectedVectorSegment`
  - owner: system-context
  - writers: selection compatibility init bridge (`init-selection-compatibility`)
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

## Contract Rules

- state owner writes state; consumers must not mutate owner internals
- feature handlers write through app/common APIs where boundary exists
- UI reads derived values and writes through controllers/common APIs
