# Feature: Delete Vector Point (Path Editing)

## Sources

- `src/features/delete-vector-point/index.ts`

## Trigger

- event: `input.shortcut.delete`
- mode: execution
- priority: `110`
- exclusive: `true`

## Preconditions

1. `pathEditingVectorId` is active.
2. `pathEditingMode` is `true`.
3. Selected vector point channel contains a selected point on that same vector.
4. Selected target is `anchor`.

If any precondition fails, delete is a no-op in path-editing mode.

## Behavior

1. Delete/Backspace removes the selected anchor point from the active path-editing vector.
2. If removed point is an interior point of an open subpath:
- subpath is split into two open subpaths
- affected segment ids are regenerated
3. Point/segment selection channels are cleared after successful point delete.
4. Compatibility selected/hovered vector point states are cleared.
5. Active element selection is kept on the editing vector (`selectElements([pathEditingVectorId])`).

## Transaction Contract

- point removal runs in the same delete transaction through:
  - selected point source: `selectionApis.getSelectedVectorPoints()`
  - mutation: `elementApis.removeVectorAnchorPoint(...)`
- cleanup (`clearVectorPointSelection`, `clearVectorSegmentSelection`, `clearVectorPointState`) runs in that same transaction.

## Relationship to Element Delete

- Element-level delete behavior is documented in `delete-element.md`.
- In path-editing mode, this point-delete branch takes precedence over element deletion.
