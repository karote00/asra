# Plan: Vector Local Geometry and Element Transform

## Status

Active. Accepted by the product owner on 2026-08-03 as the highest-priority
bug fix outside prior plans.

Semantic and execution authority:

- this plan owns the thin product contract, product cases, bounded execution
  slices, and definition of done;
- `vector-local-geometry-transform-flow-inspector.data.cjs` owns the exact
  owner, route, artifact, contributor, failure, and implementation-boundary
  contract;
- the retained framework Render Delta Update and App-level Migration
  Inspectors continue to own their shared framework routes.

## Problem

Vector points and controls are currently stored in workspace coordinates.
Moving one Vector element therefore translates every point and control,
creates one record patch per changed point, invalidates geometry-dependent
Render work, and publishes a payload proportional to point count on every
pointer sample.

A Vector with more than 7,000 points can consequently block the application
during an ordinary element drag. Throttling, preview-only output, delayed point
patches, or a renderer fallback would retain the incorrect ownership model and
are not acceptable fixes.

## Accepted Product Contract

### Canonical coordinate spaces

- `points`, `segments`, and `networks` are canonical Vector geometry.
- Every point and control coordinate is authored in one stable Vector-local
  coordinate space.
- A Vector-local origin is established when the Vector is created or migrated.
  It is never rebased merely because element bounds or transform values change.
- Local point coordinates and local geometry bounds may be negative or
  non-zero. Bounds are derived geometry evidence, not permission to normalize
  every point.
- `pointCoordinateSpace` is exactly `local` for new and migrated canonical
  Vector data.
- Production must not retain parallel workspace/local geometry mutation or
  Render paths.

### Element transform

- Whole-element translation, dimension change, rotation, scale, skew, Group
  movement, and identity-preserving reparenting update element transform or
  hierarchy state only.
- A whole-element transform must not set, replace, remove, clone, translate,
  scale, rotate, or skew any canonical point/control record.
- Current authored `x`, `y`, `width`, `height`, and `rotation` fields remain
  the public property-panel contract. Dimension and scale requests share one
  transform owner rather than becoming independent canonical values.
- Additive skew values, when present through the transform contract, are
  Render transform inputs and never geometry inputs. This task does not add a
  new skew UI.
- Runtime projection may compose the authored values into an affine transform.
  The affine transform is derived runtime state, not a second persisted
  geometry source.
- Pivot behavior remains the current top-left element-transform behavior.
  A new pivot UI or alternate pivot policy is out of scope.

### Geometry editing

- Direct point/handle operations may change only the affected canonical
  point/control records and the constant-size element bounds/transform
  projection required by the new local bounds.
- Point/handle mutation converts workspace or client intent through the inverse
  current element transform before changing local geometry.
- Hit testing, segment projection, selection overlays, and path-edit overlays
  consume the same local geometry and current transform. No consumer may
  reconstruct workspace-owned point data.
- Geometry operations that intentionally rewrite the complete path, such as a
  future explicit bake/flatten or Boolean operation, require their own product
  intent and are not part of ordinary element transforms.

### Rendering and caching

- Vector geometry is drawn from local points. The renderer may normalize the
  local draw projection without mutating canonical points.
- Translation and rotation remain direct Render deltas.
- Dimension/scale/skew changes use an engine-neutral direct transform update
  and do not execute the Vector geometry strategy again.
- Geometry/style work is invalidated only by geometry or style changes.
  Transform-only changes must retain the existing local path, fill, stroke,
  and hit geometry.
- Pixi remains a concrete engine. App and Preset code must not import Pixi.
- A generic Render strategy capability may declare transform-only property
  handling. Render and Preset must not hard-code a Vector-only delta bypass.

### Hierarchy

- Group, ungroup, move/reorder, and reparent preserve the Vector world result
  by changing element/hierarchy transform values only.
- Preset remains the official Group coordinate/bounds adapter.
- Scene Tree remains the parent membership, ordering, and cycle owner.
- No hierarchy operation may translate Vector points to compensate for a
  parent change.

### Transactions, persistence, and collaboration

- One canvas drag remains one intended Undo commit.
- Each synchronous drag update remains one ordered immediate shared
  publication inside the outer session transaction.
- A transform-only publication has bounded size independent of Vector point
  count and contains no point record patches.
- Undo, redo, persistence, collaboration publication, and accepted remote
  apply use the ordinary canonical property/state-owner path.
- Awareness, Render state, diagnostics, and caches never carry canonical
  Vector transform or geometry.

### Load migration

- Asyra Design owns one connected document-version migration from the current
  workspace-point document version to the local-point document version.
- The migration resolves each legacy Vector's effective legacy point offset
  from canonical Scene Tree/Props data, converts every point/control exactly
  once, preserves ids/topology/style/hierarchy, writes
  `pointCoordinateSpace: local`, and advances the document version.
- A malformed legacy Vector fails at the migration owner before partial
  canonical apply. It is not silently accepted through a workspace-coordinate
  runtime fallback.
- New empty documents and newly generated canonical samples use the new
  version and local geometry directly.
- The checked-in legacy-version fixture used by migration tests is test
  evidence only and is not a production fallback path.

## Public Inputs and Outputs

Inputs:

- create/import Vector topology expressed at an app boundary in workspace
  positions;
- whole-element position, dimension, rotation, scale, skew, hierarchy, undo,
  redo, load, and accepted remote-apply requests;
- point/handle client or workspace editing intent.

Outputs:

- canonical Vector elements whose point/control records are local;
- constant-size element transform mutations for whole-element transforms;
- transformed Render output, bounds, hit results, editing overlays, and
  property-panel values;
- one ordinary transaction/publication/persistence outcome per existing action
  contract.

Unsupported outputs:

- workspace-owned canonical points;
- transform-time point record patches;
- dual coordinate-space runtime adapters;
- cached or diagnostic geometry used as canonical state;
- fallback visual output when transform or migration validation fails.

## Product Cases

### Valid cases

1. Move a 7,000+ point Vector through multiple pointer updates:
   canonical points remain byte-for-byte equal, no point record patch is
   emitted, and Render performs transform-only updates.
2. Move a mixed selection of Vector and ordinary elements:
   every element reaches the same requested parent-local position in one
   update/publication and the complete gesture remains one Undo entry.
3. Change Vector width/height or invoke scale-around-center:
   local points remain equal while the displayed geometry, selection bounds,
   fill, stroke, gradient, and hit result transform together.
4. Rotate or skew a Vector:
   local points remain equal and all Render/overlay/hit consumers use the same
   affine result.
5. Edit an anchor or handle after move, scale, rotation, skew, or Group
   nesting:
   the pointer intent is inverse-transformed, only the intended local records
   change, and the displayed point follows the pointer.
6. Group, ungroup, or reparent a transformed Vector:
   the pre-operation world result is preserved and no point records change.
7. Undo/redo a move or dimension change:
   the transform and Render result reverse/restore as one action without
   geometry rewrites.
8. Apply the same accepted remote transform publication:
   the peer reaches the same canonical transform and Render result without
   adding a local Undo entry or echo publication.
9. Load a valid legacy workspace-point document:
   every Vector migrates exactly once to local points and renders identically.
10. Create a new Vector directly in the workspace or an official Group:
    creation stores local points and the correct parent-local transform without
    a post-creation whole-point move.
11. Load and transform the first 50 elements from the checked-in `crdt-7076`
    cat-face fixture:
    real dense Vectors, including the confirmed multi-thousand-point cases,
    produce no point record patches and no transform-only geometry rebuilds.

### Boundary and empty cases

- A zero-segment one-point Vector retains the existing minimum-dimension
  contract and remains transformable without point rewrites.
- Empty topology creates no invalid scale division and no fabricated point.
- Local geometry whose bounds start at negative coordinates renders and edits
  correctly without canonical rebasing.
- No-op transform requests produce no canonical mutation/publication.
- A drag that returns to its starting transform remains the existing ordered
  A -> B -> A semantic sequence inside one Undo entry.

### Invalid cases

- Non-finite transform or local point inputs are rejected before mutation.
- A singular dimension/scale request follows the existing minimum-dimension
  validation contract and does not mutate geometry.
- Missing topology references fail at the geometry owner.
- An invalid or partially migrated legacy Vector fails the migration/load
  route before canonical apply.
- Missing Render identity during coordinate conversion returns the established
  no-result/failure outcome; it does not fall back to raw workspace arithmetic.

## Ownership

- `move-elements` feature: session eligibility, threshold, target transform
  calculation, final sample, cancel policy.
- Asyra Design element/vector common APIs: local geometry creation/editing,
  workspace/local intent conversion, and transform mutation requests.
- Preset: official Vector component/render defaults, editing/selection overlay
  projection, and official Group coordinate/bounds adapters.
- Render: generic strategy capabilities, complete derived snapshots, direct
  transform delta routing, element/world coordinate conversion, and
  engine-neutral transform handoff.
- Render Engine: transform command/property contract.
- Render Engine Pixi: Pixi transform application only.
- Props/Scene Tree: canonical component values and element hierarchy.
- Factory: transaction, rollback, Undo/Redo, shared publication, and remote
  transaction settlement.
- Asyra Design startup migration: app document-version history and workspace
  to local conversion.

Forbidden ownership:

- feature-owned geometry mutation;
- Preset-owned canonical app document migration;
- Render/Pixi-owned canonical geometry or transform;
- Factory-owned Vector semantics;
- UI-owned point conversion or transform state.

## Implementation Slices

### Slice 0: Contract activation

- add this active plan and route it from `PLANS.md`;
- add the Vector Local Geometry Transform Flow Inspector and its contract test;
- register its direct-open viewer entry.

Gate:

- Inspector authorities, anchors, routes, artifacts, owner boundaries, and
  allowlists resolve.

### Slice 1: Failing formal regression oracles

- replace the existing test that requires every Vector point to move;
- assert a whole-element move emits only constant-size transform values;
- add a 7,000-point contract case proving zero point record patches;
- retain that synthetic oracle and add a real-data oracle over the first 50
  elements from the checked-in `crdt-7076` cat-face fixture;
- add Render tests proving transform-only updates do not invoke the geometry
  strategy;
- add migration and local-coordinate render/editing cases before production
  changes.

Gate:

- the new semantic tests fail on the current workspace-point implementation for
  the expected reason.

### Slice 2: App-owned load migration and creation contract

- install one app-owned connected migration during startup;
- advance the Asyra Design document version;
- migrate valid workspace-point Vector components to local coordinates;
- create new workspace/Group Vectors with local points directly;
- update canonical types and property marker validation.

Gate:

- migration tests prove exact id/topology/style preservation, identical visual
  placement inputs, atomic invalid failure, direct new-version creation, and no
  runtime workspace fallback.

### Slice 3: Local geometry mutation owner

- make local topology the direct canonical common-API shape;
- inverse-transform workspace/client point and segment intent;
- update anchor/handle/topology mutations without whole-map rebasing;
- preserve the current authored transform while projecting changed local
  bounds.

Gate:

- point/handle tests cover untransformed, moved, scaled, rotated, skewed, and
  nested-Group cases; unchanged point ids/records retain identity/equality.

### Slice 4: Whole-element transform and hierarchy

- remove the Vector whole-point translation branch;
- route move, dimension, scale-around-center, rotation, and skew through the
  transform owner;
- keep mixed selections, Group normalization, group/ungroup/reparent, Undo,
  shared delivery, and collaboration semantics intact.

Gate:

- the 7,000-point and mixed-selection oracles pass;
- mutation timelines prove one gesture => one Undo commit and one synchronous
  update => one publication;
- hierarchy tests prove point maps are unchanged.

### Slice 5: Render, engine, hit, and overlay projection

- draw local Vector geometry;
- introduce the generic strategy-owned direct transform capability;
- compose/apply engine-neutral scale/skew without geometry strategy rebuild;
- update bounds, hit testing, gradient/stroke projection, selection overlay,
  and path-edit overlay to use the same current transform;
- keep geometry/style invalidation separate from transform invalidation.

Gate:

- Render/Preset/unit integration tests prove identical local path output,
  direct transform updates, no strategy call on transform-only deltas, and
  shared transform parity across visible/hit/overlay consumers.

### Slice 6: End-to-end performance and visual closure

- add or update the maintained dense-Vector drag E2E case;
- measure the named move, Render delta, strategy, and engine phases with
  bounded output;
- run synchronized live-app review on the same runtime Vector state;
- inspect final screenshots for initial, moved, transformed, selected, and
  path-edit states.

Gate:

- 7,000-point transform mutation work is point-count independent;
- the first 50 `crdt-7076` cat-face elements retain the same point-free
  transform contract for their real dense Vectors;
- pointer updates contain zero point record patches and zero Vector geometry
  strategy executions;
- existing Render delta budgets do not regress;
- E2E passed and agent screenshot review passed are reported separately.

#### Slice 6 E2E owner revision

The dense-drag E2E consumes only the Factory shared-publication contract
(`slices[].batches[].deliveries[]`) and the Render diagnostic phase stream. Its
canonical mutation oracle reads each delivery's public `eventName` and payload
`key`; it must not re-open Property entity internals to rediscover metadata
already carried by the publication. The bounded implementation files remain
`apps/asyra-design/e2e/render-delta-performance.spec.ts` and
`apps/asyra-design/e2e/vector-render-invariants.spec.ts`.

The focused gate passes only when a browser pointer drag over the 7,001-point
Vector publishes immediate `x`/`y` updates, preserves canonical point identity
and sampled coordinates, records at least one `move-elements:apply-positions`
phase, records zero `render-layer:strategy:vector` phases, and produces the
initial, selected, moved, transformed-selected, and path-edit screenshots.
The app-level transformed state uses the registered `width`, `height`, and
`rotation` contract; scale remains represented by dimension through the
transform owner, while skew parity remains a Render/Preset/engine gate because
this task does not register a new app skew field.
Failure to observe the public delivery shape stops this slice; it does not
authorize a production mutation or a private Property lookup.

### Slice 7: Contract/document synchronization

- update current API, state, feature, common-API, architecture, migration,
  Render/Preset package, and decision-history authorities;
- remove statements that define Vector points as workspace coordinates or
  whole-element scale/move as point mutation;
- keep `PLANS.md` routing-only while the task remains active.

Gate:

- no current authority or direct code comment describes the removed workspace
  geometry contract.

## Required Formal Gates

- Flow Inspector contract test and generic viewer-entry test.
- Focused Asyra Design common-API, feature, init/migration, collaboration, and
  property tests.
- Focused Preset Vector component, render-strategy, selection-overlay,
  path-edit-overlay, Group operation, fill, and stroke tests.
- Focused Render scene-tree store, scene render layer, Render object/matrix,
  and engine contract tests.
- Focused Render Engine Pixi transform tests.
- Relevant undo/redo, Group hierarchy, Vector invariant, gradient, and dense
  Render E2E specs.
- affected package builds, Asyra Design production build, `yarn lint:ci`, and
  `git diff --check`.
- synchronized Asyra Design live-app visual review using the app-owned URL.

## Definition of Done

- Every new and loaded Vector uses local canonical points.
- Whole-element move/dimension/rotation/scale/skew and hierarchy transforms
  never patch canonical point/control records.
- Transform mutation and shared payload size are independent of point count.
- Both the 7,001-point synthetic case and the first 50 `crdt-7076` cat-face
  elements pass the point-free transform regression.
- Transform-only Render updates do not rebuild Vector geometry.
- Visible Vector geometry, fill, stroke, gradient, selection, hit testing, and
  path-edit overlay agree under the same transform.
- Direct point/handle editing after transforms updates the intended local
  records and no others.
- Group/reparent, Undo/Redo, persistence, collaboration, and remote apply retain
  their existing ownership and action semantics.
- The app-owned version migration is atomic and no workspace-coordinate runtime
  fallback remains.
- Formal tests pass, performance evidence meets the bounded gates, the app
  builds/lints, and synchronized screenshot review passes.
- Current source-of-truth documentation describes only the local geometry and
  transform contract.

## Explicit Exclusions

- New skew, pivot, transform-origin, or resize-handle UI.
- Boolean operations, outline conversion, flatten/bake transform, path
  simplification, or stroke-engine redesign.
- A general transform rewrite for non-Vector elements beyond the generic
  Render capability required by Vector.
- New cache layers without profiling evidence and an exact equivalence oracle.
- Rewriting unrelated historical completed plans or deleted behavior.

## Stop Conditions

Stop and request product-owner direction if:

- the implementation requires two canonical transform or geometry sources;
- preserving current persisted documents cannot be expressed as one connected
  app-owned migration;
- the generic Render capability would require changing non-Vector visible
  semantics;
- point editing under transform requires an undefined pivot or width/height
  product decision;
- an optimization cannot prove exact semantic parity;
- the same focused implementation repair fails three times.
