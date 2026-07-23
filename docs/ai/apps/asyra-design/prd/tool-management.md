# PRD: Tool Management

## Problem

Users need quick, reliable switching between primary tools with clear active-state feedback.

## Goals

- keyboard-first and toolbar-based switching
- explicit active tool state for UI and tests
- predictable behavior when switching during active modes

## Current Tool Set

- Select (`v`)
- Rectangle (`r`)
- Oval (`o`)
- Pen (`p`)

## Functional Requirements

1. Keyboard shortcuts switch primary tool.
2. Toolbar button clicks switch primary tool.
3. Active tool is reflected in toolbar state (`data-active`).
4. While in path-editing mode:
   - switching to Select keeps path editing active and disconnects preview segment.
   - switching to Pen keeps path editing active.
   - switching to other tools exits path editing and leaves Select active.
5. Switching to pen does not automatically enter path editing.
6. Every path-editing exit leaves Select as the active tool.

## Non-Functional Requirements

- switch response should be immediate
- active tool indicator should always match system state

## Success Criteria

- `tool-switching.spec.ts` and `oval.spec.ts` tool-switch checks pass
- no stale tool state after rapid key/button switching

## References

- `apps/asyra-design/src/features/switch-primary-tool/index.ts`
- `apps/asyra-design/src/config/key-combinations.ts`
- `apps/asyra-design/src/toolbar/tool-button.tsx`
