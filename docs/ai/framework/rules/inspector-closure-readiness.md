# Rule: Inspector Closure Readiness

## Scope

This rule applies to every active plan, inspector-backed workflow, product-flow
inspector, step graph, route graph, artifact lifecycle matrix, and formal gate
set.

It defines when a spec/inspector segment may be considered ready for
implementation. It does not replace the Inspector Step Execution Rule: runtime
implementation still works on one active owner step at a time.

## Core Rule

Closure status is a verifiable state machine, not a narrative claim.

An inspector review segment may advance only when its closure packet, formal
gates, and reopen conditions agree. If any of those are missing, vague, or
contradictory, the segment is not implementation-ready.

## Required Closure States

Inspector-backed work must use these meanings when it records segment status:

- `pending-review`: the segment has not yet passed contract review.
- `contract-closed`: the spec anchors, inspector steps/routes, artifact
  lifecycle, forbidden contributors, and formal contract tests agree.
- `family-dataflow-closed`: a multi-step product family has unique owners,
  declared inputs/outputs, preserve-through artifacts, downstream consumers,
  must-not-recompute boundaries, cross-family handoffs, and formal gates with no
  known data-loss, recomputation, or ownership conflict.
- `implementation-ready`: the segment is contract-closed, and every relevant
  family/cross-family dataflow gate is closed. Runtime correctness is not
  implied.
- `runtime-closed`: implementation has passed the required runtime gates for
  the segment, including formal oracles, integration gates, and any required
  visual/app review gates.

Runtime-only states such as `pending-runtime-gates` or `runtime-blocked` may be
used only for runtime evidence. They must not weaken or replace the closure
states above.

## Closure Packet

Every review segment that is marked `contract-closed`,
`family-dataflow-closed`, `implementation-ready`, or `runtime-closed` must have a
closure packet recorded in the inspector data or generated from it.

The packet must include:

- segment id
- covered step ids
- closure state
- contract status
- family dataflow status
- runtime status
- spec anchors
- step/route ids covered by the packet
- artifact ids computed, preserved, consumed, projected, and validated
- downstream consumers and cross-family handoffs
- owner steps for every semantic value in the segment
- `mustNotRecomputeAfter` boundaries
- formal gates that prove the current state
- runtime blockers or runtime evidence, with owner step and oracle names
- explicit reopen conditions
- remaining scope that is not closed by this packet

The closure packet is review evidence. It is not a substitute for the inspector
step, route, or artifact lifecycle contracts.

## Reopen Conditions

A closed segment must reopen when any item listed in its packet changes:

- inputs
- outputs
- routes
- artifact lifecycle
- downstream consumers
- owner step assignment
- forbidden contributors
- formal gates
- source-of-truth spec anchors
- active-plan execution constraints

A runtime oracle failure reopens runtime status only, unless the failure proves a
spec, route, artifact lifecycle, owner, or gate contract is wrong. Contract
closure and runtime closure must remain separate.

## Implementation Readiness

A segment is implementation-ready only when:

- contract status is closed
- family dataflow status is closed for any multi-step family that feeds the
  active step
- cross-family handoffs are declared and tested
- remaining runtime blockers identify an owner step, an oracle/gate, and the
  phase that owns the repair
- there is no known contract contradiction, data-loss path, recomputation path,
  downstream repair path, or ambiguous artifact format

Implementation-ready does not mean the runtime is correct. It means the
inspector contract is specific enough for the next bounded implementation
segment.

## Review Skipping

Previously closed segments may be skipped during later task iterations only when
all of the following are unchanged:

- inputs
- outputs
- routes
- artifacts
- consumers
- formal gates
- source-of-truth spec anchors
- active-plan execution constraints

If one of those changes, the segment must be reviewed again before
implementation advances.

## Required Handling

- Multi-step product families must be reviewed as families for readiness and
  closure, even though implementation edits remain one owner step at a time.
- Cross-family handoff gates are required when artifacts leave one review family
  and become downstream authority for another family.
- Runtime blockers must name the owner step and formal oracle. They must not be
  used as a reason to keep rewriting contract text after the contract is
  closed.
- Task replans must self-review the revised plan, closure packet, inspector
  contracts, and tests until no concrete issue remains before the next
  implementation iteration begins.

## Forbidden Patterns

- Marking a segment confirmed without a closure packet.
- Treating `pending-review`, `pending-family-closure-review`, or other vague
  pending labels as an implementation-ready state.
- Treating implementation-ready as runtime-closed.
- Closing a product family without checking downstream handoffs.
- Reopening contract closure because a runtime oracle failed, when the failure
  has a clear implementation owner and does not contradict the contract.
- Skipping review of a confirmed segment after its inputs, outputs, routes,
  artifacts, consumers, gates, or source anchors changed.
