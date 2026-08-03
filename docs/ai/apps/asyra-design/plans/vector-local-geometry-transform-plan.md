# Plan: Vector Render Geometry Cache and Element Transform

## Status

Active. Accepted by the product owner on 2026-08-03 as the highest-priority
bug fix outside prior plans. Revised on 2026-08-03 after product-owner review:
the persisted Vector schema and values remain unchanged; this plan changes the
Render pipeline, not the document format. Revised again on 2026-08-03 to remove
the rejected derivative sample and retain the complete `crdt-7076` fixture as
the real-data gate. The canvas-drag settlement contract was then corrected by
the product owner: one completed or commit-current interrupted gesture creates
one Undo commit from its first complete owner-issued `before` bundle and latest
complete owner-issued `after` bundle.

Local implementation and validation are complete on the feature branch. The
plan remains active until pull-request review and merge. Slice 4 now includes
the opt-in Factory staging contract, complete PropsManager History candidates,
one-commit Move session integration, ordinary final Group normalization,
full-sample `crdt-7076` E2E, drag Undo/Redo E2E, and synchronized live-app
Vector/toast screenshot review.

Validated on 2026-08-03: both Inspector contract suites (25 assertions),
Factory (227 tests), PropsManager (241 tests), focused App interaction/toast
tests (13 tests), three canvas-drag Undo E2E cases, the complete `crdt-7076`
E2E, the stacked-toast visual E2E, lint with zero errors, relevant TypeScript
builds, and the production App build all pass.

Semantic and execution authority:

- this plan owns the thin product contract, product cases, bounded execution
  slices, and definition of done;
- `vector-local-geometry-transform-flow-inspector.data.cjs` owns the exact
  owner, route, artifact, contributor, cache, failure, and
  implementation-boundary contract;
- the retained framework Render Delta Update Inspector continues to own the
  shared Render delta route.

## Problem

Moving or resizing one Vector currently treats every point and handle as part
of the element-transform mutation. A Vector with thousands of points therefore
creates point-count-dependent property patches and geometry rebuilds during an
ordinary transform, which can block the application.

The document already contains all Vector geometry and element values required
to render the element. Rewriting that document into a new coordinate schema,
adding a migration, or introducing a parallel app business-logic model is not
part of this fix.

## Accepted Product Contract

### Persisted Vector data stays unchanged

- Existing documents load with exactly the Vector property schema and values
  they already contain.
- This task does not add a document version, load hook, migration,
  `pointCoordinateSpace: local` requirement, or persisted Render-cache field.
- Existing `points`, handles, segments, networks, position, dimension,
  rotation, style, hierarchy, ids, and coordinate-space values remain ordinary
  canonical Props/Scene Tree data.
- Save, Undo, Redo, collaboration, and accepted remote apply keep using the
  existing canonical owners and wire shapes.
- The checked-in `crdt-7076` sample is read as-is and is not regenerated or
  rewritten for this task.

### Whole-element transform

- Moving, resizing, rotating, scaling, or skewing a Vector updates only the
  existing constant-size element transform/dimension values required by that
  action.
- A whole-element transform never sets, replaces, removes, clones, translates,
  scales, rotates, or skews canonical point/handle records.
- Transform mutation and publication size are independent of point count.
- Mixed Vector and non-Vector selections retain the existing transaction,
  ordering, publication, and Undo semantics.
- Pivot and property-panel semantics remain unchanged. This task adds no new
  transform UI or canonical transform model.

### Render geometry projection and cache

- On a geometry cache miss, the Vector render strategy consumes the existing
  complete render snapshot and derives the engine-local draw geometry required
  by the current Render object.
- Derived engine-local geometry is Render-owned projection only. It is never
  written into Props, Scene Tree, persistence, collaboration, Undo, diagnostics,
  or app state.
- The retained Render object/geometry is keyed by element identity and the
  geometry/style inputs that determine its draw result.
- Geometry/topology/style changes invalidate the matching retained projection
  and use the ordinary complete-snapshot strategy path.
- Position, dimension/scale, rotation, and skew deltas update the existing
  Render object transform directly and do not execute the Vector geometry
  strategy or recreate point/handle geometry.
- Element removal, reload, renderer teardown, or a failed projection releases
  the retained Render geometry. A cache miss always rebuilds through the same
  canonical snapshot path; there is no fallback geometry.
- A delta-updated result and a fresh projection of the same unchanged
  persisted Vector data plus current element transform must be equivalent.

### Engine boundary

- Render exposes a generic strategy capability for direct transform property
  handling. It must not add a Vector-specific branch to the Scene Tree store or
  Preset subscription router.
- Render Engine receives engine-neutral transform/property commands.
- Render Engine Pixi applies those commands to the existing Pixi display
  object. App and Preset code do not import Pixi.
- Fill, stroke, hit geometry, selection bounds, and path-edit overlays continue
  to agree with the visible Vector after transform.

### Geometry editing

- Existing point/handle editing inputs and persisted values keep their current
  workspace-coordinate contract.
- After a whole-element transform, interaction reads project stored Vector
  positions through the current Render result. Point/handle writes inverse
  project the visible workspace input back into the same existing stored
  coordinate space; no Render-derived record is persisted.
- If a geometry edit changes the stored geometry bounds, the existing element
  position/dimension values are adjusted by the current affine projection so
  the edited point and every unchanged point retain their intended visible
  positions. Reload derives the same result from ordinary stored values.
- A point, handle, topology, fill, or stroke edit may rebuild the affected
  Vector geometry because it is a geometry/style action, not a whole-element
  transform.
- No consumer may use the derived Render cache as canonical edit data.

### Transactions, persistence, and collaboration

- Canvas drag position samples remain ordinary canonical owner updates so
  computed data, Render, and immediate collaboration receive the current
  positions during the active gesture.
- Canvas drag opts into local transaction-history staging through an explicit
  structured mutation option. Ordinary mutations without that option retain
  the existing append-only semantic-change history contract.
- The staged history owner retains the first complete owner-issued `before`
  bundle and replaces only the reference to the latest complete owner-issued
  `after` bundle. It does not merge every selected element into pending
  History on each pointer sample.
- A completed or commit-current interrupted drag finalizes those two bundles
  into exactly one Undo commit when the existing outer session transaction
  closes. Undo restores the complete gesture start and Redo restores the
  complete final bundle.
- Staged-history control metadata is local Factory transaction metadata. It
  never enters canonical payloads, shared publications, collaboration wire
  data, persistence, or replay payloads.
- Each synchronous drag update retains the existing immediate shared
  publication behavior inside the outer session transaction.
- Transform-only rollback, persistence, and publication evidence contains no
  point/handle record patches.
- Accepted remote transform apply reaches the same direct Render transform
  route without local Undo or echo publication.
- Persistence stores the ordinary canonical snapshot and never stores Render
  cache state.

## Public Inputs and Outputs

Inputs:

- existing canonical Vector render snapshots without schema conversion;
- whole-element position, dimension, rotation, scale, skew, hierarchy, Undo,
  Redo, load, and accepted remote-apply changes;
- existing point/handle/topology/style edit changes.

Outputs:

- unchanged persisted Vector schema and pre-existing values, except for the
  specific existing transform values intentionally changed by the action;
- constant-size canonical transform mutations for whole-element transforms;
- retained engine-local Vector draw geometry across transform-only deltas;
- transformed visible output, hit results, overlays, and bounds through the
  ordinary Render pipeline.

Unsupported outputs:

- migrated or rewritten documents;
- a canonical `local` marker introduced by this task;
- transform-time point/handle record patches;
- app-owned duplicate Vector geometry;
- fallback or fixture-specific Render output.

## Product Cases

### Valid cases

1. Move a 7,001-point Vector through multiple pointer updates: canonical
   points remain byte-for-byte equal, no point record patch is emitted, and the
   Vector geometry strategy is not executed by transform-only samples.
2. Load and render the complete checked-in `crdt-7076` cat-face document, then
   move its densest Vector: existing values remain unchanged, several
   multi-thousand-point Vectors are present, and the move remains point-count
   independent.
3. Change Vector width/height, rotation, scale, or skew: the existing Render
   object updates its transform while retained path/fill/stroke/hit geometry is
   not rebuilt.
4. Apply a geometry or style edit after a transform: the affected Vector uses
   one complete-snapshot strategy rebuild and remains visually aligned with
   the current element transform.
5. Reload the result of a transform: the unchanged stored geometry plus current
   stored element values produces the same visible output without a migration
   or persisted cache.
6. Move a mixed Vector/non-Vector selection: every element reaches the same
   requested position through canonical pointer samples while staged History
   retains only one complete initial bundle and one complete latest bundle.
7. A completed or commit-current interrupted drag adds exactly one Undo entry;
   Undo and Redo restore the complete multi-selection start and final positions,
   while persistence, collaboration publication, and accepted remote apply
   preserve their current owners and transform evidence stays point-free.
8. Group, ungroup, reorder, or reparent retains the current hierarchy behavior
   and does not introduce point patches solely because the child is a Vector.

### Boundary and empty cases

- Empty and one-point Vector topology remains transformable without fabricated
  geometry or point mutation.
- A no-op transform produces no canonical mutation/publication or Render
  rebuild.
- A style-only change rebuilds style/draw output but does not become a
  canonical geometry conversion.
- An element removed before a queued frame cannot retain or reuse stale Render
  geometry.

### Invalid cases

- Non-finite transform inputs follow existing validation and produce no
  point/handle mutation.
- Missing or malformed Render identity fails closed and releases the affected
  projection; it does not emit fallback graphics.
- A geometry cache candidate whose geometry/style identity no longer matches
  is a miss and rebuilds from the complete canonical render snapshot.
- Render-derived geometry never enters persistence, collaboration, Undo, or
  app common APIs.

## Ownership

- `move-elements` feature: session eligibility, pointer threshold, requested
  positions, final sample, and cancel policy.
- Asyra Design element common API: bounded existing transform-value mutation;
  no Vector point/handle compensation for a whole-element transform.
- Props/Scene Tree: unchanged canonical Vector data and hierarchy.
- Render: complete render snapshots, generic direct-transform classification,
  retained Render-object lifetime, invalidation, and engine-neutral handoff.
- Preset Vector strategy: derive/draw engine-local Vector geometry from the
  existing render snapshot on geometry/style rebuild.
- Render Engine Pixi: update the existing Pixi object transform and draw
  commands only.
- Factory/Core persistence: existing transaction, Undo/Redo, publication,
  remote settlement, and persistence behavior.

Forbidden ownership:

- Asyra Design document migration or versioning;
- app-owned duplicate/cached Vector geometry;
- Preset-owned persistence policy;
- Render/Pixi-owned canonical data;
- feature-owned point/handle mutation;
- fixture-specific Render behavior.

## Implementation Slices

### Slice 0: Contract correction

- remove migration and canonical-local requirements from this plan and
  Inspector;
- bind the architecture to unchanged persisted data and a Render-owned retained
  projection;
- remove stale migration statements from direct framework/app contracts.

Gate:

- Inspector authorities, anchors, routes, artifacts, cache ownership, and
  implementation boundaries resolve;
- no active contract requires document migration or persisted local markers.

### Slice 1: Failing Render-pipeline regressions

- add a formal test reproducing the reported Render strategy error when an
  existing Vector receives a post-load update;
- assert the original stored coordinate-space value is accepted unchanged;
- assert transform-only deltas execute zero Vector geometry strategies;
- retain the 7,001-point case and make the complete `crdt-7076` case consume
  the checked-in fixture directly without migration or derivative samples.

Gate:

- the new/strengthened tests fail on the current PR for the reported reason
  before production code changes.

### Slice 2: Remove the rejected data/business-logic path

- remove the app document version, load migration, startup registration, and
  persisted `local` requirement introduced by the rejected iteration;
- restore existing point/handle/topology creation and editing data semantics;
- keep only the bounded whole-element transform mutation needed to prevent
  point-count-dependent writes.

Gate:

- load/save tests prove the existing document values are passed through
  unchanged;
- move tests prove zero point/handle patches for the synthetic 7,001-point case
  and the densest Vector in the complete real-data fixture.

### Slice 3: Render retained geometry and direct transform route

- make the Preset Vector strategy accept the existing render snapshot without a
  `local` marker requirement;
- retain engine-local draw geometry on the existing Render object across
  transform-only deltas;
- invalidate/rebuild only for geometry/topology/style changes;
- use the generic Render strategy direct-property capability for position,
  dimension/scale, rotation, and skew;
- keep engine-neutral and Pixi transforms equivalent.

Gate:

- Render/Preset tests prove delta/fresh equivalence, exact invalidation, no
  strategy execution on transform-only deltas, one strategy execution on a
  geometry/style miss, and fail-closed invalid input.

### Slice 4: Interaction, staged History, settlement, E2E, and visual closure

- verify hit, bounds, selection, path editing, stroke, and fill projection
  remain aligned after transform and after a later geometry/style rebuild;
- verify a moved Vector point can be hit and edited at its current visible
  workspace position while the written point record remains in the existing
  stored coordinate space;
- add an opt-in Factory history-staging option whose default absence preserves
  append-only transaction history;
- require the canonical property owner to issue complete first-before and
  latest-after history candidate bundles; Factory stores only those two bundle
  references during the gesture and materializes the final History once at
  transaction end;
- verify canvas drag creates exactly one Undo entry while rollback,
  publication, persistence, and remote apply retain existing owners and
  point-free transform evidence;
- run maintained 7,001-point and complete `crdt-7076` tests;
- run synchronized live-app screenshot review on the same runtime state.

Gate:

- focused unit/integration tests pass;
- transform work and payload size are independent of point count;
- no `[Preset Vector] Render data must contain canonical local Vector geometry`
  error occurs;
- app build and lint pass;
- E2E and synchronized visual review pass and are reported separately.

## Cache Contract

Retained value:

- the existing Render element and its engine-local Vector draw geometry,
  including geometry-dependent hit data.

Key and validity:

- element identity;
- geometry/topology/style snapshot identities or revisions that determine the
  draw result;
- current renderer instance/lifecycle.

Invalidation:

- point/handle/segment/network/topology/fill/stroke changes;
- element removal, document reload, projection failure, or renderer teardown.

Non-invalidation:

- position, dimension/scale, rotation, and skew deltas.

Miss path:

- consume the current complete canonical render snapshot and run the ordinary
  Preset Vector strategy once.

Equivalence oracle:

- a retained delta-updated result and a fresh projection from the same
  unchanged persisted geometry plus current element values have equivalent
  draw operations, bounds, hit result, overlay position, and visible output.

Profiling justification:

- the reported 7,000+ point freeze and the maintained 7,001-point/complete
  `crdt-7076` fixtures establish geometry rebuild cost as material and transform
  deltas as the required retained case.

## Definition of Done

- Existing documents and `crdt-7076` load without migration, version change,
  persisted local marker, or value rewriting.
- Whole-element Vector transform mutations contain no point/handle record
  patches and remain point-count independent.
- Transform-only Render deltas update the existing Render/Pixi object without
  executing the Vector geometry strategy.
- Geometry/topology/style changes rebuild through the ordinary complete
  snapshot path with exact cache invalidation and no fallback.
- Delta/fresh Render equivalence, hit/overlay alignment, hierarchy, one staged
  drag Undo entry, persistence, collaboration, and remote apply gates pass.
- The reported canonical-local-geometry error is absent while loading,
  rendering, moving, and editing the complete `crdt-7076` sample.
- Focused tests, build, lint, maintained E2E, and synchronized visual review
  pass.
- Current source-of-truth documentation describes only the unchanged-data,
  Render-owned cache contract.

## Explicit Exclusions

- Document migration, document-version changes, fixture rewriting, and new
  persisted coordinate-space values.
- New Vector business-logic model or canonical geometry source.
- New skew, pivot, transform-origin, or resize-handle UI.
- Boolean operations, outline conversion, flatten/bake transform, path
  simplification, or stroke-engine redesign.
- A general non-Vector transform rewrite beyond the generic Render capability
  used by existing strategies.
- Diagnostic or screenshot geometry used as product output.

## User-authorized completion addendum: status toasts

The product owner added one bounded UI fix after accepting the Vector plan.
Service-unavailable status toasts must:

- expose an accessible top-right close button;
- begin closing automatically after 10 seconds;
- collapse for 200 milliseconds before removal so every lower toast
  transitions upward instead of jumping;
- stay dismissed while the same unavailable condition remains active, then be
  eligible to appear again after that condition clears and later recurs.

This addendum does not change persistence or collaboration status ownership. It
only changes presentation lifecycle in `RenderApp`. Completion requires focused
timer/close tests plus a live-browser stacked-toast transition test and visual
review.

## Stop Conditions

Stop and request product-owner direction if:

- correct reload equivalence would require changing existing persisted values;
- the Render cache would become a second canonical geometry source;
- the generic Render capability changes non-Vector visible semantics;
- a required fix would introduce an app-owned Vector runtime model;
- cache equivalence cannot be proven through the ordinary complete-snapshot
  miss path;
- the same focused implementation repair fails three times.
