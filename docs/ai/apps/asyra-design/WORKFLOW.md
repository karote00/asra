# App Workflow

This is the default workflow for implementation work inside `apps/asyra-design`.

## Phase 0: Load Context

Read in order:

1. `docs/ai/apps/asyra-design/APP_ESSENTIALS.md`
2. `docs/ai/apps/asyra-design/CODING_STANDARDS.md`
3. `docs/ai/apps/asyra-design/ARCHITECTURE.md`
4. `docs/ai/apps/asyra-design/API_SURFACES.md`
5. `docs/ai/apps/asyra-design/REQUEST_ROUTING.md`
6. relevant `rules/*`, `modules/*`, and `features/*`

Optional retrieval accelerator:
- `npx context-rag ai "<request summary>" --top-k 8`
- Treat retrieval as lookup support; app docs remain source-of-truth.

## Phase 1: Scope

Classify task as one of:
- feature behavior change
- UI/provider change
- common-apis/controller change
- integration/bootstrap change

Define touched files and ownership before coding.

Checklist:
- [ ] feature boundary is clear
- [ ] mutation API boundary is clear
- [ ] expected undo unit is defined

## Phase 2: Design

Before coding:
- define trigger/event path
- define state reads/writes
- define cancellation/tool-switch behavior if session-based
- define panel/provider impact
- define E2E/manual verification path

Checklist:
- [ ] deterministic behavior order is defined
- [ ] no direct deep package mutation in feature handlers
- [ ] any new property is registered intentionally

## Phase 3: Implement

Implement in thin slices:
1. common API/controller boundary
2. feature behavior
3. provider/UI wiring
4. tests (if applicable)

Stop and ask if behavior conflicts with existing contracts.

## Phase 4: Verify

Run what matches scope:

- `yarn workspace @asyra/asyra-design react:build`
- `yarn workspace @asyra/asyra-design test:e2e` for UI/interaction behavior changes
- focused manual checks for interactions not fully covered by E2E

Quality gates:
- [ ] app builds
- [ ] changed interaction path behaves as expected
- [ ] no regression in tool switching/selection/property panel for touched area

## Phase 5: Docs Sync

Update app docs when contracts change:
- feature behavior -> `features/*`
- boundaries/rules -> `rules/*`
- startup/module ownership -> `modules/*` or `ARCHITECTURE.md`
- source-module mapping update -> `modules/source-coverage.md`
- state ownership or key usage changes -> `modules/state-contracts.md`
- behavior-level acceptance -> `bdd-features/*`
- requirement-level intent -> `prd/*`
- capability scope -> `epics/*`
- implementation execution slices -> `task-breakdowns/*`
- future work -> `PLANS.md`

## Phase 6: Handoff

Report:
1. what changed
2. behavior impact
3. validation run
4. open risks/follow-ups
