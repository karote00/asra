# Visual Review Microscope Rule

Visual review is evidence, not behavior authority. Rendering closure must not be
claimed from a low-zoom screenshot, one representative crop, or a single
pixel-existence check when the reported defect is geometric.

## Scope

Use this rule for visual, canvas, vector, stroke, renderer, export, hit-test, and
interactive product fixes where correctness can be hidden by zoom, viewport,
device pixel ratio, antialiasing, or coarse screenshots.

This rule complements:

- `bugfix-test-first.md`
- `inspector-step-execution.md`
- `no-patch-fixes.md`

## Required Process

1. Treat user-provided exact geometry, state, and screenshots as a bug report,
   not as closure evidence.
2. Before changing production code, verify whether current formal tests detect
   the defect. If they do not, add or strengthen a formal unit/integration
   oracle that fails on the current behavior.
3. For inspector-backed work, map the defect to the first canonical owner step
   and route before editing production code.
4. Use E2E or screenshot probes only after the source-space/formal assertion is
   in place, unless the defect is exclusively renderer projection or
   antialiasing.
5. Do not repair visual failures with renderer-local geometry, fallback output,
   fixture-specific branches, pixel masks, or app-specific visual shortcuts.

## Microscope Evidence

When visual evidence is used for a closure claim:

- Inspect every relevant point, endpoint, segment, anchor, and mode variant
  identified by the report. Do not inspect only the easiest or most obvious
  location.
- Use enough zoom, viewport size, device scale, or tiled crops to make the
  reported defect visible at the level where the user reported it.
- If one large viewport is not enough, capture multiple overlapping microscope
  crops and treat the set as the review artifact.
- Record the zoom, viewport, device scale factor, crop target, anchor or segment
  id, variant, and artifact path.
- A single overview screenshot is only triage evidence. It cannot close a
  geometry or rendering bug.

## Zoom And Viewport Independence

Source-space geometry must be independent of browser zoom, viewport size,
scroll, and device pixel ratio. If zoom or viewport is suspected, add a formal
or integration oracle that compares source-space products across multiple view
states.

Only final renderer projection, rasterization, and antialiasing may vary with
zoom or device pixels. Do not classify a source-space geometry defect as a zoom
artifact without proof.

## Closure Standard

Do not claim visual correctness while any relevant microscope crop still shows:

- missing terminal products
- seam gaps
- comb-like strip fragments
- wrong-side fill coverage
- join endpoints that do not consume the required incident product boundary
- smooth continuity products split into visible disconnected fragments

If formal gates are green but microscope review still fails, reopen the formal
oracle. The correct conclusion is that the oracle is incomplete or mapped to the
wrong owner boundary, not that the product is visually closed.
