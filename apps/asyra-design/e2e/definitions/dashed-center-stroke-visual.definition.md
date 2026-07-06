# Dashed Center Stroke Visual Definition

Authority note: this file is non-authoritative reference material for later
E2E/visual review. It must not define current stroke semantics, correctness
gates, inspector owner stages, route conditions, or product output rules.

This reference note records later-phase screenshot measurement notes for the
`dashed + center + uniform width + solid paint` slice.

It answers:

> When a formal element uses center dashed stroke rendering, does the real
> app output show alternating visible bands and gaps at the authored pattern
> positions, while non-product constrained slices remain absent?

## Later-Phase Evidence Notes

- rectangle center dashed stroke renders alternating visible and gap regions on
  the top edge
- dash offset shifts the visible/gap probes deterministically
- oval center dashed stroke renders visible center-top coverage through the
  formal path
- rectangle center dashed `miter` keeps its outer corner square filled when a
  visible dash spans the corner
- exact short-carryover `miter` cases on one closed orthogonal path follow the
  local post-turn remainder: a corner with almost no carried remainder may
  keep the incoming-edge bridge absent while a later corner with longer
  carried remainder remains visibly filled
- rectangle center dashed `bevel` cuts that outer corner square away while
  preserving diagonal bevel coverage
- center dashed `round` join renders visible corner curvature on a formal
  closed orthogonal vector path without filling the miter corner probe
- closed non-self-intersecting vector center dashed stroke renders through the
  same formal path
- open vector `butt` and `square` caps remain visually distinguishable on the
  formal path
- open vector center dashed `round` cap renders half-circle dash terminals
  without filling square-cap corner probes

## Required non-product behavior

- constrained dashed stroke remains absent
- constrained `inside` / `outside` round geometry remains outside this center
  dashed visual contract

## Pass rule

The spec passes only when:

1. formal probes show the expected visible/gap alternation
2. offset probes show a deterministic shift
3. formal join probes show the expected `miter` vs `bevel` corner
   silhouettes
4. formal `round` join and `round` cap probes show curved coverage without
   square or miter overfill
5. non-product constrained probes remain below the absence threshold
