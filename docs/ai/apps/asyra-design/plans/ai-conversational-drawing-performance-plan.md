# Asyra Design Conversational AI Drawing Performance Plan

## Status

Active Level 3 app performance closure. PR #101 is merged and the existing
`codex/asyra-design-ai-conversational-drawing-performance` branch remains the
implementation base. Production implementation and formal validation continue
one Inspector owner step at a time.

This plan, its Inspector data, contract test, and BDD are the active app-level
implementation authority. Framework package contracts remain authoritative
inside their existing owner boundaries; this checkpoint does not declare any
unstaged framework plan or framework Inspector complete.

The completed Conversational AI Mock Drawing behavior remains authoritative.
Credential-gated Live AI provider and API-key testing is outside this plan and
remains owned by the existing live-provider successor plan.

Active architecture artifacts:

- `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-flow-inspector.data.cjs`
- `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-flow-inspector.html`

The product cases have been realigned and are executable contract authority:

- `docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature`

## Goal

Make high-detail conversational drawing and progressive collaboration feel
interactive by replacing repeated single-item mutation, evidence construction,
serialization, observer, and transport boundaries with canonical batch
boundaries.

The result must retain full ordinary editable Vector detail, exact canonical
IDs and ordering, one intended Undo action per mutating turn, complete history,
progressive peer-visible slices, and the ordinary Render route.

## Current Local Interactive Drawing Closure

Status on 2026-07-29: the corrected production single-Actor gate and
synchronized live visual review are complete. Manual review accepted the
progressive drawing experience and added one bounded App requirement: while the
drawing turn is active, ordinary viewport pan and zoom stay responsive while
all other document interaction remains locked. Contents, CRDT, transport,
persistence, and remote-apply owners remain paused until this local requirement
is implemented and manually accepted.

The first manual navigation check then exposed a startup-policy mismatch: the
production entry still required `?ai=mock`, and its missing delivery flag
selected the atomic all-children path, so one 7,000-plus-element synchronous
call prevented the browser from dispatching any input until completion. The
production Asyra Design entry now provides the deterministic Mock AI without an
`ai` query and defaults to progressive delivery. Explicit
`aiDelivery=atomic` remains the atomic opt-in for isolated measurement. This is
an App startup policy correction, not an Input System, Feature System,
transaction, or event-bus exception.

The current execution phase is deliberately limited to one production
single Actor drawing turn. It answers four product questions before any
additional cross-window work resumes:

1. how long one complete 7,112-element balanced composition takes;
2. when the user first sees an exact-bounds loading frame and the first ordinary
   editable Vector;
3. whether real 25%, 50%, 75%, and 100% visible-element milestones advance
   cooperatively while the whole turn remains one Undo action;
4. whether no ordinary progressive batch continues to monopolize the main
   thread while the App is visibly loading.

Contents is excluded from this phase, and the panel may remain hidden in its
formal gate. CRDT, WebSocket transport, a second Actor, collaboration
convergence, and IndexedDB are also excluded. The gate uses one fresh empty
canonical document and does not save or reload it. These exclusions isolate
the local App/Core/Factory/Preset/Render/UI path; they do not waive the deferred
full-plan gates.

This phase stops after `evaluate-local-interactive-drawing` reports the local
timings and synchronized live visual evidence. No deferred Contents,
collaboration, persistence-policy, codec, relay, or remote-apply step advances
without a later product decision.

All current Asyra Design demo documents are intentionally memory-only on the
client. After Core starts, RenderApp loads one canonical empty document through
the ordinary Core load API; collaboration connects only after that load. The
ordinary local demo, Actor A, and Actor B must not create, initialize, load,
inject, capture, or save through a client persistence provider, and performance
routes must not read or hash IndexedDB. Production server checkpoints and
backend database durability remain future server-owned work.

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

### Final-closure transport evidence and owner correction

The first production 7,076-element no-media warm-up refined that boundary:

- Actor B first visible was approximately 0.978 seconds and Actor A product
  creation was approximately 15.743 seconds.
- At the 30-second deadline Actor B had only 940/7,076 elements and had
  processed 11 of 35 publications.
- Actor B worker decode totaled approximately 1.544 seconds and remote apply
  approximately 2.358 seconds. The reference server `socket.send` callbacks
  remained below 2 milliseconds.
- Receiver `frame-consumed` cadence grew to approximately 2-3.3 seconds,
  source request queue wait grew from approximately 2.989 to 6.478 seconds,
  and relay request totals grew from approximately 5.684 to 14.503 seconds.

The corrected first implementation owner is therefore the Step 7 receiver
provider/worker handoff. Its scalar inbound job does not give the next frame to
the worker until the prior decoded publication has crossed repeated clone
boundaries and completed synchronous App dispatch. Step 8 then amplifies that
coupling by sending only the peer queue head. Node/WebSocket write and Render
remain excluded as first owners.

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
→ derive exact accepted bounds
→ runtime-only App DOM loading frame
→ compositor paint opportunity
→ create Group
→ atomic: one all-children plural Core batch
   or progressive: ordered point-and-element-count plural Core batches
→ Props/relationship/Scene Tree preflight and canonical apply per plural batch
→ FactoryMutationBatchArtifact
   ├─ one Undo/Redo journal action
   ├─ atomic or progressive publication slices
   ├─ Preset/Render/UI projection
   └─ no collaboration client persistence
→ worker binary encode
→ opaque WebSocket relay with byte backpressure
→ worker binary decode
→ App policy and canonical preflight
→ one remote Factory transaction per source publication
→ peer Preset/Render/UI projection
```

### Bulk Mutation Contract

- `Core.createElementsInParent(...)` is the single plural creation surface and
  returns ordered canonical element IDs. A single-element convenience delegates
  to this batch-of-one path; Core exposes no AI loading, progress, slice,
  delivery-controller, or timing parameter.
- Atomic AI composition creates one Group, then submits one all-children plural
  Core batch.
- Progressive AI composition creates the same Group, then submits deterministic
  ordered plural Core batches. Each batch enforces both a point budget and an
  element-count budget so thousands of zero-point primitives cannot collapse
  into one blocking call. One indivisible element may exceed only the point
  soft target.
- Progressive batch calls remain inside one outer App transaction. They are
  separate canonical batch boundaries for cooperative local visibility, not
  separate App actions, transactions, or history actions.
- Publication slicing may further frame already-recorded evidence for transport;
  it does not repeat a completed canonical mutation.
- Every single-item public API becomes a batch-of-one convenience over the same
  canonical implementation.
- Public creation APIs are selected by data lifecycle, never blocked by local
  or remote origin: ordinary descriptors use `addNewElement`/`addNewElements`,
  detached canonical snapshots use `addNewElementsFromCanonicalData`, and
  canonical data whose property owners are already active uses
  `addNewElementsFromCanonicalDataUsingActiveProperties`. An active transaction
  owner must atomically accept canonical batch evidence; this is a capability
  invariant, not a caller-identity policy.
- Removal follows the same lifecycle rule. Ordinary `removeElement` owns
  complete element and property cleanup, while `removeSubtree` owns a complete
  container hierarchy. Retained
  history or collaboration evidence whose Props removal is carried separately
  uses `removeElementUsingActiveProperties`/
  `removeElementsUsingActiveProperties`; a complete retained container
  hierarchy uses `removeSubtreeUsingActiveProperties`. These paths preserve the
  source Scene-then-Props evidence order without applying either owner twice.
  The single-element form is the batch-of-one convenience, and none of these
  APIs is restricted by local or remote origin.
- Retained removal and restore preflight the complete Scene, Props,
  relationship, parent-index, ID, and tombstone evidence before apply. A later
  invalid item leaves no Scene, property, relationship, registry, tombstone,
  parent-list, history-readiness, or publication prefix.
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

During Undo and Redo, the retained artifact returns to the canonical owner
without reordering its Scene and Props evidence. Only an explicitly applied
owner result can ready the corresponding retained publication record. A
semantic no-op remains a failure; Factory must not infer that another owner's
side effect consumed it.

### Transaction Boundary

The write timeline is fixed:

1. One Agent turn opens one outer App transaction.
2. Group and every atomic or progressive child batch are mutated inside that
   transaction.
3. Progressive canonical batches may become locally visible between browser
   paint boundaries, but create no additional App transaction or history
   action. Later publication slicing creates no new canonical writes.
4. A successful mutating turn creates one Undo action; Undo and Redo each
   restore the complete intended action.
5. If an already-published immediate slice rolls back, compensation uses the
   inverse from the same `FactoryMutationBatchArtifact`.
6. Collaboration local action, Undo, Redo, and remote apply trigger no client
   persistence capture, save, IndexedDB read, or IndexedDB write.

No network frame, progressive slice, or observer callback may split the
intended transaction or history boundary.

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
- Inbound `ArrayBuffer` values transfer into a bounded 2 MiB frame-ingress
  window without a main-thread payload copy. One active oversized publication
  assembly may exceed that window only as required to preserve an indivisible
  publication, so no payload ceiling or multi-publication unbounded queue is
  introduced.
- The worker validates frame header, FIFO order, duplicate identity, and ingress
  capacity before emitting `frame-consumed`. Credit therefore means bounded
  worker acceptance and remains independent of previous main-thread canonical
  apply.
- The worker-to-main structured clone is the only inbound object isolation
  boundary. The provider deeply freezes that publication once; Provider and
  Collaboration consumers share the same immutable evidence without repeated
  full-publication clones.
- The worker exposes one immutable decoded-publication lease to App policy and
  canonical preflight. Its settlement has a discriminated success or terminal
  failure outcome. Success releases the next decoded publication; terminal
  apply failure clears the active and pending leases and releases none instead
  of fabricating progress.
- `@asyra/collaboration` represents that handoff as an
  `InboundPublicationLease`: the provider marks the publication evidence
  immutable and supplies a one-shot local settlement callback. The generic
  Collaboration queue preserves legacy provider cloning, but reuses proven
  immutable lease evidence and settles it only after
  `processRemotePublication` completes.
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
- Each peer queue has an exact 2 MiB unretired-byte capacity. A frame is
  admitted only when its bytes fit that remaining capacity. One oversized
  indivisible frame is allowed only when that peer queue is otherwise empty.
- Peer egress sends already-admitted FIFO frames through the 2 MiB byte window,
  so multiple unconsumed frames may be on wire only while their total admitted
  bytes remain within the declared bound.
- Frame retirement and capacity release wait for both the exact `socket.send`
  callback and receiver `frame-consumed` credit. Only a contiguous completed
  queue prefix retires; sending later already-admitted frames does not wait for
  the prior frame to retire. Blocked admission resumes as soon as contiguous
  retirement leaves exact capacity for the next frame; there is no second
  hysteresis threshold.
- A JSON `source-frame-admitted` credit is returned only after one source frame
  enters every request-start peer queue. The provider retains one outbound
  publication frame in flight and sends the next frame only after the exact
  credit arrives. This source-ingress stop-and-wait boundary remains distinct
  from the bounded peer-egress window and bounds source ingress without pausing
  the whole socket.
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
- The active decoded-publication lease settles only after that transaction
  applies successfully. Settlement releases the next lease; failure performs
  terminal cleanup and releases none.
- The worker owns wire validation and normalization only. App policy and
  canonical preflight remain in the App/Core owner.
- Props, relationships, instances, and Scene Tree apply through one canonical
  batch boundary and produce one remote Factory mutation artifact.
- The remote Factory transaction exposes the same batch-capable owner handoff
  used by ordinary transactions while still suppressing remote Undo and echo
  publication.
- Reactive evidence uses one batch publish with one observer-registry snapshot,
  while preserving exact event order.
- Actor B creates no Undo or echo publication. Like Actor A, it has no client
  persistence provider and performs no IndexedDB work.
- Disconnection, closed transport, invalid frames, and worker teardown preserve
  existing `ProviderFailure` behavior and never fabricate convergence.

### Exact-Bounds Loading Frame

- After all accepted descriptors are validated, the App derives their exact
  union bounds and publishes a runtime-only drawing-progress state through
  System Context.
- An App-owned DOM overlay commits a neutral translucent frame over those exact
  workspace bounds after applying the current viewport transform. It is
  pointer-events none, is not a canonical element, does not enter History,
  persistence, Render, or Collaboration, and is never a substitute renderer.
- Loading activity is CSS-only and compositor-safe: animation changes only
  `transform` and `opacity`, with no JavaScript per-frame timer or render loop.
- The App crosses a real browser paint opportunity after the DOM overlay is
  committed and before canonical mutation begins, so the user can see that
  execution is active instead of waiting on an unpainted main thread.
- Before the first ordinary Vector is visible, the frame uses a neutral fill,
  a fine accent outline, and a compositor-animated loading indicator. After the
  first successful batch, the fill clears and the outline plus actual
  element-count progress remain without obscuring the drawing.
- Success, failure, cancellation, and teardown clear the runtime-only state.
  Failure and cancellation retain the ordinary outer-transaction rollback and
  any required visible compensation.

### Cooperative Progressive Composition

- The production Asyra Design entry always supplies the deterministic,
  network-free Mock AI; no `ai` query activates or disables it. Ordinary startup
  selects progressive delivery. Exact `aiDelivery=atomic` remains an explicit
  one-batch measurement opt-in; empty, unknown, or duplicate delivery values
  retain the progressive default.
- Atomic mode retains one all-children plural Core call.
- Progressive mode uses deterministic point and element-count boundaries. The
  initial point soft target is 2,048 and later targets grow to at most 8,192;
  a 32-element work-unit cap independently prevents a large zero-point
  primitive batch.
- The App calls the existing plural Core creation API once per non-empty batch.
  Core, Props Manager, and Scene Tree retain one fixed batch mission and receive
  no loading, progress, AI mode, slice size, or host-yield parameters.
- Each successful batch reaches the ordinary Factory/Preset/Render/UI route,
  advances progress by the number of actually accepted visible elements, then
  awaits a later browser task before the next batch. The batches execute in one
  serialized loop; they are never independently scheduled and never overlap.
  A pure microtask and one timeout scheduled per planned range are not valid
  yields. Explicit browser paint opportunities remain before the first
  mutation and at named visible milestones. After every awaited boundary the
  action checks its Feature-owned `AbortSignal`.
- Group and every batch remain in one outer transaction and create one intended
  Undo. Fatal failure or cancellation rolls back the complete composition;
  already-visible immediate evidence uses the same Factory compensation path.
- Full detail, canonical IDs, ordering, topology, relationships, and history
  remain exact. The progressive route does not use a bitmap, AI-only renderer,
  fake canonical background, estimated time progress, or final-only reveal.

### Document Interaction Lock

- The App acquires one runtime-only document interaction lock before opening
  the outer AI action transaction. The lock is App policy, not canonical data,
  shared data, a new framework event-bus mode, or a parameter passed into Core,
  Props Manager, Scene Tree, Factory, Preset, or Render.
- While the lock is active, the ordinary viewport pan and zoom routes remain
  available and continue repainting the same live loading frame and ordinary
  Vector output. Navigation continues through ordinary Feature execution and
  may cross its existing transaction wrapper, but produces no canonical
  mutation or History and does not alter the AI action transaction evidence or
  the accepted composition bounds.
- Every other tool interaction and document mutation is unavailable during the
  active drawing turn. In particular, selection changes, element creation or
  editing, property changes, deletion, Undo, Redo, and another mutating Agent
  turn cannot enter the document or become part of the AI action.
- AI cancellation remains available. The App releases the lock in the same
  terminal cleanup boundary after success, failure, cancellation, or teardown.
  A second `reactive-events` bus is not used as a scheduling or admission-lock
  substitute; the existing viewport input path and an explicit App-owned
  interaction policy keep the responsibilities separate.

### Demo Client Persistence Bypass

- Ordinary local and collaboration demo sessions start Core and load exactly
  one canonical empty document through `Core.load(...)` without creating,
  initializing, loading, or injecting a client persistence provider.
- Local action, Undo, and Redo and Actor B remote apply all produce zero client
  persistence capture, provider save, IndexedDB read, and IndexedDB write.
- Collaboration connects only after the empty canonical document is loaded.
- Demo reload durability is not a correctness or performance gate.
- A future production socket server coordinating backend DB checkpoints is
  outside this plan. The current reference server remains an in-memory
  transport owner, not a durability owner.

## Performance Measurement Contract

### Current Local Performance Measurement

The current gate performs exactly one 7,112-element balanced progressive
production run through the ordinary Mock AI default in one browser page against
one fresh empty canonical document.
It has no second Actor, Collaboration server, Contents projection, IndexedDB
provider, persistence assertion, reload, warm-up, repeated measured creation,
video, trace, or full-state polling.

The report must name:

- accepted request to connected exact-bounds DOM loading state;
- accepted request to first compositor paint opportunity;
- accepted request to first ordinary Vector visible;
- accepted request to 25%, 50%, 75%, and 100% visible-element milestones;
- longest ordinary canonical work-unit duration and cooperative yield count;
- accepted request to product settled;
- App preparation, canonical batch, Factory, Render, UI, and E2E harness time;
- the final exact canonical element count, bounds/detail equivalence, and Undo
  delta.

Milestones use O(1) runtime counters. The harness may read one bounded exact
canonical summary only after settlement; it must not repeatedly clone, hash, or
walk the 7,112-element state. This single run answers the current product
question without claiming statistical median. The existing multi-run budgets
remain deferred full-plan gates.

The pre-DOM-compositor cooperative-scheduling baseline completed on 2026-07-29
with Contents omitted and no client persistence:

- exact-bounds loading frame visible: 1.337 seconds;
- first ordinary Vector batch visible: 1.391 seconds;
- 25%, 50%, 75%, and 100% visible: 7.130, 9.678, 12.178, and 14.624 seconds;
- product settled: 14.654 seconds; harness wall: 15.664 seconds;
- App preparation: 0.152 seconds; canonical batch calls: 7.307 seconds;
  Factory phases: 2.664 seconds; Render phases: 0.325 seconds; UI phases:
  1.148 seconds. These owner phase totals can be nested and must not be added as
  independent wall time;
- terminal evidence: 7,112 rendered canonical elements, 7,112 unique IDs,
  7,111 ordinary Vectors, 115,663 points, and one Undo action.

The synchronized final App screenshot was inspected from that same measured
state. The complete background bounds and editable portrait were visible
without viewport clipping. The subsequent manual test found that one
256-element canonical batch still blocked the loading state and the rest of
the App for a perceptible interval. That evidence reopens
`stage-local-interactive-composition`: replace the Render-owned loading
projection with a DOM compositor overlay and reduce each serialized canonical
work unit before repeating this one local measurement.

The corrected single production run then completed on 2026-07-29 with a
32-element soft cap, one serialized cooperative loop, a connected DOM
compositor overlay, Contents omitted, and no collaboration or client
persistence:

- connected exact-bounds DOM loading state: 1.076 seconds; first compositor
  paint opportunity: 1.081 seconds; first ordinary Vector: 1.377 seconds;
- 25%, 50%, 75%, and 100% visible: 7.610, 10.983, 14.495, and 17.751 seconds;
- product settled: 17.789 seconds; harness wall: 18.046 seconds; bounded harness
  overhead: 0.257 seconds;
- 226 serialized cooperative yields completed in exact FIFO order; the longest
  measured canonical work unit was 0.333 seconds;
- App preparation: 0.185 seconds; canonical batch calls: 7.991 seconds;
  Factory phases: 3.909 seconds; Render phases: 0.425 seconds; UI phases:
  1.883 seconds. These owner totals are nested and must not be added as
  independent wall time;
- terminal evidence: 7,112 rendered canonical elements, 7,112 unique IDs,
  7,111 ordinary Vectors, 115,663 points, and one Undo action.

The synchronized loading screenshot was inspected at 3,607 of 7,111 ordinary
Vectors and showed the detailed portrait progressively forming inside the
exact loading bounds. The final screenshot showed the complete uncut
background and portrait, with the loading overlay removed. This formal
evidence closes the automated local gate only; manual interaction approval is
still required. No CRDT, transport, Contents, or remote owner step may resume
until the user explicitly confirms the corrected single-machine experience.

### Reference Environment

Formal budgets use the committed tabby reference fixture, deterministic Mock AI
provider, production App build, fresh canonical and collaboration state,
dedicated App and WebSocket ports, and independent actor browser contexts.

One unmeasured warm-up precedes three measured runs. Median and worst values are
reported separately.

Production evidence uses the dedicated AI drawing performance profile. It
returns detached canonical, history, Factory transaction-status, commit, and
publication snapshots without exposing a mutable runtime owner. The dev-only `window.__Core__`
cannot satisfy a release gate; it is only a local diagnostic.

Navigation, App readiness, collaboration readiness, Mock AI readiness,
reference attachment, runtime evidence readiness, and history baseline are
named E2E harness spans. They remain separate from product execution, owner,
transport, Render, and UI timing. Collaboration client-persistence bypass is
proven with cheap startup/runtime counters; no IndexedDB state is opened,
polled, normalized, stringified, or hashed.

### Gate Partitioning

- The current local interactive gate is one single-Actor 7,112-element
  progressive run with no Contents, CRDT, transport, IndexedDB, or repeat.
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
- zero client persistence work for both collaboration actors;
- no reduced detail, bitmap replacement, regenerated full portrait, AI-only
  renderer, final-only peer shortcut, fabricated progress, missing history, or
  fixture-specific production path.

## Product Cases

### One Interactive Composition Action

The App creates one Group. Atomic mode submits all accepted children through one
plural Core request; progressive mode submits deterministic ordered plural Core
batches between browser paint boundaries. Both modes remain one App action, one
outer transaction, one Factory artifact, and one intended Undo. A later fatal
child failure rolls back the complete action; single-item calls retain the same
batch-of-one canonical implementation.

### Local Drawing Progress

The exact validated composition bounds appear as runtime-only overlay state
before the first canonical mutation. Real ordinary Vector batches replace that
placeholder progressively, and actual accepted element counts drive the visible
progress until terminal cleanup.

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
retains byte parity, slow peers remain within the exact 2 MiB unretired-byte
capacity, and wire receipt, server acceptance, and peer apply remain distinct.

### Remote Batch Apply

Each source publication applies through one remote Factory transaction and one
batch observer delivery. Actor B converges without Undo, echo, capture, save, or
IndexedDB update.

### Demo Documents Do Not Persist on Clients

The ordinary local demo, Actor A, and Actor B each load one canonical empty
document, then start without a client persistence provider. Local actions,
Undo, Redo, remote apply, and the performance harness perform no IndexedDB read
or write.

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

The current local closure advances only after the current step's focused formal
tests and bounded review have no P0-P2 finding:

1. `contract-readiness-replan`: update this plan, Inspector, contract test, and
   BDD only.
2. `stage-local-interactive-composition`: add the exact-bounds runtime overlay,
   App-owned document interaction lock, DOM compositor paint opportunity,
   deterministic point-and-32-element plural Core work units, serialized
   later-task yields, actual progress, cancellation cleanup, rollback, and
   single Undo behavior.
3. `project-visible-canonical-slices`: only if its focused test proves the
   existing Preset/Render projection turns one successful App batch into more
   than one visible flush; otherwise it remains unchanged.
4. `evaluate-local-interactive-drawing`: after explicit advance notice, run one
   production single-Actor 7,112-element gate and synchronized visual review,
   report the named times, then stop for product direction.

The following existing steps are deferred and do not advance during the current
local closure:

1. `project-scrollable-contents-window`.
2. `record-and-deliver-transaction-batch`.
3. `apply-canonical-property-scene-batch`.
4. `encode-publication-frames`: add binary publication schema, codec worker,
   transferable buffers, bounded receiver frame ingress, one immutable decoded
   publication lease, and independent wire credit.
5. `relay-frames-with-backpressure`: remove the failed compression candidate,
   relay opaque frames, and send already-admitted FIFO frames through the
   bounded per-peer byte window.
6. `apply-remote-publication-batches`: replace the per-event remote canonical
   hot path with one publication batch transaction.
7. `load-empty-demo-document`: start ordinary local and collaboration demo
    sessions with one empty canonical document and no client persistence
    provider, then prove zero capture, save, IndexedDB read, and IndexedDB write.
8. `evaluate-performance-and-equivalence`: run the complete formal and live
    closure once.

Existing committed results and current WIP are preserved and absorbed only
inside their matching owner step. No cross-owner WIP commit is allowed.

## Current Local Gates

- Contract: the active plan, Inspector, contract test, and BDD agree on the
  single-Actor phase, exact-bounds loading state, cooperative plural Core
  batches, one outer transaction, one Undo, and deferred owners.
- App interaction: focused formal tests prove loading state is published, a
  connected DOM overlay receives exact transformed bounds, and a browser paint
  opportunity completes before the first canonical write. During later-task
  yields, pan and zoom repaint the same live App state while all other document
  interactions produce no canonical mutation or history; success, failure,
  cancellation, and teardown release the lock.
- Slicing: focused tests prove both point and element-count limits, exact order,
  atomic one-call behavior, progressive multiple plural calls, AbortSignal
  checks, one in-flight serialized yield, no next batch before that yield,
  actual progress only after a successful batch, and terminal cleanup.
- Transaction: the existing formal outer-transaction gate proves successful
  progressive composition adds one history action and fatal/cancelled
  composition leaves no committed prefix after rollback/compensation.
- Projection: a focused test determines whether one successful plural Core
  batch already produces one ordinary visible Vector flush. Preset/Render
  changes are authorized only if that test fails at this owner.
- Local performance: one production single-Actor 7,112-element run reports the
  named milestones, longest work unit, and yield count once and receives
  synchronized live visual inspection.

## Step-Local Gates

- Contract: exact owners, graph routes, artifacts, allowlists, failure owners,
  plan anchors, and BDD scenarios.
- Contents: real 100+ row virtualizer unit/integration case, tail scrolling,
  bounded DOM rows, collapse, and selection.
- Factory: one immutable artifact, one history action, full Undo/Redo, no
  transaction-end resending of progressive slices, precise compensation, and
  observer isolation.
- Props/Scene Tree: later-invalid no-prefix behavior, exact IDs/order/
  relationships/instances, lifecycle-aware create/remove/restore selection,
  retained Scene-then-Props replay, and batch-of-one parity.
- App/Core: one atomic all-children plural request or deterministic progressive
  plural requests, point-and-element-count boundaries, cancellation, partial
  results, and fatal rollback.
- Projection: one atomic flush, one flush per progressive slice, exact 7,076
  ordinary Vector projection, and bounded UI updates.
- Codec/relay: binary round-trip, invalid/truncated/duplicate rejection,
  oversized single record or active publication assembly, one immutable
  decoded lease, bounded multi-frame ingress and peer-egress windows, opaque
  byte parity, slow peer, disconnect, and ordered receipts.
- Remote: one publication transaction and one batch observer call, with no
  Undo, echo, capture, save, or IndexedDB write.
- Demo startup: ordinary local and collaboration sessions load one empty
  canonical document and never configure client persistence.

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
- Actor B has no Undo or echo side effects; Actor A and Actor B both have zero
  client persistence side effects.
- Existing performance budgets pass without lowering detail or weakening
  canonical, history, or progressive semantics.
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
- an optimization changes IDs, ordering, detail, Undo/Redo,
  progressive visibility, partial result, rollback, or failure behavior;
- a required file falls outside the active step allowlist;
- existing platform capability would require an unapproved dependency or tool
  upgrade;
- the same focused gate fails three times.

If the final heavy gate fails, report only the first over-budget or incorrect
owner with evidence. Do not resume a local patch-and-tune loop.
