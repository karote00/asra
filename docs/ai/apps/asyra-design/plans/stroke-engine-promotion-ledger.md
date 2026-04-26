# Stroke Engine Promotion Ledger

This ledger tracks temporary promotion gates and bounded slices in the
professional stroke engine rollout.

Use this file before adding any new promotion flag or bounded scenario.

## Rules

- A promotion flag must map to a scenario family.
- A promotion flag must have unit and visual evidence before product promotion.
- A promotion flag is not the final architecture.
- If a flag no longer blocks later work, move the case to backlog.
- If a flag starts covering multiple topology families, replace it with a
  general classifier plan instead of adding more flags.

## Current Promotion Flags

Source file:

- `packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts`

Current option type:

- `ConstrainedDashedStrokePromotionOptions`

### Full-Loop Round Join

| Flag | Family | Status | Exit Direction |
| --- | --- | --- | --- |
| `allowRectFullLoopInsideRoundJoin` | rectangle full-loop inside round join | promoted | merge into general full-loop classifier |
| `allowRectFullLoopOutsideRoundJoin` | rectangle full-loop outside round join | promoted | merge into general full-loop classifier |
| `allowVectorRectEquivalentFullLoopInsideRoundJoin` | vector rectangle-equivalent full-loop inside round join | promoted | merge into general full-loop classifier |
| `allowVectorRectEquivalentFullLoopOutsideRoundJoin` | vector rectangle-equivalent full-loop outside round join | promoted | merge into general full-loop classifier |
| `allowFirstBroaderVectorFullLoopInsideRoundJoin` | first broader vector full-loop inside round join | promoted | merge into general full-loop classifier |
| `allowFirstBroaderVectorFullLoopOutsideRoundJoin` | first broader vector full-loop outside round join | promoted | merge into general full-loop classifier |

### Single-Edge Round Cap

| Flag | Family | Status | Exit Direction |
| --- | --- | --- | --- |
| `allowRectSingleEdgeInsideRoundCap` | rectangle single-edge inside round cap | promoted | merge into interval classifier |
| `allowRectSingleEdgeOutsideRoundCap` | rectangle single-edge outside round cap | promoted | merge into interval classifier |
| `allowVectorRectEquivalentSingleEdgeInsideRoundCap` | vector rectangle-equivalent single-edge inside round cap | promoted | merge into interval classifier |
| `allowVectorRectEquivalentSingleEdgeOutsideRoundCap` | vector rectangle-equivalent single-edge outside round cap | promoted | merge into interval classifier |
| `allowFirstBroaderVectorSingleEdgeInsideRoundCap` | broader vector single-edge inside round cap | promoted | merge into interval classifier |
| `allowFirstBroaderVectorSingleEdgeOutsideRoundCap` | broader vector single-edge outside round cap | promoted | merge into interval classifier |

### Corner-Spanning Bevel/Miter

| Flag | Family | Status | Exit Direction |
| --- | --- | --- | --- |
| `allowRectCornerSpanningInsideBevel` | rectangle corner-spanning inside bevel | promoted | merge into corner-spanning classifier |
| `allowRectCornerSpanningInsideMiter` | rectangle corner-spanning inside miter | promoted | merge into corner-spanning classifier |
| `allowRectCornerSpanningOutsideBevel` | rectangle corner-spanning outside bevel | promoted | merge into corner-spanning classifier |
| `allowRectCornerSpanningOutsideMiter` | rectangle corner-spanning outside miter | promoted | merge into corner-spanning classifier |
| `allowFirstBroaderVectorCornerSpanningInsideBevel` | broader vector corner-spanning inside bevel | promoted | merge into corner-spanning classifier |
| `allowFirstBroaderVectorCornerSpanningInsideMiter` | broader vector corner-spanning inside miter | promoted | merge into corner-spanning classifier |
| `allowFirstBroaderVectorCornerSpanningOutsideBevel` | broader vector corner-spanning outside bevel | promoted | merge into corner-spanning classifier |
| `allowFirstBroaderVectorCornerSpanningOutsideMiter` | broader vector corner-spanning outside miter | promoted | merge into corner-spanning classifier |

## Next Refactor Target

The next structural target is not another flag unless it unblocks a required
manual-test path.

Preferred next architecture:

- `classifyConstrainedDashedInterval(points, closed, interval, stroke)`
- `classifyConstrainedDashedSource(points, closed)`
- `classifyConstrainedDashedOwnership(packets)`

Expected classifier outputs:

- source topology:
  - rectangle-equivalent
  - sampled oval/simple closed
  - broader simple closed
  - self-intersecting
  - open
  - multi-network
- interval topology:
  - full-loop
  - single-edge
  - corner-spanning
  - seam-wrapping
  - multi-corner
- legality status:
  - accepted
  - fallback-to-center
  - blocked

## Stop Rule

Do not add another promotion flag if any of these is true:

- the new case does not unblock manual product testing
- the new case only adds another source variant to an already proven family
- the new case requires more than `20%` of the current phase scope
- the new case changes an external API

Record it in backlog instead.
