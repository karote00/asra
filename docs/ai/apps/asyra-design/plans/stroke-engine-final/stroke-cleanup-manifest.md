# Stroke Clean-Room Cleanup Manifest

This manifest is the audit ledger for removing obsolete stroke product routes.
It is active documentation, not decision history. Product implementation must
follow this file together with `README.md`, `PLANS.md`, and the inspector data.

## Product Call Graph

All visible stroke output must flow through this graph:

1. Computed data patch updates the scene-tree model.
2. Render mirror receives the committed computed data.
3. Vector render builds source path/topology.
4. `StrokeDomainPlan` classifies each network/span into one formal domain mode.
5. Dashed product builders create `DashProductInterval` records.
6. Endpoint cap policy, join ownership, and smooth continuity materialize the
   final product geometry.
7. Product descriptors/render entries are emitted for visible render, hit, and
   export.

Drag, cap switch, color/alpha switch, reload, and pan are not product routes.
They only change inputs to the same graph.

## Formal Domain Modes

- `center-product`
- `closed-constrained-domain`
- `open-contour-constrained-domain`
- `open-dangling-outside-both-sides`
- `inside-excluded-open-span`

`inside-excluded-open-span` is a formal domain-plan entry for authored open
spans that do not own inside product output. It records the rule decision; it
does not emit visible product geometry.

Invalid input is rejected before product routing or recorded as diagnostic-only
evidence. It must not create a product domain mode.

## File Roles

### Authority

- `docs/ai/apps/asyra-design/PLANS.md`
- `docs/ai/apps/asyra-design/STROKE_CANONICAL_VISUAL_REVIEW.md`
- `docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md`
- `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js`
- `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-cleanup-manifest.md`

### Product

- `packages/preset/src/components/vector.ts`
- `packages/preset/src/components/stroke-render/stroke-domain-plan.ts`
- `packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts`
- `packages/preset/src/components/stroke-render/constrained-dashed-domain-geometry.ts`
- `packages/preset/src/components/stroke-render/constrained-domain-stroke-geometry.ts`
- `packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts`
- `packages/preset/src/components/stroke-render/dashed-center-stroke-packets.ts`
- `packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts`
- `packages/preset/src/components/stroke-render/solid-center-stroke-render.ts`
- `packages/preset/src/components/stroke-render/stroke-candidate-arrangement.ts`

### Diagnostic-Only

Diagnostic code may report route signatures and counters, but it must not choose
visible product geometry.

- Runtime diagnostic metadata embedded by product builders.
- E2E artifact analysis helpers.
- Performance counters and route traces.

### Test Oracle / Guards

- `packages/preset/src/__tests__/stroke-product-route-nonreachability.test.ts`
- `packages/preset/src/__tests__/stroke-domain-plan.test.ts`
- canonical stroke matrix tests
- app visual review E2E specs

## Forbidden Product Concepts

Active product code and active authority docs must not encode:

- drag-specific product geometry routes
- diagnostic-only product domain modes
- product-visible substitute routes
- legacy open constrained to center mapping outside the formal simple-open
  unbounded `center-product` rule
- descriptor paths that materialize different geometry than the product builder

## Audit Status

- 2026-06-16: Began clean-room audit. First hard blockers found:
  - `vector.ts` read `mouseDragging` inside product render for hit-area routing.
  - `stroke-domain-plan.ts` encoded a diagnostic/no-output state as a domain
    mode.
  - Existing non-reachability tests did not guard those cases.
- 2026-06-16: Continued line-by-line audit. Additional product-visible blockers found:
  - `stroke-domain-plan.ts` was still mixing invalid input handling with formal
    domain-plan entries. `inside-excluded-open-span` is now treated as a formal
    rule entry for excluded authored spans, while invalid input stays out of
    product routing entirely.
  - `constrained-dashed-stroke-packets.ts` still contained explicit
    `open-dangling-outside-both-sides` special routing. Cleanup removed:
    - side-resolution-reason based route selection,
    - boundary-path gating by dangling-mode special case,
    - and a dedicated dangling-only product-final branch.
    Remaining `open-dangling-outside-both-sides` checks must be formal domain
    semantics only, not alternate product routes.
  - `vector.ts` still contains constrained dashed product promotion/local
    routing (`shouldKeepConstrainedDashedPacketLocal`,
    `shouldDeferConstrainedDashedExactArrangement`) instead of a single
    product route driven only by the domain plan and the product builder.
- 2026-06-21: Architecture closure completed.
  - `vector.ts` is a render input assembler. It builds source path/topology and
    normalized stroke input, then delegates product semantics to
    `StrokeDomainPlan` and product builders.
  - Formal product routing is limited to `center-product`,
    `closed-constrained-domain`, `open-contour-constrained-domain`,
    `open-dangling-outside-both-sides`, and `inside-excluded-open-span`.
  - Constrained dashed, center dashed, constrained solid, and center solid now
    share the same route decision shape: domain plan input, product contract,
    product descriptors, and render entries.
  - Diagnostics, export details, cache counters, and screenshots remain
    evidence. They do not choose visible product output.
  - Verified gates:
    - `yarn workspace @asyra/preset vitest run src/__tests__/stroke-product-route-nonreachability.test.ts src/__tests__/stroke-domain-plan.test.ts --reporter=verbose`
    - `yarn workspace @asyra/preset vitest run src/__tests__/constrained-dashed-stroke-packets-high-curvature.test.ts --reporter=verbose`
    - focused constrained dashed self-intersection, rule-domain, canonical, and
      performance contract suites
    - `yarn workspace @asyra/preset test:local`
    - `yarn workspace @asyra/preset build:preset`
    - `yarn react:build`
    - focused app e2e for canonical dashed/solid, self-check star, reported
      dashed regressions, reference dashed rendering/completeness, and vector6
      join visual review
    - app stroke drag performance and stroke parameter switch performance gates
    - manual screenshot review of canonical, self-check, reported, vector6, and
      drag product review artifacts
