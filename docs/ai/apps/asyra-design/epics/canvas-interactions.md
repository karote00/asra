# Epic: Canvas Interactions

## Goal

Provide a coherent interaction system for creating, selecting, and navigating canvas content.

## Included Capabilities

- tool switching
- shape creation (rectangle/oval)
- selection and hover
- viewport zoom/pan/fit
- undo/redo across these operations

## Implementation Streams

1. feature behavior
- `create-element`
- `selection`
- `hover-element`
- `zoom`, `pan`, `zoom-fit`
- `undo-redo`

2. common APIs
- `common-apis/element`, `selection`, `viewport`, `history`

3. UI feedback
- toolbar active states
- contents panel selection state
- properties panel visibility

## Done Criteria

- corresponding E2E suites pass
- no regressions in core interaction loop after refactors
