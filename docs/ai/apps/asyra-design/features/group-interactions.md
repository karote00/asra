# Feature: Group Interactions

## Sources

- `src/features/group-elements/index.ts`
- `src/controllers/group-commands.ts`
- `src/contents/GroupCommandControls.tsx`
- `src/contents/layer-hierarchy.ts`

## Trigger

- event: `input.shortcut.group`
- visible controls: Layers `Group` and `Ungroup` buttons
- mode: one-shot execution
- priority: `100`
- exclusive: `true`

## Behavior

- `Meta/Ctrl+G` groups the current eligible sibling selection.
- `Meta/Ctrl+Shift+G` ungroups one selected official Group.
- Editable targets bypass the shortcut.
- One command owns one outer transaction, canonical hierarchy operation, undo
  commit, grouped publication, and post-operation selection.
- Group selects the created official Group; Ungroup selects the canonical
  children returned by Preset/Scene Tree, including the empty result.
- Layers rows are projected from canonical `flattenedElementIds` and
  `elementDataMap`; Group collapse state is UI-local.

## Boundaries

- The app owns command availability, selection intent, controls, shortcuts,
  collapsed state, and visible row projection.
- Preset owns the official Group operation adapter and basic 2D
  coordinate/bounds normalization.
- Scene Tree remains the only parent membership, child order, subtree, cycle,
  and hierarchy validation/mutation owner.
- Factory owns transaction, rollback, undo/redo, and grouped publication.
- Render projects the committed canonical hierarchy without fallback state.

## Non-Goals

- No second Group component registration.
- No Frame/custom-container grouping, auto-layout, resize/scaling, clipping,
  symbols, or Render-only hierarchy repair.
