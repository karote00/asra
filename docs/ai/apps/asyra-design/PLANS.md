Never record completed plans here.

# App Plans

## In Progress

1. Stroke engine final implementation

- active source-of-truth package:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md`
- active routing contract:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/source-of-truth.md`
- active baseline analysis report:
  - `docs/ai/apps/asyra-design/reports/stroke-engine-final-analysis-report.md`
- decision history:
  - `docs/ai/apps/asyra-design/decisions/releases/unreleased.md`

Required direction:

- geometry is resolved before paint
- fill, stroke, and shadow attach paint to canonical geometry
- `inside` and `outside` strokes use direct one-sided geometry, not doubled
  center-band clipping
- render, hit-test, export, diagnostics, and animation share the same resolved
  geometry family
- ownership, topology, support state, interval state, and blocked state are
  typed metadata, never parsed from `geometryId`
- interaction performance targets `120fps`; product floor is `60fps`

Legacy stroke planning files outside `stroke-engine-final/` are not retained as
active or archived documents. Historical reasoning belongs only in decision
history and the active analysis report.
