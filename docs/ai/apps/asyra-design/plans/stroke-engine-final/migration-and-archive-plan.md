# Migration And Legacy Deletion Plan

## Role

This file defines how the final stroke package replaces earlier stroke planning
documents without leaving a second archive-level authority.

## Migration Goals

- preserve historical reasoning only where it helps future decisions
- remove active-authority ambiguity
- make reviewer entrypoints obvious
- prevent future contributors from reviving deleted rollout plans

## Active Package

The active stroke documentation package is:

- `docs/ai/apps/asyra-design/plans/stroke-engine-final/`

The active baseline report is:

- `docs/ai/apps/asyra-design/reports/stroke-engine-final-analysis-report.md`

The only allowed historical record is:

- `docs/ai/apps/asyra-design/decisions/releases/unreleased.md`

## Deleted Legacy Documents

Earlier professional-stroke rollout plans, scenario matrices, support matrices,
support ledgers, manual QA checklists, handoff notes, source-of-truth routing
files, and failure-triage files outside `stroke-engine-final/` are deleted.

They must not be kept as:

- archived plan files
- superseded plan files with banners
- shadow source-of-truth files
- reviewer reading requirements
- implementation references

If a deleted document contained a still-relevant decision, the decision must be
represented in one of these places:

- the appropriate active spec file in `stroke-engine-final/`
- the final analysis report, if it is assessment context
- app decision history, if it records why a decision changed

## PLANS Index Rule

`docs/ai/apps/asyra-design/PLANS.md` must point only to:

- the active final package
- the active source-of-truth file
- the active final analysis report
- app decision history

It must not list deleted legacy stroke documents as current, historical, or
archived reading.

## Future Update Rule

Any future stroke documentation change must follow this routing rule:

- if it changes active stroke behavior, update `stroke-engine-final/*`
- if it records historical rationale, update app decision history
- if a new stroke document is needed, add it inside `stroke-engine-final/` and
  update `README.md` and `source-of-truth.md` in the same change

## Legacy Search Safety Rule

A repository search for deleted legacy stroke plan names may only return:

- decision-history references
- final analysis references
- active final-package text explaining that legacy documents were deleted

If a deleted legacy stroke plan file exists under
`docs/ai/apps/asyra-design/plans/`, the migration is incomplete.
