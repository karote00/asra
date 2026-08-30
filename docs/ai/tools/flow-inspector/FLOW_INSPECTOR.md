# Flow Inspector Contract

## Purpose

The Flow Inspector is a project-owned, product-runtime-independent viewer for
feature and system contracts. It renders target-owned semantic data without
owning or modifying that data. Stroke Engine is the first target; neither the
schema nor the renderer may contain Stroke-specific fields, rules, paths, or
execution state.

Flow Inspector helps a reader answer:

- which steps participate in a target flow;
- which package owns each step;
- which routes connect the steps and under what predicates;
- which immutable artifacts cross each boundary;
- which invariants and acceptance contracts apply;
- which step owns a failure when a contract is violated.

## Ownership

`tools/flow-inspector/viewer.js` owns generic browser rendering and structural
validation. It may read only the public Flow Inspector schema.

`tools/flow-inspector/inspectors/` owns every target data artifact, standalone
HTML entry, and Inspector contract test. Framework and App `plans/` directories
contain plans only; they must not own generated or executable Inspector
artifacts. A target data file directly declares its complete contract and exposes it as
`globalThis.FLOW_INSPECTOR_DATA` for the browser. It may also export the same
object through CommonJS for static validation. It must not import, require, or
re-export another target data file.

Each viewer entry owns only the established HTML/CSS shell and these browser
inputs, in order:

1. the target data file from the shared tool-owned Inspector directory;
2. a synchronized inline snapshot of `tools/flow-inspector/viewer.js`.

`tools/flow-inspector/embed-viewer.cjs` owns snapshot embedding. Target entries
must not load the renderer across directories because each entry must remain
directly openable without a local server. `viewer-entry.test.cjs` verifies that
the inline snapshot exactly matches the shared renderer source.

Product semantics remain in the target's authoritative Framework, App, Release,
or Tool specification. Centralized artifact ownership does not transfer those
semantics to the Flow Inspector tool; Inspector data maps the specification and
the shared renderer never defines it.

## Schema

Every target supplies exactly these top-level contract collections:

```js
{
  schema: { id: 'flow-inspector', version: 2 },
  target: { id, kind, title, subtitle },
  authority: { specPath, inspectorPath, semanticOwner, inspectorOwner },
  links,
  lanes,
  steps,
  routes,
  artifacts,
  invariants,
  acceptanceContracts
}
```

Target data must not include execution status, locks, closure state, test paths,
implementation helpers, compatibility aliases, viewer layout coordinates, or
renderer-specific presentation state.

### Target and authority

- `target.id` is stable and unique within the repository.
- `target.kind` identifies the reusable target class, such as `feature` or
  `system`.
- `authority.specPath` identifies the semantic source of truth.
- `authority.inspectorPath` identifies the target data file.
- `links` provides viewer-visible navigation without embedding target-specific
  links in the shared renderer.

### Lanes

Each lane has a unique `id`, a human-readable `title`, and a deterministic
`order`. Lanes organize presentation only; they do not alter routes or
ownership.

### Steps

Each step declares:

- `id`, `order`, `laneId`, `title`, and `purpose`;
- one `ownerPackage`;
- `inputs` and `outputs`;
- `conditions` and `bypasses`;
- `allowedContributors` and `forbiddenContributors`;
- `cacheDimensions`;
- `implementationBoundary`;
- `specRefs`;
- `failureOwnerStepId`.

Step order is descriptive and deterministic. Routes are the authority for
connectivity. A step may name itself or another valid step as failure owner.

`inputs` lists the union of artifacts and resources that a step may consume.
When routes provide different input subsets, the step's `conditions` and
`bypasses` must state the exact subset required by each route; consumers must
not wait for an artifact that the selected bypass route does not produce.

`cacheDimensions` is the exact key only for a contractually declared,
step-owned retained candidate whose hit may bypass part of that step's work. An
empty tuple means the step owns no retained candidate; ordinary execution
dependencies remain explicit in `inputs` and `conditions` and must not be copied
into `cacheDimensions` merely because they affect the result. Lower-level
platform resource reuse that is observationally transparent, emits no target
contract value, and cannot bypass the step's required outputs is not a target
step cache.

### Routes

Each route has a unique `id`, valid `from` and optional `to` step ids, a
declared `kind`, a predicate, and `producedArtifacts`. Terminal routes omit
`to`. Route predicates describe semantic routing and must not encode runtime
pass/fail state.

### Artifacts

Each artifact has a unique `id`, exactly one `ownerStepId`, a channel, and
`consumerStepIds`. A non-terminal artifact must have at least one consumer.
Artifact ownership cannot be inferred from rendering order.

### Invariants and acceptance contracts

Invariants bind stable statements and specification references to valid steps
and artifacts. Acceptance contracts bind target-level assertions and
specification references to valid steps. They describe correctness; they do
not record whether a current run passed.

## Renderer Contract

The shared renderer must:

- preserve the viewer shell's CSS, links, wide flow canvas, route arrows,
  filters, and detail panel;
- derive title, subtitle, navigation, lanes, cards, routes, and detail content
  only from target data;
- avoid target-name conditionals and target-specific field access;
- render specification references as links when an authority link exists;
- report structural errors without fabricating missing target data;
- remain read-only and independent of product runtime code.

The renderer may use optional step tags for generic visual emphasis. Tags are
presentation hints only and never represent execution state.

## Structural Validation

A target is structurally valid only when:

- all lane, step, route, artifact, invariant, and acceptance ids are unique;
- every step references an existing lane and failure-owner step;
- every artifact-valued step input and output exists;
- every route endpoint and produced artifact exists, the route starts at the
  artifact owner, and its destination is an artifact consumer;
- every artifact has one valid owner and all consumers exist, with the artifact
  declared in the owner's outputs and every consumer's inputs;
- every invariant references valid steps and artifacts;
- every acceptance contract references valid steps;
- every specification anchor exists in the authoritative specification;
- the data file can be loaded directly without importing another target file.

Structural validity does not prove product correctness. Product semantics are
verified against the target specification by the target's formal gates.

## Storage

- Shared renderer: `tools/flow-inspector/viewer.js`
- Snapshot embedder: `tools/flow-inspector/embed-viewer.cjs`
- Direct-open and synchronization gate:
  `tools/flow-inspector/__tests__/viewer-entry.test.cjs`
- Target data and HTML entry: near the target's authoritative documentation
- Target-specific semantic handoff gate: next to the target data when the
  generic structural gate cannot prove route-conditional behavior
- Workspace package: not required for the static schema and renderer

A multi-target workspace, catalog, future generator, result sidecar, or local
server requires a separate contract. A static workspace may discover and load
schema version 2 targets, but its catalog must not duplicate target semantics
or make standalone viewer entries dependent on the workspace. Future dynamic
layers must not add execution fields to schema version 2 or make the static
viewer dependent on product/runtime internals.

## First Target

Stroke Engine uses:

- semantic authority:
  `docs/ai/apps/asyra-design/specs/stroke-engine/SPEC.md`;
- target data:
  `tools/flow-inspector/inspectors/stroke-flow-inspector.data.cjs`;
- viewer entry:
  `tools/flow-inspector/inspectors/stroke-flow-inspector.html`.
- target-specific semantic handoff gate:
  `tools/flow-inspector/inspectors/__tests__/stroke-flow-inspector.contract.test.cjs`.

The Stroke data file exercises the generic schema with its end-to-end feature
flow. Future features must provide their own target data and viewer entry while
reusing the same schema and renderer.
