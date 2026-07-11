# Flow Inspector Contract

## Purpose

Flow Inspector is a framework-level, product-runtime-independent viewer for
feature and system contracts. It renders target-owned semantic data without
owning or modifying that data. Stroke Engine is the first target; neither the
schema nor the renderer may contain Stroke-specific fields, rules, paths, or
execution state.

Flow Inspector helps a reader answer:

- which stages participate in a target flow;
- which package owns each stage;
- which routes connect the stages and under what predicates;
- which immutable artifacts cross each boundary;
- which invariants and acceptance contracts apply;
- which stage owns a failure when a contract is violated.

## Ownership

`tools/flow-inspector/viewer.js` owns generic browser rendering and structural
validation. It may read only the public Flow Inspector schema.

Each target owns one data file near its authoritative documentation. A target
data file directly declares its complete contract and exposes it as
`globalThis.FLOW_INSPECTOR_DATA` for the browser. It may also export the same
object through CommonJS for static validation. It must not import, require, or
re-export another target data file.

Each viewer entry owns only the established HTML/CSS shell and these browser
inputs, in order:

1. the target data file from the same target directory;
2. a synchronized inline snapshot of `tools/flow-inspector/viewer.js`.

`tools/flow-inspector/embed-viewer.cjs` owns snapshot embedding. Target entries
must not load the renderer across directories because each entry must remain
directly openable without a local server. `viewer-entry.test.cjs` verifies that
the inline snapshot exactly matches the shared renderer source.

Product semantics remain in the target's authoritative specification. The
Inspector data maps that specification; the shared renderer never defines it.

## Schema

Every target supplies exactly these top-level contract collections:

```js
{
  schema: { id: 'asyra.flow-inspector', version: 1 },
  target: { id, kind, title, subtitle },
  authority: { specPath, inspectorPath, semanticOwner, inspectorOwner },
  links,
  lanes,
  stages,
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

### Stages

Each stage declares:

- `id`, `order`, `laneId`, `title`, and `purpose`;
- one `ownerPackage`;
- `inputs` and `outputs`;
- `conditions` and `bypasses`;
- `allowedContributors` and `forbiddenContributors`;
- `cacheDimensions`;
- `implementationBoundary`;
- `specRefs`;
- `failureOwnerStageId`.

Stage order is descriptive and deterministic. Routes are the authority for
connectivity. A stage may name itself or another valid stage as failure owner.

### Routes

Each route has a unique `id`, valid `from` and optional `to` stage ids, a
declared `kind`, a predicate, and `producedArtifacts`. Terminal routes omit
`to`. Route predicates describe semantic routing and must not encode runtime
pass/fail state.

### Artifacts

Each artifact has a unique `id`, exactly one `ownerStageId`, a channel, and
`consumerStageIds`. A non-terminal artifact must have at least one consumer.
Artifact ownership cannot be inferred from rendering order.

### Invariants and acceptance contracts

Invariants bind stable statements and specification references to valid stages
and artifacts. Acceptance contracts bind target-level assertions and
specification references to valid stages. They describe correctness; they do
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

The renderer may use optional stage tags for generic visual emphasis. Tags are
presentation hints only and never represent execution state.

## Structural Validation

A target is structurally valid only when:

- all lane, stage, route, artifact, invariant, and acceptance ids are unique;
- every stage references an existing lane and failure-owner stage;
- every route endpoint exists and every produced artifact exists;
- every artifact has one valid owner and all consumers exist;
- every invariant references valid stages and artifacts;
- every acceptance contract references valid stages;
- every specification anchor exists in the authoritative specification;
- the data file can be loaded directly without importing another target file.

Structural validity does not prove product correctness. Product semantics are
verified against the target specification by the target's formal gates.

## Storage

- Shared renderer: `tools/flow-inspector/viewer.js`
- Snapshot embedder: `tools/flow-inspector/embed-viewer.cjs`
- Direct-open and synchronization gate:
  `tools/flow-inspector/viewer-entry.test.cjs`
- Target data and HTML entry: near the target's authoritative documentation
- Workspace package: not required for the static schema and renderer

A future generator, result sidecar, or local server requires a separate
contract. It must not add execution fields to schema version 1 or make the
static viewer dependent on product/runtime internals.

## First Target

Stroke Engine uses:

- semantic authority:
  `docs/ai/apps/asyra-design/specs/stroke-engine/SPEC.md`;
- target data:
  `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js`;
- viewer entry:
  `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.html`.

The Stroke data file exercises the generic schema with its end-to-end feature
flow. Future features must provide their own target data and viewer entry while
reusing the same schema and renderer.
