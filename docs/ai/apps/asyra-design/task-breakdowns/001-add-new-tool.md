# Task Breakdown 001: Add New Tool

## Scope

Add one new primary tool with shortcut, toolbar button, and feature behavior.

## Steps

1. constants

- add tool constant in `src/constants/tools.ts`

2. key mappings

- add shortcut mapping in `src/config/key-combinations.ts`

3. toolbar

- add button in `src/toolbar/tool-button.tsx`

4. feature

- implement feature behavior in `src/features/*`
- register via `src/features/index.ts`

5. state/panel

- ensure provider/UI behavior is correct for new tool mode

6. tests

- add/update E2E coverage for switch + primary interaction

## Validation

- tool can be activated by key and button
- expected behavior executes and is undo-safe
