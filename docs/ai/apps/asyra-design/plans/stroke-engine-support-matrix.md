# Stroke Engine Support Matrix

This is the product-facing support matrix for the current professional stroke
engine rollout.

Use this file to answer:

- what can be manually tested now
- what is supported only on a bounded representative
- what is intentionally blocked
- what is future-feature work

Legend:

- `SUPPORTED`: expected to render through the real app/runtime path.
- `PARTIAL`: supported only for listed topology/source families.
- `BLOCKED`: deliberately absent or fallback-only in the current rollout.
- `FUTURE`: out of current execution scope.

## Current Product Target

Current target:

- Figma-like uniform-width stroke behavior for supported Asyra Design
  shape/vector paths.

Excluded from this plan:

- variable-width stroke
- broader gradient/paint rollout
- shadow paint/geometry

## Center Solid

| Source | Topology | Join | Cap | Status | Required Evidence |
| --- | --- | --- | --- | --- | --- |
| rectangle | closed | miter | butt/square | SUPPORTED | unit + `solid-center-stroke-visual.spec.ts` |
| rectangle | closed | bevel | butt/square | SUPPORTED | unit + `solid-center-stroke-visual.spec.ts` |
| rectangle | closed | round | butt/square | SUPPORTED | unit + `solid-center-stroke-visual.spec.ts` |
| oval | closed sampled loop | miter/bevel/round | butt/square | SUPPORTED | primitive shape unit |
| vector | closed simple network | miter/bevel/round | butt/square | SUPPORTED | vector unit |
| vector | open network | miter/bevel/round | butt/square/round | SUPPORTED | vector unit |

Notes:

- Closed-path caps have no visible terminal effect.
- Open-path `round` cap is supported on the shared center geometry path.

## Center Dashed

| Source | Topology | Join | Cap | Status | Required Evidence |
| --- | --- | --- | --- | --- | --- |
| rectangle | closed | miter | butt/square | SUPPORTED | unit + `dashed-center-stroke-visual.spec.ts` |
| rectangle | closed | bevel | butt/square | SUPPORTED | unit + `dashed-center-stroke-visual.spec.ts` |
| vector | closed orthogonal | miter/bevel | butt/square | SUPPORTED | unit + visual |
| vector | closed orthogonal | round | butt/square | SUPPORTED | unit + visual |
| vector | open | miter/bevel/round | butt/square/round | SUPPORTED | unit + visual |
| oval | closed sampled loop | miter/bevel/round | butt/square | PARTIAL | promoted center dashed oval visual only |

Notes:

- Center dashed uses interval allocation plus shared center geometry for each
  visible interval.
- Open vector authored `inside`/`outside` dashed may render through center
  fallback, but that is not exact constrained geometry.

## Constrained Solid

| Source | Topology | Position | Join | Cap | Status | Required Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| rectangle | closed simple | inside/outside | miter/bevel | butt/square | SUPPORTED | unit + visual |
| oval | closed sampled simple | inside/outside | miter/bevel | butt/square | SUPPORTED | unit + visual |
| vector | closed simple single-network | inside/outside | miter/bevel | butt/square | SUPPORTED | unit + visual |
| vector | open | inside/outside | any | any | BLOCKED | no exact constrained geometry |
| vector | self-intersecting | inside/outside | any | any | BLOCKED | needs fill-rule semantics |
| vector | multi-network | inside/outside | any | any | PARTIAL | only explicitly promoted mixed-topology slices |
| any | closed simple | inside/outside | round | any | BLOCKED | Phase 5 constrained round work |
| any | closed simple | inside/outside | any | round | BLOCKED | Phase 5 constrained cap work |

## Constrained Dashed

| Family | Source | Topology | Position | Join/Cap | Status |
| --- | --- | --- | --- | --- | --- |
| A full-loop | rectangle | closed simple | inside/outside | round join | SUPPORTED |
| A full-loop | oval | closed sampled simple | inside/outside | miter/bevel baseline only | PARTIAL |
| A full-loop | vector rectangle-equivalent | closed single-network | inside/outside | round join | SUPPORTED |
| A full-loop | vector non-rectangle quadrilateral | closed single-network | inside/outside | round join | SUPPORTED |
| B single-edge | rectangle | closed simple | inside/outside | round cap | SUPPORTED |
| B single-edge | vector rectangle-equivalent | closed single-network | inside/outside | round cap | SUPPORTED |
| B single-edge | vector non-rectangle quadrilateral | closed single-network | inside/outside | round cap | SUPPORTED |
| C corner-spanning | rectangle | closed simple | inside/outside | bevel/miter | SUPPORTED |
| C corner-spanning | vector rectangle-equivalent | closed single-network | inside/outside | bevel/miter | SUPPORTED |
| C corner-spanning | vector non-rectangle quadrilateral | closed single-network | inside/outside | bevel/miter | SUPPORTED |
| D equivalence | rectangle vs vector rectangle-equivalent | closed single-network | inside/outside | promoted families only | SUPPORTED |
| open vector | open | inside/outside | any | any | BLOCKED / center fallback only |
| self-intersecting vector | closed | inside/outside | any | any | BLOCKED |
| multi-network vector | closed/open mixed | inside/outside | any | any | BLOCKED unless explicitly promoted |

## Future Feature Matrix

| Feature | Status | Reason |
| --- | --- | --- |
| variable width | FUTURE | outside current plan |
| broader gradient paint rollout | FUTURE | paint phase, not geometry phase |
| shadow geometry/paint | FUTURE | not part of stroke engine rollout |
| self-intersecting constrained semantics | FUTURE/BLOCKED | needs fill-rule product semantics |
| exact open-path inside/outside | FUTURE/BLOCKED | needs product semantics distinct from fallback |

## Manual Testing Guidance

Manual testing may start with:

- center solid: width, miter/bevel/round join, butt/square/round cap on open
  vectors
- center dashed: dash/gap/offset, miter/bevel/round join, butt/square/round cap
  on open vectors
- constrained dashed: closed rectangle and closed simple vector switching
  between `center`, `inside`, and `outside`

Manual testing should not treat these as done yet:

- open vector exact `inside`/`outside`
- self-intersecting constrained behavior
- multi-network constrained behavior
- variable width
- gradient stroke semantics
