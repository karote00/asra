# Asyra Design App Context

This folder is the app-level implementation context for **Asyra Design**.

## Read Order

1. `APP_ESSENTIALS.md`
2. `CODING_STANDARDS.md`
3. `ARCHITECTURE.md`
4. `WORKFLOW.md`
5. `REQUEST_ROUTING.md`
6. `CONSTRAINTS.md`
7. `rules/*`
8. `modules/*`
9. `features/*`
10. `bdd-features/*`
11. `prd/*`
12. `epics/*`
13. `golden-paths/*`
14. `task-breakdowns/*`
15. `BEST_PRACTICES.md`
16. `PLANS.md`

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
10. `PLANS.md` (future work index)

## Scope

These docs are for **app-level behavior** only.
Framework-level contracts belong to `docs/ai/framework/*`.

## Source-of-Truth Rule

If app implementation changes contract-level behavior, update this folder in the same work.
