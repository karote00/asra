# Feature: Delete Selected Element

## Sources

- `src/features/delete-element/index.ts`

## Trigger

- event: `input.shortcut.delete`
- mode: execution
- priority: `100`
- exclusive: `true`

## Behavior

1. If exactly one element is selected:
- Delete/Backspace removes that element.
- Selection is cleared after deletion.

2. If no element is selected, or more than one is selected:
- no-op.

3. If path-editing mode is active:
- no-op (element deletion is blocked)
- vector-specific delete behavior is handled by vector-editing flow, not this feature

4. If deleted element is currently hovered target:
- trigger hover-element feature API (`importFeature(FeatureNames.HOVER_ELEMENT).reEvaluate(...)`)
- re-evaluate hover target from current mouse position using hover-element logic
- update hovered element id to the top-most remaining element under cursor, or `null` if none

## Transaction Contract

- element removal is executed as one transaction through `elementApis.deleteElement(...)`
- selection cleanup runs after successful delete in the same transaction (undo restores selection)
- hovered target is re-evaluated after successful delete (not a blind clear)
