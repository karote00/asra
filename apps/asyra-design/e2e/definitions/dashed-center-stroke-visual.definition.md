# Dashed Center Stroke Visual Definition

This benchmark defines the screenshot-level oracle for the supported
`dashed + center + uniform width + solid paint` slice.

It answers:

> When a supported element uses center dashed stroke rendering, does the real
> app output show alternating visible bands and gaps at the authored pattern
> positions, while non-supported constrained slices remain absent?

## Required supported behavior

- rectangle center dashed stroke renders alternating visible and gap regions on
  the top edge
- dash offset shifts the visible/gap probes deterministically
- oval center dashed stroke renders visible center-top coverage through the
  supported path
- rectangle center dashed `miter` keeps its outer corner square filled when a
  visible dash spans the corner
- exact short-carryover `miter` cases on one closed orthogonal path follow the
  local post-turn remainder: a corner with almost no carried remainder may
  keep the incoming-edge bridge absent while a later corner with longer
  carried remainder remains visibly filled
- rectangle center dashed `bevel` cuts that outer corner square away while
  preserving diagonal bevel coverage
- center dashed `round` join renders visible corner curvature on a supported
  closed orthogonal vector path without filling the miter corner probe
- closed non-self-intersecting vector center dashed stroke renders through the
  same supported path
- open vector `butt` and `square` caps remain visually distinguishable on the
  supported path
- open vector center dashed `round` cap renders half-circle dash terminals
  without filling square-cap corner probes

## Required non-product behavior

- constrained dashed stroke remains absent
- constrained `inside` / `outside` round geometry remains outside this center
  dashed visual contract

## Pass rule

The spec passes only when:

1. supported probes show the expected visible/gap alternation
2. offset probes show a deterministic shift
3. supported join probes show the expected `miter` vs `bevel` corner
   silhouettes
4. supported `round` join and `round` cap probes show curved coverage without
   square or miter overfill
5. non-product constrained probes remain below the absence threshold
