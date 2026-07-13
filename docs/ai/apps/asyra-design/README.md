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
10. `specs/*`
11. `modules/*`
12. `features/*`
13. `bdd-features/*`
14. `prd/*`
15. `epics/*`
16. `golden-paths/*`
17. `task-breakdowns/*`
18. `BEST_PRACTICES.md`
19. `decisions/releases/*` (app decision history by release timeline)

## Interpretation Priority

When docs overlap, follow this order:

1. `rules/*` (hard rules)
2. `specs/*` (product semantic and inspector contracts)
3. `modules/*` (app contracts and boundaries)
4. `features/*` (feature behavior contracts)
5. `bdd-features/*` (behavior expectations)
6. `prd/*` (product-level requirements)
7. `epics/*` (capability grouping and scope)
8. `golden-paths/*` (project-approved implementation playbooks)
9. `task-breakdowns/*` (execution slices)
10. `BEST_PRACTICES.md` (general guidance)
11. `PLANS.md` (future work index only)

## Scope

These docs are for **app-level behavior** only.
Framework-level contracts belong to `docs/ai/framework/*`.
Cross-cutting history rules come from `docs/ai/decisions/README.md`.

Asyra Design also inherits all framework hard rules, including
`docs/ai/framework/rules/bugfix-test-first.md` and
`docs/ai/framework/rules/no-patch-fixes.md`. App fixes must repair the canonical
owner step, must first prove whether existing formal tests detect the bug, and
must not add app-specific patch render output, patch UI state, patch export
output, or visual fallback paths.

## Source-of-Truth Rule

If app implementation changes contract-level behavior, update this folder in the same work.
