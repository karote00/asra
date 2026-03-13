# Plan: Auto-Switch To Select After Create

## Scope

Ensure the primary tool resets to Select after creating a rectangle or oval so the canvas does not remain in a create-tool state.

## Steps

1. create-element feature update
- switch primary tool to Select at the end of a successful create session
- keep switching gated to rectangle/oval tools only

2. documentation sync
- update create-element feature behavior notes

## Validation

- not run (behavioral change is isolated to app feature end state)

## Result

Completed on 2026-03-13.

- create-element now switches primary tool back to Select after creation completes
- create-element feature docs reflect the post-create tool reset
