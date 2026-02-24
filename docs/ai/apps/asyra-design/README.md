# Asyra Design App Context

This folder is the app-level implementation context for **Asyra Design**.

## Read Order

1. `APP_ESSENTIALS.md`
2. `CODING_STANDARDS.md`
3. `ARCHITECTURE.md`
4. `WORKFLOW.md`
5. `CONSTRAINTS.md`
6. `rules/*`
7. `modules/*`
8. `features/*`
9. `bdd-features/*`
10. `prd/*`
11. `epics/*`
12. `golden-paths/*`
13. `task-breakdowns/*`
14. `BEST_PRACTICES.md`
15. `PLANS.md`

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
