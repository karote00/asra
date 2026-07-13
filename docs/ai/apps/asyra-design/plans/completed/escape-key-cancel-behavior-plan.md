# Plan: Escape Key Cancel Behavior Alignment

## Status

- Completed: 2026-03-13
- Outcome: Escape now clears vector selection first, exits path editing when no vector selection exists, and clears element selection when not editing.
- Canonical: `docs/ai/apps/asyra-design/plans/completed/escape-key-cancel-behavior-plan.md`

## Goal

Align Escape key behavior with updated path-editing and selection cancel rules.

## Scope

- App-level feature behavior for Escape (`input.shortcut.cancel`).
- Path editing and selection state only.
- No framework changes.

## Requirements

- If in path editing mode and point/segment selection exists: clear point/segment selection only.
- If in path editing mode and no point/segment selection: exit path editing mode.
- If not in path editing mode and element selection exists: clear element selection.

## Non-Goals

- No tool switching changes beyond cancel behavior.
- No geometry edits or topology changes on Escape.
- No new input mappings.

## Touch Points

- `apps/asyra-design/src/features/pen-tool/index.ts`
- `docs/ai/apps/asyra-design/features/pen-tool.md`

## Plan

1. Update the Escape feature execution to follow the new branching rules.
2. Ensure selection-clearing paths reset compatibility vector point/segment state.
3. Update feature documentation to reflect new Escape behavior.
4. Manual verification:
   - Path editing with selected point: Escape clears point selection only.
   - Path editing with selected segment: Escape clears segment selection only.
   - Path editing with no point/segment selection: Escape exits path editing mode.
   - Not path editing, element selected: Escape clears element selection.

## Exit Criteria

- Escape behavior matches the requirements above.
- Documentation updated for pen/path editing escape semantics.
