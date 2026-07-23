# Feature: Switch Primary Tool

## Sources

- `src/features/switch-primary-tool/index.ts`
- `src/config/key-combinations.ts`
- `src/toolbar/tool-button.tsx`
- `src/controllers/app.ts`

## Trigger

- event: `input.shortcut.switchPrimaryTool`
- mode: execution
- priority: default
- exclusive: default

## Behavior

1. Reads `snapshot.detail.primaryTool`.
2. Updates `primaryTool` through `systemContextApis.switchPrimaryTool`.
3. If path editing mode is active and target tool is `select`, keeps path editing mode and disconnects preview segment (`pathEditingStartNewSubpath = true`).
4. If target tool is `pen`, keeps path editing mode unchanged.
5. If target tool is neither `pen` nor `select`, exits path editing mode; the
   canonical exit contract makes `select` the final active tool.

## UI Contract

- Toolbar active state must reflect `primaryTool`.
- Keyboard shortcuts and toolbar click should produce the same final state.
- Every path-editing exit leaves Select active.

## Notes

- Tool switching is the canonical place where cross-tool path-editing handling is enforced.
