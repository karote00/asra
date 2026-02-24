# Asyra Framework Context

This folder is the AI framework context for **Asyra**:
**a deterministic execution kernel for declarative information modeling systems**.

Framework-first rules:
- Core is UI-agnostic.
- App-level domain logic is first-class.
- Builtins are optional and movable.
- Data flow is deterministic and transaction-safe.

## Read Order

1. `FRAMEWORK_ESSENTIALS.md`
2. `CODING_STANDARDS.md`
3. `ARCHITECTURE.md`
4. `WORKFLOW.md`
5. `REQUEST_ROUTING.md`
6. `RUNTIME_MATRICES.md`
7. `CONSTRAINTS.md`
8. `rules/*`
9. `packages/*`
10. `golden-paths/*`
11. `BEST_PRACTICES.md`
12. `PLANS.md`

## Interpretation Priority

When docs overlap, follow this order:

1. `rules/*` (hard constraints)
2. `packages/*` (ownership/contracts)
3. `golden-paths/*` (project-approved implementation flow)
4. `BEST_PRACTICES.md` (general guidance)

`golden-paths` is Asyra-specific and takes priority over `BEST_PRACTICES.md`.

## What This Context Optimizes For

- Framework reuse across multiple apps.
- Strict package boundaries.
- Consistent extension patterns.
- Migration-safe persistence.
- Fast defaults with opt-out flexibility.

## Expected Usage

- AI and humans should treat these docs as implementation contracts.
- If implementation and docs diverge, update docs in this folder as source-of-truth.
