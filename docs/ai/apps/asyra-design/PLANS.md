Never record completed plans here.

# App Plans

## In Progress

1. Stroke engine final implementation

- active source-of-truth package:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md`
- active routing and inspector contract:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.html`
- active baseline analysis report:
  - `docs/ai/apps/asyra-design/reports/stroke-engine-final-analysis-report.md`
- decision history:
  - `docs/ai/apps/asyra-design/decisions/releases/unreleased.md`

Required direction:

- geometry is resolved before paint
- fill, stroke, and shadow attach paint to canonical geometry
- `inside` and `outside` constrained strokes first resolve shared fill/mask
  domains. Solid and dashed consume that evidence differently: solid uses a
  Figma-like doubled center-stroke plus fill/exterior mask model, while dashed
  uses selected boundary-domain dash intervals.
- self-intersecting solid visible render must draw the authored source path as
  a doubled-width center stroke and apply the inside-fill or outside-exterior
  mask. Exact boolean coverage may be used for legality, hit-test, export, or
  diagnostics, but flattened exact-boolean polygons must not be the outside
  solid visible-render source when they expose bridge/cut seam edges.
- render, hit-test, export, diagnostics, and animation share the same resolved
  geometry family
- ownership, topology, support state, interval state, and blocked state are
  typed metadata, never parsed from `geometryId`
- interaction performance targets `120fps`; product floor is `60fps`
- Step 30 completion requires deterministic probes plus global and local zoom
  visual review artifacts for solid miter/join shape, mask boundaries, overlap
  darkening, high-curvature cracks, exact-boolean bridge/cut seams, split-end
  cap artifacts, dashed terminal/cap behavior, intersections, and side
  eligibility
- self-intersecting solid Step 30 gates must include the join matrix currently
  covered by the self-check star: outside round/bevel plus inside
  miter/bevel/round, with no dashed terminal metadata, no illegal side leakage,
  no same-paint dark-overdraw beyond the anti-aliasing threshold, and local
  deterministic crack probes for high-curvature anchors such as `tp-13` and
  `tp-16`
- self-intersecting solid mask-model packets must stay on the lightweight
  product path during reload; inspector provenance is required, but dashed-only
  interval allocation and expensive ownership arrangement diagnostics are not
  allowed on the normal render path

Legacy stroke planning files outside `stroke-engine-final/` are not retained as
active or archived documents. Historical reasoning belongs only in decision
history and the active analysis report.
