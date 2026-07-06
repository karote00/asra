# Asyra Design App Context

This folder is the app-level implementation context for **Asyra Design**.

## Read Order

1. `APP_ESSENTIALS.md`
2. `CODING_STANDARDS.md`
3. `ARCHITECTURE.md`
4. `API_SURFACES.md`
5. `WORKFLOW.md`
6. `REQUEST_ROUTING.md`
7. `CONSTRAINTS.md`
8. `PLANS.md`
9. `rules/*`
10. `modules/*`
11. `features/*`
12. `bdd-features/*`
13. `prd/*`
14. `epics/*`
15. `golden-paths/*`
16. `task-breakdowns/*`
17. `BEST_PRACTICES.md`
18. `decisions/releases/*` (app decision history by release timeline)

## Interpretation Priority

When docs overlap, follow this order:

1. `rules/*` (hard rules)
2. `modules/*` (app contracts and boundaries)
3. `features/*` (feature behavior contracts)
4. `bdd-features/*` (behavior expectations)
5. `prd/*` (product-level requirements)
6. `epics/*` (capability grouping and scope)
7. `golden-paths/*` (project-approved implementation playbooks)
8. `task-breakdowns/*` (execution slices)
9. `BEST_PRACTICES.md` (general guidance)
10. `PLANS.md` (future work index and active stroke task focus)

## Scope

These docs are for **app-level behavior** only.
Framework-level contracts belong to `docs/ai/framework/*`.
Cross-cutting history rules come from `docs/ai/decisions/README.md`.

Asyra Design also inherits all framework hard rules, including
`docs/ai/framework/rules/bugfix-test-first.md` and
`docs/ai/framework/rules/no-patch-fixes.md`. App fixes must repair the canonical
owner stage, must first prove whether existing formal tests detect the bug, and
must not add app-specific patch render output, patch UI state, patch export
output, or visual fallback paths.

## Source-of-Truth Rule

If app implementation changes contract-level behavior, update this folder in the same work.
