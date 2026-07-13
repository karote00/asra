# Epic: Vector Editing (Pen + Path Mode)

## Goal

Deliver vector creation/editing workflow comparable to professional design tool expectations for basic path editing.

## Included Capabilities

- pen-based vector creation
- path editing mode entry (Enter, double click)
- point hover and point selection
- point coordinate editing in properties panel
- escape-based split/exit behavior

## Implementation Streams

1. feature behaviors
- `penFeature`
- `selectVectorPointFeature`
- `hoverVectorPointCursorFeature`
- `cancelPenEditingFeature`
- enter-path-edit features

2. state model
- system properties for path-editing and point states

3. UI behavior
- point panel visibility
- cursor changes on point hover

## Done Criteria

- pen-tool E2E flow passes
- manual validation confirms expected escape semantics and point editing
