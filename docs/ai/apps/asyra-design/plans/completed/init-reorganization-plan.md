# Plan: Init Folder Reorganization and Rules

## Scope

Define clear ownership rules for app initialization code and reorganize
`apps/asyra-design/src/init` into purpose-driven groups so that future
initialization stays deterministic, minimal, and discoverable.

In scope:
- document init categories and rules
- reorganize init files by category
- update init entry points and docs to match

Out of scope:
- feature behavior changes
- altering initialization behavior or order beyond grouping

## Completion (2026-03-17)

- outcome: init modules grouped into foundation/capabilities/derived-state/diagnostics
- outcome: app startup docs and source-coverage references updated for new paths
- completed plan: `docs/ai/apps/asyra-design/plans/completed/init-reorganization-plan.md`

## Steps

1. Define init categories and rules

- clarify what belongs in init vs feature/common-apis
- document required vs optional init groups
- note idempotency and ordering expectations

2. Reorganize init folder structure

- group init modules by category
- update `init-app.ts` ordering and comments
- update `init/index.ts` exports

3. Sync docs

- update `modules/init-and-startup.md`
- update `ARCHITECTURE.md` startup flow summary

## Validation

- `rg "init-" apps/asyra-design/src` should show updated paths only
- manual: build not required unless follow-up changes demand it
