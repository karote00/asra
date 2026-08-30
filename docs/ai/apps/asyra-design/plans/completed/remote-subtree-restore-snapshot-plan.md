# Asyra Design Remote Subtree Restore Snapshot Plan

## Completion

Completed on 2026-07-25 after implementation review and explicit user closeout
authorization.

- Outcome: a local subtree undo now publishes one exact owner-partitioned
  restore snapshot through the existing Factory `SharedPublication`; receiving
  peers apply it atomically with or without compatible local tombstones.
- Final decision: Scene Tree and Props remain the canonical restore owners,
  Factory retains transaction/publication ownership, Collaboration remains
  transport-only, and Asyra Design retains remote policy and routing.
- Canonical record:
  `docs/ai/apps/asyra-design/plans/completed/remote-subtree-restore-snapshot-plan.md`.
- Exit criteria: Inspector/readiness contracts, affected framework/app tests,
  remote undo/redo product cases, build/lint/dependency gates, synchronized
  visual review, and bounded direct-consumer review passed before closeout.

Architecture authority:

- `tools/flow-inspector/inspectors/remote-subtree-restore-snapshot-flow-inspector.data.cjs`
- `tools/flow-inspector/inspectors/remote-subtree-restore-snapshot-flow-inspector.html`
- `tools/flow-inspector/inspectors/__tests__/remote-subtree-restore-snapshot-flow-inspector.contract.test.cjs`

## Decision

A local subtree undo publishes one ordinary Factory `SharedPublication`.
Within that existing publication:

- the Scene Tree `CHANGE_SUBTREE` delivery with
  `RESTORE_SUBTREE` carries the exact hierarchy/element snapshot;
- the Props deliveries carry the exact property-component snapshot; and
- the publication boundary preserves the one-action grouping and owner delivery
  order.

Together, those already-grouped owner deliveries are the remote subtree restore
snapshot. They are not a second collaboration protocol, a full-document
snapshot, or a sequence of user-facing create operations.

The receiving Asyra Design collaboration adapter identifies that restore case
from the typed Scene Tree delivery, performs app-owned remote policy checks,
and routes every owner section through one remote Factory transaction. Each
canonical state owner validates and applies only its own data.

## Goal

Make undoing a deleted Group subtree visible to every receiving peer, including
a peer that has the current document state but never observed the original
delete and therefore has no matching local deleted-instance tombstones.

The restored result must preserve:

- stable entity and property-component ids;
- exact element and Group raw data;
- exact parent membership, root sibling index, and descendant child order;
- exact property-component data and owner relations;
- one intended remote transaction;
- ordinary Render/UI projection after canonical apply; and
- local instance isolation.

## Current Baseline and Missing Case

- Gate 2 Collaboration transports completed Factory `SharedPublication` values
  without semantic interpretation, history, dedupe, ordering policy, or
  conflict resolution.
- Gate 3 Scene Tree owns canonical hierarchy validation, subtree removal,
  tombstone-backed local restoration, parent membership, and child order.
- Factory already publishes local undo/redo through the same grouped shared
  publication path as other committed actions.
- Asyra Design already validates supported Scene Tree and Props deliveries and
  applies each accepted publication through one non-undoable, no-echo remote
  Factory transaction.
- A peer that observed the delete can restore from its own owner-held
  tombstones.
- A peer that did not observe the delete has no deleted runtime instances.
  The current Scene Tree restore route rejects that peer even though the
  received publication carries the exact known element and property data.

This plan closes only the final case. It does not add initial synchronization,
missed-publication replay, or durable collaboration storage.

## Ownership Contract

### Factory

- retains one intended local undo commit and one grouped outbound
  `SharedPublication`;
- retains detached mutation-time evidence and publication ordering;
- opens one remote transaction for the accepted publication;
- keeps remote apply rollbackable, non-undoable, and no-echo; and
- does not interpret subtree, hierarchy, or property meaning.

### Collaboration

- transports the publication as an opaque completed Factory value;
- preserves its deliveries, order, metadata, and repeated payloads; and
- adds no restore classifier, tombstone store, semantic history, dedupe, LWW,
  timestamp ordering, conflict resolution, or convergence registry.

### Asyra Design collaboration adapter

- validates the complete publication and identifies a subtree restore from the
  typed `CHANGE_SUBTREE` action;
- owns remote permission, domain ordering, duplicate/stale decision, and
  accept/reject policy;
- routes owner deliveries in the Inspector-defined canonical order inside one
  remote transaction; and
- rejects the whole publication when policy or complete preflight fails.

### Scene Tree

- remains the sole canonical owner of active/deleted element instances,
  hierarchy membership, parent/index validation, child order, cycle prevention,
  and subtree mutation;
- reuses the exact owner-held deleted instance when a compatible tombstone
  exists;
- otherwise materializes an isolated runtime instance from the exact received
  Scene Tree snapshot through a bounded canonical restore API; and
- never delegates hierarchy reconstruction to App, Render, UI, or
  Collaboration.

### Props Manager

- remains the sole canonical owner of property-component validation,
  materialization, identity, data, and element/property relations;
- reuses compatible owner-held deleted property instances where available; and
- otherwise materializes exact known property data through its canonical
  owner path, without defaults or newly generated ids.

### Core, Preset, Render, and UI

- Core exposes only the minimum instance-safe owner façades required by the
  accepted Inspector; it owns neither restore policy nor snapshot semantics.
- Preset continues to own official Group component registration and ordinary
  Group bounds/coordinate behavior. It does not restore hierarchy.
- Render and UI consume the ordinary committed canonical projection. They
  cannot patch missing elements, build a fallback hierarchy, or retain a
  restore-only state copy.

## Product Contract

### Restore snapshot

- The snapshot is captured from detached owner evidence at the original delete
  transaction, not reconstructed from later runtime state when undo is invoked.
- It is exactly one affected subtree, not the whole file.
- It contains enough owner-partitioned evidence to restore the subtree's exact
  Scene Tree and Props state. The matching Inspector finalizes the existing
  payload fields and any strictly necessary stale-before evidence.
- The existing Factory `SharedPublication` is the only transport envelope.
  No second provider message, side channel, or restore-specific Collaboration
  API is allowed.
- The snapshot remains a known-data materialization contract. It is not expanded
  into feature/tool/create-default steps and does not allocate replacement ids.

### Sender behavior

- A successful local subtree delete retains the exact detached inverse evidence
  required by local undo and remote restore.
- Undo first completes the ordinary local canonical restoration.
- The committed undo publishes one grouped restore snapshot using the existing
  Factory shared-publication path.
- Redo publishes the ordinary exact forward subtree removal through that same
  path.
- A failed local undo publishes nothing. A failed publication does not invent a
  second restore path.

### Receiver classification and routing

- The App validates every delivery before the first canonical mutation.
- A valid `CHANGE_SUBTREE` delivery whose action is `RESTORE_SUBTREE`
  classifies the complete publication as a subtree restore publication.
- The App does not call a feature-level create command. It routes the received
  known-data sections to their canonical state owners.
- Ordinary create, update, move, remove, and property publications continue
  through their existing remote routes.
- A mixed or malformed publication that cannot satisfy the restore contract is
  rejected as one unit; it is not partially downgraded to ordinary deliveries.

### Canonical restore

- An owner may reuse a compatible local tombstone, but the remote contract
  cannot require one to exist.
- When no tombstone exists, the owner materializes a new client-local runtime
  instance from the exact received data while preserving the canonical stable
  id. Cross-client identity is the stable id and data contract, not JavaScript
  object identity.
- Scene Tree validates the complete hierarchy snapshot before its first
  hierarchy mutation.
- Props Manager validates the complete property snapshot before its first
  property mutation.
- The full owner sequence must be preflight-valid or formally rollbackable so
  any later owner failure restores the exact pre-publication state.
- One accepted restore publication creates no local undo entry and emits no
  outbound collaboration echo.

### Strict stale-restore policy

Asyra Design's reference policy rejects the complete restore before mutation
when any of the following is true:

- a stable id is already active;
- an owner-held tombstone exists for a restored id but is not exactly
  compatible with the received snapshot;
- the target parent is missing, invalid, or cannot accept the exact root index;
- the current hierarchy no longer satisfies the Inspector-defined
  delete/restore before evidence;
- the snapshot contains duplicate ids, missing owner data, invalid component
  registrations, malformed property relations, a cycle, or inconsistent child
  order; or
- permission or app/backend domain-order policy rejects the publication.

Scene Tree and Props Manager still enforce their canonical invariants. The App
may reject earlier through policy, but neither the App nor Collaboration may
repair, reorder, merge, or partially apply stale canonical data.

### `core.load(...)` boundary

This plan does not restrict when an app developer may call `core.load(...)` and
does not define a live-session prohibition. A future app-owned append workflow
is also outside this plan.

Remote subtree restore must use the scoped canonical restore/materialization
owners rather than loading a whole document, but that route-specific decision
does not change the general Core load contract.

## Product Cases

The formal plan and Inspector tests must cover at least:

1. a live peer that observed delete reuses compatible local element/property
   tombstones on restore;
2. a peer with the current post-delete document but no local tombstones
   materializes the exact nested Group subtree from the received snapshot;
3. normal and empty Groups restore with exact stable ids, parent, root index,
   descendant order, raw Group data, and properties;
4. local undo emits one grouped publication and the receiver applies one remote
   transaction;
5. remote restore is non-undoable and produces no outbound echo;
6. a subsequent remote redo removes the restored exact subtree;
7. id collision, stale parent/order evidence, malformed element data, malformed
   property data, duplicate ids, missing registration, and permission rejection
   leave no partial Scene Tree or Props state;
8. snapshot data stays detached from later mutation of caller/runtime objects;
9. save after restore contains the exact canonical subtree;
10. Render and Layers projection receive the restored stable identities through
    their ordinary canonical handoff; and
11. two Core/Scene Tree/Props/Factory compositions remain instance-isolated.

## Unsupported and Deferred

- full-document initial sync or late-join state acquisition;
- missed-publication replay, reconnect recovery, durable snapshots, or backend
  storage;
- Yjs, state vectors, CRDT document ownership, or a framework recovery engine;
- a Collaboration-owned operation registry, dedupe, LWW, timestamp ordering,
  hierarchy conflict policy, or semantic history;
- general `core.append(...)` design or any `core.load(...)` lifecycle
  restriction;
- cross-document paste/import, partial subtree restore, UI recovery prompts, or
  automatic stale-data repair;
- Group UI, auto-layout, resize/scaling, clipping, masks, symbols, or other
  roadmap behavior.

Those concerns cannot be introduced merely because they are discovered during
this plan.

## Required Inspector Readiness

The first production PR must create a matching Inspector and executable
readiness contract tests before production edits. It must define these exact
owner steps:

1. **Delete evidence capture** — Scene Tree and Props each produce detached
   owner evidence; Factory records it in one intended transaction.
2. **Local undo and publication** — owners restore locally; Factory groups the
   exact inverse owner deliveries in one `SharedPublication`.
3. **Transport handoff** — Collaboration forwards the opaque publication
   unchanged.
4. **Remote classification and policy** — App validates the complete
   publication, classifies restore, and accepts or rejects it.
5. **Scene Tree restore preflight/materialization** — Scene Tree validates
   hierarchy evidence and chooses tombstone reuse or exact known-data
   materialization.
6. **Props restore preflight/materialization** — Props Manager validates and
   applies its exact owner data through the Inspector-defined atomic ordering.
7. **Remote transaction settlement** — Factory commits or completely rolls
   back one non-undoable, no-echo remote transaction.
8. **Projection handoff** — Preset bounds, Render identity projection, and App
   Layers/UI consume ordinary canonical updates.

Every step must state owner, input/output, conditions, bypasses,
allowed/forbidden contributors, implementation boundary, failure owner,
product cases, and Definition of Done. Production work advances one owner step
at a time.

## Planned Implementation Slices

1. Create the Inspector and failing readiness/product contract tests.
2. Prove and implement detached complete restore evidence in the existing
   Factory publication boundary.
3. Prove and implement Scene Tree tombstone-optional exact materialization.
4. Prove and implement Props tombstone-optional exact materialization.
5. Prove and implement App classification, strict stale policy, atomic remote
   ordering, no-undo, and no-echo behavior.
6. Prove save/load, Render/Layers handoff, instance isolation, and synchronized
   product behavior.

Each slice requires a bounded local commit after its formal tests and direct
consumer review pass. Implementation must stop if the matching Inspector does
not authorize the required owner boundary.

## Required Validation

Before implementation can be presented for user review:

- all affected Scene Tree, Props Manager, Factory, Core, Collaboration, Preset,
  Render, and Asyra Design tests;
- Inspector contract tests;
- focused remote delete/undo/redo integration tests;
- TypeScript and affected package builds;
- dependency validation;
- lint;
- root production build;
- synchronized visual/product gates for restored Group projection; and
- bounded final diff and direct-consumer review.

Tests belong in the nearest matching `__tests__` directory. Fixture-specific
exceptions, mock product paths, Render-only workarounds, and app-only fallback
state are forbidden.

## Definition of Done

- A no-tombstone receiving peer can apply one valid subtree restore publication
  and obtain the exact canonical Group subtree.
- Tombstone-present and tombstone-absent paths produce equivalent stable ids,
  data, hierarchy, properties, save output, and projections.
- One local undo remains one grouped publication; one accepted remote restore
  remains one transaction with no local undo entry or echo.
- Every invalid or stale restore fails atomically with its failure owned by the
  Inspector-defined App or canonical state owner.
- Collaboration remains transport-only and unchanged in semantic
  responsibility.
- General Core load behavior is unchanged.
- All required formal and product gates pass.
- The implementation PR remains open for user review; closeout and merge occur
  only after explicit user approval.
