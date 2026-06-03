# Stroke Engine Final Spec

## Authority

This file is the stroke engine specification. It must stay in sync with:

- `docs/ai/apps/asyra-design/PLANS.md`
- `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js`

No other stroke plan, report, BDD feature, completed copy, or archived spec is
allowed to define current stroke behavior. Wrong historical decisions may remain
only in decision history.

`stroke-flow-inspector.html` is a non-authoritative viewer shell. It may read and
display `stroke-flow-inspector.data.js`; it must not contain stroke rules,
contracts, conclusions, reading instructions, or completion status.

## Current Status

The stroke engine remains active as of 2026-05-31. The reported
grid/vector-network self-intersecting inside solid slice now passes focused
numeric probes, e2e pixel gates, and manual app screenshot review for
shared-edge half-width, fill clipping, join-matrix differences, and absence of
fragmented internal pentagon output. Any previous whole-matrix completion
statement is superseded; this is slice-level evidence only, not a whole-engine
completion claim.

## Figma Solid Rule

Constrained solid strokes follow Figma's doubled authored center-stroke mask
model:

1. Build the authored center stroke at twice the requested stroke width.
2. Apply authored join behavior to that center stroke. `strokeJoin` and
   `strokeMiterLimit` affect the produced center-stroke envelope before masking.
3. Clip the result with the filled-region mask for `inside`, or the exterior
   mask for `outside`.

The solid product must not be represented as direct constrained-side visible
geometry. Region faces, strip fragments, helper polygons, and topology evidence
can justify legality, but they are not the visible solid stroke.

For adjacency-aware self-intersecting masks, a grouped render descriptor may
carry authored centerline stroke paths with explicit clip groups. Those groups
are an encoding of the masked authored stroke source: they must preserve
`strokeJoin`, `strokeMiterLimit`, and source-centerline provenance, and must not
turn face strips, helper polygons, or derivation fragments into visible product
geometry.

## Self-Intersecting Inside Solid

For grid/vector-network self-intersecting inside solid shapes, including the
reported five-point star:

- visible pixels must come from the doubled authored center stroke clipped by an
  inside filled-region mask;
- the inside mask must preserve face occupancy, winding rule, and filled-filled
  adjacency;
- a binary union of filled faces is insufficient when it widens internal shared
  edges or erases join-sensitive corners;
- each internal shared edge may reveal only half of the requested stroke width
  from each adjacent filled face, so the combined visible width along that edge
  matches the requested stroke width rather than two full-width contributions;
- all five internal pentagon corners must respond to `strokeJoin`;
- miter output must obey `strokeMiterLimit`;
- bevel output must cut the corner without cracks or overreach;
- round output must be smooth and bounded by the authored center-stroke
  envelope;
- outer authored vertices remain normal authored joins and must not be shaved by
  the inside mask.
- the internal pentagon must remain visually continuous, without fragmented
  helper-like strips, broken corner patches, or disconnected slivers.

If a render shows independent full-width strips on both sides of an internal
edge, fixed corner patches that ignore join style, or visible derivation
fragments, Step 20/24/25 are wrong and Step 30 must fail. If a numeric probe
passes while the app screenshot still shows fragmentation, the test is
insufficient and must be tightened before any completion claim.

## Dashed Separation

Dashed constrained strokes are a separate interval-domain model:

- selected boundary intervals own dash placement;
- terminal half-dashes and caps are dashed-only behavior;
- dashed provenance must not be copied into solid product records;
- solid visible render must not borrow dashed boundary interval geometry.

For constrained `inside` dashed strokes, interval-domain ownership stops at
dash allocation. Visible product geometry must be built as Figma-style doubled
center dashed stroke geometry: each split source range keeps half-dash
terminals at both cut ends and evenly distributed middle gaps, then each visible
interval is stroked on the authored centerline at `stroke.width * 2` with the
authored cap, join, and miter limit, and finally clipped by the inside
filled-region mask. Direct one-sided ribbons, local-side fallback strips, and
diagnostic derivation fragments are not product-visible geometry for inside
dashed strokes.

## Inspector Step Contracts

- Step 17, `build-stroke-candidates`: build model-specific candidates. Solid
  emits doubled authored center-stroke candidates plus mask provenance. Dashed
  emits interval candidates for allocation; constrained `inside` dashed also
  emits doubled center-dashed product candidates for visible geometry.
- Step 20, `apply-legality`: clip solid candidates with the inside filled-region
  mask or outside exterior mask. Diagnostic derivation geometry may be recorded
  only as bounded evidence.
- Step 20 also clips constrained `inside` dashed doubled center-dashed product
  candidates with the inside filled-region mask. Empty clip results are dropped;
  they must not fall back to one-sided geometry.
- Step 24, `build-final-faces`: preserve model-separated provenance. Solid
  final records may carry coverage evidence for hit/export, but visible render
  must reference the masked authored stroke descriptor.
- Step 25, `emit-render-hit-export-packets`: emit render, hit, and export
  projections without changing stroke semantics.
- Step 30, `visible-final-result`: passed for the 2026-05-31 reported
  inside-solid slice only after current Figma-parity probes and manual app
  screenshot review covered internal shared-edge width, the five internal
  pentagon join variants, miter limits, fill preservation, absence of visible
  derivation fragments, and absence of fragmented internal pentagon output.
  Broader matrix closure still requires the same evidence standard.

## Diagnostic Evidence Limits

Diagnostics may keep bounded records for:

- face ownership;
- winding and occupancy;
- source span and source vertex provenance;
- adjacency classification;
- exact coverage comparison;
- rejected shortcut modes;
- probe measurements.

Diagnostics must not become visible render inputs, normal render cache
signatures, export geometry, or hit geometry unless that path is explicitly
defined as non-visible evidence. Product-visible render must stay the masked
doubled authored center stroke.

## Invalid Current-Rule Sources

These sources are not valid rule authorities:

- completed plan copies;
- analysis reports;
- BDD feature files;
- viewer HTML;
- screenshots by themselves;
- old helper names or implementation branches;
- decision-history entries that predate this cleanup.

Screenshots can reopen the earliest owning inspector step, but the rule must be
written into the three authority files before implementation resumes.

## Completion Requirements

Completion requires:

- the three authority files state the same solid rule;
- old stroke specification files are removed from the docs tree;
- the inspector data labels Step 17 as model-neutral stroke candidate building;
- no active status claims completion until current Figma-parity probes and
  reviewed screenshots pass;
- visual gates fail when the internal pentagon breaks into helper-like fragments
  even if shared-edge width and join-difference numeric probes pass;
- implementation evidence separately proves render, hit, export, diagnostics,
  reload, performance behavior, and visible screenshot parity.
