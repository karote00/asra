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

The inspector flow is now the Stroke / Vector System Inspector Flow. It covers
the complete stroke-related data path from feature intent through common API
vector operations, canonical computed patches, transaction/data-channel
publication, render mirror updates, stroke geometry, product packets, and final
visual review. The framework-native vector operation flow is the baseline:
point/handle drag and structural operations commit canonical workspace/world
vector data through computed patches, while render remains a downstream
consumer.

The outside dashed square visual gate remains open. That failure is owned by
the Product Output / visual review step until rule-driven probes and reviewed
screenshots pass; it is not a whole-system completion claim.

## Stroke / Vector System Flow

Stroke-related behavior is inspected as one deterministic system flow:

1. Feature/session code converts input into explicit vector or stroke intent
   and never writes render store state directly.
2. App common API/domain adapters own vector mutations and emit canonical
   workspace/world computed patches for drag and structural operations.
3. Each intended user action is wrapped in one transaction boundary and one
   intended undo unit. Drag preview remains non-undoable.
4. Scene-tree and data-channel publish changed scalar values and record ids as
   computed patch updates after commit.
5. Render mirror/cache applies each committed patch exactly once and derives
   renderer-ready vector/stroke data from committed state.
6. Stroke geometry stages consume normalized render data and own shared
   geometry, stroke domains, dash intervals, legality, and final semantic
   records.
7. Product output emits render, hit, export, and diagnostics descriptors
   without changing stroke semantics. Visible render must not use diagnostic or
   helper geometry as product output.

## Asyra Solid Rule

Constrained solid strokes follow Asyra's doubled authored center-stroke mask
model. This is the Asyra rule contract; it may be informed by a subset of
external design-tool behavior, but external tools are not the authority for this
spec:

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

For constrained `inside` dashed render, the product-visible encoding may be one
exact grouped descriptor with `fillClipPolygons`, authored dashed `strokePaths`,
and `strokePathStyle`. That descriptor represents the same doubled authored
center-dashed stroke clipped by the inside filled-region mask. It is not a drag
preview, a helper overlay, or an approximation. If the descriptor covers one
fill domain and one stroke style, product output may bypass same-visual overlap
collapse for that frame; per-interval polygons remain diagnostics/export
evidence unless explicitly routed as non-visible projection data.

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
fragments, the Stroke Geometry / Product Output path is wrong and the final
Diagnostics review must fail. If a numeric probe passes while the app
screenshot still shows fragmentation, the test is insufficient and must be
tightened before any completion claim.

## Dashed Separation

Dashed constrained strokes are a separate interval-domain model:

- selected boundary intervals own dash placement;
- terminal half-dashes and caps are dashed-only behavior;
- dashed provenance must not be copied into solid product records;
- solid visible render must not borrow dashed boundary interval geometry.

For constrained `inside` dashed strokes, interval-domain ownership stops at
dash allocation. Visible product geometry must be built as Asyra doubled center
dashed stroke geometry: each split source range keeps half-dash
terminals at both cut ends and evenly distributed middle gaps, then each visible
interval is stroked on the authored centerline at `stroke.width * 2` with the
authored cap, join, and miter limit, and finally clipped by the inside
filled-region mask. Direct one-sided ribbons, local-side fallback strips, and
diagnostic derivation fragments are not product-visible geometry for inside
dashed strokes.

## Inspector Step Contracts

- `Interaction`: feature/session steps own explicit user intent only. They must
  not commit model data directly or synchronize render state.
- `Model Commit`: common API/domain adapter steps own canonical workspace vector
  data, computed patch construction, structural operation adapters, and
  transaction/undo boundaries.
- `Data Channel`: scene-tree and reactive event steps publish computed patch
  updates after commit.
- `Render Mirror`: render mirror/cache steps consume committed patch data once
  and derive renderer-ready data without repairing model state.
- `Stroke Geometry`: geometry steps own normalized render inputs, shared
  geometry, source families, stroke domains, dash allocation, legality, paint,
  and final semantic stroke records. Solid still uses doubled authored
  center-stroke candidates plus mask provenance; constrained `inside` dashed
  still clips doubled center-dashed product intervals with the inside
  filled-region mask.
- `Product Output`: render, hit, export, and renderer projection steps consume
  semantic descriptors without changing stroke rules.
- `Diagnostics`: diagnostics and visible review steps are the completion gates.
  The 2026-05-31 inside-solid slice passed only after current Asyra rule probes
  and manual app screenshot review. Current outside dashed square failures stay
  blocked here until the same evidence standard passes.

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
- the inspector data labels Stroke Geometry candidate building as
  model-neutral;
- the inspector data covers the Stroke / Vector System flow from feature intent
  through Product Output and Diagnostics;
- no active status claims completion until current Asyra rule probes and
  reviewed screenshots pass;
- visual gates fail when the internal pentagon breaks into helper-like fragments
  even if shared-edge width and join-difference numeric probes pass;
- implementation evidence separately proves render, hit, export, diagnostics,
  reload, performance behavior, and visible screenshot consistency.
