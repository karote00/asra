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
4. `API_SURFACES.md`
5. `design-principles/*`
6. `WORKFLOW.md`
7. `REQUEST_ROUTING.md`
8. `RUNTIME_MATRICES.md`
9. `CONSTRAINTS.md`
10. `rules/*`
11. `packages/*`
12. `golden-paths/*`
13. `BEST_PRACTICES.md`
14. `PLANS.md`
15. `plans/completed/*` (historical completed-plan archive)
16. `decisions/releases/*` (framework decision history; global rules in `../decisions/README.md`)

## Interpretation Priority

When docs overlap, follow this order:

1. `rules/*` (hard constraints)
2. `design-principles/*` (decision rationale)
3. `packages/*` (ownership/contracts)
4. `golden-paths/*` (project-approved implementation flow)
5. `BEST_PRACTICES.md` (general guidance)

`golden-paths` is Asyra-specific and takes priority over `BEST_PRACTICES.md`.

Project-wide bug fixes must follow
`rules/bugfix-test-first.md`: before implementation, verify whether existing
formal tests detect the reported failure. If they do not, add or strengthen the
formal regression test/oracle first and prove it fails on the current behavior.

Project-wide product fixes must follow
`rules/no-patch-fixes.md`: repair the canonical owner stage instead of adding
patch output or fallback product paths. This applies to framework packages,
preset defaults, reference apps, and future apps.

## What This Context Optimizes For

- Framework reuse across multiple apps.
- Strict package boundaries.
- Consistent extension patterns.
- Migration-safe persistence.
- Fast defaults with opt-out flexibility.

## Expected Usage

- AI and humans should treat these docs as implementation contracts.
- If implementation and docs diverge, update docs in this folder as source-of-truth.
