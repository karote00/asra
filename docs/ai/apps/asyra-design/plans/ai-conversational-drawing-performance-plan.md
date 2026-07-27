# Asyra Design Conversational AI Drawing Performance Plan

## Status

Active Level 3 architecture refactor. PR #101 is merged and the existing
`codex/asyra-design-ai-conversational-drawing-performance` branch remains the
authorized implementation base. This document is the single active plan; the
architecture replan updates it instead of creating a duplicate plan.

The completed Conversational AI Mock Drawing behavior remains authoritative.
Credential-gated Live AI provider and API-key testing is outside this plan and
remains owned by the existing live-provider successor plan.

Architecture authority:

- `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-flow-inspector.data.cjs`
- `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-flow-inspector.html`
- `docs/ai/apps/asyra-design/plans/__tests__/ai-conversational-drawing-performance-flow-inspector.contract.test.cjs`

Executable product cases:

- `docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature`

## Goal

Make high-detail conversational drawing and progressive collaboration feel
interactive by replacing repeated single-item mutation, evidence construction,
serialization, observer, and transport boundaries with canonical batch
boundaries.

The result must retain full ordinary editable Vector detail, exact canonical
IDs and ordering, one intended Undo action per mutating turn, complete history,
progressive peer-visible slices, and the ordinary Render route.

## Architecture Replan Evidence

The following evidence closes the earlier incremental profiling loop and fixes
the target architecture before further production edits.

### Prior reference baseline

- The original balanced atomic creation settled in 29 seconds and progressive
  creation settled in 105 seconds.
- The original blue-whisker and red-pupil follow-ups settled in 20 seconds and
  4.3 seconds.
- The original full progressive two-actor recording command took 13.2 minutes;
  its retained recording is 774.96 seconds long. No post-replan full recording
  has been run, so these values are not a current implementation estimate.
- Maximum detail originally materialized 27,471 editable Vectors and 295,794
  points in 153 seconds.
- The already-validated Render projection repair reduced the production atomic
  three-run range to 9.454-9.795 seconds with a 9.744-second median while
  retaining all 7,112 ordinary projections.

### Contents attribution and correctness

- Contents present averaged 7.026 seconds; Contents omitted averaged 7.074
  seconds for the same persisted 7,112-element state.
- Omitting Contents therefore did not improve product load time and Contents
  mount is not the main drawing latency owner.
- The Layers list has a separate correctness defect: its virtualizer observes
  the outer panel while the actual inner scroll element receives scrolling.
  The DOM remains near the first viewport, so only the first twenty-some rows
  are reachable even though canonical state contains every element.

### High-detail collaboration transport profile

- Actor A product execution was approximately 18.194 seconds.
- Actor B first visible state was approximately 1.275 seconds.
- At the 30-second convergence deadline Actor B had only 5,548/7,076 elements
  and 29/35 publications.
- The server-side socket backlog was approximately 4.99 MB and the longest
  write callback was approximately 9.46 seconds.
- Actor B remote apply totaled approximately 5.894 seconds, inbound dispatch
  approximately 1.979 seconds, and Render approximately 0.682 seconds.

The first blocking boundary is server-to-Actor-B transport drain and bounded
delivery, not Render or Contents mount.

### Rejected compression candidate

The tested WebSocket compression candidate regressed Actor B to 3,500/7,076
elements and 21/35 publications at the same deadline. Compression is rejected
as a result, and the final relay contract explicitly uses
`perMessageDeflate: false`.

## Bounded Contract

Authorized mutation scope:

- `@asyra/factory`, `@asyra/props-manager`, `@asyra/scene-tree`, `@asyra/core`,
  `@asyra/collaboration`, `@asyra/preset`, and `@asyra/render`;
- Asyra Design AI actions, common APIs, UI projection, Contents,
  Collaboration adapter, codec worker, reference WebSocket server, profiling,
  and formal tests;
- this active plan, Inspector data and contract test, and performance BDD.

The HTML Inspector remains the existing shared viewer. It changes only if the
new lanes cannot be represented by the current generic viewer.

Excluded scope:

- Live AI provider and API-key formal testing;
- production backend DB integration or socket-server checkpoint policy;
- VTracer detail generation;
- an AI-only renderer or Render-engine bulk command;
- unrelated framework cleanup.

No third-party package, binary, runtime, Node.js, Yarn, or package-manager
upgrade is authorized. Existing platform and repository dependencies must be
used; any missing capability stops the step for explicit approval.

## Target Architecture

```text
validated AI descriptor
→ create Group
→ one all-children Core bulk request
→ Props/relationship/Scene Tree staged preflight and canonical apply
→ FactoryMutationBatchArtifact
   ├─ one Undo/Redo journal action
   ├─ atomic or progressive publication slices
   ├─ Preset/Render/UI projection
   └─ local-only persistence snapshot trigger
→ worker binary encode
→ opaque WebSocket relay with byte backpressure
→ worker binary decode
→ App policy and canonical preflight
→ one remote Factory transaction per source publication
→ peer Preset/Render/UI projection
```

### Bulk Mutation Contract

- Add `Core.createElementsInParentBatch(...)`, returning
  `CanonicalElementBatchResult` with ordered element IDs and a Factory-owned
  delivery handle.
- AI composition creates one Group, then submits one all-children Core bulk
  request for all accepted children. The existing App hot-path loop that calls
  Core once per fixed 256 items is removed.
- Point-aware progressive publication slices start with a 2,048 points soft
  target and grow to an 8,192 points soft target. One indivisible element may
  exceed a soft target.
- A slice changes only projection and publication timing; it does not repeat,
  split, or otherwise redo the canonical mutation.
- Every single-item public API becomes a batch-of-one convenience over the same
  canonical implementation.
- Props Manager performs one whole-batch schema, ID, and relationship preflight,
  then instance materialization, relationship rebind, and `registerMany`.
  A later invalid item leaves no committed prefix.
- Scene Tree performs one map-registration phase, one parent children
  replacement, and one ordered batch evidence handoff. Required instance
  construction, local relationship wiring, local observer binding, and ordered
  Scene evidence entries may iterate N inside their canonical owner. They must
  not create N Core requests, Props registration phases, Scene map or parent
  replacement phases, Factory batch handoffs, or App transactions. Step 11
  profiling must identify one of these owner-local loops as a material
  bottleneck before deeper micro-batching becomes a release blocker.

### Factory Mutation Batch Artifact

`@asyra/factory` adds and owns:

- `FactoryMutationBatchArtifact`;
- `SharedDeliveryBatch`;
- `SharedPublication.batches`;
- `LocalSharedDataChannel.appendBatch(...)`;
- `LocalSharedDataChannel.observeBatch(...)`;
- an ordered batch observer API.

Single-delivery conveniences delegate to batch-of-one. At the canonical owner
handoff, Factory deeply detaches and freezes the artifact once. The immutable
artifact contains ordered canonical changes, IDs, inverses, shared-delivery
mode, and progressive slice boundaries.

History, Render/UI, and Collaboration consume this one artifact. They do not
call `.save()` to reconstruct it, rebuild snapshots from live owners, or clone
each observed delivery independently. An observer mutation attempt cannot
pollute another consumer.

### Transaction Boundary

The write timeline is fixed:

1. One Agent turn opens one outer App transaction.
2. Group and children are both mutated inside that transaction.
3. Progressive publication slices create no new canonical writes or history
   actions.
4. A successful mutating turn creates one Undo action; Undo and Redo each
   restore the complete intended action.
5. If an already-published immediate slice rolls back, compensation uses the
   inverse from the same `FactoryMutationBatchArtifact`.
6. Local action, Undo, and Redo commits each trigger one complete persistence
   snapshot. Remote transactions trigger no client snapshot or write.

No network frame, progressive slice, observer callback, or persistence
acknowledgement may split the intended transaction or history boundary.

### Projection and Contents Contract

- Preset consumes the batch observer directly. Atomic delivery causes one
  projection; progressive delivery causes one projection for each formal
  slice and never collapses to a final-only peer frame.
- Render uses the existing ordinary Vector strategy and preserves all 7,076
  editable elements. Each slice causes at most one invalidation and one frame
  flush.
- UI context updates only affected entries and hierarchy order from the batch
  artifact; it does not rebuild the complete element map for each
  `ADD_ELEMENT`.
- Contents binds the virtualizer to the actual inner scroll element. The DOM
  remains bounded to viewport plus overscan rows, but the user can scroll to
  and interact with the last canonical element.
- No Render-engine bulk command is added. Current evidence does not justify
  expanding the engine command surface.

### Binary Collaboration Transport

- Hello, acknowledgement, failure, awareness, and credit control frames remain
  JSON.
- All shared publication data uses a versioned binary frame. It is not first
  JSON-stringified and then compared with a binary representation.
- The existing repository codec moves to a Web Worker without a new package.
  Outbound data makes one object-to-worker structured clone; the worker returns
  a transferable `ArrayBuffer`.
- An inbound `ArrayBuffer` transfers to the worker without a main-thread payload
  copy. The worker releases only one publication at a time for main-thread
  canonical apply.
- The binary frame has a 1 MiB soft target. One indivisible canonical record
  may exceed it without creating an element, point, payload, or composition
  ceiling.
- Invalid, unsupported-version, and truncated frames fail through the existing
  provider failure contract.

### Opaque Relay and Backpressure

- After handshake, the server parses only the frame header, version, request,
  publication, chunk, and control metadata. The canonical payload is relayed
  opaquely with byte parity: no payload decode, re-encode, history ownership,
  or canonical splitting.
- Each peer queue uses a 2 MiB high watermark and a 512 KiB low watermark. One
  oversized indivisible frame is allowed only when that peer queue is otherwise
  empty.
- Queue progress waits for the `socket.send` callback and receiver
  `frame-consumed` credit.
- A JSON `source-frame-admitted` credit is returned only after one source frame
  enters every request-start peer queue. The provider retains one outbound
  publication frame in flight and sends the next frame only after the exact
  credit arrives. This bounds source ingress without pausing the whole socket.
- JSON controls, especially receiver `frame-consumed`, remain on a readable fast
  path while publication admission is blocked. The server must not use a
  socket-wide pause as publication backpressure because that can deadlock
  bidirectional credit.
- Sender `server-accepted` means every current peer queue had bounded capacity;
  it does not mean a peer decoded or applied the publication.
- Receiver wire credit is returned after worker receipt. Main-thread canonical
  completion emits a separate `peer-applied` receipt.
- The client and reference server explicitly use `perMessageDeflate: false`.
  Any future compression experiment needs a worker-side profile and a separate
  plan.

### Remote Apply Contract

- Each source publication owns one remote Factory transaction. Different source
  publications are not merged into one transaction.
- The worker owns wire validation and normalization only. App policy and
  canonical preflight remain in the App/Core owner.
- Props, relationships, instances, and Scene Tree apply through one canonical
  batch boundary and produce one remote Factory mutation artifact.
- Reactive evidence uses one batch publish with one observer-registry snapshot,
  while preserving exact event order.
- Actor B creates no Undo, no echo publication, no persistence capture, no
  provider save, and no IndexedDB write.
- Disconnection, closed transport, invalid frames, and worker teardown preserve
  existing `ProviderFailure` behavior and never fabricate convergence.

### Persistence Contract

- Eligible local action, Undo, and Redo commits each capture one deeply detached
  complete snapshot at the committed state.
- Snapshot provider work remains FIFO; failure of one save does not coalesce,
  drop, or prevent a later eligible snapshot.
- Remote origin is an explicit persistence bypass with zero client persistence
  capture, save-hook execution, provider save, or IndexedDB update.
- A future production socket server coordinating backend DB checkpoints is
  outside this plan. The current reference server remains an in-memory
  transport owner, not a durability owner.

## Performance Measurement Contract

### Reference Environment

Formal budgets use the committed tabby reference fixture, deterministic Mock AI
provider, production App build, fresh canonical and collaboration state,
dedicated App and WebSocket ports, and independent actor browser contexts.

One unmeasured warm-up precedes three measured runs. Median and worst values are
reported separately.

### Gate Partitioning

- The default fast Mock AI CRDT correctness fixture has 16 items and exercises
  ordinary App, Factory, Collaboration, remote apply, Render, and history
  routes.
- The 7,112-element balanced correctness gate is change-aware or explicitly
  requested.
- High-detail performance and CRDT suites remain independent and explicitly
  opt-in.
- The 7,076-element two-window full recording remains manual opt-in. Video,
  screenshot, trace, profile, and thumbnail artifacts are ignored and never
  committed.
- The Contents present/omitted comparison remains diagnostic only and can
  satisfy no release budget.

### Required Spans

Measured output separates:

- accepted turn and product execution;
- App bulk-request preparation;
- canonical Props/Scene Tree batch preflight and apply;
- Factory artifact isolation, history commit, and publication slicing;
- worker encode;
- server peer queue and socket drain;
- worker decode;
- remote canonical apply;
- Render;
- UI and Contents projection;
- client persistence capture and provider save;
- Actor A/Actor B first-visible and settled milestones;
- server startup, browser launch, assertions, screenshots, recording, and
  teardown as E2E harness overhead.

Detached profiling cannot alter product scheduling, transaction boundaries,
canonical state, delivery, history, retry, cancellation, or terminal results.

## Performance Budgets

On the reference environment:

- Balanced atomic creation:
  - median accepted-turn-to-Actor-A-settled time at most 12 seconds;
  - no measured run over 20 seconds.
- Balanced progressive creation:
  - median accepted-turn-to-Actor-A-settled time at most 20 seconds;
  - no measured run over 30 seconds.
- Progressive collaboration:
  - Actor B first visible canonical batch within 2 seconds of Actor A's first
    shared publication;
  - Actor B canonical convergence within 30 seconds of Actor A's canonical
    creation commit;
  - blue-whisker and red-pupil follow-ups each converge within 5 seconds of
    Actor A settlement.
- Full three-turn two-actor product flow:
  - product spans total at most 90 seconds median and 120 seconds worst;
  - whole dedicated E2E command, including harness overhead, at most 180
    seconds.
- Maximum detail:
  - median accepted-turn-to-Actor-A-settled time at most 60 seconds;
  - no measured run over 90 seconds.

Budgets are gates, not item, path, point, payload, frame, or composition
ceilings. A finite valid drawing remains accepted even when a performance gate
fails.

## Non-Negotiable Equivalence

Every optimized route preserves:

- exact accepted item order and element, subpath, and point counts;
- every canonical element, point, segment, network, subpath, and component ID;
- canonical bounds, transforms, hierarchy, roles, fills, strokes, visibility,
  and ordinary editable Vector behavior;
- one Group before its ordered children;
- the 1,672-by-941 pure-white background;
- one outer transaction and one intended history action per mutating turn;
- exact Undo, Redo, recoverable partial-result, fatal rollback, compensation,
  cancellation, and teardown semantics;
- exact atomic or progressive delivery selection and peer-visible progressive
  slices;
- local persistence parity and remote persistence bypass;
- no reduced detail, bitmap replacement, regenerated full portrait, AI-only
  renderer, final-only peer shortcut, fabricated progress, missing history, or
  fixture-specific production path.

## Product Cases

### One Composition Bulk Mutation

The App creates one Group and submits all accepted children through one Core
bulk request. A later invalid child commits no prefix; single-item calls produce
the same canonical evidence through batch-of-one.

### One Immutable Transaction Artifact

One `FactoryMutationBatchArtifact` serves History, Render/UI, and Collaboration.
It retains ordered inverses and slice boundaries, creates one intended Undo
action, and supplies precise compensation after rollback.

### Scrollable Contents Window

A 100+ row formal case scrolls the real virtualizer viewport to the final
canonical element while keeping mounted row count bounded. Collapse,
selection, and hierarchy order remain correct.

### Visible Atomic and Progressive Projection

Atomic delivery projects once. Progressive delivery projects each formal slice
once, retains ordinary Vector detail, and does not create new canonical writes.

### Binary Backpressured Collaboration

Versioned binary publication frames round-trip exactly, the opaque server
retains byte parity, slow peers remain bounded by watermarks, and wire receipt,
server acceptance, and peer apply remain distinct.

### Remote Batch Apply

Each source publication applies through one remote Factory transaction and one
batch observer delivery. Actor B converges without Undo, echo, capture, save, or
IndexedDB update.

### Local Snapshot Durability

Local action, Undo, and Redo commits each capture one complete FIFO snapshot.
Remote commits capture none.

### Fast Mock AI CRDT Correctness

The default two-actor case uses the deterministic 16-item fixture. Actor A gains
one Undo action and Actor B gains none while both converge on exact canonical
state.

### Balanced and Maximum Detail

The changed canonical, Contents, and transport paths require one 7,112-element
balanced correctness run during final closure. The 7,076-element production
no-media CRDT and performance cases remain independent. Maximum detail retains
27,471 ordinary editable Vectors and 295,794 canonical points.

### Cancellation and Failure

Recoverable siblings commit as one partial result. Fatal canonical failure,
invalid wire input, transport closure, worker teardown, and App teardown preserve
existing rollback and terminal failure semantics without a committed prefix or
fabricated convergence.

## Owner Step Execution Order

Execution advances only after the current step's focused formal tests and
bounded review have no P0-P2 finding.

1. `contract-readiness-replan`: update this plan, Inspector, contract test, and
   BDD only.
2. `project-scrollable-contents-window`: add a failing real-scroll regression,
   then fix the virtualizer scroll owner.
3. `record-and-deliver-transaction-batch`: add Factory artifact, batch journal,
   batch shared channel, Undo/Redo, and rollback compensation.
4. `apply-canonical-property-scene-batch`: complete Props relationship,
   registration, and Scene Tree bulk boundaries.
5. `prepare-one-composition-bulk-request`: create Group plus one all-children
   Core request; slices only project and publish.
6. `project-visible-canonical-slices`: make Preset, Render, and UI consume the
   artifact directly.
7. `encode-publication-frames`: add binary publication schema, codec worker,
   transferable buffers, and receipts.
8. `relay-frames-with-backpressure`: remove the failed compression candidate,
   relay opaque frames, and enforce per-peer byte credit.
9. `apply-remote-publication-batches`: replace the per-event remote canonical
   hot path with one publication batch transaction.
10. `persist-local-commit-snapshots`: prove local action/Undo/Redo FIFO snapshots
    and remote zero client persistence; production changes occur only for a
    proven mismatch.
11. `evaluate-performance-and-equivalence`: run the complete formal and live
    closure once.

Existing committed results and current WIP are preserved and absorbed only
inside their matching owner step. No cross-owner WIP commit is allowed.

## Step-Local Gates

- Contract: exact owners, graph routes, artifacts, allowlists, failure owners,
  plan anchors, and BDD scenarios.
- Contents: real 100+ row virtualizer unit/integration case, tail scrolling,
  bounded DOM rows, collapse, and selection.
- Factory: one immutable artifact, one history action, full Undo/Redo, no
  transaction-end resending of progressive slices, precise compensation, and
  observer isolation.
- Props/Scene Tree: later-invalid no-prefix behavior, exact IDs/order/
  relationships/instances, and batch-of-one parity.
- App/Core: one all-children bulk request, point-aware publication boundaries,
  cancellation, partial results, and fatal rollback.
- Projection: one atomic flush, one flush per progressive slice, exact 7,076
  ordinary Vector projection, and bounded UI updates.
- Codec/relay: binary round-trip, invalid/truncated rejection, oversized single
  record, opaque byte parity, watermarks, slow peer, disconnect, and ordered
  receipts.
- Remote: one publication transaction and one batch observer call, with no
  Undo, echo, capture, save, or IndexedDB write.
- Persistence: local action/Undo/Redo FIFO snapshots and remote zero client
  persistence.

Each owner step runs focused unit and integration gates only. The 7,076 heavy
suite is not repeated after every step.

## Final Gates

After all architecture owners are complete, run one heavy closure:

1. Inspector contract, all affected package unit/integration tests, Asyra
   Design full local tests, lint, and production build.
2. Default 16-item Mock AI CRDT correctness.
3. One 7,112-element balanced correctness run because canonical, Contents, and
   transport paths changed.
4. Independent 7,076-element production no-media CRDT and performance runs.
5. One warm-up plus three measured runs reporting product execution, artifact,
   encode, server queue/drain, worker decode, remote apply, Render, UI, and
   harness overhead.
6. Maximum-detail 27,471-element and 295,794-point gate.
7. `app-visual-review-sync` from the same measured live App state, with direct
   inspection of complete, uncropped Actor A and Actor B output, Styles, IDs,
   and hierarchy.
8. The 7,076-element two-window full recording only with explicit user opt-in.

Generated media, recordings, screenshots, traces, profiles, and thumbnails are
never committed.

## Definition of Done

- Every Step-local gate passes before its owner step advances.
- The final formal unit, integration, E2E, CRDT, performance, lint, build, and
  Inspector gates pass.
- Bulk APIs delegate singles to batch-of-one and preserve canonical evidence.
- One immutable Factory artifact is shared across History, projection, and
  Collaboration without downstream semantic reconstruction.
- Peer queues remain byte-bounded and exact publication order converges.
- Contents reaches the final canonical element with bounded DOM rows.
- Actor B has no Undo, echo, or client persistence side effects.
- Existing performance budgets pass without lowering detail or weakening
  canonical, history, persistence, or progressive semantics.
- The synchronized visual review passes from the same measured live App state.
- The plan remains active until the product owner explicitly accepts closure.

## Assumptions and Exclusions

- PR #101 and the current feature branch/local commits remain the recovery
  basis; do not recreate the branch or reset accepted work.
- Live AI provider testing is outside this plan.
- Production backend DB integration and checkpoint policy are outside this
  plan.
- The reference WebSocket server remains memory-only.
- No third-party package is added and no environment tool is upgraded.
- No item, point, payload, or composition ceiling is introduced.

## WIP Disposition

Preserve valid committed work and current WIP until its matching owner step,
then review, test, and commit only that owner slice. Remove the failed
compression candidate in `relay-frames-with-backpressure`; do not remove valid
batch or profiling evidence merely because it predates this replan.

## Stop Conditions

Stop the current owner step and replan from the first incorrect owner when:

- an artifact cannot reproduce exact canonical or history evidence;
- a downstream owner must rederive upstream semantics from raw mutable data;
- a peer queue cannot remain bounded;
- an optimization changes IDs, ordering, detail, Undo/Redo, persistence,
  progressive visibility, partial result, rollback, or failure behavior;
- a required file falls outside the active step allowlist;
- existing platform capability would require an unapproved dependency or tool
  upgrade;
- the same focused gate fails three times.

If the final heavy gate fails, report only the first over-budget or incorrect
owner with evidence. Do not resume a local patch-and-tune loop.
