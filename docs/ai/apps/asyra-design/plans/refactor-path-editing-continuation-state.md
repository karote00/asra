# Plan: Refactor Path Editing Continuation State

## Objective
Reduce computational overhead and complexity in the Pen Tool by moving the "continuation endpoint" logic (identifying which point the pen tool should connect to next) into the `systemContext`.

## Problem Statement
The current implementation in `pen-tool/index.ts` manually calculates the `sourceEndpoint` by:
1. Fetching all subpaths for the vector being edited.
2. Fetching and decoding all vector point selections.
3. Matching the selected point to the subpaths to find its endpoint side.
4. Falling back to the last point of the last subpath if no selection exists.

This logic is executed frequently (mouse moves, clicks, hover previews) and is duplicated across different paths of the pen tool.

## Technical Approach

### 1. Data Model
Define the continuation state in `apps/asyra-design/src/common-apis/system-context.ts`:
```typescript
export interface PathEditingContinuationState {
  elementId: string;
  pointId: string;
  side: VectorEndpointSide;
}
```

### 2. System Context Updates
- Register `pathEditingContinuation` as a managed property in `systemContext`.
- Add `getPathEditingContinuation` and `setPathEditingContinuation` to `systemContextApis`.

### 3. Reactive Synchronization
Implement an observer/helper that updates this state whenever:
- `selection.vectorPoint` changes.
- `pathEditingVectorId` changes.
- The topology of the active vector changes (e.g., points added/removed).

### 4. Pen Tool Simplification
- Remove the "heavy" calculation block from `pen-tool/index.ts`.
- Replace it with a call to `systemContextApis.getPathEditingContinuation()`.
- Ensure the hover preview logic also consumes this shared state.

## Success Criteria
- [ ] Pen tool functions identically to the user (no regression).
- [ ] Code base is simplified in `pen-tool/index.ts`.
- [ ] `yarn react:build` and `yarn test:local` pass.
- [ ] Hover preview and point connection logic use a single source of truth for the "source" point.
