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
7. Each successful or partially successful mutating Agent turn creates one
   intended action; its Message Bar acts only while that AI action is current.
8. Failed, cancelled, denied, unavailable, unsupported, and zero-mutation AI
   turns do not expose a new enabled Undo control.
9. Undo and Redo default to visible progressive replay. Exact recorded
   progressive boundaries remain visible boundaries; ordered immediate source
   publications may be coalesced into bounded render slices. Each operation
   remains one History transition.
10. A history control rejects a concurrent second request until replay settles,
    and presentation direction changes only after canonical completion.
11. The framework API permits an explicit atomic opt-out for a bulk interaction
    whose dependent mutation must wait for the full canonical mutation and
    projection.

## Constraints

- behavior depends on transaction boundaries in feature/common API mutation paths
- app currently delegates undo/redo to reactive-events API wrappers
- AI presentation may retain only current action identity and turn
  correlation; Factory remains the sole history stack and replay owner

## Success Criteria

- `undo-redo.spec.ts` passes
- creation workflows produce expected reversible history
- drag-create undo behavior remains compact and deterministic
- `conversational-ai.spec.ts` proves one action per mutating Agent turn,
  current-only Message Bar Undo/Redo, and stale-control invalidation
- the explicit 7,076-element gate completes Undo within 12,000 ms, keeps Undo
  at or below 1.5 times the same-run Redo duration, completes Redo within
  30,000 ms, keeps both connected Actors converged within 30,000 ms after
  create/Undo/Redo without a disconnect epoch, preserves the complete canonical
  drawing, and observes progressive intermediate projection without a page
  crash

## References

- `apps/asyra-design/src/features/undo-redo/index.ts`
- `apps/asyra-design/src/common-apis/history.ts`
- `apps/asyra-design/src/common-apis/transaction.ts`
- `apps/asyra-design/e2e/conversational-ai.spec.ts`
