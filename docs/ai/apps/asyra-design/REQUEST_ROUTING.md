# App Request Routing (Asyra Design)

Use this file to quickly map a user request to app docs and source owners.

## Fast Route

1. classify request type
2. open mapped docs
3. confirm owner module
4. update docs in same owner scope

## Request Type -> Primary Docs

- tool switching behavior
  - `features/switch-primary-tool.md`
  - `modules/input-mapping.md`
  - `prd/tool-management.md`

- create rectangle/oval behavior
  - `features/create-element.md`
  - `modules/common-apis.md`
  - `prd/element-creation.md`

- element hover/selection behavior
  - `features/hover-element.md`
  - `features/selection.md`
  - `prd/element-selection.md`

- pen/path editing behavior
  - `features/pen-tool.md`
  - `rules/ui-data-flow.md`
  - `prd/pen-tool.md`
  - `epics/vector-editing.md`

- properties panel display/edit behavior
  - `modules/providers-and-ui.md`
  - `rules/ui-data-flow.md`
  - `prd/properties-panel.md`

- viewport behavior (zoom/pan/fit)
  - `features/viewport.md`
  - `modules/input-mapping.md`
  - `prd/viewport-navigation.md`

- undo/redo behavior
  - `features/undo-redo.md`
  - `modules/common-apis.md`
  - `prd/undo-redo.md`

- input shortcut mapping
  - `modules/input-mapping.md`
  - `features/*` touched by shortcut
  - `bdd-features/*` related behavior file

- startup/init wiring issues
  - `modules/init-and-startup.md`
  - `modules/controllers-and-state.md`
  - `ARCHITECTURE.md`

- E2E or selector regressions
  - `modules/e2e.md`
  - `rules/testing-contracts.md`
  - `bdd-features/README.md`

## Routing Rule

If request spans multiple behaviors:
- use the most specific `features/*` contract as primary
- use `modules/*` for ownership and boundary checks
- use `prd/*` for requirement intent and success criteria
