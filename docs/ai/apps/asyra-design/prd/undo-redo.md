# PRD: Undo/Redo

## Problem

Users must be able to recover from mistakes through reliable undo and redo behavior.

## Goals

- consistent history behavior across major interactions
- predictable multi-step undo/redo
- avoid unintended transaction splitting

## Functional Requirements

1. Undo reverts most recent committed action.
2. Redo reapplies last undone action.
3. Multiple undo/redo operations maintain correct order.
4. History shortcuts are available from keyboard.
5. Drag-create interactions must commit as a compact single intended action (no move-spam history entries).
6. Drag-move interactions must undo/redo element position deterministically as one intended action.

## Constraints

- behavior depends on transaction boundaries in feature/common API mutation paths
- app currently delegates undo/redo to reactive-events API wrappers

## Success Criteria

- `undo-redo.spec.ts` passes
- creation workflows produce expected reversible history
- drag-create undo behavior remains compact and deterministic

## References

- `apps/asyra-design/src/features/undo-redo/index.ts`
- `apps/asyra-design/src/common-apis/history.ts`
- `apps/asyra-design/src/common-apis/transaction.ts`
