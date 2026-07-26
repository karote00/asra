# Asyra Design Conversational AI Drawing Performance Plan

## Status

Active profiling-first successor to the completed Conversational AI Mock
Drawing plan. The product owner authorized implementation after PR #101 merged
on 2026-07-26. This plan does not reopen, replace, or weaken the completed
drawing contract.

The credential-gated live-provider formal-test plan is the second queued
successor unless the product owner explicitly reorders the queue. It does not
change this plan's deterministic performance authority or permit an API key in
ordinary performance runs.

Architecture authority:

- `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-flow-inspector.data.cjs`
- `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-flow-inspector.html`
- `docs/ai/apps/asyra-design/plans/__tests__/ai-conversational-drawing-performance-flow-inspector.contract.test.cjs`

Executable product cases:

- `docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature`

Queued credential-gated successor:

- `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-live-provider-test-plan.md`
- `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-live-provider-test-flow-inspector.data.cjs`

## Goal

Make high-detail conversational drawing and progressive collaboration feel
interactive without reducing drawing detail, changing canonical identity,
adding a special renderer, or splitting one user turn into multiple history
actions.

The first optimized reference flow remains:

1. Actor A opens Asyra Design with exact
   `ai=mock&aiDelivery=progressive`.
2. Actor A drops the committed 1,672-by-941 tabby reference image.
3. Actor A requests only the cat on a same-size pure-white background.
4. Actor B observes ordered drawing progress before Actor A settles.
5. Both actors converge on the same 7,076 canonical elements.
6. Actor A changes existing whiskers to blue.
7. Actor A changes existing pupils to red.

The optimized output must be semantically and visually equivalent to the
current production route.

## Measured Baseline

The 2026-07-26 reference run used the same local Apple Silicon host, production
App build, headless Chromium, fresh collaboration document, dedicated local App
and WebSocket servers, and the committed cat-only VTracer fixture.

- Balanced cat-only composition:
  - 7,075 ordinary editable Vector elements;
  - one canonical Group;
  - 7,076 total non-workspace canonical elements;
  - more than 100,000 canonical topology points;
  - one 1,672-by-941 pure-white editable background Vector.
- Atomic Actor A creation settled in 29 seconds.
- Progressive Actor A creation settled in 105 seconds.
- Progressive blue-whisker follow-up settled in 20 seconds.
- Progressive red-pupil follow-up settled in 4.3 seconds.
- The full progressive two-actor recording command took 13.2 minutes.
- The retained recording is 774.96 seconds long.
- Maximum detail materialized 27,471 ordinary editable Vectors and 295,794
  canonical points in 153 seconds.

The 13.2-minute command duration is not itself a CRDT-runtime measurement. It
also includes server startup, two browser contexts, continuous side-by-side
recording, repeated cross-page canonical snapshot assertions, screenshots,
three Agent turns, and test teardown. Gate 0 must separate product spans from
test-instrumentation overhead before choosing an optimization.

## Performance Measurement Contract

### Reference environment

Formal budgets use:

- the committed tabby reference input and deterministic provider fixtures;
- a production App build, not a Vite development server timing;
- fresh canonical and collaboration state;
- dedicated App and WebSocket ports;
- one Actor A browser for local budgets;
- two independent browser contexts for collaboration budgets;
- the exact atomic or progressive URL flag named by the case;
- three warm measured runs after one unmeasured warm-up;
- monotonic product timing marks emitted by the owning steps;
- median and worst measured values reported separately.

Server build/start time, browser launch, screenshot encoding, video encoding,
and full-snapshot assertion serialization are recorded as harness overhead and
do not enter product budgets.

### Gate partitioning and diagnostic attribution

- Production profiling activates only for one exact `ai=mock`,
  `aiPerformance=profile`, and optional exact `aiDelivery=atomic|progressive`
  query. `aiPerformanceContents=present|omitted` controls the attribution-only
  Contents mount; the omitted variant is never release-budget evidence.
- `ASYRA_DESIGN_RUN_AI_DRAWING_PERFORMANCE=1` enables the committed profiling
  E2E. Owner-baseline, fixed-state Contents attribution, and high-detail A/B
  remain independent explicit opt-ins so they cannot enter the ordinary E2E
  suite accidentally.
- The default fast Mock AI CRDT correctness fixture has 16 items and runs
  through the ordinary Feature, App transaction, Factory publication,
  Collaboration remote-apply, Render, and history routes.
- The 7,112-element balanced correctness gate is change-aware or explicitly
  requested; it is not part of the default fast CRDT command.
- High-detail performance and CRDT suites remain independent and explicitly
  opt-in so one expensive gate cannot hide or delay the other.
- The 7,076-element two-window full recording remains manual opt-in. Its video,
  screenshots, traces, and profiles are transient ignored artifacts and are
  never committed.
- One matched profiling-only A/B compares the ordinary App with the Contents
  panel present and diagnostically omitted. This comparison may attribute cost
  to Contents/UI projection, but neither diagnostic variant is release budget
  evidence and both must preserve identical canonical and history results.

### Required spans

The profiling harness must distinguish:

- accepted Agent turn to validated action descriptor;
- App descriptor-to-batch preparation;
- Scene Tree canonical batch apply;
- Factory transaction recording and history commit;
- Factory shared-publication construction;
- collaboration encode, send, receive, decode, and remote canonical apply;
- local Core persistence snapshot capture, save-hook isolation, provider save,
  and persistence acknowledgement;
- local and remote Render projection flush;
- Actor A visible-first-change and settled timestamps;
- Actor B visible-first-change and canonical-convergence timestamps;
- E2E assertion, screenshot, recording, server, and browser overhead.

Span collection is detached diagnostics. It cannot change batching, delivery,
history, canonical state, render scheduling, retry, or terminal results.

### First production owner baseline

The production atomic 7,112-element reference baseline used one unmeasured
warm-up followed by three fresh-document measured runs. Accepted-turn product
time was 14.582–14.722 seconds. The complete App transaction took
13.516–13.656 seconds, while its action-execute callback took only
4.501–4.606 seconds. This first split routed the 8.961–9.050 second
transaction-settlement remainder through
`record-history-and-shared-publication` (`@asyra/factory`) for finer owner
attribution.

Factory sub-profiling then showed `flush-shared-channels` at
6.912–7.025 seconds, of which the registered local projection observer consumed
5.718–5.826 seconds. Factory publication construction consumed about
1.01 seconds. Because the dominant synchronous observer owns Preset and Render
projection rather than Factory history or publication semantics, the first
optimization owner is `project-visible-canonical-batches`, not Factory.

Within action execution, ordinary canonical batch calls took
4.485–4.592 seconds and Render add-or-update projection took
2.986–3.020 seconds. The fixed persisted 7,112-element Contents attribution
showed no meaningful mount-only improvement: three present reloads averaged
7.026 seconds and three diagnostically omitted reloads averaged 7.074 seconds
with the same persisted canonical digest.

The first Render repair recognizes a child ADD envelope whose seeded child and
parent mirrors already match the exact canonical after-state. It avoids
treating transaction-end delivery as a mismatch while retaining the ordinary
incremental path for a parent mirror that has not applied the child. After one
warm-up, three production runs settled in 9.454–9.795 seconds (9.744-second
median), below the 12-second balanced atomic median budget and 20-second
worst-run budget. All 7,112 ordinary projections remained, while 7,111 parent
mismatch/invalidate/resync cycles fell to zero.

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
  - blue-whisker and red-pupil follow-ups each converge on Actor B within
    5 seconds of Actor A settlement.
- Full three-turn two-actor product flow:
  - product spans total at most 90 seconds median and 120 seconds worst;
  - whole dedicated E2E command, including harness overhead, at most 180
    seconds.
- Maximum detail:
  - median accepted-turn-to-Actor-A-settled time at most 60 seconds;
  - no measured run over 90 seconds.

These are release gates, not new item, point, payload, or composition ceilings.
A finite valid drawing remains accepted even when it misses a performance
budget; the failing performance gate reports the first over-budget owner span.

## Non-Negotiable Equivalence

Every optimized case must preserve:

- the exact accepted item order and total element, subpath, and point counts;
- every canonical element, point, segment, network, and subpath id;
- canonical bounds, transforms, hierarchy, roles, fills, strokes, and
  visibility;
- one Group created before its ordered children;
- the original 1,672-by-941 pure-white background in the cat-only case;
- the same ordinary Render and Preset Vector route;
- the same persistence and collaboration canonical evidence;
- no client persistence capture or provider save for a remote-origin
  Collaboration commit;
- an internal Factory commit-capture handoff runs before reentrant completion,
  publication, or public status observers so each eligible local snapshot
  represents its own committed state;
- exact atomic or progressive delivery selection;
- progressive peer visibility before the Agent turn settles;
- one outer App transaction and one intended Undo action per mutating user
  turn;
- one local history action for Undo and one for Redo, regardless of network
  batch count;
- partial-result and fatal-rollback behavior;
- cancellation and teardown safety.

No performance implementation may:

- reduce VTracer detail or replace editable elements with a bitmap;
- regenerate the complete portrait for a follow-up;
- add an AI-only renderer, scene mirror, transport protocol, or server-side
  splitter;
- publish one history entry per network batch;
- hide latency with fabricated progress or early success;
- skip canonical validation, persistence, Render, or collaboration owners;
- add a cache before profiling identifies its owning step and an exact
  equivalence oracle.

## Profiling-First Owner Decisions

The first implementation segment adds only bounded timing and count evidence.
After three reference runs, the largest product-owned span determines the next
single Inspector owner step.

Candidate repairs remain hypotheses until that evidence exists:

- App: avoid repeated descriptor traversal or transient topology copies while
  forming ordered batches.
- Scene Tree: reduce per-element hierarchy/property work while retaining the
  same canonical ADD_ELEMENT evidence.
- Factory: reduce repeated delivery construction, serialization, or replay
  bookkeeping inside one transaction.
- Collaboration: reduce encode/decode/apply amplification per progressive
  publication without adding a message ceiling or server semantic owner.
- Core/Persistence: reduce snapshot capture or provider-write amplification
  while preserving one exact deeply detached FIFO snapshot and status for every
  eligible local action, undo, and redo commit.
- Render: coalesce invalidation and projection once per accepted canonical
  batch while preserving the ordinary Vector strategy and visible progressive
  steps.
- E2E: replace repeated full-scene cross-page polling with bounded canonical
  counters plus one final exact snapshot, while keeping product timing
  separate from harness timing.

If profiling justifies a retained cache, implementation must stop and update
the matching Inspector step first with:

- the exact owner;
- cache key dimensions;
- invalidation events;
- miss path;
- memory bound;
- exact hit/miss equivalence test.

Until then every Inspector `cacheDimensions` tuple remains empty.

The App-selected IndexedDB provider remains browser-local demo durability. A
remote-origin Collaboration commit updates live canonical and Render state but
does not capture or save another client-side persistence snapshot. A future
production collaboration deployment does not use client IndexedDB as shared
durability: its socket server owns backend database checkpoint and save
scheduling outside this plan.

## Product Cases

### Balanced atomic local creation

The committed cat-only fixture creates 7,076 total canonical elements through
one transaction and one history action. Actor A meets the atomic budget without
progressive publications.

### Balanced progressive collaboration

Actor B sees at least two increasing non-final canonical element counts before
Actor A settles. Both actors then converge on the exact ids, topology, style,
hierarchy, and background. Network batches never become local history steps.

### Fast Mock AI CRDT correctness

The default collaboration correctness case creates one deterministic 16-item
Mock AI composition. Two independent actors converge through ordinary
publication and remote apply, Actor A gains one Undo action, and Actor B gains
none. This fast case does not replace the balanced high-detail gate.

### Contents panel attribution

One profiling-only matched run compares the same accepted composition with the
ordinary Contents panel present and diagnostically omitted. The result may
select a Contents/UI projection owner only when canonical output, history, and
all non-UI timing inputs remain equivalent. The omitted-panel variant cannot
satisfy a product performance budget.

### Existing-id follow-ups

Blue whiskers and red pupils mutate only revalidated existing ids, preserve all
element and topology counts, converge within their budgets, and each add one
Actor A Undo action.

### Maximum detail

The 27,471-item, 295,794-point fixture remains ordinary editable Vector
topology, produces one intended Undo action, and meets the maximum-detail
budget without an item or point ceiling.

### Cancellation and failure

Cancellation, recoverable partial results, fatal rollback, closed transport,
and app teardown release any profiling state and preserve their current
canonical and history semantics.

## Planned Inspector Segments

Each implementation segment begins with a Step Execution Card and changes only
one owner step.

1. Add detached owner spans and establish three-run baseline evidence.
2. Optimize the first over-budget owner step only.
3. Rerun the exact equivalence and timing gates.
4. Repeat profiling before selecting another owner.
5. Prove local atomic, local progressive, remote progressive, follow-up,
   maximum-detail, cancellation, failure, and replay budgets.
6. Run synchronized live visual review from the same measured App state.

## Definition of Done

- The new target Inspector contract and shared viewer-entry tests pass.
- BDD cases cover every reference budget and equivalence requirement.
- Three-run profiling names the first product-owned bottleneck and separates
  test overhead.
- Every implemented optimization has an exact before/after owner span and
  canonical equivalence oracle.
- All local, collaboration, follow-up, maximum-detail, history, cancellation,
  and failure budgets pass.
- The default 16-item Mock AI CRDT gate passes; the change-aware 7,112-element
  gate and independent high-detail suites pass when their path or explicit
  opt-in requires them.
- App AI, App local/integration, Factory, Scene Tree, Core, Collaboration,
  Render, Preset, E2E, lint, and production builds pass.
- A synchronized side-by-side live review shows complete, uncropped Actor A and
  Actor B states from the measured run.
- Generated screenshots, recordings, traces, profiles, and thumbnail media
  remain ignored local artifacts and are not committed.
- The active Conversational AI plan is not closed until the product owner
  explicitly validates it.

## Stop Conditions

Stop and re-plan before implementation when:

- timing cannot distinguish product work from harness overhead;
- an optimization would change canonical output or history boundaries;
- the first over-budget span belongs to a different Inspector owner;
- a proposed cache lacks exact invalidation and equivalence evidence;
- a performance shortcut requires a renderer, transport, or persistence
  bypass;
- three implementation attempts fail the same focused gate.
