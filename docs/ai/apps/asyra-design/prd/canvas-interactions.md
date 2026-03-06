# PRD: Canvas Interactions

## Problem

Asyra Design needs a predictable, fast canvas interaction model for shape creation, selection, path editing, and navigation.

## Goals

- deterministic interaction behavior
- responsive tool switching and feedback
- state-driven render and panel updates
- stable undo/redo semantics

## In Scope

- rectangle/oval creation
- single selection and deselection
- delete selected element / selected vector anchor behavior
- viewport zoom/pan/zoom-fit
- pen tool path editing core behavior
- undo/redo integration

## Out of Scope (Current)

- advanced bezier handles
- lasso/marquee selection
- auto-layout behavior UX

## Functional Requirements

1. Input-to-feature routing must be deterministic via feature priorities/exclusive rules.
2. Shape creation supports click default size and drag dynamic size.
3. Selection works from canvas and contents panel.
4. Delete shortcuts remove selected element in standard mode and route to selected anchor-point delete in path-editing mode.
5. Path editing mode allows vector point-centric workflows.
6. Viewport supports zoom (modifier wheel), pan (plain wheel), zoom-fit shortcut.
7. Undo/redo reflects intended interaction unit boundaries.

## Non-Functional Requirements

- interaction response should feel immediate (<100ms for visible updates)
- frame update should remain smooth for normal document sizes
- behavior should be consistent across repeated operations

## Success Metrics

- core E2E suites pass reliably
- no major regressions in tool switching, selection, creation, or history
- delete behavior remains deterministic across standard and path-editing modes
- manual workflow validation of pen/path editing passes

## Current Implementation References

- `apps/asyra-design/src/features/*`
- `apps/asyra-design/src/common-apis/*`
- `apps/asyra-design/e2e/*`
