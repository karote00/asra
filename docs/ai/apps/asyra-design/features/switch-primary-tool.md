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
3. If path editing mode is active and target tool is not `pen`, exits path editing mode.
4. If target tool is `pen`, keeps path editing mode unchanged.

## UI Contract

- Toolbar active state must reflect `primaryTool`.
- Keyboard shortcuts and toolbar click should produce the same final state.

## Notes

- Tool switching is the canonical place where cross-tool path-editing cancellation is enforced.
