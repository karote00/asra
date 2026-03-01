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
  - readers: selection feature (hit target)

- `pathEditingVectorId`
  - owner: system-context
  - writers: pen/enter/cancel/switch-tool features
  - readers: pen feature, properties panel visibility logic

- `pathEditingStartNewSubpath`
  - owner: system-context
  - writers: pen cancel and append-point flow
  - readers: pen feature escape/subpath logic

- `selectedVectorPoint`
  - owner: system-context
  - writers: pen and select-vector-point flow
  - readers: vector-point property panel
  - state shape includes target type: `anchor` | `inHandle` | `outHandle`

- `hoveredVectorPoint`
  - owner: system-context
  - writers: hover-vector-point flow
  - readers: vector-point selection and cursor behavior
  - state shape includes target type: `anchor` | `inHandle` | `outHandle`

## UI Context Keys (App Registered)

- `elementSelection`
  - source: selection state
  - consumers: properties panel, content panel logic

- `flattenedElementIds`
  - source: scene-tree
  - consumers: content panel list rendering

- aggregate layout keys: `x`, `y`, `width`, `height`, `rotation`
  - source: aggregate registration over selected elements
  - consumers: property panel inputs

- mirrored system keys: `zoom`, `primaryTool`, path-editing keys
  - source: system context subscription
  - consumers: toolbar and path-editing UI

## Contract Rules

- state owner writes state; consumers must not mutate owner internals
- feature handlers write through app/common APIs where boundary exists
- UI reads derived values and writes through controllers/common APIs
