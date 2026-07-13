# Golden Path: Add a Shape Tool

## Goal

Add a new shape tool (for example triangle/star) with creation, selection, and property panel support.

## Steps

1. Framework/component registration

- ensure component is defined and registered through framework/core path
- ensure render strategy exists for the new type

2. App tool constant + shortcut

- add tool type to `src/constants/tools.ts`
- add key mapping in `src/config/key-combinations.ts`

3. Toolbar button

- add icon/button state handling in `src/toolbar/tool-button.tsx`

4. Creation behavior

- extend `create-element` feature or add dedicated creation feature
- route creation through `elementApis.createElement`

5. Content + property panel

- ensure contents panel icon/name mapping works
- ensure aggregate/property panel shows expected fields

6. Verification

- create shape via shortcut
- create shape via toolbar button
- select/deselect works
- undo/redo works for creation

## Common Failures

- tool switches but creation logic not wired
- shape created but render strategy missing
- selector/test-id coverage not updated
