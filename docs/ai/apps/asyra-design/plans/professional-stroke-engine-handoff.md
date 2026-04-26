# Professional Stroke Engine Handoff

## Purpose

This document is the fast handoff entrypoint for the current stroke-engine
execution.

Use it when:

- resuming work in a new conversation
- handing work to another AI agent
- checking what the next honest slice should be without rereading the whole
  architecture thread

This document is a resume guide, not a replacement for the execution plan.

Primary source-of-truth documents still are:

- `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`
- `docs/ai/apps/asyra-design/plans/professional-stroke-engine-plan.md`
- `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
- `docs/ai/apps/asyra-design/rules/scenario-matrix-testing.md`
- `docs/ai/apps/asyra-design/PLANS.md`

## How To Resume

Read in this order:

1. this handoff file
2. `professional-stroke-engine-execution-plan.md`
3. `dashed-constrained-scenario-matrix.md`
4. `scenario-matrix-testing.md`

Then decide the next slice using this rule:

- prefer the next unfinished uniform-width user-facing stroke blocker
- do not reopen future-feature work unless explicitly requested
- do not expand a finished family if it no longer blocks downstream work

## Current Execution Contract

The active rollout is intentionally narrow:

- uniform-width stroke only
- prioritize `inside` / `outside` / `center`
- prioritize `solid` / `dashed`
- prioritize `round` joins / caps
- optimize for the common design-tool stroke matrix first

Not part of the active rollout:

- gradient expansion
- variable-width product rollout

Those remain future-feature work. Historical Phase 6 / Phase 7 notes may stay
in the plans as architecture-compatible backlog, but they do not outrank
unfinished uniform-width stroke work.

## Mandatory Expansion Check

Before taking any new edge-case or scope-expansion slice, answer these three
questions:

1. If this case is not handled now, which later phase is blocked?
   - if none, move it to backlog and keep moving downstream
2. Would this change any externally exposed interface?
   - if yes, stop for explicit approval
3. Does the added work exceed `20%` of the current phase scope?
   - if yes, stop for explicit approval

## Per-Round Discipline

- scenario-matrix-first
- unit / helper contract before implementation
- visual benchmark before claiming product support
- bounded expansion stop rule
- optimize for "good enough to move downstream"
- backlog is valid; silent scope growth is not

## Current Status Snapshot

As of `2026-04-26`, the execution is stable through:

- Phase 1 accepted
- Phase 2 accepted
- Phase 3 accepted
- Phase 4A accepted
- Phase 4B stopped at its declared bounded boundary
- Phase 4C promoted for:
  - full-loop constrained dashed
  - single-edge constrained dashed
  - corner-spanning constrained dashed
  - first equivalence / crossover gates already recorded in the execution plan
- Phase 5 promoted for the current uniform-width round matrix on the bounded
  app path:
  - `full-loop + inside + round join`
  - `full-loop + outside + round join`
  - `single-edge + inside + round cap`
  - `single-edge + outside + round cap`
  - shape-generated `rect`
  - rectangle-equivalent `vector`
  - first broader non-rectangle-equivalent `vector` representatives where
    already promoted

## Last Confirmed Green Baseline

The latest completed checkpoint is:

- `broader non-rectangle-equivalent vector + full-loop + outside + round join`

Last confirmed green validation set:

- `yarn workspace @asyra/preset test:local constrained-dashed-stroke-packets.test.ts`
  - `30 passed`
- `yarn workspace @asyra/preset test:local vector-constrained-dashed-stroke.test.ts`
  - `43 passed`
- `yarn workspace @asyra/asyra-design test:e2e e2e/constrained-dashed-stroke-visual.spec.ts --workers=1`
  - `66 passed`
- `yarn workspace @asyra/asyra-design react:build`
  - green

## Next Recommended Slice

The next honest move is no longer a new source frontier.

The next recommended slice is:

- close the `outside + round join` equivalence gate

Reason:

- `rect + full-loop + outside + round join` is promoted
- rectangle-equivalent `vector + full-loop + outside + round join` is promoted
- broader non-rectangle-equivalent `vector + full-loop + outside + round join`
  is promoted
- this family is now at the point where another source expansion is lower
  value than a closeout checkpoint

Do not reopen:

- gradient expansion
- variable-width rollout
- finished `round cap` families that no longer block downstream work

## Known Active Traps

1. App path consumes `@asyra/preset` dist runtime

- do not inspect `src` only
- if a preset runtime branch changes, verify `src` and `dist` are synced

2. `packages/preset` full `build:preset` is still blocked by unrelated repo
   TypeScript issues

- do not pretend the app path updated unless the relevant `dist` files are
  actually synced

3. A red visual test may be one of four categories, not automatically a runtime
   bug:

- implementation bug
- missing scenario coverage
- product-semantics mismatch
- dist/source/runtime drift

4. Do not expand a family just because more cases exist

- if the next slice no longer unblocks later work, move it to backlog

## Required Docs To Sync On Every Real Slice

At minimum:

- `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`
- `docs/ai/apps/asyra-design/PLANS.md`
- `docs/ai/apps/asyra-design/decisions/releases/unreleased.md`

Usually also:

- `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
- `apps/asyra-design/e2e/definitions/constrained-dashed-stroke-visual.definition.md`

## Required Turn Report Format

For this execution thread, progress closeout should use:

- `Before`
- `This Round`
- `Still Missing`
- `Why Not Done`

## If A New Agent Takes Over

The new agent should:

1. confirm the current execution scope is still uniform-width only
2. confirm gradient and variable-width remain deferred
3. verify the latest green baseline still matches the repo
4. take the next slice from `Next Recommended Slice`
5. stop immediately if a step would change an externally exposed interface
