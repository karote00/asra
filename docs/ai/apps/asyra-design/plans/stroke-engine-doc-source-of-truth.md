# Stroke Engine Documentation Source Of Truth

This file defines where to look during the professional stroke engine rollout.

If documents conflict, this routing table wins.

## Current Source Of Truth

| Need | Read |
| --- | --- |
| Architecture target | `professional-stroke-engine-plan.md` |
| Execution phase and gates | `professional-stroke-engine-execution-plan.md` |
| Helper/API algorithm flow | `professional-stroke-engine-algorithm-flow.md` |
| Support status | `stroke-engine-support-matrix.md` |
| Temporary promotion flags | `stroke-engine-promotion-ledger.md` |
| Failure classification | `stroke-engine-failure-triage.md` |
| Manual QA | `stroke-engine-manual-qa-checklist.md` |
| Center dashed scenario families | `dashed-center-scenario-matrix.md` |
| Constrained dashed scenario families | `dashed-constrained-scenario-matrix.md` |
| Constrained solid legality families | `constrained-solid-ownership-legality-scenario-matrix.md` |
| Fast resume | `professional-stroke-engine-handoff.md` |
| Decision rationale | `docs/ai/apps/asyra-design/decisions/releases/unreleased.md` |

## Decision History Rule

Decision history is append-only.

- Do not edit old entries.
- Do not delete old entries.
- If a decision changes, append a superseding entry.

## Deprecated Documentation

The professional stroke engine rollout supersedes older stroke manuals and
legacy inside-dashed plans.

Deprecated legacy stroke manuals and pre-rollout stroke plans were deleted from
the active docs tree. They must not be recreated or used as implementation
authority.

## Agent Rule

Before touching stroke runtime:

1. Read this source-of-truth file.
2. Read the support matrix.
3. Read the algorithm flow.
4. Read the relevant scenario matrix.
5. Only then inspect runtime code.

If stale references are found through search, do not follow them. Replace the
reference with the current source-of-truth document instead.
