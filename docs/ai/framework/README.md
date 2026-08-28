# Asyra Framework Context

This folder is the AI framework context for **Asyra**:
**a deterministic execution kernel for declarative information modeling systems**.

Framework-first rules:

- Core is UI-agnostic.
- App-level domain logic is first-class.
- Builtins are optional and movable.
- Data flow is deterministic and transaction-bounded; failed or cancelled local
  mutations are reversed through the Factory transaction journal when they are
  rollbackable.

## New here?

Start with [`GETTING_STARTED.md`](GETTING_STARTED.md). It maps product-building,
Framework learning, API lookup, package ownership, implementation workflow, and
verification to the smallest authoritative document. Humans and AI agents can
use the same entry point.

## Read Order

1. `GETTING_STARTED.md` (orientation; not an additional contract layer)
2. `FRAMEWORK_ESSENTIALS.md`
3. `CODING_STANDARDS.md`
4. `ARCHITECTURE.md`
5. `API_SURFACES.md`
6. `design-principles/*`
7. `WORKFLOW.md`
8. `../tools/flow-inspector/FLOW_INSPECTOR.md`
9. `REQUEST_ROUTING.md`
10. `RUNTIME_MATRICES.md`
11. `SECURITY.md`
12. `RELEASE_SUPPORT.md`
13. `CONSTRAINTS.md`
14. `rules/*`
15. `packages/*`
16. `golden-paths/*`
17. `BEST_PRACTICES.md`
18. `PLANS.md`
19. `plans/completed/*` (historical completed-plan archive)
20. `decisions/releases/*` (framework decision history; global rules in `../decisions/README.md`)
21. `audits/*` (historical point-in-time diagnostics; never current authority)

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
`rules/no-patch-fixes.md`: repair the canonical owner step instead of adding
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
