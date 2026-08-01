# Asyra Design Conversational AI Drawing Performance Plan

## Status

Active Level 3 endpoint-ordered app performance closure. PR #101 is merged and
the existing
`codex/asyra-design-ai-conversational-drawing-performance` branch remains the
implementation base. Production implementation and formal validation continue
one Inspector owner step at a time. Every completed performance endpoint is
followed by one guarded 16-item safety proof before another endpoint may
advance. A guarded 7,076-element proof runs only at the named local-source,
relay, and final checkpoints and requires explicit product-owner approval after
the invalid 2026-07-31 attempt.

This plan, its Inspector data, contract test, and BDD are the active app-level
implementation authority. Framework package contracts remain authoritative
inside their existing owner boundaries; this checkpoint does not declare any
unstaged framework plan or framework Inspector complete.

`Plan` in this title and file names only this implementation-governance
document. It is not a product artifact, Runtime phase, provider response, API,
or type. Product and Runtime vocabulary names completed preparation or resolved
evidence directly with `Prepared…`, `Resolved…`, `…Batch`, `…Artifact`, or
`…Sequence`; it never calls executable data a plan. The conversational AI
boundary uses `AiActionBatch`, `batchId`, `requestActionBatch()`, and
`resolveAiActionBatch()`.
Production identifiers name the action batch, drawing artifact, canonical batch,
and wire artifact directly; they never use plan, Mock, fake, or simulated
vocabulary.

The active product contract uses one always-on server-backed Runtime route, one
formal provider, one server-prepared `AiActionBatch` payload, and one fixed
cooperative progressive plural-batch composition. Production contains no Mock,
fake, simulated, local-compat, provider-disabled, optional-Runtime, or alternate
delivery branch. Credential-gated live-provider and API-key formal testing
remains outside this performance plan.

The 2026-08-01 product-owner correction reopens only
`record-and-deliver-transaction-batch`: a bulk action must reuse the existing
App transaction, Factory journal, and Undo stack. It must not create an
AI-specific or bulk-specific forward/inverse history artifact, a parallel
applied-result mirror, or an action-completion snapshot pass. The completed
minimal `SharedPublication` wire shape remains selected; this correction
removes the redundant local-history architecture around it before performance
closure resumes.

Terminology in the active contract is exact: Props/Scene owners hold canonical
geometry data and relationships; the complete topology is the Render-side
projection built from that data. Data preparation is not described as building
Render topology. In API and type names, `canonical` means the App's formally
accepted document data; it does not mean one merged Vector, a transport
encoding, or an additional validation artifact.

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

Status on 2026-07-30: the local loading, progressive drawing, synchronized
visual review, and manual pan/zoom behavior are accepted. The fixed progressive
element cap has been raised from 32 to 64 with formal 16-, 320-, and 1,280-item
boundary coverage. The prior timing runs disabled Collaboration and are
therefore retained only as pure-client diagnostics, not as production
single-Actor acceptance. The next measurements use one required `fileId` URL
whose selected document session always starts Collaboration. Contents is
mounted as the ordinary production projection; earlier measurements that
omitted it remain diagnostic only.

The first manual navigation check then exposed a startup-policy mismatch in the
superseded implementation, whose query-selected source could enter a selectable
all-children route. One 7,000-plus-element synchronous call then prevented the
browser from dispatching any input until completion. The active production
entry always starts the single server-backed Runtime and formal provider
without an `ai` or delivery query, then performs fixed cooperative progressive
plural-batch composition. The former synchronous all-children route is
historical diagnostic evidence only and is not selectable by product startup
or measurement. This is an App startup policy correction, not an Input System,
Feature System, transaction, or event-bus exception.

The completed local execution phase was deliberately limited to one production
single Actor drawing turn. It answered four product questions before the
subsequent cross-window work was authorized:

1. how long one complete 7,112-element balanced composition takes;
2. when the user first sees an exact-bounds loading frame and the first ordinary
   editable Vector;
3. whether real 25%, 50%, 75%, and 100% visible-element milestones advance
   cooperatively while the whole turn remains one Undo action;
4. whether no ordinary progressive batch continues to monopolize the main
   thread while the App is visibly loading.

During that completed UX phase, Contents, Collaboration transport, a second
Actor, convergence, and IndexedDB were excluded. The gate used one fresh empty
canonical document without saving or reloading it. Those results isolate the
client App/Core/Factory/Preset/Render/UI path and remain useful diagnostic
evidence, but they no longer represent the current production startup contract.

The prior local-only stop is superseded by the product owner's 2026-07-30
authorization for endpoint-ordered CRDT refactoring. Each endpoint still closes
independently and cannot borrow a later endpoint's expected improvement. This
endpoint refactor does not optimize Contents or production persistence, but the
production App still mounts the ordinary Contents projection.

All current Asyra Design demo documents are intentionally memory-only on the
client. After Core starts, RenderApp loads one App-owned canonical empty
document session selected by the required `fileId` through the ordinary Core
load API and always starts Collaboration after that load. `fileId` identifies
which document is being opened and will become server authorization input; it
is never a Collaboration switch. One connected Actor is the single-Actor case;
a second Actor joining the same `fileId` session makes it the two-Actor CRDT
case. No Actor creates, initializes, loads, injects, captures, or saves through
a client persistence provider, and performance routes must not read or hash
IndexedDB. Production server checkpoints, authorization, and backend database
durability remain future server-owned work.

## Architecture Replan Evidence

The following evidence closes the earlier incremental profiling loop and fixes
the target architecture before further production edits.

### Prior reference baseline

- The original selectable one-batch creation settled in 29 seconds and the
  selectable cooperative sliced creation settled in 105 seconds. Both values
  describe the superseded product-mode implementation, not current routes.
- The original blue-whisker and red-pupil follow-ups settled in 20 seconds and
  4.3 seconds.
- The original full sliced two-actor recording command took 13.2 minutes;
  its retained recording is 774.96 seconds long. No post-replan full recording
  has been run, so these values are not a current implementation estimate.
- Maximum detail originally materialized 27,471 editable Vectors and 295,794
  points in 153 seconds.
- The already-validated Render projection repair reduced the historical
  one-batch diagnostic three-run range to 9.454-9.795 seconds with a
  9.744-second median while retaining all 7,112 ordinary projections.

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
coupling by sending only the peer queue head. Browser WebSocket ownership is
therefore part of the receiver fix; Node server socket write and Render remain
excluded as first owners of collaboration convergence latency.

### Zero-element browser CPU attribution

A guarded 0-element diagnostic then separated one ordinary local App, one
profiled local App, and profiled collaboration Actors without any drawing or
publication:

- the empty tracked browser phase reached approximately 41.1 percent browser
  CPU;
- one ordinary App under the then-current URL-gated startup path, with no
  Collaboration session and no performance profile, reached approximately 52.4
  percent during navigation and approximately 31.9 percent after settling;
- enabling the performance profile without Collaboration reached approximately
  57 percent during navigation and approximately 30.6 percent after settling;
- one connected Actor A reached approximately 55.4 percent during navigation
  and approximately 29.4 percent after Collaboration was ready;
- adding Actor B while Actor A remained open raised browser CPU to
  approximately 85.4 percent during Actor B navigation, while the WebSocket
  server remained approximately zero and both Actors retained zero elements
  and zero publications.

These bounded `ps` samples are host safety evidence, not a precise wall-time
benchmark, but they prove that WebSocket or CRDT idle work is not required for
the abnormal browser load. Static execution tracing found the first incorrect
owner: the former `PixiRenderEngine.startFrameLoop(...)` started the Pixi
Application ticker, whose own auto-render callback remained installed. The
Asyra dirty gate could skip its manual flush while Pixi still rendered the full
empty canvas every animation frame; a dirty frame could render twice. The
former permanent Render loop also updated layers and the optional performance
profile on every idle frame.

Demand-driven render frame ownership therefore moves before the receiver
endpoint. This safety correction does not claim Render is the dominant
collaboration convergence owner and does not add a Render-engine bulk command.

The post-refactor guarded comparison used the same production artifact and
0-element phase sequence. The client-browser role fell from approximately
31.9 to 6.6 percent for one ordinary local Actor, from 30.6 to 5.4 percent for
one profiled local Actor, from 29.4 to 4.6 percent for one collaboration-ready
Actor A, and from 46.4 to 8.2 percent after both Actors connected. Both Actors
retained zero canonical/rendered elements and zero publications; the WebSocket
server remained approximately zero after readiness. The browser run did not
trigger the 200-percent diagnostic stop, and all four tracked process groups
closed normally. These decayed host samples remain safety/attribution evidence,
not product wall-time budgets, but their like-for-like reduction satisfies the
required low-load checkpoint before the then-planned local-source guarded
high-detail proof.

The first formal high-detail attempt then stopped during cold bootstrap at 178
percent aggregate CPU under the superseded 150-percent limit while Actor A and
Actor B both remained at zero elements and zero publications. No App owner
timing or creation work had started. The stopped harness opened both Actor
contexts and navigated them in parallel before its first authenticated
heartbeat, unlike the accepted staged diagnostic. A later static review proved
that accepting the guard-ready heartbeat before Actor creation was itself
unsafe because normal Chromium renderer creation changed the sampled PID set.
The corrected proof creates both Actor contexts first, brings Actor A through
navigation and Collaboration readiness before Actor B navigation, brings Actor
B through Collaboration readiness, and only then accepts the guard-ready
heartbeat. All staged harness bootstrap remains outside product timing; the
creation boundary still begins at the exact request, so creation timing
excludes all staged harness bootstrap.

A later staged run proved that bootstrap correction, but the still-stale
150-percent proof configuration incorrectly stopped creation at 169.4 percent
with both Actors at one canonical Group, zero rendered children, and zero
publications. That stop is threshold-configuration evidence, not an ineffective
product architecture attempt. Production build commands are now a separate
setup outside the runtime guard and all product timing. The runtime pipeline
attests the already-built endpoint artifact before Playwright starts; it does
not build through the performance guard. The historical 200-percent limit began
with the authenticated App runtime, while product operation timing began only
at Actor A request submission.

That historical proof stopped 1.281 seconds after the exact creation request
when the then-reported aggregate test-owned CPU reached 210.5 percent. The
reported client-browser process group was 206 percent, while the App preview,
WebSocket server, and harness were approximately 1.9, 1.1, and 1.5 percent.
Those values are below the current 250-percent frontend and 400-percent
aggregate limits and therefore do not authorize a current CPU stop. Both Actors
still reported one canonical element, zero Render projection elements, and
zero publications. That one canonical element is the empty document Workspace
created during Scene Tree initialization; Workspace is deliberately absent
from ordinary Render. It is not evidence that the AI Group or first children
batch was created.

The historical guard polled process CPU every 250 milliseconds, while the App
heartbeat could be delayed by a busy renderer and reported only the latest
completed owner phase. The 210.5-percent CPU sample and the retained Actor
counts were therefore not a co-temporal snapshot. The latest completed phase was
`ai-app:prepare-composition-slices`; no later phase had completed when the last
heartbeat was captured. This does not prove which phase was active when the
later CPU sample crossed the historical limit, and therefore does not exclude
Group, Core, publication, remote apply, or Render ownership. The first
unresolved phase span begins after the last completed slice-preparation phase
and ends at the first phase-start/phase-end evidence captured around the guard
stop.

For all subsequent work, the only formal CPU percentage is the raw `%cpu`
reported by the operating system in one `ps` snapshot. The guard polls at a
nominal 250-millisecond cadence, but that cadence is only how often it asks the
system for a new value; it is not a measurement window and never participates
in a CPU-percentage formula. The complete frontend value is the same-snapshot
sum of the raw system values for the App's Chromium root browser, renderer or
worker, GPU, utility, and other browser processes. The formal frontend peak is
the highest such raw `client-browser` snapshot and has a fixed 250-percent
limit. Backend and harness CPU never enter that peak.

The aggregate safety value is the same-snapshot sum of the raw system values
for frontend, App server, WebSocket server, and test harness. One raw aggregate
snapshot above 400 percent stops the exact owned process groups and reports the
contributing roles. The guard must not derive a percentage from cumulative
process CPU time, divide CPU-time deltas by wall time, normalize a sample to the
polling cadence, average multiple snapshots into the formal peak, or use any
such converted percentage for pass/fail. Cumulative CPU milliseconds may be
retained only as non-percentage diagnostic evidence and cannot replace the raw
system snapshot.

Periodic and phase-boundary sampling share one serialized OS-sample and
state-consumption queue. No overlapping `ps` calls or out-of-order state update
may combine values from different snapshots. A fixed 375-millisecond
observation-gap ceiling fails closed because the guard may have missed a raw
system peak; it does not construct a longer interval average.

Production build commands run only as separate setup outside the runtime guard
and product timing. Artifact attestation must succeed before Playwright may
start. Each runtime invocation then owns exactly one production preview and one
WebSocket server. It verifies that the intended ports had no pre-existing
listener, starts no Vite development server, and has no HMR path. Bootstrap
before guard-ready is safety-only: legal process registration or identity churn
resets the candidate baseline and is never attributed to a product owner. After
the App, Collaboration, and Agent UI settle, the harness resolves the prompt
field and submit control, performs prompt fill and actionability outside the
product boundary, and then takes one complete raw system snapshot that freezes
the exact request PID set. App-owned request acceptance or dispatch starts
`local-request`. No Playwright locator, visibility, count, text, or attribute
polling executes inside that measured window. One App-owned O(1) scalar
completion signal closes product timing; UI assertions execute afterward.
Every request or phase boundary requires exact PID-set equality. A new, lost,
or identity-changed process after readiness makes attribution invalid instead
of having its lifetime silently counted or ignored.

### Pre-canonical owner attribution

The 7,076-element proof remains paused until the measurement owner first
removes cross-phase contamination and then separates the first chronological
product owner without another high-detail run. The attribution sequence is
deliberately smaller than an endpoint acceptance proof:

1. Run one guarded production two-Actor 16-item activity diagnostic. Both
   Actors use the same required `fileId`, one production preview, and one
   WebSocket server with no HMR or pre-existing listener. The harness seeds the
   exact server response only into the harness-owned response inbox adapter,
   and its file-scoped preload completes before readiness. Operation begins at
   Actor A request submission and ends only when Actor B canonical and ordinary
   Render projection counts are exactly 17. Both Actors then remain idle for
   exactly 10 seconds with no further product action. Build commands and all
   pre-ready response-inbox, App, Collaboration, and Agent bootstrap are excluded
   from product operation timing.
2. Capture each Actor page-target through CDP Performance with
   `timeDomain: threadTicks`. Cumulative `TaskDuration`, `ScriptDuration`,
   `LayoutDuration`, and `RecalcStyleDuration` deltas report page main-thread
   task occupancy for operation and idle separately. They are not complete
   Actor CPU: worker, GPU, network, App server, WebSocket server, and harness
   work remain in separate OS guard evidence. The case uses the distinct
   `collaboration-attribution` proof kind and cannot create an accepted endpoint
   baseline.
3. Run each single-Actor attribution case in its own invocation with a fresh
   browser process group, one production App preview, and one WebSocket server,
   with no HMR or pre-existing listener. Navigate the
   required `fileId` URL, wait for that selected document session's
   Collaboration readiness, require harness/browser/App/WebSocket-server
   process roles, and do not create Actor B.
4. Run one guarded production single-Actor 16-item cat-prefix case from an
   exact fileId-selected response already resident before App readiness. Its sixteen
   Vector records contain 12,919 points and its progressive sizes are
   `[2, 2, 10, 2]`, so Group plus early high-detail canonical and Render work is
   material; it is not treated as a negligible placeholder.
5. If the raw system-reported frontend snapshot crosses 250 percent, or the raw
   same-snapshot frontend/backend/harness total crosses 400 percent, terminate
   first and perform the required bounded replan. That replan may authorize the
   same 16-item case once with reduced motion. A material reduction with an equivalent
   `AiActionBatch` and
   canonical evidence assigns the first owner to loading/compositor work; no
   material reduction returns attribution to the remaining measured browser
   owners rather than guessing provider ownership.
6. If the 16-item case stays at or below the 250-percent frontend limit and the
   400-percent aggregate safety limit, run one guarded production single-Actor
   1,280-item cat-prefix case. It preserves the same source and ordinary Vector
   route while increasing Runtime batch resolution, preview, and canonical
   work.
7. Only if the single-Actor 1,280-item result cannot distinguish Actor A and
   client-to-server work from peer relay or Actor B remote apply may one
   two-Actor 1,280-item case run.

These attribution cases report response inbox adapter seed, read, structured
clone, and handoff as separate external-backend/transport-adapter timing. That
timing remains recorded but is excluded from frontend product execution and
cannot affect Runtime, Render, or CRDT effectiveness. The cases then report an
ordered browser-monotonic product timeline for provider request/batch handoff,
Runtime batch resolution, `AiActionBatchPreview` projection, loading
evidence, Group, and plural children-batch work. One request-wide cumulative
process CPU-time boundary may report direct CPU-time milliseconds for the
harness, browser, App, and optional server without converting those deltas into
a CPU percentage or retrospectively splitting OS CPU among nested JavaScript
spans. Every boundary snapshot passes the same raw system-reported
250-percent frontend and 400-percent aggregate safety evaluators as the
periodic sampler.
Every periodic and boundary safety snapshot compares the same PID and role
identities. Any observed process identity change makes attribution invalid
rather than undercounted. Raw OS snapshots remain corroborating evidence and
are never the sole owner-attribution signal. Each safety sample retains its own
heartbeat age and never turns a stale latest-completed phase into an
active-owner claim.

Local attribution uses an explicit `local-attribution` proof kind. It requires
only Actor A exact completion and carries no Actor B report; it must never
manufacture a zero-item completed peer or be accepted as an endpoint baseline.
The two-Actor 16-item activity diagnostic uses
`collaboration-attribution`; it requires exact completion from both Actors but
remains attribution evidence, not an accepted endpoint proof.
The pipeline fixes one required proof kind for the entire guarded invocation;
an endpoint, local-attribution, or collaboration-attribution run cannot switch
category in a later heartbeat.
The cases retain the 250-percent frontend and 400-percent aggregate stops and
terminate the exact test-owned process groups. They never count as a 7,076
architecture attempt and cannot establish product equivalence. The resulting
attribution artifact routes to exactly one
owner contract—server response bootstrap/request-boundary contamination,
Runtime batch resolution,
App loading paint, local canonical composition, or receiver/collaboration
admission. Only that selected owner receives one complete architecture replan,
focused formal tests, and one implementation. Only then, and only with explicit
product-owner approval after the invalid 2026-07-31 attempt, may a replacement
guarded 7,076 proof run.

### 2026-07-30 local attribution result and selected owner

The prior transport-disabled 16-item progressive diagnostic completed 17/17
canonical and ordinary Render elements in 2.074 seconds with one Undo action. Its
request-wide process boundary reported 1.670 CPU-seconds over 2.127 wall
seconds, or 78.5-percent average core use. In the superseded implementation,
provider materialization took 143.7 milliseconds and its artificial
651.3-millisecond delay was waiting rather than CPU work.

The prior transport-disabled 1,280-item progressive diagnostic then crossed the
fixed safety limit and was terminated exactly as required. The trigger sample reported
225.5 percent for the complete owned process tree: 215.4 percent
client-browser, 9.7 percent App preview, 0.4 percent harness, and zero
WebSocket-server work because no collaboration server was started. At the last
bounded heartbeat Actor A had 327/1,281 canonical and ordinary Render elements,
first visible was 3.087 seconds, Actor B was absent, and the complete action had
not committed. All tracked process groups exited after termination.

These results were produced with Node v24.13.0 even though the root package
contract still declares Node 20.x, so a Node 20-to-24 upgrade cannot own this
browser-side failure. They also prove a useful pure-client scaling signal: the
16- and 1,280-item fixtures both parse the same complete deterministic source
before selecting their prefix, while the larger case adds repeated
full-geometry Runtime normalization, action-schema preparation, post-schema
detachment, and preview redaction before first visible.

However, disabling Collaboration is no longer a valid production single-Actor
contract. These diagnostics therefore identified only the former front-end
preparation phase as a provisional candidate; they did not authorize its
production edit. The corrected always-on Collaboration startup has now been
implemented, while the guard measurement contract remains the first owner. The
current outer App transaction and progressive canonical batches remain
unchanged, preserving one Undo action.

### 2026-07-30 always-on 16-item guard correction

The first always-on 16-item cat-prefix run used one required `fileId`, one
production preview, one WebSocket server, no Actor B, no HMR, and 12,919 points.
It completed 17/17 canonical and ordinary Render elements in 2.076 seconds,
became first-visible in 1.068 seconds, produced one Undo action, and sent all
four local publications. Its request-wide cumulative CPU-time boundary measured
2.110 CPU-seconds over 2.135 wall seconds, or 98.829 percent average core use:
87.119 percent browser, 3.747 percent App preview, 7.494 percent harness, and
0.468 percent WebSocket server.

Those CPU-time-derived percentages are historical diagnostic values only. They
cannot be used as the formal frontend peak, pass/fail evidence, or a resource
stop under the corrected raw-snapshot contract.

A second equivalent run was stopped when the old decayed signal reported
207.7 percent aggregate and 205.5 percent for the browser. Its last one-second
heartbeat retained 5/17 elements and first-visible at 1.078 seconds. This
decayed raw system value was evaluated against the then-active 200-percent
aggregate threshold, so the guard terminated and verified the exact browser,
App, WebSocket, and harness process groups before returning. It is historical
safety evidence only: it is below the current 250-percent frontend and
400-percent aggregate limits, cannot select a product owner, and does not
consume an architecture attempt.

The mismatch between the completed request-wide average and the later raw
system sample selects the guard measurement contract, not a speculative product
patch. After the raw-snapshot guard and exact PID-set equality tests pass, one
fresh always-on 16-item run is the next permitted browser proof. No 1,280-item
or 7,000-plus run is permitted until that corrected small proof stays within
the active frontend and aggregate limits and reports a usable first-owner
timeline.

### 2026-07-30 measured-window contamination and renderer split

The next fresh single-Actor 16-item run produced a historical
251.287-millisecond converted interval report at 234.791 percent aggregate CPU.
The converted browser contribution was 218.873 percent for the coarse
`renderer-or-worker` bucket, 11.939 percent for GPU, and 3.980 percent for the
root browser; App preview, WebSocket server, and the Node harness reported zero
in that converted interval. The guard terminated every owned process group, but
these converted percentages are invalid formal CPU peak and stop evidence under
the corrected raw-snapshot contract.

It is invalid for product-owner selection. `local-request` began before the
harness called the superseded `submitMockTurn(...)` helper, which still performed prompt
fill, locator resolution, actionability, click dispatch, loading visibility,
article-count, text, and attribute polling. Playwright causes several of those
operations inside the Browser process, so a zero Node-harness contribution
does not remove harness-induced Browser process work. The last heartbeat also
preceded the CPU sample and retained 0/17 elements; it is not co-temporal
evidence that canonical work had not begun.

The next permitted run uses the 250-percent raw frontend and 400-percent raw
aggregate guards and corrects the measurement contract before changing
production. Prompt fill, locator resolution, and actionability complete outside
the product boundary. App-owned request acceptance or dispatch starts
`local-request`; no Playwright polling occurs until an O(1) App completion
signal ends product timing, after which UI correctness assertions resume.

Browser attribution also stops collapsing every Chrome renderer into one
semantic owner. The guard retains each renderer PID's raw same-snapshot system
`%cpu` value. Actor A page-target CDP reports `TaskDuration`, `ScriptDuration`,
`LayoutDuration`, and `RecalcStyleDuration`; CDP-visible worker targets are
reported independently. CPU that remains inside a renderer process but is not
explained by page-target or visible-worker evidence is reported as residual
renderer cost, not guessed to be main-thread, Worker, raster, or compositor
ownership. GPU remains a separate process class and every subprocess remains
inside both the 250-percent frontend total and the 400-percent overall safety
aggregate.

Static inspection also retains a separate downstream finding for the next
owner boundary: after first visible, each progressive slice currently performs
growing UI hierarchy reconstruction, Render parent-membership validation,
canonical snapshot seeding, and a possible retained-scene frame. This finding
does not expand the active Runtime implementation segment. After the Runtime
focused gates, one fresh guarded 1,280-item run must show the owned
pre-first-visible work improved by at least 15 percent without crossing either
the 250-percent frontend limit or the 400-percent aggregate safety limit. If the
run still stops only after first visible, the
Runtime result is recorded and work advances through a new Step Execution Card
to `project-visible-canonical-slices`; it must not be hidden by changing slice
size, detail, IDs, history, or the CPU limit. No 7,076-element or collaboration
run resumes until the local 1,280-item path stays below the host guard.

### 2026-07-30 superseded alternate test-source implementation root cause

This subsection is retained only as historical diagnostic evidence. The
superseded implementation used a test-only backend name and a scheduling term
for its payload. Neither name nor route is part of the active production
contract below; runtime vocabulary now distinguishes an `AiActionBatch`, a
`PreparedDrawingArtifact`, canonical batches, publication batches, and ordered
sequences.

The next corrected two-Actor 16-item activity run excluded build time and
isolated a sub-second operation spike, but source inspection then proved that
the request was not a bounded 16-item provider response. The test response
dynamically imported the complete 1,484,028-byte cat SVG, scanned all 7,075
source paths, tokenized and transformed the complete 156,373-point retained
graph, and only then kept the first 16 items with 12,919 points. It discarded
7,059 already-materialized items before Runtime received the candidate.

That work is test-fixture preparation, not AI Runtime, canonical batch, Render,
WebSocket, CRDT, or Actor B apply. The affected CPU spike therefore cannot be
used to select any of those product owners. The first incorrect owner is the
test response bootstrap/request boundary. Its former prefix-materialization
step is deleted rather than kept as a compatibility path.

The replacement test architecture uses a harness-owned IndexedDB response
inbox adapter, separate from document persistence:

1. Before App navigation, the test or manual harness writes one exact,
   versioned provider response under the required `fileId`.
2. App bootstrap reads only that record and completes before App/Agent
   readiness and the stable performance baseline.
3. The canonical document still loads empty; the response is local,
   noncanonical, nonshared, and never enters `Core.load(...)`.
4. After Actor A submits the ordinary conversation request, the formal provider
   calls `requestActionBatch()` and returns the resident server-prepared
   `AiActionBatch`; no artificial delay or phrase-selected fallback exists.
5. Runtime `resolveAiActionBatch()`, App/Core batch execution, Render,
   publication, and Actor B remote apply remain inside frontend product timing.

The App performs no request-time IndexedDB read, dynamic import, fetch, SVG or
JSON parse, path tokenization, geometry transform, fixture materialization,
full-source slicing, or provider deep-freeze. Deterministic preparation, seed
data, and fixtures belong only to the test/manual harness and are excluded from
the production bundle.

This fixture database does not restore client document persistence. Local
actions, Undo, Redo, and remote apply still perform zero persistence capture,
provider save, or document IndexedDB read/write. Only the source Actor's
pre-ready response inbox adapter read is permitted, and it is reported as
separate external-backend/transport-adapter timing rather than frontend product
execution. Response inbox seed, read, structured clone, and handoff do
not count against App, Runtime, Render, or CRDT budgets.

### 2026-07-30 pre-navigation payload correction

The first guarded 7,076-element proof after the local projection refactor
stopped before product execution. Actor A and Actor B both remained at zero
elements and no publication was emitted. The stop was
`cpu-sample-gap-exceeded`: one sample arrived after 448 milliseconds instead
of the fixed 375-millisecond ceiling. Aggregate CPU remained below the
200-percent hard ceiling, but the test-harness role reached approximately
145 percent while the browser remained approximately 27 percent.

The failure belonged to server-response preparation, not canonical mutation,
Render, WebSocket, or remote apply. The guarded Playwright worker dynamically
read and parsed the complete high-detail SVG, materialized 7,075 child
descriptors and approximately 397,000 canonical property records, then passed
an approximately 65 MB JavaScript record through `page.evaluate(...)` before
IndexedDB could receive it. This duplicated backend preparation and
cross-process serialization inside the runtime test.

The corrected boundary is:

1. The production build completes and is attested independently.
2. After the production build and before the runtime guard or Playwright
   starts, the harness prepares the exact file-scoped 16-, 320-, 1,280-, and
   7,075-child responses once, writes compressed artifacts plus a hash manifest
   into an ignored preview overlay, and never modifies canonical production
   `dist`.
3. The guard separately attests the response overlay and refuses a stale,
   mismatched, or production-deployable artifact.
4. A same-origin blank seed page receives only bounded file identity and URL
   strings, fetches the exact compressed response, decompresses and parses it
   in the browser, and writes it directly to the response-inbox IndexedDB
   store. Playwright never transports the prepared response object.
5. Browser fetch, decompression, parse, and IndexedDB write stay under the
   runtime host safety guard and are reported separately as external
   backend/transport adapter timing. They remain excluded from frontend
   product execution.
6. Actor A consumes the resident response through the ordinary provider route;
   Actor B receives only Actor A's canonical collaboration publications.

The overlay is generated, ignored evidence only. It is neither production App
source nor a deployment artifact, and no new Worker, codec, package, product
mode, compatibility path, or runtime fixture API is introduced by this
correction.

### 2026-07-30 corrected request boundary and selected Runtime owner

The first corrected single-Actor 16-item run used the resident response, one
production preview, the always-on WebSocket service, no Actor B, no build
inside runtime timing, and no Playwright locator or assertion polling inside
`local-request`. The superseded fixed 650-millisecond artificial delay was
waiting time, not product work. The response inbox preload completed before App readiness and stayed
separate external-backend/transport timing.

After that historical delay, one converted 252.599-millisecond interval report
crossed the then-active limit at 221.695 percent aggregate CPU. Its converted
role values attributed 201.901 percent to one renderer PID, zero to the second
renderer PID, 7.918 percent to GPU, and 3.959 percent each to App preview,
WebSocket server, and harness. The guard terminated and verified every owned
process group. These converted percentages are invalid formal CPU peak and stop
evidence under the current raw-snapshot contract. At the stop Actor A remained
at 0/17 canonical elements, 0/17 Render projection elements, zero Factory
publications, and no completed canonical Group.

The timing and execution order select the first chronological owner without
guessing a PID-to-target mapping. The resident provider returns at 650
milliseconds; Runtime then synchronously calls the registered action schema
before permission, loading paint, Group creation, topology, Core, publication,
or Render can run. `parseInsertComposition(...)` walks all 12,919 points with
property-descriptor checks, constructs a second point-object graph, and freezes
each point and path on the page main thread. The page heartbeat could not run
during this work, while the other renderer/worker PID remained idle. The
resulting main-thread allocation plus renderer-process V8 helper and garbage
collection work explains why one renderer process can exceed two cores even
though the schema JavaScript itself is synchronous.

This evidence originally selected client-side action-schema preparation as the
first chronological owner. The product responsibility decision made on
2026-07-30 changes the remedy: model validation, normalization, summarization,
and compact encoding belong to the backend, while the design tool consumes the
server-prepared result. The historical Inspector owner used ambiguous
scheduling vocabulary; the active contract replaces it with
`resolve-server-prepared-action-batch`, not a client Worker validation step.

The active test/manual harness uses the response inbox adapter to represent the
server boundary without adding another production provider. Its seed path
prepares the exact `PreparedDrawingArtifact` before App navigation; the formal
provider returns the resident `AiActionBatch` through `requestActionBatch()`.
Runtime resolves only the small batch/action control envelope through
`resolveAiActionBatch()` and passes the original arguments identity to
permission and execution. The App then submits each already-prepared
flat canonical element/property slice through the distinct canonical Core
creation route.
No additional browser proof is permitted until this complete boundary and its
focused formal gates are finished.

### 2026-07-31 guarded 16-item source evidence

The corrected resident-response 16-item case contains exactly 12,919 points and
is divided into eight prepared slices. Provider handoff, Runtime resolution,
permission handoff, and the complete Runtime pre-execute interval remained less
than 1 millisecond. Runtime control-envelope work is therefore non-material and
is not the owner of the current renderer CPU spike.

The source audit instead found two unconditional full-work boundaries before
high-detail execution can resume:

- generic Core system-property publication invalidates Canvas even when the
  changed value is nonvisual App state such as AI progress or the interaction
  lock; and
- the workspace identity query calls the Scene Tree save path, serializing the
  complete hierarchy to read one stable ID.

The prepared drawing handoff is also still too descriptor-shaped. The corrected
server artifact contains one flat canonical element batch and one flat
canonical property batch with ordered IDs, relationships, exact bounds, and
slice ranges. The App does not build another graph. It uses the existing
`Core.createElementsInParentFromCanonicalData(...)` route, creates the Group,
crosses a browser paint opportunity after the Group, and only then submits the
prepared child ranges.

The next browser proof is the same guarded 16-item case. It must complete at or
below the fixed 250-percent frontend limit and the 400-percent aggregate safety
limit with exact canonical, Render, transaction, and History evidence before
any guarded 7,076-element proof is permitted.

### 2026-07-31 active resource-budget revision

This user-directed revision supersedes the earlier guard thresholds for every
remaining endpoint proof. References to 150- or 200-percent stops elsewhere in
the dated evidence remain historical observations only and are not active
configuration.

- Actor A and Actor B each have one formal frontend performance peak: the
  maximum same-snapshot sum of raw operating-system `%cpu` values for that
  Actor's independently launched complete Chromium process group. The two
  Actor values are never added for a per-client limit. Guarded 16-, 320-, and
  1,280-item safety or attribution cases retain the fixed 250-percent limit for
  each Actor. The exact guarded 7,076-element high-performance case uses a
  500-percent limit for each Actor. Backend and harness CPU are excluded from
  both peaks.
- The aggregate frontend, App-server, WebSocket-server, and test-harness safety
  value is the same-snapshot sum of both Actor Chromium groups and those
  backend/harness raw operating-system `%cpu` values. Its limit is 500 percent
  for the exact 7,076-element high-performance case and 400 percent for 16-,
  320-, and 1,280-item safety or attribution cases; crossing it stops the exact
  tracked groups and reports their raw contributions.
- Polling may occur every 250 milliseconds, but polling cadence is never a CPU
  measurement window. The guard must not subtract cumulative CPU time, divide
  by elapsed time, normalize to the cadence, or use any converted percentage
  for the formal peak or either stop decision.
- The CRDT product-flow deadline from Actor A request submission through Actor
  B complete canonical and Render convergence is 300 seconds. The guarded
  Playwright ceiling is 360 seconds so bounded bootstrap, final assertions, and
  teardown cannot preempt that product deadline.
- Crossing either raw CPU limit or either time ceiling terminates the current
  benchmark action and its exact tracked processes, but it never terminates
  this implementation task. The current owner immediately enters bounded root
  cause analysis, re-reads its Inspector contract, revises only that owner plan
  and formal oracle, and executes the resulting new iteration before any
  downstream owner may advance.

### 2026-07-31 raw CPU contract correction checkpoint

The attempted 7,076-element proof after the minimal SharedPublication cutover
was terminated by an unauthorized converted interval percentage. That attempt
is invalid evidence: it does not establish an App performance failure, does not
count as an architecture attempt, creates no accepted endpoint baseline, and
must not be used to select a CRDT owner. The converted 397.203-percent frontend
and 401.175-percent aggregate values are rejected. Its same-snapshot raw system
values were 199.4 percent for the complete frontend and 209.2 percent for the
aggregate, so neither user-defined limit was crossed.

No browser or 7,076-element proof may run from this checkpoint until:

1. the product owner reviews this revised plan and Inspector contract;
2. the resource-guard formal test first proves that converted CPU-time interval
   percentages cannot drive peak or stop decisions;
3. the guard implementation uses only same-snapshot raw system `%cpu` values
   for the then-current 250-percent frontend peak/stop and 400-percent
   aggregate stop;
4. focused guard, configuration, and Inspector contract tests pass; and
5. bounded review confirms that no interval-derived percentage remains in a
   formal peak, pass/fail result, or violation report.

After those gates, one corrected guarded 16-item proof must pass. A replacement
7,076-element proof requires explicit product-owner approval because the
invalid attempt already consumed the available high-detail test budget. No
later CRDT owner begins before that decision.

### 2026-07-31 corrected raw CPU checkpoint result

The product owner authorized the complete remaining plan. The corrected
guarded 16-item local-source proof passed with exact 17/17 canonical and Render
counts, one Undo entry, eight Factory publications, a 146.4-percent raw
frontend peak, and 153.0-percent same-snapshot aggregate CPU.

The authorized single guarded 7,076-element local-source proof then crossed the
then-current raw frontend limit at 251.7 percent; the same snapshot aggregate
was 259.0 percent, so the 400-percent aggregate limit did not fire. The guard
stopped and confirmed all four tracked process groups at Actor A 1,522/7,076,
Actor B 0/7,076, 49 Factory publications, and 48 locally sent publications.
The raw snapshot remains valid observation evidence, but the later product
owner threshold revision below supersedes its stop classification and it is
not a completed endpoint proof.

The required fresh single-Actor 1,280-item attribution completed at 1,281/1,281
in 3,098 milliseconds with a 221.7-percent raw frontend peak and 226.4-percent
same-snapshot aggregate CPU. Provider handoff and Runtime resolution remained
below one millisecond. The material local transaction contained 2,403.1
milliseconds of composition-batch work, including 796.3 milliseconds of
Dedicated Worker encode, 484.7 milliseconds of Factory shared-channel append,
and 350.5 milliseconds of Render projection. Actor B was absent, so receiver,
remote apply, and relay cannot own this stop. The bounded replan therefore
selects the already ordered `encode-publication-frames` owner and proceeds with
its existing focused-tests → bounded-review → guarded-16 gate without another
7,076-element run.

### 2026-07-31 high-performance CPU threshold revision

The product owner classifies the exact 7,076-element creation-only endpoint as
a high-performance test and raises only that invocation's complete frontend raw
same-snapshot CPU limit to 400 percent. Guarded 16-item and 1,280-item safety or
attribution cases remain at 250 percent. Every invocation retains the
400-percent raw same-snapshot aggregate frontend, backend, and harness hard
safety limit.

Therefore the earlier 251.7-percent frontend and 259.0-percent aggregate stop
does not exceed either current 7,076-element limit. It remains an incomplete
run, not accepted endpoint evidence. Before remote-apply work advances, the
formal guard test must fail against the old threshold selection, the guard and
this exact contract must be corrected, focused guard/configuration/Inspector
tests and bounded review must pass, and the local-source guarded 7,076-element
proof must run once under the corrected limits. A real 400-percent frontend or
aggregate stop still terminates only that benchmark action and returns the
active owner to bounded root-cause analysis and a revised iteration.

The first corrected invocation exposed two harness/guard races rather than a
product CPU stop. The `loading-at-zero` observer was armed after dispatch and
could miss the valid initial loading state; it must be armed before dispatch.
The subsequent 16-item safety proof reached an accepted terminal complete
heartbeat, but normal Chrome teardown identity churn was still evaluated as
active-proof evidence. A terminal complete heartbeat closes the product proof
window: later teardown samples cannot invalidate the accepted result, although
exact tracked process-group termination remains mandatory. Both corrections
require focused formal tests and a passing guarded 16-item proof before the
corrected 7,076-element run resumes.

The next corrected invocation captured loading and all four locked interaction
attempts correctly, with zero document deliveries, but its E2E probe sampled
`defaultPrevented` from a microtask before the later-registered capture lock
listener completed. The product lock already has formal unit coverage proving
`preventDefault()`. The observer must defer only that evidence read to the next
animation frame; it must not change the lock, product scheduling, or
interaction result. Focused source-contract and lock tests plus another guarded
16-item proof precede the resumed high-performance invocation.

That resumed invocation completed Actor A and proved the blocked interaction
snapshot, but the terminal oracle expected the cumulative rectangle-shortcut
`defaultPrevented` count to remain one. The unlocked, delivered `r` shortcut is
also intentionally prevented by the ordinary InputSystem to suppress browser
default behavior, so the correct cumulative terminal count is two while the
blocked snapshot remains exactly one and delivery remains zero. The formal
source contract must retain both values before another focused 16-item safety
proof and resumed endpoint invocation.

### 2026-07-30 guarded local source pipeline replan

The corrected guarded runs prove that the local creation source pipeline must
be restructured as one architecture segment before another high-detail browser
proof:

- The exact 16 vectors contain 12,919 points and approximately 26,030
  independently addressable canonical property records.
- The exact 7,075 vectors contain 156,373 points and approximately
  397,674 independently addressable canonical property records: point,
  segment, network, root vector, and fill records all retain stable IDs.
- The 7,076-element two-Actor attempt crossed the fixed 200-percent host guard
  during Actor A creation. One fresh single-Actor 16-item attempt, without
  Actor B or reference-image attachment, also crossed the guard. Therefore
  peer navigation and image metadata are not the first owner.
- Static owner tracing identifies avoidable repeated work around those required
  records: frontend point/topology rematerialization, repeated vector
  validation/bounds/normalization, full-batch relationship filtering per
  element, per-record structured clone/save/equality work, per-edge observer
  closures, Computed topology reconstruction, recursive immutable scans, and
  local publication splitting.

The records themselves are not the bug. Shared props, future shared
components, shared elements, relationships, stable canonical IDs, full vector
detail, and one complete Undo action remain non-negotiable. The corrected local
source pipeline is therefore implemented once as:

1. The server returns one `PreparedDrawingArtifact` containing one flat
   canonical element batch, one flat canonical property batch, stable ordered
   IDs, relationships, geometry data, bounds, styles, and formal slice ranges.
   The frontend builds no duplicate point-object or geometry relationship graph
   and performs no model validation, bounds calculation, or normalization.
2. The canonical Props and Scene Tree owners build each
   owner-to-relationship index once before element creation; Core delegates the
   complete batch without rescanning or reconstructing relation evidence.
3. Props performs one owner-indexed relationship traversal, one fixed batch
   materialization boundary, and one manager-owned affected-owner
   notification. It retains every property instance but creates no per-edge
   subscriptions and no per-record clone/save/equality boundary.
4. Scene Tree applies one map/parent boundary. Local `Computed` data projects
   from the same owner artifact and never enters shared data or CRDT.
5. Factory records the ordinary reversible owner changes once in its existing
   transaction journal. The outer action transaction creates one existing Undo
   entry; there is no AI/bulk-specific history artifact or second
   forward/inverse graph. Local projection consumes the applied owner batch,
   while the shared-data boundary derives one separate transport wire artifact
   containing only one remote-apply payload, ordered IDs, and publication
   metadata.
6. Preset/Render/UI consume each formal local batch directly and create at most
   one visible flush per slice.

This is one local source endpoint even though its implementation crosses the
App, Core, Props, Scene Tree, Factory, and projection owners. Focused formal
tests and bounded review still occur at each owner boundary, but the next
guarded 7,076-element proof runs once only after the complete source pipeline,
not after every internal owner. This avoids repeating an already-known unsafe
browser workload before the causal chain is complete.

### Rejected compression candidate

The tested WebSocket compression candidate regressed Actor B to 3,500/7,076
elements and 21/35 publications at the same deadline. Compression is rejected
as a result, and the final relay contract explicitly uses
`perMessageDeflate: false`.

## Endpoint-Ordered Refactor Closure

This 2026-07-30 replan replaces the former pattern of deferring all high-detail
performance proof until every owner was changed. One shared creation-only
benchmark is first made trustworthy and resource-bounded. Every endpoint then
performs one complete endpoint refactor, its focused correctness gates, one
guarded 16-item safety proof, and only then one guarded 7,000-plus production
proof before the next endpoint starts.

The severity order uses the most recent retained owner evidence, while keeping
the first incorrect upstream multiplier and host-safety owner ahead of
downstream cleanup:

1. **Demand-driven render frame ownership** — a settled ordinary local
   zero-element App still used approximately 31.9 percent browser CPU, and
   static tracing proves the Pixi Application ticker renders outside the Asyra
   dirty gate. The engine owns a scheduler independent of Pixi auto-render,
   one invalidation schedules at most one frame, one flush renders at most
   once, and idle performance evidence remains bounded. Pan, zoom, canonical
   changes and local computed changes remain ordinary frame requests.
   System-property changes request Canvas work only when their values are
   render-affecting.
2. **Canonical Props, Scene Tree, and Core source mutation** — local canonical
   batch work was approximately 7.991 seconds, and the current first upstream
   multiplier still represents one plural Scene creation as N scalar Scene
   evidence records. The endpoint becomes one complete Props owner batch and
   one plural Scene owner event per Core request, with whole-request preflight
   and no prefix.
3. **Factory existing action history and transport wire delivery** — Factory
   phases were approximately 3.909 seconds. The existing transaction journal
   and Undo stack retain ordinary owner inverses without a parallel local
   artifact, while one separate transport wire artifact contains only one
   remote-apply payload, ordered IDs, and publication metadata without aliases.
4. **Codec encode and decode ownership** — retained worker decode was
   approximately 1.544 seconds; no retained 7,000-plus encode number exists.
   The minimal wire artifact, Worker validation, and transferable binary
   ownership become the only payload codec boundary.
5. **Receiver provider and worker handoff** — Actor B reached only 940/7,076
   elements and 11/35 publications at 30 seconds while `frame-consumed`
   intervals grew to approximately 2–3.3 seconds. The Worker owns the
   WebSocket data plane, main-thread recursive freeze and duplicate header
   ownership are removed, and receiver handoff timing exists.
6. **Remote apply and main-thread organization** — retained remote apply ranged
   from approximately 2.358 to 5.894 seconds and earlier inbound dispatch was
   approximately 1.979 seconds. The App consumes each worker-valid batch once
   through one linear policy/organization pass, one Core canonical request, and
   one remote Factory transaction without rebuilding a snapshot.
7. **Relay and byte backpressure** — the newer server socket callbacks remained
   below 2 milliseconds, but source queue wait and relay request duration grew
   with receiver credit. The relay is changed only after the receiver and
   source multipliers are removed, then must keep opaque byte parity, bounded
   peer capacity, and independent acceptance, consumption, and apply receipts.
8. **Visible canonical and UI projection** — retained canonical projection
   Render work was approximately 0.425 seconds locally and 0.682 seconds
   remotely, so no speculative Render-engine bulk command is added. The
   demand-driven scheduler correction does not authorize a different Vector
   route or an AI-only projection shortcut.

### Common Creation-Only Benchmark

Before the first endpoint proof, the current high-detail suite is split into a
single committed benchmark with exactly this mission:

- one dedicated Playwright config discovers only this creation case, uses one
  worker with no retry, trace, screenshot, or video, and starts production
  preview plus the memory-only collaboration server through a fixed
  test-owned process-group registry;
- two production browser actors, one fresh empty memory-only document, one
  7,076-element progressive cat creation, and no later property follow-up,
  Undo, Redo, reload, persistence assertion, recording, screenshot, trace, or
  CPU profile;
- O(1) heartbeat evidence from the production performance profile for the
  current phase, Actor A/B canonical and Render projection element counts,
  Factory publication progress, history depth, collaboration outcomes, and
  named owner timings; Render projection counts are never capped at the
  expected fixture size, so stale or duplicate projections remain visible;
- `Render.getProjectedElementCount()` is the single O(1), read-only query for
  the actual ordinary viewport RenderLayer map. It returns only a number and
  does not expose the map, an engine object, or canonical state;
- `Factory.getUndoHistoryDepth()` is the single read-only query for exact local
  Undo depth. The profile never casts or reads `DataTransact` private storage;
- Actor A complete time, Actor B first-visible time, Actor B complete/converged
  time, exact canonical equivalence, one Actor A Undo action, zero Actor B Undo,
  zero echo, and zero client persistence work;
- server queue/drain output normalized into the same bounded endpoint report
  instead of being left only in unstructured server stdout.

At the explicitly named local-source, relay, and final checkpoints, local and
collaboration evidence comes from the same two-Actor 7,076-element
creation-only benchmark; the Actor A side is also the local interaction proof.
Intervening codec, receiver, and remote-apply owners close through their focused
tests and guarded 16-item proof without another high-detail invocation. A
benchmark failure caused by its own obsolete assertion or harness overhead is a
benchmark defect, not evidence against a production endpoint.

### Host Resource Guard

Production build commands are a separate setup step and never run inside the
project-owned runtime guard. Before Playwright starts, the pipeline attests that
the existing production App artifact embeds the required collaboration
endpoint. No 7,000-plus runtime benchmark may start without that attestation and
the project-owned guard. Before the AI request, the test sends an authenticated
`ready` heartbeat and waits until the guard confirms ownership and active CPU
sampling for the fixed `test-harness`, `client-a-browser`,
`client-b-browser`, `app-server`, and `websocket-server` roles for a two-Actor
proof. A single-Actor attribution requires only `client-a-browser`. A missing
or rejected registration or handshake prevents the request from starting.
Each invocation proves that its ports were free, then owns one production
preview and one WebSocket server; Vite development mode, HMR, and pre-existing
listeners are forbidden. Actor A and Actor B run in independently launched
Chromium process groups. The guard samples only these exact test-owned process
groups. Each Actor frontend value includes that Actor Chromium root, renderer,
GPU, utility, and other browser processes; the aggregate safety value includes
both Actor groups plus the server and harness groups. The report retains each
renderer PID's Actor identity and raw system-reported `%cpu` value from the
same snapshot as well as role breakdowns so Actor A, Actor B, local preview
overhead, WebSocket server work, and test-harness overhead are not attributed
to one another.
Page-target CDP reports main-thread task,
script, layout, and style-recalculation deltas; CDP-visible workers are named
separately; the remaining unexplained renderer contribution stays residual
rather than being guessed as a page or Worker owner. The benchmark sends one
bounded heartbeat without walking or hashing the canonical graph.

The immediate first sample records the exact process identities and their raw
system-reported `%cpu` values. The product request cannot start before one
complete required-role snapshot exists. Later polling nominally occurs every
250 milliseconds, solely to ask the operating system for another raw snapshot.
No sample subtracts cumulative CPU time or divides by wall time. Periodic and
phase-boundary requests use the same serialized sample queue; a gap above 375
milliseconds fails closed because the guard may have missed a system-reported
peak.

The fixed limits cannot be relaxed through runner configuration:

- for the exact 7,076-element high-performance proof, any single raw system
  snapshot whose complete Actor A or complete Actor B browser sum is above 500
  percent CPU stops the benchmark immediately and marks that architecture
  attempt invalid;
- for 16-, 320-, and 1,280-item safety or attribution proofs, the corresponding
  complete per-Actor browser limit remains 250 percent CPU;
- for the exact 7,076-element high-performance proof, any single raw system
  snapshot whose aggregate frontend, App-server, WebSocket-server, and
  test-harness sum is above 500 percent CPU stops the benchmark immediately;
- for 16-, 320-, and 1,280-item safety or attribution proofs, the corresponding
  aggregate limit remains 400 percent CPU;
- no heartbeat for 10 seconds while the process tree remains above the ordinary
  80 percent baseline;
  or
- no Actor A/B canonical progress for 20 seconds while the process tree remains
  above the ordinary 80 percent baseline.

Crossing a limit is a failed refactor architecture attempt, not a slow pass or a
benchmark warning. The guard sends termination to the fixed tracked Actor A
browser, Actor B browser, App server, WebSocket server, and Playwright harness
process groups, waits at most three seconds, then force terminates only
surviving tracked test processes. It must report the last completed phase,
Actor A and Actor B element counts, publication progress, both per-Actor
frontend peaks, aggregate and separate role CPU samples, and last owner
timing. If exact process ownership or the heartbeat cannot be established, the
benchmark refuses to start rather than running unguarded.

Every `ps` sample has a 200-millisecond hard timeout, shorter than the fixed
250-millisecond cadence. SIGINT, SIGTERM, SIGHUP, exceptional guard exit, and
benchmark failure all terminate the same exact registered process groups. The
ordinary Playwright suite always excludes the heavy endpoint spec, even if guard
environment variables leak into the process. A terminal complete heartbeat
re-samples and revalidates both exact Actor projections; it cannot reuse a
report produced before a late extra projection. Every phase boundary and
request boundary requires exact PID-set equality with its start sample.
Pre-ready bootstrap remains safety-only and resets its candidate baseline after
legal process registration or PID churn. Once App, Collaboration, and Agent
bootstrap settle, prompt fill, locator resolution, and actionability finish
outside product timing, and one complete raw system snapshot freezes request
identity.
App-owned request acceptance or dispatch then starts `local-request`, which
retains the maximum raw frontend system value observed during the product
window. No Playwright polling runs inside that window; an O(1) App completion
signal closes it before UI assertions resume.

### Endpoint Iteration and Effectiveness

Each endpoint uses this fixed loop:

1. replace the endpoint with one complete owner architecture rather than a
   parameter tweak, cache guess, fixture branch, or downstream patch;
2. pass focused formal tests and bounded review;
3. pass one guarded 16-item safety proof using only raw system CPU percentages;
4. run a guarded 7,000-plus creation proof only at the explicitly named local
   source, relay, and final closure checkpoints, and only after product-owner
   approval when an earlier invalid run consumed the high-detail test budget;
5. accept the endpoint only when exact product equivalence holds and either its
   failing budget becomes green or its owned structural/span/queue metric
   improves by at least 15 percent without making an adjacent critical owner
   more than 15 percent worse;
6. if the result is ineffective, replace that endpoint's plan from the first
   incorrect owner and repeat without advancing.

The first receiver endpoint uses the retained pre-refactor result—Actor B at
940/7,076 elements and 11/35 publications after 30 seconds—as its fixed initial
comparison. It does not run an extra 7,076-element seed benchmark. Its first
effective guarded proof creates `artifact:accepted-endpoint-baseline`; every
later endpoint compares against the immediately preceding accepted artifact.

Removing a proven N-to-one structural multiplier is effective when the exact
count oracle passes and overall product time does not regress by more than 15
percent, even when another downstream endpoint still prevents convergence. An
owner already below five percent of product time may be classified as
non-material and left unchanged after one proof; this avoids over-design.

One design hypothesis receives at most five materially revised architecture
attempts. The same focused failure three times, a host resource stop, a time
ceiling, or lost canonical/history equivalence terminates the current attempt
and forces a bounded self-iteration: capture the first blocker, identify its
root cause inside the current owner, re-read the Inspector, revise the owner
plan and formal oracle, and execute the new plan. None of those stop conditions
ends the overall task, and no downstream owner advances around the failure.
Only an effective endpoint may receive a local commit and establish the next
endpoint's baseline. No ineffective attempt is committed.

## Bounded Contract

Authorized mutation scope:

- `@asyra/factory`, `@asyra/props-manager`, `@asyra/scene-tree`, `@asyra/core`,
  `@asyra/collaboration`, `@asyra/preset`, `@asyra/render`, and
  `@asyra/ai-agent-runtime`;
- Asyra Design AI actions, common APIs, UI projection, Contents,
  Collaboration adapter, codec worker, reference WebSocket server, profiling,
  and formal tests;
- this active plan, Inspector data and contract test, and performance BDD.

The HTML Inspector remains the existing shared viewer. It changes only if the
new lanes cannot be represented by the current generic viewer.

Excluded scope:

- Live network endpoint and API-key formal testing for the server-backed
  provider;
- production backend DB integration or socket-server checkpoint policy;
- VTracer detail generation;
- an AI-only renderer or Render-engine bulk command;
- unrelated framework cleanup.

No third-party package, binary, runtime, Node.js, Yarn, or package-manager
upgrade is authorized. Existing platform and repository dependencies must be
used; any missing capability stops the step for explicit approval.

## Target Architecture

```text
test/manual harness seeds one exact versioned server response in the response inbox adapter by fileId
→ response inbox bootstrap completes outside the production bundle and before App/Agent readiness
→ user conversation request
→ provider.requestActionBatch()
→ server-prepared AiActionBatch with batchId
→ Runtime.resolveAiActionBatch()
→ ResolvedAiActionBatch
→ permission resolution produces PermissionReadyAiActionBatch
→ confirmation and terminal presentation consume AiActionBatchPreview
→ consume one PreparedDrawingArtifact with flat canonical element/property batches
→ runtime-only App DOM loading frame
→ compositor paint opportunity
→ create Group through Core.createElementsInParentFromCanonicalData(...)
→ compositor paint opportunity after Group
→ ordered flat child-batch ranges through the same canonical route
→ Props/relationship/Scene Tree preflight and canonical apply per plural batch
→ existing Factory transaction journal
   ├─ one ordinary Undo stack entry for the complete bulk action
   ├─ existing rollback compensation from recorded owner inverses
   └─ no AI/bulk-specific forward/inverse artifact
→ ordinary canonical owner batch → Preset/Render/UI projection
→ one minimal SharedPublication with remote-apply payload/ordered IDs/metadata
→ Dedicated Worker binary encode and WebSocket send
→ opaque server relay with byte backpressure
→ peer Dedicated Worker WebSocket receive and binary decode
→ App policy and canonical preflight
→ one remote Factory transaction per source publication
→ peer Preset/Render/UI projection
```

### File-scoped Server Response Inbox Contract

- Production contains one formal server-backed provider. The provider calls
  `requestActionBatch()` and knows nothing about fixtures, IndexedDB, test
  phrases, or local compatibility.
- The test/manual harness alone may stand in for the backend by validating and
  normalizing one exact model response, deriving its bounded summary, and
  building one `PreparedDrawingArtifact` with one flat canonical element batch,
  one flat canonical property batch, stable ordered IDs, relationships,
  geometry data, bounds, styles, and formal slice ranges.
  It seeds the versioned `AiActionBatch` into an IndexedDB response inbox
  adapter under the required `fileId`. That deterministic preparation, seed
  code, and fixture data are excluded from the production bundle.
- The response inbox adapter performs at most one bounded lookup for that exact
  `fileId` before App and Agent readiness, Collaboration performance readiness,
  and the stable CPU baseline. It is harness transport evidence, not an App
  provider or a second product execution route.
- The 16-, 320-, 1,280-, and 7,075-child records are exact response variants.
  Looking up one key does not read, construct, or slice a larger response.
- At request time the provider calls only `requestActionBatch()`. Production
  performs no artificial delay, phrase-selected fixture fallback, failure
  simulation, response-inbox access, dynamic fixture import, JSON/SVG parsing,
  path tokenization, coordinate transform, fixture materialization,
  full-source slicing, model validation, normalization, drawing-artifact
  encoding, or provider deep-freeze.
- A harness run without the exact inbox record fails harness setup before
  product timing. It never creates a production fallback.
- The response remains local, noncanonical, and nonshared.
  `Core.load(...)` still receives only the empty document, Actor A and Actor B
  remain at zero canonical elements before the conversation request, and Actor
  B receives the drawing only through ordinary canonical CRDT publications.
- `PreparedDrawingArtifact` preserves every canonical element and property
  record, stable ID, relationship, item, path, point, role, order, bound,
  transform, and style without retaining a parallel full point-object or
  geometry relationship graph in the frontend batch.
- The response inbox adapter is not document persistence. Production App code
  neither contains nor writes its deterministic seed/fixture implementation;
  local actions, Undo, Redo, and remote apply continue to perform zero
  persistence capture, provider save, or document IndexedDB read/write.

### Server-prepared AiActionBatch Contract

The backend owns model preparation; `@asyra/ai-agent-runtime` owns only
control-envelope resolution and action orchestration:

- The provider exposes one request method:
  `requestActionBatch(input, { signal })`. It returns one server-prepared
  `AiActionBatch` identified by `batchId`.
- Runtime passes that value through one fixed
  `resolveAiActionBatch(batch, { signal })` boundary and returns one
  `ResolvedAiActionBatch`. Permission resolution consumes that resolved value
  and produces one `PermissionReadyAiActionBatch`; confirmation and terminal
  presentation consume one bounded `AiActionBatchPreview`.
- Runtime checks only the small control envelope—`batchId`, explanation,
  action ids and names, bounded summaries, empty batch, duplicate ids, and
  unknown actions. It never traverses item, path, point, style, bounds,
  coordinate, or geometry arguments.
- The former alternate action-preparation API, its scheduling-oriented
  identifiers, conversion helpers, and compatibility overloads are deleted.
  Production exposes one action-batch route and no test-source, fake,
  simulated, local-only, or local-compat provider path or naming.
- Each registered action definition exposes one backend-facing `inputSchema`
  for server preparation and one executor. There is no client-side action
  schema, `parse`, `prepare`, validation compatibility, or payload-size mode.
- Each server-prepared action contains its execution arguments and one bounded
  redaction-ready summary. Runtime does not recursively clone or freeze the
  arguments; permission and execution consume the exact same arguments
  identity. `AiActionBatchPreview` consumes only bounded summaries.
- The action-definition contract receives no large-payload, validation,
  delivery, scheduling, loading, or collaboration control. An app that wants a
  stronger trust policy implements it on the server before
  `requestActionBatch()` returns rather than adding another Runtime path.
- The shipped create-app Asyra Design template, framework golden path, and
  executable documentation example use this same single action-definition
  contract inside the ordinary Runtime flow. They contain no test-source or
  compatibility implementation.
- The server validates and normalizes accepted/skipped roles, bounds, styles,
  paths, points, stable IDs, relationships, and geometry data, then builds one
  `PreparedDrawingArtifact` containing flat canonical element/property batches
  before returning the `AiActionBatch`.
- The frontend submits each already-prepared slice range through the existing
  `Core.createElementsInParentFromCanonicalData(...)` route after the
  server-prepared loading bounds are visible. It performs no item, path, point,
  style, bounds, role, model semantic, or geometry-data validation; no
  drawing-artifact encoding; and no second point-object graph construction.
- The shipped create-app template consumes that same
  `PreparedDrawingArtifact` and point-aware current-slice contract. Each mixed
  oval/vector slice enters one
  `Core.createElementsInParentFromCanonicalData(...)` call; the template
  accepts no full-item compatibility input, `itemPointCounts`, or per-element
  fallback.
- The server issues stable descriptor IDs and relationships, while the ordinary
  App common API and plural Core route remain the only canonical commit owners.
  The prepared artifact never writes canonical, Render, history, shared-data,
  or CRDT state directly.

The `ResolvedAiActionBatch` is local, noncanonical, and nonshared. It neither creates nor
combines shared props, shared components, shared elements, Factory
publications, or CRDT data. Those remain owned by their existing canonical and
shared-data boundaries.

### Bulk Mutation Contract

- `Core.createElementsInParent(...)` is the single plural creation surface and
  returns ordered canonical element IDs. A single-element convenience delegates
  to this batch-of-one path; Core exposes no AI loading, progress, slice,
  delivery-controller, or timing parameter.
- Server-prepared flat canonical data uses the existing
  `Core.createElementsInParentFromCanonicalData(...)` plural surface; it is not
  a second AI-specific or compatibility path.
- One registered bulk action containing 100 Vector items creates 100
  independently addressable Vector element data records; when grouping is
  requested, one separate Group record is created first. Bulk execution does
  not merge those items into one giant Vector data record.
- AI composition creates one Group through that canonical-data surface, crosses
  one browser paint opportunity after the Group, and only then submits
  deterministic ordered child ranges through the same route. Each range uses
  one fixed 2,048-point budget and a 32-element work-unit cap so thousands of
  zero-point primitives cannot collapse into one blocking call. One indivisible
  element may exceed only the point budget.
- Cooperative batch calls remain inside one outer App transaction. They are
  separate canonical batch boundaries for cooperative local visibility, not
  separate App actions, transactions, or history actions.
- Publication slicing may further frame already-recorded evidence for transport;
  it does not repeat a completed canonical mutation.
- Every single-item public API becomes a batch-of-one convenience over the same
  canonical implementation.
- One origin-neutral canonical lifecycle selects evidence by data lifecycle,
  never by caller identity. Ordinary descriptors provide source creation or
  removal data; detached canonical data provides exact IDs, relations, and
  ordering; retained property evidence carries its separate Props cleanup or
  restore batch. Scene Tree always produces one `PreparedElementMutation`, and
  Core coordinates any separate Props evidence without applying either owner
  twice.
- Ordinary creation and removal own their complete Scene and Props lifecycle.
  A complete retained container hierarchy is prepared and applied once through
  the same plural Scene mutation owner while its separate retained Props
  evidence remains active. Single-item conveniences are batch-of-one calls to
  that same implementation. No origin-specific API family or local/remote mode
  exists.
- Retained removal and restore preflight the complete Scene, Props,
  relationship, parent-index, ID, and tombstone evidence before apply. A later
  invalid item leaves no Scene, property, relationship, registry, tombstone,
  parent-list, history-readiness, or publication prefix.
- Every independently addressable property record and stable ID remains
  canonical so shared props, shared components, and shared elements retain
  their framework semantics. The canonical Props and Scene Tree owners build
  each owner-to-relationship index once instead of filtering the complete
  relation set for every element; Core delegates the complete batch without
  rescanning or reconstructing relation evidence.
- Props Manager performs one whole-batch schema, ID, and relationship preflight,
  one owner-indexed traversal for child-first order, forward/reverse indexes,
  and owner ranges, then one fixed batch materialization and `registerMany`.
  Materialization consumes the validated action owner data through one direct
  shallow field handoff and performs no geometry-data clone, no per-record
  structured clone, `.save()`, or `isEqual` reconstruction. A later invalid
  item leaves no committed prefix.
- Relationship change propagation uses the manager-owned relationship index and
  one affected-owner batch. It creates no per-edge subscription or one closure
  per child relationship.
- Scene Tree performs one map-registration phase, one parent children
  replacement, and one ordered batch evidence handoff. Required property and
  element instances remain one per canonical ID, but construction creates no N
  Core requests, Props registration phases, relationship graph traversals,
  observer registries, Scene map or parent replacements, Factory handoffs, or
  App transactions. Local `Computed` projection consumes the same owner-issued
  geometry data instead of rebuilding complete Render topology through repeated
  property-instance reads; it remains local Render evidence and never enters
  shared data.

### Factory Existing History and Transport Wire Contract

`@asyra/factory` reuses its existing transaction journal, Undo/Redo stacks,
inverter registry, rollback path, shared data channel, and ordered observer
batch. It does not add a second AI/bulk history model.

The registered bulk action remains one ordinary App action inside one outer
transaction. Props and Scene owners emit their ordinary reversible change
batches, including the before/after or add/remove evidence already required by
their event contracts. Factory records each owner change once in the existing
journal, and the outer commit groups those entries into one existing Undo stack
entry. Undo, Redo, and failed-action rollback reuse that journal. There is no
`FactoryMutationBatchArtifact`, `FactoryMutationBatchAppliedResult`,
AI-specific forward/inverse graph, or bulk-specific compensation record.

Core creation returns only ordered element IDs and never returns a Factory
delivery/evidence handle. Render/UI consumes the ordinary applied canonical
owner batch and its existing projection subscriptions; it does not consume a
History artifact. The action executor trusts the successful canonical owner
result. Production performs no post-action `save`, `isEqual`, finalize-save,
evidence clone, full-document comparison, or recursive immutable-tree scan.
Required mutation-time detachment and inverse registration remain part of the
existing owner and transaction contracts and are not repeated after the action.

At each eligible ordinary shared-delivery boundary, Factory derives one
separate `SharedPublication` exactly once. Its only hierarchy is:

```text
publicationId / artifactId / transactionId / origin / mode
→ ordered slices: sliceId / orderedIds
→ ordered channel batches: batchId / channel
→ remote deliveries: deliveryId / eventName / orderedIds / payload
```

`artifactId` is an opaque publication-correlation identity; it is not a
reference to a local History artifact. Only an actual compensation publication
or delivery carries its corresponding `compensatesPublicationId` or
`compensatesDeliveryId`.

The wire view contains no `inverseEvents`, History evidence, rollback evidence,
reserved future compensation IDs, top-level delivery alias, batch `records` or
`changes` alias, or nested record wrapper.

This public contract is cut over atomically across Factory and every direct
Collaboration, codec, and remote-apply consumer. The implementation never
contains parallel old and new publication shapes, a compatibility converter,
optional legacy aliases, or decode-time reconstruction of removed fields.
Later codec and remote-apply owner steps optimize their own execution over this
one already-selected shape; they do not preserve or reinterpret the old one.

Local observers receive the ordinary canonical owner batch; Collaboration
receives only the transport wire artifact. Transport framing never splits
local projection into one observer change per element. Delivery bookkeeping
records only the existing journal entry's actual shared-delivery outcome; it
does not mirror the canonical payload or build another applied-result object.
An observer mutation attempt cannot pollute another consumer or the journal.

During Undo and Redo, the existing journal returns the recorded owner events to
their canonical owners without reordering Scene and Props evidence. A semantic
no-op remains a failure; Factory must not infer that another owner's side
effect consumed it. Actor B applies the minimal publication through one remote
transaction and creates no local Undo entry, echo, or persistence effect.

### Transaction Boundary

The write timeline is fixed:

1. One Agent turn opens one outer App transaction.
2. Group and every child batch are mutated inside that transaction.
3. Cooperative canonical batches may become locally visible between browser
   paint boundaries, but create no additional App transaction or history
   action. Later publication slicing creates no new canonical writes.
4. A successful mutating turn creates one Undo action; Undo and Redo each
   restore the complete intended action.
5. If an already-published immediate slice rolls back, compensation uses the
   inverse already recorded in the existing transaction journal; no separate
   bulk compensation artifact is created.
6. Collaboration local action, Undo, Redo, and remote apply trigger no client
   document persistence capture, save, document IndexedDB read, or document
   IndexedDB write.

No network frame, publication slice, or observer callback may split the
intended transaction or history boundary.

### System Property and Workspace Query Boundary

- Only a render-affecting system property may schedule Canvas invalidation.
  Nonvisual App state, including AI progress and the document interaction lock,
  updates its own DOM/UI consumers and causes no Canvas invalidation.
- The Core workspace ID query is a constant-time identity read. It never calls
  Scene Tree `save`, serializes the complete Scene Tree, builds a document
  snapshot, or reconstructs canonical data to return one ID.

### Projection and Contents Contract

- Preset consumes the batch observer directly. Each canonical publication batch
  causes one projection; each formal slice from the fixed cooperative
  composition remains peer-visible and never collapses to a final-only frame.
- Render uses the existing ordinary Vector strategy and preserves all 7,076
  editable elements. Each slice causes at most one invalidation and one frame
  flush.
- The concrete Pixi Application ticker never owns framework rendering and
  cannot bypass the Render dirty gate. A scheduled frame performs at most one
  explicit engine flush; after the App settles with no pending invalidation,
  zero elements produce no frame and no engine flush.
- Pan, zoom, canonical changes, local computed changes, and render-affecting
  system property changes schedule the same ordinary frame path. Nonvisual
  system property changes schedule no Canvas frame. A future local animation
  publishes its computed updates, which request subsequent frames; Render does
  not run a permanent idle loop in anticipation of animation.
- When detached performance evidence is explicitly collected, it stores bounded
  timing and counters only for demanded work. It cannot change the product
  route, create an unbounded per-frame workload, or become the reason an
  otherwise idle frame exists.
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
- A Dedicated Worker owns the browser WebSocket data plane after the
  main-thread Provider supplies connection configuration. The main thread
  never receives inbound publication bytes and never sends `frame-consumed`;
  it exchanges only bounded commands, normalized control evidence, one decoded
  publication handoff, and apply settlement with the Worker.
- Outbound shared data makes one object-to-worker structured clone. The Worker
  encodes and writes the binary frames directly to its WebSocket instead of
  returning an `ArrayBuffer` for a main-thread send. JSON control commands from
  the App use the same Worker-owned socket.
- Inbound `ArrayBuffer` values remain inside the Worker and enter a bounded
  2 MiB frame-ingress window. One active oversized publication assembly may
  exceed that window only as required to preserve an indivisible publication,
  so no payload ceiling or multi-publication unbounded queue is introduced.
- The worker validates frame header, FIFO order, duplicate identity, and ingress
  capacity before sending `frame-consumed` directly on the Worker-owned socket.
  Credit therefore means bounded Worker acceptance and remains independent of
  previous main-thread canonical apply, including a CPU-bound apply that delays
  the main event loop.
- The worker-to-main structured clone is the only inbound object isolation
  boundary. After worker validation, the Provider performs no second clone or
  recursive freeze. It gives the read-only publication evidence to exactly one
  required asynchronous Collaboration consumer, so no overlapping consumer can
  mutate or retain a second canonical copy.
- The Provider privately retains only the queue and settlement token needed to
  expose one decoded publication at a time. The consumer Promise resolves after
  App policy, canonical preflight, and remote apply succeed; that settlement
  releases the next decoded publication. Terminal failure clears active and
  pending publications and releases none instead of fabricating progress.
- `@asyra/collaboration` has one provider-to-process contract for this async
  handoff. It does not retain a legacy clone mode, public lease wrapper, or
  alternate scalar publication route.
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
- Receiver wire credit is returned when an ordered publication leaves the
  worker retained-byte window for its single App handoff, before that App apply
  begins. Main-thread canonical completion emits a separate `peer-applied`
  receipt.
- The client and reference server explicitly use `perMessageDeflate: false`.
  Any future compression experiment needs a worker-side profile and a separate
  plan.

### Remote Apply Contract

- Each source publication owns one remote Factory transaction. Different source
  publications are not merged into one transaction.
- The active decoded publication settles only after that transaction applies
  successfully. Settlement releases the next publication; failure performs
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
  document persistence provider and performs no document IndexedDB work.
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

- The production Asyra Design entry always starts the single server-backed
  Runtime and formal provider. No `ai` or delivery query activates, disables,
  swaps, or changes this route, and measurement cannot select another product
  execution path.
- Composition always uses deterministic point and element-count boundaries. A
  32-element work-unit cap independently prevents a large zero-point primitive
  batch, and one fixed 2,048-point budget prevents later slices from growing
  into long main-thread blocks. One indivisible element may exceed only the
  point budget.
- The App calls the existing plural Core creation API once per non-empty batch.
  Core, Props Manager, and Scene Tree retain one fixed batch mission and receive
  no loading, progress, AI mode, slice size, or host-yield parameters.
- Every successful canonical slice reaches the ordinary
  Factory/Preset/Render/UI route, advances progress by the number of actually
  accepted visible elements, then awaits one browser paint opportunity before
  the next slice. The slices execute in one serialized loop; they are never
  independently scheduled and never overlap. A pure microtask and one timeout
  scheduled per range are not valid yields. After every awaited boundary the
  action checks its Feature-owned `AbortSignal`.
- Group and every batch remain in one outer transaction and create one intended
  Undo. Fatal failure or cancellation rolls back the complete composition;
  already-visible immediate evidence uses the same Factory compensation path.
- Full detail, canonical IDs, ordering, topology, relationships, and history
  remain exact. The cooperative route does not use a bitmap, AI-only renderer,
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

- RenderApp receives one required `fileId` URL, starts Core, loads exactly one App-owned
  canonical empty document session selected by that identity through
  `Core.load(...)`, then always starts Collaboration. A missing or empty
  `fileId` cannot open the document. The identity selects the document and is
  future server authorization input; it never toggles Collaboration.
- Root `dev:all` starts only workspace package watchers and the App dev server.
  The explicit `collaboration:server` command or collaboration Playwright
  startup separately owns the reference WebSocket server and makes it ready
  before the App begins its required document connection.
- One connected Actor is classified as single-Actor processing. A second Actor
  joining the same document session is classified as two-Actor CRDT processing;
  both cases use the same framework and App APIs.
- Every demo Actor starts without creating, initializing, loading, or injecting
  a client persistence provider.
- RenderApp startup and `resetData()` obtain independent fresh values from one
  zero-argument App-owned empty-document factory. `resetData()` calls
  `Core.load(...)` exactly once and performs no IndexedDB, localStorage, URL
  parsing, or page reload.
- Reset Data is a local demo-document reset, not a Factory action or CRDT clear
  command. It does not publish a canonical action and makes no claim that
  another Actor is cleared.
- `Core.load(...)` is the sole `FILE_LOAD_COMPLETE` publisher for startup and
  reset. App contexts may observe that completed load for zoom-fit, but never
  synthesize file readiness from Render readiness.
- Local action, Undo, and Redo and Actor B remote apply all produce zero client
  document persistence capture, provider save, document IndexedDB read, and
  document IndexedDB write. This does not prohibit the harness-owned pre-ready
  response inbox lookup outside the production bundle.
- Collaboration connects only after the empty canonical document is loaded.
- Demo reload durability is not a correctness or performance gate.
- A future production socket server coordinating backend DB checkpoints is
  outside this plan. The current reference server remains an in-memory
  transport owner, not a durability owner.

## Performance Measurement Contract

### Current Local Performance Measurement

The accepted local UX behavior is now proven inside the same guarded
two-Actor 7,076-element endpoint run used for CRDT effectiveness. Actor A owns
the local exact-bounds loading, ordinary Vector milestones, pan/zoom,
interaction-lock, one-Undo, and settled evidence; Actor B owns first-visible,
completion, and convergence evidence. The ordinary AI performance spec keeps
only the low-load 16-item profiling sanity check. No second high-detail
single-Actor run, Vite development/HMR run, retry, or unguarded 7,000-plus run
is allowed.

The one guarded run has no Contents projection, document IndexedDB,
persistence, reload, warm-up, repeated measured creation, follow-up turn,
Undo/Redo execution, media, trace, CPU profile, or full-state polling.
WebSocket-server CPU is reported as a separate role rather than attributed to
the browser product owner.

Before Playwright starts, the guard requires two independent attestations:
one for the canonical production build and one for the generated response
overlay manifest and hashes. The preview server may serve the ignored overlay
copy of the production build, but canonical production `dist` must contain no
prepared response fixture and the overlay must never be deployable as
production output.

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

Milestones use O(1) runtime counters. After both actors complete, the harness
may read exactly one bounded canonical summary from each actor; it must not
repeatedly clone, hash, or walk the 7,076-element state. The same guarded run
answers the local UX and CRDT endpoint questions without claiming a statistical
median.

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

The then-current client-only production run completed on 2026-07-29 with a
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
evidence closed the client UX gate and later received manual approval. Because
Collaboration was disabled, its timing remains a pure-client historical
baseline rather than current single-Actor production acceptance.

### Reference Environment

Formal budgets use the committed tabby reference response prepared by the
test/manual harness, the formal production provider, production App build,
fresh canonical and collaboration state,
dedicated App and WebSocket ports, and independent actor browser contexts.

The high-detail route runs once after each completed endpoint and once after the
final architecture owner. It reports the observed result against the retained
pre-refactor and preceding accepted endpoint baselines; it never adds a warm-up
or repeat.

Production evidence uses the dedicated AI drawing performance profile. It
returns detached canonical, history, Factory transaction-status, commit, and
publication snapshots without exposing a mutable runtime owner. The dev-only `window.__Core__`
cannot satisfy a release gate; it is only a local diagnostic.

Response inbox adapter seeding and the fileId-selected response lookup,
navigation, App readiness, collaboration readiness, server AI readiness,
reference attachment, runtime evidence readiness, and history baseline are
named E2E harness spans. They remain separate from product execution, owner,
transport, Render, and UI timing. Collaboration client-document-persistence
bypass is proven with cheap startup/runtime counters; no canonical document
IndexedDB state is opened, polled, normalized, stringified, or hashed.

### Gate Partitioning

- The endpoint benchmark is the only automated high-detail gate: one guarded
  two-Actor 7,076-element cooperative plural-batch creation-only run. Actor A
  also proves the accepted local loading, progress, pan/zoom, interaction-lock,
  and one-Undo behavior. There is no additional single-Actor high-detail run.
- The endpoint run has no follow-up edit, Undo/Redo execution, persistence,
  media, trace, CPU profile, HMR, warm-up, retry, or repeat.
- The exact same endpoint benchmark establishes the accepted output baseline
  after every effective owner and is rerun immediately after the next owner
  refactor.
- The default fast server-response AI CRDT correctness case has 16 items and exercises
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

- test/manual server-response preparation and fileId-selected response inbox
  seed, read, structured clone, and handoff as separately recorded external
  backend/transport timing excluded from frontend product execution;
- request-time provider request and resident `AiActionBatch` handoff;
- accepted turn and product execution;
- App bulk-request preparation;
- canonical Props/Scene Tree batch preflight and apply;
- Factory existing-journal recording, Undo commit, and publication derivation;
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

- Balanced cooperative plural-batch creation:
  - the guarded observed accepted-turn-to-Actor-A-settled time is at most
    30 seconds.
- Collaborative creation:
  - Actor B first visible canonical batch within 2 seconds of Actor A's first
    shared publication;
  - Actor B canonical convergence within 30 seconds of Actor A's canonical
    creation commit;
  - the hard CRDT flow deadline from Actor A request submission through Actor B
    complete canonical and Render convergence is 300 seconds;
  - the guarded Playwright test ceiling is 360 seconds so bounded bootstrap,
    final assertions, and teardown cannot preempt the 300-second product-flow
    deadline.
- Maximum detail:
  - the guarded observed accepted-turn-to-Actor-A-settled time is at most
    90 seconds.

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
- the fixed cooperative plural-batch route and exact peer-visible ordered
  publication slices;
- zero client persistence work for both collaboration actors;
- no reduced detail, bitmap replacement, regenerated full portrait, AI-only
  renderer, final-only peer shortcut, fabricated progress, missing history, or
  fixture-specific production path.

## Product Cases

### One Interactive Composition Action

The App creates one Group through
`Core.createElementsInParentFromCanonicalData(...)`, crosses a browser paint
opportunity after the Group, then submits deterministic ordered flat child-batch
ranges through the same canonical route. The complete composition remains one
App action, one outer transaction, and one intended Undo entry in the existing
Factory history. It creates no AI/bulk-specific history artifact. A later fatal
child failure rolls back the complete action; single-item calls retain the same
batch-of-one canonical implementation.

### Local Drawing Progress

The exact validated composition bounds appear as runtime-only overlay state
before the first canonical mutation. Real ordinary Vector batches replace that
placeholder progressively, and actual accepted element counts drive the visible
progress until terminal cleanup.

### Existing Action History and Minimal Wire Artifact

The existing Factory journal and Undo stack retain the ordinary action's owner
events and supply Undo, Redo, and rollback. No parallel AI/bulk forward/inverse
artifact is constructed, and Render/UI consumes ordinary canonical owner
projection rather than History evidence. One minimal `SharedPublication`
serves Collaboration with only one remote-apply payload, ordered IDs, and
publication metadata.

### Scrollable Contents Window

A 100+ row formal case scrolls the real virtualizer viewport to the final
canonical element while keeping mounted row count bounded. Collapse,
selection, and hierarchy order remain correct.

### Visible Cooperative Projection

Each canonical publication batch projects once. Each ordered formal composition
slice reaches the same ordinary Vector route once and does not create another
canonical write.

### Binary Backpressured Collaboration

Versioned binary publication frames round-trip exactly, the opaque server
retains byte parity, slow peers remain within the exact 2 MiB unretired-byte
capacity, and wire receipt, server acceptance, and peer apply remain distinct.

### Remote Batch Apply

Each source publication applies through one remote Factory transaction and one
batch observer delivery. Actor B converges without Undo, echo, capture, save, or
document IndexedDB update.

### Demo Documents Do Not Persist on Clients

The ordinary local demo, Actor A, and Actor B each load one canonical empty
document, then start without a client persistence provider. Local actions,
Undo, Redo, remote apply, and the performance harness perform no document
IndexedDB read or write. The test/manual harness may seed the separate response
inbox adapter before navigation; that harness adapter remains outside the
production bundle and completes its exact record lookup before App readiness.

### Fast Server-response AI CRDT Correctness

The default two-actor case uses the exact 16-item server response selected by
required `fileId` and resident before readiness. Actor A gains one Undo action
and Actor B gains none while both converge on exact canonical state.

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

Each Inspector owner completes focused formal tests, bounded review, and one
local owner-step commit before the next owner begins. The current committed
foundation is:

- `50c184d03 refactor(collaboration): deliver minimal shared publications`;
- `c13165571 test(factory): satisfy shared publication lint`.

Subsequent accepted commits corrected raw system CPU measurement, moved
publication transport to the Worker, organized remote publications once,
bounded receiver handoff, and retained the revised high-detail guard limits.
Those owner results remain in place. The minimal `SharedPublication` wire
cutover is complete, but the 2026-08-01 product-owner decision rejects the
parallel rich local-history artifact that had been planned around it.

Before any further high-detail or browser execution, remaining work uses this
exact order:

1. **Correct the `record-and-deliver-transaction-batch` contract** — update
   this plan, Inspector, BDD, Factory transaction documentation, and direct API
   documentation only. Specify that one bulk action reuses the existing
   transaction journal and produces one ordinary Undo entry; remove the
   parallel local history artifact and every post-action save/equality/clone
   requirement while retaining the already-selected minimal wire shape. Run no
   browser workload.
2. **Implement the existing-history fast path** — strengthen focused Factory,
   action-transaction, App adapter, Undo/Redo, rollback-compensation,
   publication-order, immutability, and old-alias rejection tests first. Remove
   the AI/bulk-specific forward/inverse artifact and applied-result mirror.
   Derive each minimal `SharedPublication` once from ordinary eligible shared
   deliveries. Render/UI consumes ordinary canonical owner batches. Actor B
   retains zero Undo, echo, and persistence. Do not change codec Worker,
   receiver, remote apply, relay, Contents, or Render semantics in this step.
3. **Close the corrected owner** — pass all focused unit/integration gates,
   perform bounded review, stage exact owner paths, and create one local
   owner-step commit. Do not lower a test or add a compatibility branch to make
   the commit pass.
4. **Revalidate the complete local source endpoint** — run one corrected
   guarded 16-item proof. It must preserve exact canonical, Render, transaction,
   History, and publication evidence while reporting only the maximum raw
   frontend system value. After it passes, stop for explicit product-owner
   approval before any replacement 7,076-element proof. If approved, run that
   proof once and report Actor A completion, publication timing, raw frontend
   peak, and aggregate raw safety status. A raw limit violation or focused
   correctness failure terminates only that benchmark invocation and returns
   this owner to bounded root-cause analysis and a revised iteration.
   The later product-owner threshold revision classifies this exact
   7,076-element proof as high performance, sets both its frontend and aggregate
   limits to 500 percent, and requires one
   corrected local-source rerun before relay closure may advance.
5. **Resume `relay-frames-with-backpressure`** — retain the already-completed
   codec, receiver, and remote-apply owner commits. Relay opaque frames without
   decode/re-encode, enforce per-peer byte queues and watermarks, handle slow
   peers, and keep wire-consumed, peer-applied, and sender-accepted receipts
   distinct. Pass focused tests and one guarded 16-item proof; then stop for
   explicit approval before its one guarded 7,076-element proof.
6. **`evaluate-performance-and-equivalence`** — run 16-item correctness,
   7,112-element balanced correctness, separate 7,076 CRDT and performance
   checks, affected unit/integration tests, lint, production build,
   synchronized A/B live-state visual review, and the 27,471 maximum-detail
   gate. The full recording remains manual opt-in.

The 2026-08-01 local closure completed items 1–3. Factory no longer exposes or
constructs the rich mutation artifact, artifact-status stream, or applied-result
mirror; its Undo stack retains the existing transaction journal entries and
shared-delivery outcomes directly. The focused closure passed 184 Factory
tests, 16 Core hierarchy transaction tests, 30 Collaboration handoff/provider
tests, 69 App collaboration adapter/protocol/operation tests, the Factory
TypeScript build, and all 21 performance Inspector contract tests. Item 4 has
not run; no browser or 7,076-element workload was started during this owner
closure.

Existing committed results and current WIP are preserved and absorbed only
inside their matching owner step. No cross-owner WIP commit is allowed.
Every resource or time stop terminates only the active benchmark invocation.
The task remains active and returns to the same Inspector owner for root-cause
analysis, bounded replan, test-first correction, and a new validated iteration.

### 2026-07-31 local-source convergence failure iteration

The authorized corrected guarded 7,076-element endpoint invocation stayed
within the current raw CPU limits. Actor A completed 7,076 of 7,076 requested
elements in 9,251 milliseconds and Factory produced 136 publications. The raw
frontend peak was 308.7 percent and the aggregate at that same snapshot was
314.2 percent. Actor B applied zero publications and the invocation reached the
180-second product-flow deadline; the guard then terminated and confirmed all
tracked process groups.

The bounded two-Actor 16-item diagnostic reproduced the first failure without
another high-detail run. Actor B rejected publication
`1:publication:1` because it contained only the Props `ADD_PROPERTY` owner
batch. This is not a valid reason to merge different source publications or to
add a remote compatibility path. Scene Tree already prepares the Props and
Scene evidence for one creation request, but the current Core coordination
applies the prepared Props mutation and prepared Scene mutation through two
separate Factory owner handoffs. The first unresolved owner is therefore
`apply-canonical-property-scene-batch`, before
`apply-remote-publication-batches`.

The revised iteration is bounded to:

1. strengthen the Inspector contract and its formal test so one local
   creation request must hand the complete ordered Props-then-Scene evidence
   to Factory in one `updateTransactionBatch(...)` call;
2. add a formal Core/Scene regression that fails while the prepared Props and
   Scene owners hand off separately, including later-invalid no-prefix
   evidence;
3. coordinate the already-prepared Props and Scene artifacts through that one
   owner handoff without adding an App delivery mode, a second mutation path,
   a remote source-publication merge, or a compatibility format;
4. run only the affected Core, Props Manager, Scene Tree, Factory publication,
   App collaboration-processing, Inspector, and lint gates, then bounded
   review and one guarded two-Actor 16-item proof; and
5. return to `apply-remote-publication-batches` only after Actor B accepts the
   complete source creation publications with one remote transaction per
   publication and no Undo, echo, or persistence.

Implementation discovery is fixed to the existing Core creation coordinator,
Props Manager prepared-batch handoff, Scene Tree prepared-element handoff,
Factory batch-publication regression tests, and their direct App collaboration
consumer. App AI composition, codec Worker, receiver admission, relay,
Contents, Pen Tool, and performance tuning remain excluded. No replacement
7,076-element run occurs in this iteration.

Self-review found and rejected two downstream patches: accepting an orphan
Props creation as a complete remote element creation and merging it with the
next Scene publication. Both would violate canonical preflight and the
one-source-publication remote transaction contract. The bounded source-owner
iteration above agrees with the product case, Inspector owner boundary,
step-local source canonical gate, and endpoint DoD.

### 2026-07-31 relay checkpoint aggregate-stop iteration

The relay owner focused suite and corrected guarded 16-item proof passed. The
first relay-checkpoint 7,076-element invocation then stopped on one raw
same-snapshot aggregate value of 400.8 percent. The complete frontend value in
that snapshot was 368.9 percent, below its separate 400-percent high-performance
limit; the remaining tracked values were 24.3 percent test harness, 7.6 percent
WebSocket server, and 0 percent App server. At the last bounded heartbeat Actor
A had 1,522 canonical elements, Actor B had 1,330, Actor A had produced 49
Factory publications, Actor B had processed 46, and no publication had failed.
All tracked process groups terminated successfully.

The server value and passing byte-queue suite do not select relay decode,
re-encode, queue growth, or receipt semantics as the first failure owner. The
bounded harness review instead found that the in-page local-interaction probe
recursively schedules `requestAnimationFrame(inspect)` while reading DOM and
profile state on every frame until each assertion settles. That creates a
second harness-owned per-frame workload inside both the frontend raw value and
the aggregate stop total, contrary to the existing endpoint and Render
instrumentation contracts. It also contaminates the exact Chrome App CPU value
the checkpoint is intended to measure.

The revised iteration is bounded to `evaluate-endpoint-performance`:

1. strengthen the Inspector and the existing static endpoint harness test so
   product-window interaction evidence forbids recursive frame polling;
2. replace the probe loop with event-driven loading observation and fixed
   bounded frame handoffs after explicit pan, zoom, keyboard, and pointer
   actions, preserving every loading, interaction-lock, canonical, publication,
   Undo, and convergence assertion;
3. run the focused endpoint configuration/guard tests, Inspector contract,
   exact lint, and one guarded 16-item proof;
4. perform bounded review of only the harness, Inspector, and direct tests; and
5. run one replacement guarded 7,076-element relay checkpoint under the same
   400-percent frontend and aggregate raw limits.

No relay protocol, source publication, remote apply, canonical owner, Render
product path, slice budget, threshold, polling cadence, Contents, or Pen Tool
change is authorized. A new resource stop returns this same bounded iteration
to root-cause analysis instead of weakening the gate or repeating unchanged
work.

### 2026-07-31 receiver decode/apply overlap iteration

The event-driven interaction-probe revision passed its focused tests and a new
guarded 16-item proof. That proof completed Actor A and Actor B at 17/17 in
1,007 milliseconds with eight source publications, one Actor A Undo entry,
zero Actor B Undo entries, zero publication failures, a 111.7-percent raw
frontend peak, and a 131.3-percent raw same-snapshot aggregate value.

The next guarded 7,076-element relay checkpoint correctly stopped on a
405.8-percent raw same-snapshot aggregate value. Its frontend value was
370.3 percent, below the separate 400-percent high-performance limit; the
remaining values were 26.2 percent test harness, 9.3 percent WebSocket server,
and 0 percent App server. The two dominant frontend processes were separate
renderer-or-worker processes at 180.4 and 174.3 percent. At the last bounded
heartbeat Actor A had 1,522 canonical elements, Actor B had 1,394, Actor A had
produced 49 Factory publications and sent 48, Actor B had processed 47, and no
publication had failed. Every tracked process group terminated successfully.

This falsifies the preceding interaction-probe workload as the first remaining
CPU owner: removing its recursive frame polling did not remove the overlapping
two-renderer peak. Bounded receiver inspection found the next upstream overlap.
While one decoded publication is active in main-thread App apply, the codec
Worker immediately decodes every later complete publication assembly and keeps
those decoded object graphs pending. Actor B therefore overlaps Worker binary
decode with its main-thread remote Factory/Core transaction even though only
one decoded handoff may be active.

Step Execution Card:

- Owner: `admit-receiver-publication-frames`.
- Objective: retain bounded admitted frame assemblies, but decode the oldest
  complete publication only when no decoded publication is active, so one
  Actor never overlaps queued binary decode with the current main-thread remote
  apply.
- Inputs and outputs: preserve relayed binary frames, exact
  `frame-consumed`, one decoded publication handoff, App settlement,
  `peer-applied`, and receiver timing without merging source publications.
- Test-first oracle: with one slow async consumer and several already credited
  complete frames, exactly one codec decode completes before the first App
  settlement; after settlement, every publication decodes and delivers in
  source order. The current implementation must fail this oracle before the
  production change.
- Mutation allowlist:
  `apps/asyra-design/src/collaboration/publication-codec-worker.ts`,
  `apps/asyra-design/src/collaboration/collaboration-transport-worker.ts`,
  `apps/asyra-design/src/init/__tests__/collaboration-protocol.test.ts`,
  `apps/asyra-design/src/init/__tests__/collaboration-websocket-provider.test.ts`,
  `docs/ai/apps/asyra-design/modules/collaboration-reference.md`, this active
  plan, the performance Inspector, and its contract test.
- Required gates: the new failing oracle, focused codec/receiver and
  Collaboration process tests, Inspector contract, exact lint, bounded diff
  review, and one guarded 16-item proof. Only after those gates pass may one
  new guarded 7,076-element relay checkpoint evaluate the materially revised
  architecture.
- Exclusions: no threshold, raw-CPU formula, 250-millisecond polling cadence,
  frame size, 2 MiB capacity, source stop-and-wait, relay queue, App canonical
  policy, remote transaction, Render, slice budget, Contents, Pen Tool, legacy
  format, compatibility branch, package installation, or recording change.
- Stop condition: another resource or time stop terminates only that benchmark
  action, records its first bounded evidence, and starts another owner-scoped
  root-cause iteration; it does not weaken a gate or stop the overall task.

The serial-decode architecture is rejected. Its focused tests and guarded
16-item proof passed, and its 7,076-element raw frontend and aggregate peaks
fell to 363.7 and 397.3 percent, but Actor B reached only 1,906/7,076 elements
and 55/136 publications after 106.681 seconds while Actor A had completed in
4.040 seconds. The guard then failed closed on an operating-system sample gap.
This is an adjacent convergence regression far above 15 percent. Decode/apply
pipeline overlap is therefore necessary and the receiver implementation and
contract return to their prior accepted behavior; none of this rejected
implementation is committed.

### 2026-07-31 product-window heartbeat overhead iteration

The two aggregate CPU stops retained 24.3 and 26.2 percent test-harness CPU in
the failing snapshots. The guarded endpoint already samples complete raw
process CPU independently every 250 milliseconds, but its Playwright progress
controller also executes one `page.evaluate(...)` in each Actor and posts a
JSON heartbeat every second during the product window. The first aggregate
stop arrived 591 milliseconds after that dual-Actor heartbeat. Those
cross-process reads do not measure raw CPU and need not run every second to
satisfy the guard's ten-second heartbeat and twenty-second progress deadlines.

Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: keep the independent 250-millisecond raw operating-system sampler
  unchanged while reducing product-window Playwright progress observation to
  one fixed five-second dual-Actor scalar sample, leaving five seconds of
  margin under the immutable heartbeat-stale deadline.
- Test-first oracle: the endpoint harness source declares one fixed
  five-second heartbeat interval and both local-attribution and two-Actor
  controllers use it instead of a one-second loop. The current one-second
  implementation must fail this oracle before the production harness change.
- Mutation allowlist:
  `apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts`,
  `apps/asyra-design/__tests__/playwright-config.test.mjs`, this active plan,
  the performance Inspector, and its contract test.
- Required gates: the static harness oracle, focused endpoint guard/config
  suites, Inspector contract, exact lint, bounded diff review, one guarded
  16-item proof, then one materially revised guarded 7,076-element relay
  checkpoint.
- Exclusions: no raw `%CPU` conversion, average, subtraction, threshold,
  250-millisecond OS polling change, 375-millisecond sample-gap change,
  heartbeat-stale or progress-stale relaxation, product code, receiver, codec,
  remote apply, relay, Render, Contents, Pen Tool, compatibility format,
  package installation, or recording change.
- Stop condition: any new limit or time stop again terminates only the exact
  benchmark action and begins another bounded owner iteration without
  weakening the guard or stopping the full task.

### 2026-07-31 timed-out endpoint owner-evidence iteration

The five-second product-window heartbeat reduced the guarded 16-item peak to
98.4 percent raw frontend and 102.9 percent raw aggregate CPU. The materially
revised guarded 7,076-element relay checkpoint then remained below both
400-percent limits, with a 371.6-percent raw frontend peak and a 399.6-percent
raw aggregate peak. Actor A completed in 5.005 seconds, but Actor B had applied
only 2,994/7,076 elements and 72/136 publications when the 180-second product
deadline terminated the benchmark. No publication failure was reported.
Because the failed heartbeat currently discards the already bounded Actor
phase totals, it cannot yet distinguish remote apply, receiver handoff, or
wire scheduling as the first remaining owner.

Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: capture each Actor's existing bounded final diagnostics when the
  endpoint fails or times out, and preserve those diagnostics in the guard's
  bounded failure report so the next product owner is selected from direct
  browser-monotonic evidence.
- Test-first oracle: the guard must sanitize and retain only the bounded Actor
  diagnostics and top 24 phases from `error.ownerEvidence`, and the high-detail
  failure path must call `readFinalDiagnostics` for Actor A and Actor B before
  posting the failed heartbeat. Both oracles must fail before implementation.
- Mutation allowlist:
  `apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts`,
  `apps/asyra-design/e2e/performance-resource-guard.mjs`,
  `apps/asyra-design/__tests__/performance-resource-guard.test.mjs`,
  `apps/asyra-design/__tests__/playwright-config.test.mjs`, this active plan,
  the performance Inspector, its contract test, and the directly referenced
  AI conversational drawing performance BDD feature.
- Required gates: focused failing-oracle evidence, focused resource-guard and
  harness-config suites, Inspector contract, exact lint, bounded diff review,
  one guarded 16-item proof, then one materially revised guarded 7,076-element
  relay checkpoint that supplies the missing failure-owner evidence if the
  deadline remains red.
- Exclusions: no product implementation, receiver, codec, remote apply, relay,
  Render, CPU threshold, polling cadence, heartbeat deadline, progress
  deadline, CRDT deadline, Playwright ceiling, Contents, Pen Tool,
  compatibility format, package installation, or recording change.
- Stop condition: any raw CPU or time limit still terminates its exact
  benchmark processes, but the retained bounded owner evidence immediately
  begins the next Inspector-owner root-cause iteration without weakening a
  gate or stopping the full task.

### 2026-07-31 pre-stall owner-evidence iteration

The owner-evidence harness passed its focused gates and guarded 16-item proof.
The next materially revised guarded 7,076-element checkpoint stayed below the
frontend limit at a 341.0-percent raw peak, with renderer contributions of
183.7 and 142.9 percent and no aggregate-limit violation. The guard stopped on
`progress-stale` while Actor A was complete at 7,076 elements and 136 sent
publications, but Actor B remained at 3,122 elements and 74 applied
publications with zero publication failures. The guard correctly terminated
all four process groups before the Playwright catch could post its failed
heartbeat, so the failure-only owner evidence was absent. A resource-owned
stall must retain evidence before termination rather than relying on code that
can execute only afterward.

Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: after Actor A is complete, capture exactly one bounded A/B owner
  snapshot when two consecutive five-second heartbeat samples show no Actor B
  canonical, Render, or applied-publication progress; retain it on subsequent
  heartbeats so a guard-owned stall can report direct owner evidence before
  terminating the benchmark.
- Test-first oracle: the endpoint controller must capture the existing final
  diagnostics once after two unchanged peer-progress samples, never on every
  heartbeat, and the guard must sanitize and expose that last-heartbeat
  evidence in its bounded emergency report. Failure/stall evidence permits
  only bounded scalar diagnostics, top 24 phase totals, Render anomalies, and
  worker-target names; it must reject actor-level scalars, summaries, phase
  timelines, and arbitrary nested data.
- Mutation allowlist:
  `apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts`,
  `apps/asyra-design/e2e/performance-resource-guard.mjs`,
  `apps/asyra-design/__tests__/performance-resource-guard.test.mjs`,
  `apps/asyra-design/__tests__/playwright-config.test.mjs`, this active plan,
  the performance Inspector, and its contract test.
- Required gates: focused failing-oracle evidence, focused resource-guard and
  harness-config suites, Inspector contract, exact lint, bounded diff review,
  one guarded 16-item proof, then one materially revised guarded 7,076-element
  relay checkpoint.
- Exclusions: no progress-stale, heartbeat-stale, raw CPU, sample-gap, CRDT, or
  Playwright limit change; no product transaction, receiver, codec, remote
  apply, relay, Render, Contents, Pen Tool, compatibility format, package
  installation, or recording change.
- Stop condition: any stop still terminates the exact benchmark process groups;
  the retained pre-stall evidence selects the first product owner and begins
  its bounded iteration without relaxing the stall detector or stopping the
  full task.

### 2026-07-31 pre-dispatch dual-sample iteration

The pre-stall evidence implementation passed 76 focused guard/config tests,
20 Inspector tests, lint, bounded review, and the guarded 16-item proof at a
108.3-percent raw frontend peak. Its first 7,076-element invocation stopped
before the product request: Actor A and Actor B were both still zero, the last
heartbeat phase was `actors-ready`, raw frontend CPU was 375.5 percent, and
the same-snapshot aggregate was 408.6 percent from browser 375.5, harness
23.7, and WebSocket 9.4 percent. The two renderer contributions were 198.2
and 160.5 percent. Immediately after the request-ready heartbeat, the harness
currently performs two consecutive dual-page `heartbeat.sample()` calls
before dispatch. Those duplicate pre-dispatch renderer round trips provide no
new product evidence because the connected local interaction probe has already
proved the document is empty and the independent guard has already accepted
process identity.

Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: post one bounded zero-state creation-start heartbeat from the
  already proven request-ready state, then dispatch immediately; the first
  dual-Actor scalar sample remains the normal five-second heartbeat rather
  than two consecutive pre-dispatch page evaluations.
- Test-first oracle: from the accepted request-ready heartbeat through
  `triggerPreparedAiTurn`, the high-detail harness contains no
  `heartbeat.sample()` call and posts exactly one creation-start connectivity
  heartbeat whose active phase is `creation`. The current duplicate-sample
  sequence must fail before implementation.
- Mutation allowlist:
  `apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts`,
  `apps/asyra-design/__tests__/playwright-config.test.mjs`, this active plan,
  the performance Inspector, and its contract test.
- Required gates: focused failing static oracle, focused guard/config and
  Inspector suites, exact lint, bounded diff review, one guarded 16-item
  proof, then one materially revised guarded 7,076-element relay checkpoint.
- Exclusions: no CPU exclusion, conversion, threshold, polling, sample-gap,
  heartbeat, progress-stale, CRDT, or Playwright limit change; no product,
  receiver, codec, remote apply, relay, Render, Contents, Pen Tool,
  compatibility format, package installation, or recording change.
- Stop condition: a further raw limit or time stop terminates that benchmark
  and begins the next bounded root-cause iteration; it never weakens a guard
  or stops the full task.

### 2026-07-31 first-visible interaction handoff iteration

Removing the two pre-dispatch page samples passed all focused gates and lowered
the guarded 16-item frontend peak to 84.3 percent. The revised 7,076-element
run still stopped in the first product second at a 406.5-percent aggregate
snapshot: frontend 368.5, harness 22.9, and WebSocket 15.1 percent. This
confirms that the first high-detail product burst overlaps the harness's
loading-zero assertions and immediate pan, zoom, keyboard, button, Delete, and
Undo-attempt sequence. Those interactions are proof work, not required
contributors to the initial creation and relay burst. The proof can retain
real loading-time interaction semantics by waiting event-first for the first
ordinary canonical element and one bounded frame handoff before issuing input.
The initial history depths still need one dual-Actor scalar sample, but that
sample belongs before request-ready rather than inside the ready-to-dispatch
window.

Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: retain one pre-ready dual-Actor history baseline, dispatch without
  a post-ready page sample, prove loading at zero, then wait event-first for the
  first visible canonical element before the real pan/zoom and blocked-input
  sequence. Product CPU, WebSocket work, and all guard sampling continue while
  the harness is waiting.
- Test-first oracle: the initial heartbeat sample occurs before the accepted
  request-ready heartbeat; the ready-to-dispatch range contains no sample; the
  interaction probe exposes a `first-visible` target requiring loading to
  remain connected and canonical count to be strictly between zero and 7,076;
  the high-detail flow awaits it before the first `mouse.move` and asserts that
  the AI turn remains active.
- Mutation allowlist:
  `apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts`,
  `apps/asyra-design/__tests__/playwright-config.test.mjs`, this active plan,
  the performance Inspector, and its contract test.
- Required gates: focused failing static oracle, focused guard/config and
  Inspector suites, exact lint, bounded diff review, one guarded 16-item
  proof, then one materially revised guarded 7,076-element relay checkpoint.
- Exclusions: no synthetic input replacement, delayed product dispatch, CPU
  exclusion, conversion, threshold, polling, sample-gap, heartbeat,
  progress-stale, CRDT, or Playwright limit change; no product, receiver,
  codec, remote apply, relay, Render, Contents, Pen Tool, compatibility format,
  package installation, or recording change.
- Stop condition: the third equivalent raw aggregate stop rejects interaction
  overlap as the controlling hypothesis and forces a new first-owner
  iteration; any other stop follows its direct bounded evidence without
  stopping the full task.

### 2026-07-31 receiver retained-window credit iteration

The materially revised first-visible checkpoint did not hit a resource stop:
its raw frontend peak was 371.7 percent and no same-snapshot aggregate sample
exceeded 400 percent. Actor A completed 7,076/7,076 elements, produced and sent
all 136 publications, and retained one Undo action. Actor B remained connected
with zero publication failures and zero Undo actions, but stopped at
2,866/7,076 elements and 70/136 processed publications at the 180-second CRDT
deadline. Actor B's bounded owned phase totals included only 1,013.8
milliseconds of remote transaction apply and 997.6 milliseconds of receiver
handoff, so canonical apply, Factory, and Render do not explain the missing 66
publications.

The 70-publication plateau matches the receiver's 2 MiB retained-publication
window. The receiver currently returns `frame-consumed` immediately after
storing every frame, so the relay retires those bytes and refills the socket
while decoded publications remain reserved behind one active App consumer.
Once that independent receiver reservation reaches 2 MiB, the next otherwise
valid frame cannot enter. Wire credit must therefore mean that a publication's
retained bytes have left the receiver window for its one App handoff; it
remains independent of whether that later App Promise succeeds, but cannot
fabricate capacity while the publication is still queued.

Step Execution Card:

- Owner: `admit-receiver-publication-frames`.
- Objective: keep the receiver's exact 2 MiB retained-publication window and
  one async App consumer, but return each publication frame's wire credit only
  when that ordered publication leaves the retained window for handoff.
- Inputs and outputs: preserve exact relayed binary frames, ordered decoded
  publications, `frame-consumed`, one Worker-to-main handoff, App settlement,
  `peer-applied`, failure, teardown, and receiver timing.
- Test-first oracle: with more than one receiver window of valid publications
  and the first App consumer pending, only the first handed-off publication is
  credited; the simulated relay may fill but not overrun the retained window.
  After each settlement, the next publication and its exact frame credits
  advance in order until every publication is applied. Current immediate
  per-frame credit must fail this oracle before production code changes.
- Mutation allowlist:
  `apps/asyra-design/src/collaboration/publication-codec-worker.ts`,
  `apps/asyra-design/src/collaboration/collaboration-transport-worker.ts`,
  `apps/asyra-design/src/init/__tests__/collaboration-protocol.test.ts`,
  `apps/asyra-design/src/init/__tests__/collaboration-websocket-provider.test.ts`,
  `docs/ai/apps/asyra-design/modules/collaboration-reference.md`, this active
  plan, the performance Inspector, and its contract test.
- Required gates: prove the focused oracle fails first; pass focused
  codec/receiver and Collaboration process tests, Inspector contract, exact
  lint, bounded diff review, and one guarded 16-item proof. Only then run one
  materially revised guarded 7,076-element relay checkpoint, retaining relay
  profile counts in the bounded report.
- Exclusions: no relay implementation, source publication, App canonical
  policy, remote transaction, Factory, Render, slice budget, deadline, CPU
  threshold, 250-millisecond polling cadence, Contents, Pen Tool, compatibility
  format, package installation, or recording change.
- Stop condition: a resource or time stop terminates the current benchmark,
  retains bounded owner evidence, and begins the next root-cause iteration
  inside this plan; it never weakens a gate or stops the full task.

The first validation attempt after this source change used a stale production
artifact. The receiver source files were modified at 21:17, while the attested
`dist/index.html` and `collaboration-transport-worker-CgS_fw_B.js` were both
from 20:34. The stale guarded 16-item case happened to pass, and the stale
7,076-element case reproduced the previous 71/136 plateau before
`progress-stale`; neither result validates or falsifies this owner change.
That stale high-detail process remained below both raw limits at 362.5 percent
frontend and 392.7 percent aggregate, and all four process groups terminated.

Validation now requires the explicit separate
`prepare:e2e:endpoint-performance` production setup after the receiver source
change. The new `dist/index.html`, Worker asset hash, and response preview must
postdate the source change before the guarded 16-item proof can count. Only a
fresh passing 16-item proof may authorize the one replacement 7,076-element
checkpoint. This correction changes no product, threshold, deadline, or
benchmark semantics.

### 2026-07-31 direct Worker frame assembly iteration

The fresh `DozuiEJY` production artifact passed the guarded 16-item proof at
17/17 elements, eight ordered publications, one Actor A Undo action, zero
Actor B Undo actions, zero failures, a 107.5-percent raw frontend peak, and a
122.5-percent raw aggregate peak. Its fresh 7,076-element checkpoint then
stopped during the initial creation burst at a real 395.0-percent frontend and
404.5-percent aggregate snapshot. The two frontend renderer/worker processes
used 254.9 and 128.6 percent; the harness and WebSocket server contributed 6.8
and 2.7 percent. The last heartbeat preceded the first observable canonical
batch, so the receiver had processed no publication and cannot own this stop.

The preceding complete high-detail evidence placed Actor A's main transaction
at approximately 3.25 seconds and outbound Worker encoding at approximately
0.93 seconds. Bounded codec inspection found one direct duplicate byte
ownership inside that overlap: after compact-binary produces each delivery
unit buffer, the Worker copies all units into a complete publication payload
and then copies that payload again into final WebSocket frames.

Step Execution Card:

- Owner: `encode-publication-frames`.
- Objective: preserve identical versioned frames and canonical delivery
  boundaries while writing prepared compact-binary segments directly into the
  final frame allocation, removing the intermediate full-publication payload
  copy.
- Inputs and outputs: preserve one minimal `SharedPublication`, one
  object-to-Worker clone, exact metadata and delivery bytes, the soft 1 MiB
  target, indivisible oversized delivery behavior, source admission, and
  codec timing.
- Test-first oracle: a single large delivery records exactly one large
  `Uint8Array.set` from its prepared encoded bytes into final frame ownership.
  Current code must fail with the extra full-payload recopy; existing exact
  round-trip, split-boundary, UTF-16, invalid, and oversized tests remain
  unchanged.
- Mutation allowlist:
  `apps/asyra-design/src/collaboration/protocol.ts`,
  `apps/asyra-design/src/init/__tests__/collaboration-protocol.test.ts`, this
  active plan, the performance Inspector, and its contract test.
- Required gates: prove the focused copy-count oracle fails first; pass the
  complete protocol and receiver suites, Collaboration process/provider tests,
  Inspector contract, exact lint, bounded diff review, explicit production
  setup, and one guarded 16-item proof. Only then may one materially revised
  guarded 7,076-element checkpoint evaluate the lower-copy Worker.
- Exclusions: no codec format or version, JSON compatibility route,
  compression, frame target, payload ceiling, receiver credit, relay, App
  canonical transaction, Factory, Render, polling cadence, deadline, CPU
  threshold, Contents, Pen Tool, package, or recording change.
- Stop condition: a time or resource stop ends only that benchmark and begins
  the next bounded root-cause iteration; it never weakens a gate or stops the
  full task.

The direct-frame Worker passed its fresh guarded 16-item proof with a new
`BvNBf3_o` asset, exact 17/17 Actor output, eight publications, one/zero Undo
actions, zero failures, an 83.4-percent frontend peak, and a 93.3-percent
aggregate peak. Its high-detail checkpoint lowered the initial frontend peak
from 395.0 to 383.8 percent, but the same snapshot included 18.8 percent test
harness and 15.1 percent WebSocket-server CPU and therefore stopped at a
417.7-percent aggregate value 1.252 seconds after the creation-start
heartbeat.

The current harness waits for first visible and then immediately performs pan,
zoom, focus, rectangle keyboard and pointer attempts, Delete, and Undo before
waiting for another product milestone. That bunches independent proof work
into the same initial canonical/encode/relay burst. The interaction contract
does not require those independent actions to share one instant; it requires
each to be real, loading-time, locked, and inside the same active turn.

Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: retain the exact real interaction proof while distributing it
  across event-first canonical progress: pan after first visible, zoom at 25
  percent, rectangle shortcut/button lock at 50 percent, and Delete/Undo lock
  at 75 percent.
- Inputs and outputs: preserve the same dispatched high-detail turn, connected
  loading indicator, viewport changes, four real blocked document attempts,
  post-settlement release checks, endpoint timing, raw OS sampling, and
  canonical/CRDT evidence.
- Test-first oracle: static harness order proves the 25-, 50-, and 75-percent
  event-first waits separate the four input groups; each wait uses
  `MutationObserver` plus one bounded frame confirmation and rejects a settled
  turn. Current first-visible-adjacent sequence must fail that oracle.
- Mutation allowlist:
  `apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts`,
  `apps/asyra-design/__tests__/playwright-config.test.mjs`, this active plan,
  the performance Inspector, and its contract test.
- Required gates: focused static oracle, guard/config and Inspector suites,
  exact lint, bounded diff review, one guarded 16-item proof, then one
  materially revised guarded 7,076-element checkpoint.
- Exclusions: no synthetic interaction, fixed delay, product dispatch delay,
  CPU exclusion or conversion, threshold, polling cadence, heartbeat
  frequency, CRDT deadline, product, codec, receiver, relay, canonical,
  Factory, Render, Contents, Pen Tool, package, or recording change.
- Stop condition: any time or resource stop ends the benchmark, retains the
  first bounded evidence, and starts another root-cause iteration without
  weakening the gate or stopping the task.

The distributed-interaction harness passed its focused 76-test guard/config
gate, Inspector contract, exact lint and bounded review. Its fresh guarded
16-item proof completed Actor A and Actor B at 17/17 elements with eight
ordered publications, one/zero Undo actions, zero failures and exact process
termination.

The materially revised guarded 7,076-element checkpoint then stopped on one
real same-snapshot 425.5-percent aggregate value. The complete client-browser
sum was 382.8 percent, below the 400-percent high-performance frontend limit;
the same snapshot also contained 31.9 percent test-harness and 10.8 percent
WebSocket-server CPU. Its two largest renderer-or-worker processes were 198.7
and 165.8 percent. The last completed heartbeat still contained zero canonical
elements and zero publications on both Actors, so this evidence cannot select
receiver, remote-apply or relay ownership. All four tracked process groups
terminated successfully.

Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: identify the first chronological frontend owner behind the
  pre-canonical aggregate stop without repeating the 7,076-element proof.
- Inputs and outputs: retain the attested production artifact, raw same-snapshot
  CPU, exact process roles and browser subprocesses, App-owned request timing,
  loading paint, canonical phase spans and exact single-Actor output.
- Fixed discovery: run one fresh single-Actor guarded 16-item attribution. If
  and only if it remains at or below the 250-percent frontend and 400-percent
  aggregate limits, run one fresh single-Actor guarded 1,280-item attribution
  to separate provider/Runtime, loading, local canonical composition and
  Worker encode. Compare direct browser-monotonic owner spans; raw CPU alone
  cannot assign ownership.
- Mutation allowlist: this active plan only until the attribution selects one
  exact Inspector owner. Any later implementation iteration must first add its
  own test-first Step Execution Card and stay inside that owner's implementation
  boundary.
- Required gates: existing guard/config and Inspector contract remain green;
  each attribution must confirm exact process termination and canonical
  correctness. Neither attribution creates an accepted endpoint baseline or
  authorizes another 7,076-element run.
- Exclusions: no threshold, polling, deadline, workload, product dispatch,
  browser flag, CRDT, codec, receiver, remote apply, relay, Render, Contents,
  Pen Tool, dependency, recording or visual-review change.
- Stop condition: any resource or time stop terminates only that diagnostic and
  selects the next bounded owner iteration from its first direct evidence; the
  overall task continues.

The single-Actor attribution path remained green. The 16-item case completed
17/17 elements and eight publications with a 44.6-percent product-window
frontend peak. The 1,280-item case completed 1,281/1,281 elements and 46
publications with a 179.7-percent frontend peak and 196.9-percent aggregate
peak. Its one hot renderer-or-worker reached 167.4 percent while local
transaction, outbound send-to-acceptance, Worker encode and Props preflight
measured 940.5, 584.9, 293.6 and 322.7 milliseconds respectively. These results
explain one of the two hot 7,076 processes but cannot distinguish the second
process between Actor B remote work and another browser Worker.

Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: extend the existing formal two-Actor operation/idle attribution
  to the already-authorized 1,280-item case so Actor A and Actor B page-target
  work can be separated without another high-detail proof.
- Inputs and outputs: reuse the versioned 1,280 response, sequential Actor
  bootstrap, one collaboration-attribution proof kind, raw process guard,
  per-Actor CDP operation windows, exact convergence, publication parity,
  one/zero Undo and the existing ten-second idle control.
- Test-first oracle: guard/config tests require one
  `1280-two-actor-attribution` case, select the existing two-Actor diagnostic,
  retain the 250-percent frontend and 400-percent aggregate limits, and prove
  the spec derives 1,281 expected elements and the 1,280 prompt from that case.
  The current case allowlist and fixed 16-item constants must fail first.
- Mutation allowlist:
  `apps/asyra-design/e2e/performance-resource-guard.mjs`,
  `apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts`,
  `apps/asyra-design/__tests__/performance-resource-guard.test.mjs`,
  `apps/asyra-design/__tests__/playwright-config.test.mjs`,
  `apps/asyra-design/package.json`, and this active plan.
- Required gates: prove the focused oracle fails, pass complete guard/config
  tests, exact lint, bounded diff review and one guarded two-Actor 1,280-item
  attribution with confirmed process termination.
- Exclusions: no product, 7,076 invocation, accepted baseline, fixed delay
  change, idle-window change, CPU threshold, polling cadence, CRDT deadline,
  codec, receiver, remote apply, relay, Render, Contents, Pen Tool, dependency,
  recording or visual-review change.
- Stop condition: a resource or correctness failure terminates the diagnostic
  and selects the first direct owner; success selects exactly one owner from
  Actor A/Actor B direct timing rather than raw CPU alone.

The guarded two-Actor 1,280-item attribution stopped correctly at a
262.8-percent frontend raw snapshot, below the 400-percent aggregate limit but
above the attribution-class 250-percent frontend limit. The snapshot contained
154.4- and 89.5-percent renderer-or-worker processes, whereas the fresh
single-Actor 1,280 case contained one 167.4-percent hot process. This proves
that the peer path introduces the second material browser process, but the
resource stop occurred before a complete operation window and therefore cannot
distinguish receiver admission, remote apply and Actor B Render ownership. All
tracked process groups terminated successfully.

Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: obtain one complete two-Actor page-target attribution below the
  small-case CPU limit by using the existing formal 320-item response after the
  1,280-item diagnostic stopped.
- Inputs and outputs: preserve the same two-Actor operation/idle diagnostic,
  sequential readiness, raw guards, collaboration proof kind, exact
  publication parity, convergence, per-Actor CDP operation windows, ten-second
  idle control and one/zero Undo, changing only the versioned response size and
  matching prompt.
- Test-first oracle: the Inspector contract explicitly permits one two-Actor
  320-item fallback only after the two-Actor 1,280 resource stop; guard/config
  tests require a `320-two-actor-attribution` case with the 250-percent
  frontend and 400-percent aggregate limits, 321 expected elements and the
  320-item prompt. Current Inspector and case allowlist must fail first.
- Mutation allowlist:
  `apps/asyra-design/e2e/performance-resource-guard.mjs`,
  `apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts`,
  `apps/asyra-design/__tests__/performance-resource-guard.test.mjs`,
  `apps/asyra-design/__tests__/playwright-config.test.mjs`,
  `apps/asyra-design/package.json`, this active plan, the performance Inspector
  and its contract test.
- Required gates: prove the Inspector and focused harness oracles fail, then
  pass complete Inspector, guard/config, exact lint and bounded review before
  one guarded two-Actor 320-item attribution with confirmed teardown.
- Exclusions: no repeat of 1,280 or 7,076, accepted baseline, product code,
  workload-detail change inside a response, CPU threshold, polling, deadline,
  idle duration, CRDT, codec, receiver, remote apply, relay, Render, Contents,
  Pen Tool, package installation, recording or visual review.
- Stop condition: any resource or correctness failure terminates the diagnostic
  and selects its first direct owner; a complete result selects exactly one
  next owner from Actor A and Actor B browser-monotonic evidence.

The guarded two-Actor 320-item fallback completed exactly. Actor A and Actor B
both reached 321 canonical and Render elements with 28 ordered publications,
one/zero Undo actions, zero failures, 5.005-second convergence and confirmed
termination. Its frontend raw peak was 186.0 percent and its same-snapshot
aggregate was 197.7 percent. Actor A and Actor B page-target operation task
times were 380.130 and 212.738 milliseconds. Actor B's direct chronological
phases were 36.4 milliseconds Worker decode, 41.1 milliseconds inbound
receive-to-dispatch, 50.0 milliseconds receiver handoff, 106.0 milliseconds
remote transaction apply, and only 6.8–7.1 milliseconds Render. The first
material peer owner is therefore `admit-receiver-publication-frames`; remote
apply remains the next downstream owner and Render is not selected.

The receiver timing review found that `collaboration:receiver-handoff` starts
at the first frame receipt and closes before the main-bound delivery post. It
therefore overlaps the complete codec and receive-to-dispatch spans and does
not measure the exclusive handoff named by its artifact. The 50.0-, 41.1- and
36.4-millisecond values cannot be added or used as separate CPU ownership.

Step Execution Card:

- Owner: `admit-receiver-publication-frames`.
- Objective: make receiver-handoff timing exclusive to the one decoded
  publication's Worker-to-main delivery and remove the publication-start map
  that exists only for the overlapping span.
- Inputs and outputs: preserve exact frame admission, retained-window credit,
  decoded publication order, one active async consumer, settlement, teardown,
  codec timing and inbound receive-to-dispatch timing; start handoff only after
  a decoded candidate is ready and close it after the sole
  `publication-delivery` post returns.
- Test-first oracle: the real transport Worker integration requires the
  main-bound `publication-delivery` to precede its
  `collaboration:receiver-handoff` timing event, proving the timing closes
  after the handoff rather than before it. The current ordering must fail.
  Inspector contract text requires the same non-overlapping boundary.
- Mutation allowlist:
  `apps/asyra-design/src/collaboration/collaboration-transport-worker.ts`,
  `apps/asyra-design/src/init/__tests__/collaboration-websocket-provider.test.ts`,
  this active plan, the performance Inspector, its contract test, and
  `docs/ai/apps/asyra-design/modules/collaboration-reference.md`.
- Required gates: prove both focused oracles fail; pass App protocol/provider,
  Collaboration process/provider/lifecycle, Inspector, exact lint,
  `diff --check`, bounded review and one guarded 16-item proof.
- Exclusions: no protocol codec, frame format, queue/window size, credit
  semantics, App apply, Core/Factory transaction, remote apply, relay, Render,
  CPU threshold, polling, deadline, 1,280/7,076 invocation, Contents, Pen Tool,
  dependency, recording or visual review change.
- Stop condition: any correctness or 16-item resource failure returns to this
  receiver owner; a green structural and guarded proof advances to the already
  selected downstream remote-apply owner without a receiver high-detail run.

The exclusive receiver-handoff boundary passed its complete focused gates and
fresh guarded 16-item proof. Actor A and Actor B reached 17/17 elements with
eight ordered publications, one/zero Undo, zero failures and confirmed
teardown on Worker asset `YdmndVi9`. The frontend raw peak was 87.1 percent and
the same-snapshot aggregate was 91.9 percent. Actor B reported 7.0 milliseconds
inbound receive-to-dispatch, 4.8 milliseconds codec decode and 21.0
milliseconds remote transaction apply; exclusive receiver-handoff fell below
the retained top 18 phases. This proves the prior 50.0-millisecond handoff was
overlapping evidence and advances to `apply-remote-publication-batches`
without a receiver 7,076-element run.

Step Execution Card:

- Owner: `apply-remote-publication-batches`.
- Objective: close the already-implemented one-organization, one-Core-request,
  one-remote-Factory-transaction path and add the missing direct remote
  removal-evidence oracle identified by bounded review.
- Inputs and outputs: consume one decoded source publication, preserve its
  ordered Factory batch evidence, produce one Core canonical request inside one
  remote Factory transaction, and settle it without Undo, echo publication, or
  persistence.
- Test-first oracle: a complete remote element-removal publication containing
  its ordered Props removal evidence must be accepted and applied as one Core
  request. Existing tests cover Scene-only removal but not the complete
  Scene-plus-Props envelope. The new formal case must establish whether a
  production correction is needed before any implementation edit.
- Mutation allowlist:
  `apps/asyra-design/src/collaboration/operations.ts`,
  `apps/asyra-design/src/init/__tests__/collaboration-operations.test.ts`, this
  active plan, the performance Inspector and its contract test only if the
  executable contract proves incomplete, plus direct focused owner tests.
- Required gates: prove the new removal oracle fails; pass App collaboration
  operations/factory/lifecycle tests, Collaboration process tests, Factory and
  Reactive Events batch tests, Inspector, exact lint, `diff --check`, bounded
  review, and one guarded 16-item proof.
- Exclusions: no codec Worker, receiver admission, relay, remote publication
  merge, compatibility format, persistence, Render, Contents, Pen Tool, CPU
  threshold, 1,280/7,076 invocation, package, recording, or visual-review
  change.
- Stop condition: any focused or guarded failure returns to this owner for
  bounded root-cause analysis; a green proof advances to
  `relay-frames-with-backpressure`.

The complete Scene-plus-Props removal oracle passed on the current
implementation, proving the bounded review suspicion came from overlapped
command output rather than the exact source. No production correction was
authorized or made. The owner then passed 32 App collaboration
operations/factory/lifecycle tests, 12 Collaboration process tests, 28 Factory
tests, 21 Reactive Events tests, 20 Inspector tests, exact lint and
`diff --check`. Its single guarded two-Actor 16-item proof returned exit code
zero, Playwright recorded `passed`, and all tracked process groups closed. The
waiting tool did not surface the guard's final one-line resource JSON, so this
gate records no reconstructed CPU peak; it was not rerun merely to recover
diagnostic output. The exact fixed correctness assertions remained 17/17
canonical and Render elements, eight/eight ordered publications, one/zero Undo,
and zero failures. The owner advances to
`relay-frames-with-backpressure`.

Step Execution Card:

- Owner: `relay-frames-with-backpressure`.
- Objective: verify and close the existing opaque reference relay with exact
  per-peer byte capacity, contiguous dual-gated retirement, one credited source
  frame, and distinct sender-accepted, wire-consumed, and peer-applied
  evidence.
- Inputs and outputs: accept one encoded source frame, inspect only its bounded
  wire metadata, preserve canonical payload byte parity, enqueue it in every
  request-start peer's exact 2 MiB window, and return source admission only
  after all peer queues accept it.
- Formal oracle: the existing server suite must prove opaque payload relay,
  exact 2 MiB capacity without hysteresis, one oversized-empty-queue exception,
  FIFO sends before contiguous send-callback plus frame-consumed retirement,
  readable JSON credit under bidirectional saturation, single uncredited source
  rejection, slow/disconnected/write-failed peer behavior, distinct
  peer-applied receipt, and disabled compression. Any missing contract becomes
  a formal failing test before production edits.
- Mutation allowlist: `apps/asyra-design/collaboration-server.ts`,
  `apps/asyra-design/__tests__/collaboration-server.test.mjs`, this active plan,
  and the performance Inspector plus its contract test only if executable
  coverage is incomplete.
- Required gates: collaboration-server focused tests, Inspector, exact lint,
  `diff --check`, bounded review, one guarded 16-item proof, then one guarded
  high-performance 7,076-item proof under the raw 400-percent frontend and
  same-snapshot aggregate limits.
- Exclusions: no canonical payload decode/re-encode, client codec or receiver
  edit, remote apply edit, queue threshold change, persistence, Render,
  Contents, Pen Tool, package, recording, or visual-review change.
- Stop condition: a correctness, 180-second product-flow, 240-second
  Playwright, frontend raw CPU, or aggregate raw CPU stop terminates only that
  benchmark invocation and returns to this owner for bounded root-cause and
  replan; a green high-detail proof advances to final closure.

Relay evidence task iteration:

- First blocker: the correctly owned 16-item proof passed exact correctness and
  resource gates but reported zero relay profile records, so it cannot prove
  the relay's changed-owner timing before the 7,076 checkpoint.
- Root cause: the collaboration server emits the existing bounded
  `AI_COLLABORATION_SERVER_*` lines when profiling is enabled, and the guard
  already parses them, but the endpoint Playwright `webServer` keeps its default
  ignored stdout. The evidence is lost between the tracked server process and
  guard; relay production behavior is not the failure.
- Revised owner: return narrowly to `evaluate-endpoint-performance`, whose
  Inspector allowlist includes
  `apps/asyra-design/playwright.endpoint-performance.config.ts` and
  `apps/asyra-design/__tests__/playwright-config.test.mjs`.
- Test-first oracle: the endpoint configuration must formally require the
  tracked WebSocket server's stdout to be piped while leaving the App preview
  output ignored. The current source assertion must fail before the config
  changes.
- Mutation allowlist: those two configuration files, this plan, the performance
  Inspector and contract test only if its evidence contract is incomplete.
- Gates and return: pass focused Playwright config and guard tests, Inspector,
  exact lint and bounded review, then run one corrected relay-owned 16-item
  proof. It must contain nonzero bounded relay profile evidence before the
  relay's single high-performance 7,076 proof may start.
- Exclusions: no relay server logic, codec, receiver, remote apply, production
  App, threshold, polling, deadline, persistence, Render, Contents, Pen Tool,
  package, recording, or visual-review change.

The corrected relay-owned 16-item proof passed with A/B 17/17 canonical and
Render elements, eight/eight publications, one/zero Undo, zero failures,
5,004-millisecond convergence, 117.4-percent raw frontend peak,
137.4-percent same-snapshot aggregate, and confirmed teardown. It captured
eight server acceptance profiles, eight peer writes, eight contiguous drains,
and eight peer-applied receipts. The bounded relay maxima were 0.579
milliseconds write callback, 5.888 milliseconds drain, 0.423 milliseconds
queue wait, 0.962 milliseconds total relay, and 12,955 queued bytes. This
closes the harness evidence blocker and permits the relay owner's single
guarded high-performance 7,076-item proof.

### 2026-07-31 single-frame inbound decode iteration

The relay-owned high-performance proof correctly stopped on a
401.1-percent raw same-snapshot aggregate value. The complete frontend was
375.1 percent and remained below its 400-percent limit; the same snapshot
contained 17.2 percent test-harness and 8.8 percent WebSocket-server CPU. Its
two hot renderer-or-worker processes were 201.0 and 155.5 percent. All four
tracked process groups terminated. Before the stop, the relay had accepted 55
single-frame publications, written 55, drained 54, and received 53
peer-applied receipts with no publication failure. Its exact queue peak was
1,002,080 bytes, maximum queue wait 0.346 milliseconds, and maximum total
relay time 0.638 milliseconds, so relay is below five percent of the observed
product work and remains unchanged.

The accepted 1,280-item attribution already measured 293.6 milliseconds of
Worker encode, and direct protocol inspection found the matching remaining
Actor B ownership: even when an inbound publication has exactly one validated
frame, decode allocates a payload-sized `Uint8Array` and copies that frame view
before compact-binary decode. The high-detail relay evidence confirms the
active publications are single-frame records of approximately 501 KiB. This
duplicate payload ownership overlaps Actor A encode with Actor B decode and is
the first directly evidenced remaining frontend owner.

Step Execution Card:

- Owner: `encode-publication-frames`.
- Objective: decode a validated one-frame publication directly from its payload
  view, allocating a combined payload only for a true multi-frame publication.
- Inputs and outputs: preserve identical versioned frames, header/order/
  duplicate/schema validation, compact-binary decode, one decoded candidate,
  ProviderFailure behavior, Worker ownership, and multi-frame assembly.
- Test-first oracle: the existing large direct-frame round trip must contain
  exactly one large `Uint8Array.set` for outbound final-frame ownership rather
  than a second inbound payload recopy. The current decoder must fail that
  copy-count oracle. The Inspector contract must also require direct
  single-frame view decode and multi-frame-only combination.
- Mutation allowlist:
  `apps/asyra-design/src/collaboration/protocol.ts`,
  `apps/asyra-design/src/init/__tests__/collaboration-protocol.test.ts`, this
  active plan, the performance Inspector, and its contract test.
- Required gates: prove both formal oracles fail, pass complete protocol and
  receiver/provider suites, Collaboration process/provider tests, Inspector,
  exact lint and bounded review, run explicit production setup, then one
  guarded 16-item proof. Only after that materially revised architecture passes
  may one new guarded relay-owned 7,076-item proof run.
- Exclusions: no format/version/target/ceiling, JSON compatibility, compression,
  source credit, receiver retained-window credit, relay, remote apply,
  canonical transaction, Factory, Render, polling, threshold, deadline,
  Contents, Pen Tool, package, recording, or visual-review change.
- Stop condition: a correctness, resource, or time stop terminates only that
  benchmark and begins the next bounded owner iteration without weakening any
  gate or stopping the full task.

The single-frame view decode is rejected and has been removed. Its fresh
`DOCIw72c` 16-item proof passed at 92.1-percent frontend and 105.8-percent
aggregate CPU, but the materially revised 7,076 proof stopped at
378.2-percent frontend and 414.6-percent aggregate CPU. This did not improve
the preceding 375.1-percent frontend observation and regressed the aggregate
snapshot. All process groups terminated, and the direct-frame outbound
optimization remains the accepted codec implementation.

The rejected run also supplied the next direct diagnostic owner. It emitted 59
server acceptance, 59 write, 58 drain, and 57 peer-applied log records before
the stop. The Playwright WebServer forwarded each record and the guard parsed
each record while the same snapshot contained 27.2-percent harness and
9.2-percent WebSocket-server CPU. Relay data-plane work still measured at most
0.637 milliseconds total with a 0.313-millisecond queue wait. Profiling
transport, not relay product logic, must become bounded before another
high-detail proof can distinguish product CPU from proof overhead.

Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: preserve exact relay count/max evidence while batching its
  diagnostic stdout handoff once per eight same-type records, reducing
  Playwright forwarding and guard parsing without excluding any process from
  raw CPU safety.
- Inputs and outputs: retain acceptance, peer-write, contiguous-drain, and
  peer-applied counts; exact timing/queue maxima; bounded recent evidence; and
  the existing relay data plane. Each emitted diagnostic record carries its
  exact `sampleCount`, and the guard adds that count rather than treating one
  batched line as one publication.
- Test-first oracles: the guard profile test must fail until an exact
  `sampleCount: 8` contributes eight records to its count and retains maxima;
  the profiled server test must fail until eight peer-applied receipts emit one
  bounded line with `sampleCount: 8`. The Inspector must name the same
  diagnostic-only boundary.
- Mutation allowlist:
  `apps/asyra-design/collaboration-server.ts`,
  `apps/asyra-design/__tests__/collaboration-server.test.mjs`,
  `apps/asyra-design/e2e/performance-resource-guard.mjs`,
  `apps/asyra-design/__tests__/performance-resource-guard.test.mjs`, this
  active plan, the performance Inspector, and its contract test.
- Required gates: prove all three formal oracles fail, pass server, guard/config
  and Inspector focused suites, exact lint and bounded review, explicit
  production setup, and one guarded 16-item proof with exact 8/8/8/8 weighted
  profile counts. Only then may one materially revised 7,076 proof run.
- Exclusions: no data-plane queue, credit, relay payload, codec, receiver,
  remote apply, canonical transaction, Render, CPU role/exclusion/formula,
  threshold, polling, deadline, Contents, Pen Tool, package, recording, or
  visual-review change.
- Stop condition: a correctness, resource, or time stop terminates only that
  benchmark and begins the next bounded owner iteration; no guard is weakened.

The batched evidence path passed server 15/15, guard/config 78/78, Inspector
21/21, exact lint and bounded review. Its fresh `YdmndVi9` guarded 16-item
proof completed A/B 17/17 with eight/eight publications, one/zero Undo, zero
failures, 5,006-millisecond convergence, an 89.2-percent raw frontend peak,
108.0-percent same-snapshot aggregate, and confirmed teardown. Exactly one
line per metric type carried `sampleCount: 8`; the final report therefore
retained exact 8/8/8/8 counts and the complete maxima. This authorizes one
materially revised high-detail proof.

The materially revised guarded 7,076-element checkpoint then stopped on one
real same-snapshot 403.5-percent aggregate value. Its complete client-browser
sum was 374.1 percent, with 20.9-percent test-harness and 8.5-percent
WebSocket-server CPU; the two hottest renderer-or-worker processes were 201.7
and 153.7 percent. Relay evidence retained exact weighted counts of 56
admissions and peer writes plus 48 contiguous drains and peer-applied receipts,
with a 0.636-millisecond maximum relay total. All tracked process groups
terminated. Compared with the preceding 414.6-percent aggregate stop, bounded
profile batching reduced diagnostic output by 87.5 percent and the observed
aggregate peak by 11.1 percentage points without changing raw CPU sampling or
the relay data plane.

The product owner subsequently raised the exact 7,076-element high-performance
ceiling to 500 percent. This replaces both its raw same-snapshot complete
client-browser and aggregate frontend/backend/harness limits; 16-, 320-, and
1,280-item safety or attribution proofs retain the 250-percent frontend and
400-percent aggregate limits.

Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: encode the product-owner-approved 500-percent exact
  7,076-element high-performance ceiling without weakening any small-proof
  safety limit or changing raw operating-system measurement.
- Inputs and outputs: retain one complete `ps` snapshot, raw `%CPU`, exact
  process roles, proof kind, resource-stop evidence and exact process-group
  termination; change only the high-detail endpoint ceiling selected by the
  guarded runner.
- Test-first oracles: the guard/config suite must fail until the endpoint
  runner carries 500-percent frontend and aggregate ceilings while attribution
  proofs remain 250/400; the Inspector contract and BDD scenario must fail
  until they name the same proof-class split.
- Mutation allowlist:
  `apps/asyra-design/e2e/performance-resource-guard.mjs`,
  `apps/asyra-design/__tests__/performance-resource-guard.test.mjs`,
  `docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature`,
  this active plan, the performance Inspector, and its contract test.
- Required gates: prove guard/config and Inspector contracts fail first, then
  pass those focused suites, exact lint and bounded diff review. Reuse the
  already-green guarded 16-item proof because this policy change does not
  modify its 250/400 proof class; the next named 7,076-element invocation is
  the first execution under 500/500.
- Exclusions: no CPU conversion or averaging, polling cadence, process-role
  exclusion, heartbeat, deadline, workload, browser flag, CRDT, codec,
  receiver, remote apply, relay data plane, Render, Contents, Pen Tool,
  dependency, recording, or visual-review change.
- Stop condition: any correctness, time, or new 500-percent resource stop
  terminates only the benchmark and starts the next bounded owner iteration;
  the overall task continues.

The first 500/500 relay checkpoint stayed within the revised raw CPU limits:
the frontend peak was 382.9 percent and its same-snapshot aggregate was 422.9
percent. Actor A and Actor B both reached 7,076/7,076 canonical and Render
elements at approximately 5,003 milliseconds with 136/136 ordered
publications, one/zero Undo depth and exact tracked-process termination. The
endpoint did not close because the terminal canonical summary reported zero
Vector points against the formal minimum of 115,000; that first correctness
blocker remains active and no unchanged high-detail retry is permitted.

The product owner then raised the complete CRDT rendering deadline from 180 to
300 seconds.

Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: allow up to 300 seconds from Actor A request submission through
  Actor B complete canonical and Render convergence without letting the test
  runner preempt the product deadline.
- Inputs and outputs: retain the same request-start timestamp, bounded
  heartbeat, remaining-time calculation, exact complete proof and teardown;
  change the product-flow constant to 300 seconds and the guarded Playwright
  ceiling to 360 seconds.
- Test-first oracles: the guard/config test must fail until the spec names
  `300_000` and the config names `360_000`; the Inspector/BDD contract must
  fail until it names the same 300/360 ordering.
- Mutation allowlist:
  `apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts`,
  `apps/asyra-design/playwright.endpoint-performance.config.ts`,
  `apps/asyra-design/__tests__/playwright-config.test.mjs`,
  `docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature`,
  this active plan, the performance Inspector, and its contract test.
- Required gates: prove config and Inspector oracles fail first, then pass the
  focused config/Inspector suites, exact lint and bounded diff review. Do not
  run a browser because the current Vector-point correctness blocker is
  independent and already has formal failing evidence.
- Exclusions: no CPU threshold, raw sampling, polling, heartbeat frequency,
  progress-stale interval, workload, CRDT semantics, codec, receiver, remote
  apply, relay, Render implementation, Contents, Pen Tool, package, recording,
  or visual-review change.
- Stop condition: a later 300-second product timeout or 360-second Playwright
  ceiling still terminates only the benchmark and starts the next bounded
  root-cause iteration; the overall task continues.

The first 500/500 relay checkpoint's zero-Vector-point blocker is owned by
`apply-canonical-property-scene-batch`. The prepared 7,075-child server
artifact retains 156,373 topology points, but the ordinary property creation
path validates descriptor owner values and then materializes explicitly named
root property components from defaults alone. Scene local computed projection
therefore receives empty Vector topology even though the source descriptor and
canonical owner ids remain present.

Step Execution Card:

- Owner: `apply-canonical-property-scene-batch`.
- Product contract: `#bulk-mutation-contract`,
  `#one-composition-bulk-mutation`, `#non-negotiable-equivalence`, and the
  Projection and Props/Scene Tree step-local gates require exact source values,
  stable property ids, complete topology, one canonical batch, and ordinary
  local computed projection.
- Inspector contract: consume `artifact:composition-batch-sequence` and the
  active Factory mutation boundary; produce ordered canonical element ids and
  canonical batch timing. Props owns whole-batch property validation and
  materialization, while Scene consumes those owner values for local computed
  projection without publishing computed data.
- Conditions and bypasses: preserve individually addressable property records,
  stable ids, owner relationships, batch-of-one parity, later-invalid
  no-prefix behavior, and complete rollback. Empty input remains inert;
  invalid schema, id, relationship, or ownership evidence fails before apply;
  fatal apply failure rolls back the outer transaction.
- Allowed contributors: the composition batch sequence, Core facade,
  Props Manager property graph owner, Scene Tree hierarchy/computed owner, and
  active Factory transaction. Forbidden contributors include fixture-specific
  topology recovery, App access to private stores, computed CRDT publication,
  post-hoc geometry repair, or a second property/Scene handoff.
- Implementation boundary and failure owner:
  `packages/props-manager/src`,
  `packages/props-manager/src/__tests__`,
  `packages/scene-tree/src`,
  `packages/scene-tree/src/__tests__`,
  `packages/preset/src/props/components`,
  `packages/preset/src/__tests__`; failure remains
  `apply-canonical-property-scene-batch`.
- Test-first oracle: strengthen the Scene Tree ordinary plural-creation test
  with explicit property ids and non-default owner values, including a
  point-like record, and prove the current computed projection loses them.
  Then cover Props Manager's prepared ordinary root materialization directly.
- Required gates: focused Props Manager and Scene Tree tests, the affected
  Core canonical-owner test, Inspector contract, exact lint, and bounded diff
  review. After the owner fix, run guarded 16-item before any named exact
  high-detail checkpoint.
- Mutation allowlist for this segment: the listed Props Manager and Scene Tree
  implementation/test paths plus this active plan. No App E2E oracle change is
  allowed merely to make the existing point-count assertion pass.
- Stop conditions: any required semantic change outside this owner boundary,
  failure to reproduce descriptor-value loss formally, an owner contract
  conflict, or three failed focused repair iterations starts a bounded
  root-cause replan without ending the overall task.

The focused regression first failed with every explicitly named ordinary
position and dimension owner present but all descriptor values absent from
Props and local computed projection. Props Manager now retains one shallow
reference to the already-validated action owner fields, supplies those fields
only to ordered root materialization, keeps relationship-child construction on
its separate accessor route, and preserves existing requested-id replacement
and finalize rejection semantics.
The complete focused Props Manager file passed 160/160, the complete Scene Tree
file passed 62/62, Core canonical coordination passed 25/25, exact ESLint and
Props Manager build passed, and the performance Inspector contract passed
21/21. Record-map relationship coverage proves point-like child records come
from the validated action owner data without cloning unrelated or nested
geometry fields.

The first post-SharedPublication guarded 16-item proof stopped correctly on a
293.4-percent raw frontend snapshot. The two renderer-or-worker values were
148.8 and 131.1 percent; WebSocket-server and test-harness work in the same
snapshot totaled only 6.7 percent. The guard stopped before its first completed
canonical heartbeat, but the relay had already accepted all eight progressive
publications, directly locating the overlap in local canonical/property work
and peer browser work rather than backend relay.

Step Execution Card:

- Owner: `apply-canonical-property-scene-batch`.
- Objective: remove the preflight geometry snapshot that copied each
  already-validated action owner value before ordinary property
  materialization while preserving schema, ID, relationship, ordering,
  rollback, and projection semantics.
- Test-first oracle: record-map preflight must not read an unrelated nested
  getter merely to prepare root materialization. The corrected expectation
  failed because the current deep clone read it once.
- Mutation allowlist: `packages/props-manager/src`,
  `packages/props-manager/src/__tests__`, this active plan, the performance
  Inspector, and its contract test.
- Required gates: complete Props Manager, Scene Tree and affected Core focused
  suites, Props Manager build, exact lint, Inspector, `diff --check`, bounded
  review, production setup, and one corrected guarded 16-item proof before any
  high-detail invocation.
- Exclusions: no schema or relationship bypass, fixture-specific path, Factory,
  codec, receiver, relay, remote apply, Render, Contents, Pen Tool, CPU
  threshold, polling, deadline, dependency, recording, or visual-review
  change.
- Stop condition: any correctness or resource stop terminates only that gate
  and begins the next bounded root-cause iteration without ending the task.

The shallow owner-data handoff passed Props Manager 160/160, Scene Tree 62/62,
Core canonical coordination 9/9, Inspector 21/21, Props Manager build, exact
lint, `diff --check`, and bounded review. The corrected guarded 16-item proof
completed Actor A and Actor B at 17/17 canonical and Render elements with
eight/eight ordered publications, one/zero Undo depth, zero failures, and
confirmed teardown. Its maximum raw frontend system value was 196.4 percent,
below the 250-percent limit; operation completed and converged in 5,007
milliseconds.

The next relay-owned 7,076-element invocation stayed below its 500-percent
limits and completed Actor A and Actor B at 7,076/7,076 canonical and Render
elements with 136/136 ordered publications, one/zero Undo depth, zero
publication failures, and 10,055-millisecond convergence. Its observed raw
combined Chromium value was 333.9 percent. That value joined both Actor
contexts from one Chrome process group and is therefore not a valid per-Actor
frontend peak; it remains aggregate observation evidence only. The run then
failed because the terminal
diagnostic reconstructed `loadingFrameVisibleCount` from a retained sample ring
after more than 16,384 later counter samples had evicted that first sample.
The existing exact counter total still retained the event.

Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: make the loading-frame terminal oracle consume the profile's O(1)
  exact accumulated counter total so bounded sample-ring rollover cannot erase
  already-proven evidence.
- Test-first oracle: the Playwright config contract requires
  `readCounterTotal('ai-drawing:loading-frame-visible')`; the current
  snapshot-filter implementation failed that oracle. The performance-profile
  rollover test already proves accumulated totals survive sample eviction.
- Mutation allowlist:
  `apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts`,
  `apps/asyra-design/__tests__/playwright-config.test.mjs`, this active plan,
  the performance Inspector, and its contract test.
- Required gates: complete Playwright config and performance-profile focused
  suites, Inspector, exact lint, `diff --check`, bounded review, production
  setup, one guarded 16-item proof, then one materially corrected final
  7,076-element proof.
- Exclusions: no product action, counter emission, retained-ring size, CPU
  formula or threshold, polling, heartbeat, deadline, workload, codec,
  receiver, remote apply, relay data plane, Render, Contents, Pen Tool,
  dependency, recording, or visual-review change.
- Stop condition: any correctness, resource, or time stop ends only that gate
  and begins the next bounded owner iteration.

The corrected guarded 16-item proof then reached a raw frontend CPU resource
stop at operation start after the relay had already accepted all eight source
publications and before the first canonical progress heartbeat. The preceding
accepted 16-item diagnostics identify
`factory:owner-batch-clone` as a 70.3-millisecond recursive copy of the complete
already-validated geometry graph. Scene Tree combines the Props and Scene
owner events in one new frozen outer array, but that array does not retain the
Reactive Events detached-owner identity, so Factory correctly treats it as
untrusted external input and clones it again.

Step Execution Card:

- Owner: `record-and-deliver-transaction-batch`.
- Objective: preserve the detached identity of the already-immutable canonical
  owner batch when Scene Tree creates its ordered Props-then-Scene outer
  container, so Factory can reuse that exact batch without another recursive
  geometry traversal.
- Test-first oracle: the existing combined canonical handoff test requires the
  exact batch received by the transaction owner to be recognized as a detached
  transaction value. The current unmarked frozen array fails that expectation.
- Mutation allowlist: `packages/reactive-events/src/app/publish.ts`,
  `packages/reactive-events/src/__tests__/transaction-batch.test.ts`,
  `packages/scene-tree/src/sceneTree.ts`,
  `packages/scene-tree/src/__tests__/sceneTree.test.ts`,
  `packages/factory/src/__tests__/factory-batch-regressions.test.ts`, this
  active plan, the performance Inspector and its contract test, plus the
  Reactive Events and Factory package contracts.
- Required gates: complete Reactive Events transaction-batch, Scene Tree,
  affected Factory batch/publication, and Inspector suites; exact package
  builds and lint; `diff --check`; bounded review; production setup; then one
  corrected guarded 16-item proof before any high-detail invocation.
- Exclusions: no external shallow-frozen trust, schema or relationship bypass,
  new history representation, publication shape, codec, receiver, remote
  apply, relay data plane, Render, Contents, Pen Tool, CPU threshold, polling,
  deadline, dependency, recording, or visual-review change.
- Stop condition: any correctness, resource, or time stop ends only that gate
  and begins the next bounded owner iteration without ending the task.

Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: launch Actor A and Actor B in independently registered Chromium
  process groups, retain one raw same-snapshot frontend CPU value and peak for
  each Actor, apply the proof-class frontend limit to each Actor separately,
  and reserve their sum for the distinct aggregate safety limit.
- Test-first oracle: one raw sample with Actor A at 140 percent, Actor B at 140
  percent, and aggregate CPU at 280 percent must pass the 250-percent
  per-Actor frontend gate while reporting both exact Actor values. The current
  combined `client-browser` role incorrectly stops at 280 percent.
- Mutation allowlist:
  `apps/asyra-design/e2e/performance-resource-guard.mjs`,
  `apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts`,
  `apps/asyra-design/playwright.endpoint-performance.config.ts`,
  `apps/asyra-design/__tests__/performance-resource-guard.test.mjs`,
  `apps/asyra-design/__tests__/playwright-config.test.mjs`, this active plan,
  the performance Inspector, and its contract test.
- Required gates: prove the new guard oracle fails first; pass the complete
  focused resource-guard and Playwright-config suites, Inspector contract,
  exact lint, `diff --check`, and bounded review; then rerun one guarded
  two-Actor 16-item proof before any high-detail invocation.
- Exclusions: no workload, prompt, fixture, CPU threshold, sampling cadence,
  deadline, product route, CRDT owner, browser profile, package, Contents, Pen
  Tool, recording, trace, or screenshot change.
- Stop condition: inability to establish two independently attributable
  Chromium process groups invalidates the performance proof and returns to
  this owner; it does not authorize a combined frontend metric or stop the
  overall task.

The per-Actor guard correction passed 73/73 resource-guard tests, 7/7
Playwright-config tests, 21/21 Inspector contract tests, exact lint,
Playwright discovery, and `diff --check`. The formal oracle first failed
because `client-a-browser` and `client-b-browser` were not recognized
independently, then passed with separate sampled process groups, separate Actor
peaks, and one retained aggregate peak. Full App TypeScript checking remains
blocked by pre-existing dirty AI/Common API/Contents errors outside this owner;
the endpoint spec itself loads through the formal Playwright config.

The final bounded guarded 16-item proof launched Actor A and Actor B in
separate Chromium process groups and completed without a resource stop. Actor
A's real raw operating-system frontend peak was 169.0 percent, Actor B's was
125.0 percent, and the overall same-snapshot peak across both browsers, App
server, WebSocket server, and harness was 306.2 percent. Both Actors completed
17/17 canonical and Render elements, Actor A sent eight ordered publications,
Actor B applied all eight with zero failures, history depth remained one/zero,
operation duration was 5,072 milliseconds, convergence was 5,010
milliseconds, and all five tracked process groups terminated exactly. The
earlier 284.9-percent combined-browser stop is invalid as a per-client
frontend decision and must not be used as endpoint evidence.

The following 7,076 checkpoint stopped before the AI request with both Actors
at zero elements and zero publications. Each browser stayed below its
500-percent per-Actor limit, but the two independently launched Chrome
bootstrap workloads overlapped at a real 578.4-percent overall snapshot. The
guard correctly stopped and terminated every tracked group. This is a harness
bootstrap sequencing failure, not product execution evidence.

Revised Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: create, navigate, and settle Actor A's independent Chromium
  process group across two fresh raw settled samples before the Actor B browser
  is launched; then create, navigate, and settle Actor B across two fresh raw
  settled samples before the guard-ready heartbeat, using fresh raw guard
  samples rather than a fixed sleep.
- Test-first oracle: a bounded guard status reports settled only when the
  required Actor browser roles are present in a fresh sample and both the
  per-Actor values and real overall value are at or below the ordinary
  80-percent idle baseline; missing Actor B or a 90-percent overall sample is
  not settled.
- Mutation allowlist: the existing `evaluate-endpoint-performance` guard,
  endpoint spec, Playwright-config test, resource-guard test, active plan,
  Inspector, Inspector contract, and BDD files.
- Required gates: focused guard/config/Inspector suites, exact lint,
  `diff --check`, one guarded 16-item proof, then one corrected 7,076
  checkpoint.
- Exclusions: no CPU limit, workload, product action, CRDT owner, App runtime,
  sampling formula, fixed startup delay, deadline, dependency, Contents, Pen
  Tool, media, trace, or recording change.
- Stop condition: any raw limit still stops the exact action; the task returns
  here with the first bootstrap phase and does not weaken the guard.

The serialized-bootstrap implementation passed its focused guard, Playwright
config, and Inspector suites, exact lint, Playwright discovery, `diff --check`,
bounded review, and guarded 16-item proof. The 16-item proof completed both
Actors at 17/17 canonical and Render elements with eight/eight publications,
one/zero Undo depth, zero failures, 5,005-millisecond convergence, and
5,090-millisecond operation time. The same raw snapshot at its aggregate peak
reported Actor A at 144.4 percent, Actor B at 138.8 percent, and all tracked
frontend, backend, and harness processes at 292.8 percent.

The resulting 7,076 root-cause run no longer overlapped browser bootstrap and
stayed below every 500-percent limit. Actor A's independent browser peak was
367.5 percent, Actor B's was 298.6 percent, and the real overall peak was
435.4 percent. Both Actors reached 7,076/7,076 canonical and Render elements,
136/136 publications, one/zero Undo depth, zero publication failures, first
visible at the 5,023-millisecond heartbeat, and complete at the
10,035-millisecond heartbeat. A post-product Playwright assertion then failed
without a guard stop. The bounded command projection mistakenly omitted the
already-retained failure payload, so this invocation is not accepted as the
formal endpoint proof and its missing assertion must not be guessed.

Root-cause capture iteration:

- Owner: `evaluate-endpoint-performance`.
- Objective: recover the exact already-formal post-product assertion and its
  bounded failure evidence without changing the product, workload, limits,
  sampling, timing, or correctness oracle.
- Inputs and outputs: reuse the unchanged guarded endpoint and emit only the
  existing bounded failure, Actor A/B state, per-Actor raw peaks, overall raw
  peak, endpoint report, and confirmed teardown fields.
- Authorization: the product owner's standing stop-condition instruction
  explicitly requires root-cause iteration and re-execution rather than ending
  the task. This permits one replacement root-cause invocation; it is not a
  warm-up, accepted proof, or evidence that can hide the first failure.
- Required gates: the preceding focused suites, bounded review, and guarded
  16-item proof remain valid because no implementation changed. The replacement
  command must include the exact failure field and must not start another run
  until that failure selects a revised owner.
- Exclusions: no implementation, oracle, threshold, deadline, workload,
  browser topology, CPU formula, CRDT, Render, Contents, Pen Tool, dependency,
  media, trace, profile, or recording change.
- Stop condition: capture the exact first failure, terminate every tracked
  group, and return immediately to a revised Step Execution Card before any
  further 7,076 invocation.

The replacement root-cause invocation stopped correctly before canonical
progress on a 580.1-percent real overall snapshot. Actor A's independent
browser was 297.4 percent, Actor B's was 260.4 percent, the App server was
zero, the WebSocket server was 7.6 percent, and the test harness was 14.7
percent. The two hot renderer processes were 287.8 and 253.9 percent. Neither
Actor crossed its independent 500-percent limit, but their simultaneous
frontend work correctly crossed the overall 500-percent safety limit. Every
tracked process group terminated exactly.

The accepted 16-item proof supplies the bounded comparison: its point-heavy
source formed eight narrow publications for 16 children and peaked at Actor A
144.4 percent, Actor B 138.8 percent, and 292.8 percent overall. The
7,076-element source formed 136 publications for 7,075 children, averaging
about 52 children per publication. Actor A's next local canonical slice
therefore overlaps Actor B's preceding remote publication apply in two
independent renderer processes. The differential selects the element-count
work-unit width at `stage-local-interactive-composition`; backend relay and
harness work are not the first incorrect owner.

Revised Step Execution Card:

- Owner: `stage-local-interactive-composition`.
- Objective: reduce the fixed prepared composition element-count work-unit
  cap from 64 to 32 while retaining the fixed 2,048-point budget, so the same
  source publication boundary reduces both Actor A local and Actor B remote
  renderer/Worker bursts without merging clients, suppressing peer visibility,
  or changing the bulk action.
- Test-first oracle: the formal server-response harness and Inspector contract
  must require exactly 32 elements at most per prepared work unit. The current
  64-element constant and Inspector conditions must fail first.
- Inputs and outputs: preserve the same server-prepared
  `PreparedDrawingArtifact`, flat canonical descriptors, exact IDs/order/
  geometry, one serialized paint-yield loop, one outer transaction, one Undo,
  ordered progressive `SharedPublication` records, and exact remote apply.
- Mutation allowlist:
  `apps/asyra-design/src/ai/prepared-drawing-artifact.ts`,
  `apps/asyra-design/test-data/ai-drawing/server-response-inbox.test.ts`,
  this active plan, the performance Inspector and its contract test, the
  performance BDD, and `docs/ai/apps/asyra-design/API_SURFACES.md`.
- Required gates: prove the focused harness and Inspector oracles fail first;
  pass the complete server-response harness, affected AI composition tests,
  Inspector, exact lint, `diff --check`, and bounded review; then one guarded
  16-item proof. Only after that materially narrower source boundary passes may
  one replacement 7,076 proof run.
- Exclusions: no point budget, prepared geometry, validation, clone, Factory
  history, publication shape, codec, receiver, remote apply, relay, Render,
  CPU limit/formula/cadence, deadline, Contents, Pen Tool, template, package,
  dependency, media, trace, profile, or recording change.
- Stop condition: any correctness, resource, or time stop ends only that gate,
  selects the first direct owner, and begins another bounded iteration without
  weakening the limits or ending the task.

The 32-element source boundary passed the server-response harness 5/5,
composition and prepared-consumer suites 35/35, Inspector 21/21, exact lint,
`diff --check`, and bounded review. Its guarded 16-item proof completed both
Actors at 17/17 canonical and Render elements with eight/eight publications,
one/zero Undo depth, zero failures, 5,064-millisecond operation time, and
5,006-millisecond convergence. Actor A's independent browser peak was 167.7
percent, Actor B's was 136.5 percent, the real overall peak was 281.9 percent,
and all five tracked groups terminated exactly. The materially narrower
7,076-element replacement is now permitted once.

The first replacement used an older 01:38 attested response overlay rather
than the newly changed source constant. Its manifest still reported 136
slices, a 64-element maximum, and 107 slices above 32 elements, so its
476.9-percent overall result is not evidence for the 32-element boundary and
must not be used as improvement proof. It nevertheless stayed below every CPU
limit and completed both Actors at 7,076/7,076 with 136/136 publications,
one/zero Undo depth, and zero publication failures.

That run exposed the next formal oracle bug after product completion:
`cooperativeYieldCount` retained the exact 136 total while the bounded counter
ring retained only the last 77 visible-element samples. Comparing an exact
total with a bounded sample-array length failed as Expected 77 / Received 136.
The exact local-sent publication count was also 136 and is the correct
independent equality for one publication per successful source work unit.

Revised Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: compare exact cooperative-yield total with exact Actor A
  local-sent publication total, never with bounded retained sample length, and
  require explicit production setup plus manifest attestation before evaluating
  the new 32-element source boundary.
- Test-first oracle: the Playwright config contract requires
  `drawingProgress.cooperativeYieldCount` to equal
  `completed.publications.actorALocalSent` and forbids equality with
  `drawingProgress.visibleElementSampleCount`. The current high-detail oracle
  must fail first.
- Mutation allowlist:
  `apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts`,
  `apps/asyra-design/__tests__/playwright-config.test.mjs`, this active plan,
  the performance Inspector and its contract test only if their oracle is
  incomplete.
- Required gates: fail then pass the focused Playwright config oracle; pass
  guard/config, Inspector, exact lint, `diff --check`, and bounded review;
  execute `prepare:e2e:endpoint-performance`; prove the 7,075-child manifest
  has no slice above 32; run one guarded 16-item proof, then one materially
  corrected 7,076 proof.
- Exclusions: no product constant, point budget, geometry, counter emission,
  retained-ring capacity, transaction, publication shape, CPU limit/formula/
  cadence, deadline, codec, receiver, remote apply, relay, Render, Contents,
  Pen Tool, dependency, media, trace, profile, or recording change.
- Stop condition: any setup, correctness, resource, or time failure selects
  its direct owner and begins another bounded iteration; no stale artifact or
  bounded sample count can be accepted as exact evidence.

Explicit production setup rebuilt and attested the response overlay. The
7,075-child manifest now contains 239 slices, no slice above 32 elements, and
no stale 64-element range. The setup-backed guarded 16-item proof completed
17/17 canonical and Render elements with eight/eight publications, one/zero
Undo depth, zero failures, 5,070-millisecond operation time, and
5,010-millisecond convergence. Actor A's peak was 135.6 percent, Actor B's was
135.2 percent, the real overall peak was 267.3 percent, and exact teardown
completed. One 32-element 7,076 proof is now permitted.

The first setup-attested 32-element proof stayed below every 500-percent raw
limit and completed Actor A and Actor B at 7,076/7,076 canonical and Render
elements with 239/239 ordered publications, one/zero Undo depth, zero
publication failures, 5,026-millisecond first visibility, and
10,036-millisecond completion. Actor A's independent browser peak was 287.5
percent, Actor B's was 286.5 percent, and the real overall peak was 436.3
percent. The proof was not accepted because one post-product assertion compared
97 retained canonical phase samples with 139 retained visible-element counter
samples. Both are bounded-ring contents rather than exact totals, so their
lengths may diverge after unrelated Render and transport samples roll over the
two rings.

Root-cause Step Execution Card:

- Owner: `evaluate-endpoint-performance`.
- Objective: retain an O(1) exact phase count for
  `ai-app:create-composition-batch`, compare it with the exact Actor A
  local-sent publication count, and keep retained phase/counter arrays only for
  bounded timing and milestone evidence.
- Inputs and outputs: preserve the existing phase sink, bounded snapshots,
  exact publication count, longest retained canonical work-unit duration, and
  endpoint report; add no product event, canonical traversal, CPU conversion,
  or unbounded evidence.
- Test-first oracles: the performance-profile rollover test requires the exact
  phase count after its named sample has left the retained phase ring; the
  Playwright config test requires the endpoint to use that query and forbids
  canonical-work-unit equality with retained visible-sample length. Both
  oracles failed on the current implementation before production changes.
- Mutation allowlist:
  `apps/asyra-design/src/init/performance/ai-drawing-performance-profile.ts`,
  its focused test,
  `apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts`,
  `apps/asyra-design/__tests__/playwright-config.test.mjs`, this active plan,
  the performance Inspector, and its contract test.
- Required gates: pass both focused oracles, Inspector contract, exact lint,
  `diff --check`, bounded review, explicit production setup, and one guarded
  16-item proof before one root-cause replacement 7,076 proof.
- Exclusions: no action, geometry, slice, publication, codec, receiver, remote
  apply, relay, Render, Contents, Pen Tool, CPU limit/formula/cadence, deadline,
  dependency, media, trace, profile capture, or recording change.
- Stop condition: any focused, correctness, resource, or time failure remains
  owned here and starts another bounded iteration without weakening a gate.

The root-cause replacement proof passed after the exact-count change. Actor A
and Actor B each reached 7,076/7,076 canonical and Render elements with
239/239 ordered publications, one/zero Undo depth, and zero publication
failures. Both Actors became first-visible at 5,017 milliseconds and completed
and converged at 10,026 milliseconds; the complete endpoint report took 14,277
milliseconds. The exact canonical work-unit count and Actor A local-sent count
were both 239. Actor A's independent browser peak was 296.4 percent, Actor B's
was 308.5 percent, and the real aggregate peak was 458.4 percent, below the
named 7,076 proof's 500-percent raw limit. The guard did not stop, all five
tracked process groups terminated exactly, and the Playwright invocation
reported one passing test in 26.1 seconds.

## Current Local Gates

The accepted single-Actor path retains the exact loading bounds, cooperative
plural-batch composition, one outer transaction, one Undo action, and
responsive pan/zoom behavior already proven by the current local formal tests.
Endpoint work must not regress those gates. The guarded two-Actor benchmark
proves those Actor A behaviors in the same creation used for peer convergence
and reports WebSocket-server work separately; no duplicate high-detail local
benchmark runs.

## Endpoint Proof Gates

- Guard: a pure decision test proves the CPU, stale-heartbeat, stalled-progress,
  tracked-process termination, and last-heartbeat report behavior without
  starting a browser.
- Benchmark: one creation-only integration case proves the heartbeat uses O(1)
  counts, reports both actors, excludes persistence/media/follow-ups, and
  closes all owned processes.
- Source canonical: exact N-to-one Props/Scene evidence counts, later-invalid
  no-prefix behavior, exact IDs/order/relations, and one Undo.
- Factory/pub-sub: one existing action journal and Undo entry, one ordered
  shared view, one batch observer registry snapshot, no parallel AI/bulk
  history artifact, no synonymous flattened payload graph, and exact
  rollback/Undo/Redo.
- Receiver: frame acceptance remains Worker-owned; `frame-consumed` releases
  exact retained-window capacity before App apply and never fabricates capacity
  for a still-queued publication. Bounded bytes and one active decoded
  publication survive slow consumer, terminal failure, disconnect, and
  teardown.
- Remote: one policy pass, one Core request, one remote transaction, no
  quadratic batch/slice scan, Undo, echo, capture, save, or document IndexedDB
  work.
- Relay: byte parity, exact queue capacity, FIFO retirement, control fast path,
  and distinct server-admitted/frame-consumed/peer-applied receipts.
- Codec: exact binary round-trip and worker-only payload validation/ownership
  with invalid, truncated, duplicate, and oversized evidence.
- Projection: batch subscriber and local computed projection counts precede
  ordinary Render/UI counts; full detail remains editable.
- Effectiveness: every owner proof reports the changed owner metric, A complete,
  B first-visible, B complete/converged, adjacent critical owners, and resource
  guard status against the immediately preceding accepted baseline.

## Step-Local Gates

- Contract: exact owners, graph routes, artifacts, allowlists, failure owners,
  plan anchors, and BDD scenarios.
- Server response inbox: required `fileId` selects exactly one versioned 16-,
  320-, 1,280-, or 7,075-child response from the harness-owned response inbox;
  preload completes before App/Agent readiness and the stable baseline; the
  product request performs zero response-inbox/fixture
  import/parse/materialization; the provider calls `requestActionBatch()` once;
  the canonical document remains empty before the request; and exact detail is
  unchanged.
- AI action batch resolution: exact `batchId`, complete envelope resolution,
  `ResolvedAiActionBatch` identity through `PermissionReadyAiActionBatch` and
  execution, bounded `AiActionBatchPreview` with no geometry, later-invalid
  no-prefix behavior, and exact 16/320/1,280 item, role, order, bounds, and
  point-count equivalence.
- Contents: real 100+ row virtualizer unit/integration case, tail scrolling,
  bounded DOM rows, collapse, and selection.
- Factory: one existing journal-backed history action, one separate minimal
  transport publication hierarchy, full Undo/Redo, no transaction-end
  resending of cooperative slices, precise compensation, and observer
  isolation.
- Props/Scene Tree: later-invalid no-prefix behavior, exact IDs/order/
  relationships/instances, lifecycle-aware create/remove/restore selection,
  retained Scene-then-Props replay, and batch-of-one parity.
- App/Core: deterministic cooperative plural requests,
  point-and-element-count boundaries, cancellation, partial results, and fatal
  rollback.
- Projection: one flush per canonical publication batch and each formal
  cooperative slice, exact 7,076 ordinary Vector projection, and bounded UI
  updates.
- Codec/relay: binary round-trip, invalid/truncated/duplicate rejection,
  oversized single record or active publication assembly, one read-only active
  decoded publication, bounded multi-frame ingress and peer-egress windows, opaque
  byte parity, slow peer, disconnect, and ordered receipts.
- Remote: one publication transaction and one batch observer call, with no
  Undo, echo, capture, save, or document IndexedDB write.
- Demo startup: ordinary local and collaboration sessions load one empty
  canonical document and never configure client persistence.

Each owner step runs focused unit and integration gates first. A guarded
7,076-element creation-only proof runs only at the explicitly named complete
local source, relay, and final closure checkpoints, never after codec, receiver,
or remote apply individually. After an invalid high-detail attempt consumes the
available test budget, any replacement invocation requires explicit
product-owner approval. The full multi-turn high-detail suite is not repeated
after every step.

## Final Gates

After all architecture owners are complete, run one heavy closure:

1. Inspector contract, all affected package unit/integration tests, Asyra
   Design full local tests, lint, and production build.
2. Default 16-item server-response AI CRDT correctness.
3. One 7,112-element balanced correctness run because canonical and transport
   paths changed.
4. After explicit product-owner approval, one final invocation of the same
   guarded two-Actor 7,076-element endpoint proof, reporting product execution,
   artifact, encode, server queue/drain, worker decode, remote apply, Render,
   UI, and harness overhead.
5. Maximum-detail 27,471-element and 295,794-point gate.
6. `app-visual-review-sync` from the same measured live App state, with direct
   inspection of complete, uncropped Actor A and Actor B output, Styles, IDs,
   and hierarchy.
7. The 7,076-element two-window full recording only with explicit user opt-in.

Generated media, recordings, screenshots, traces, profiles, and thumbnails are
never committed.

## Definition of Done

- Every Step-local gate passes before its owner step advances.
- Every endpoint has one accepted guarded 16-item proof. The named complete
  local-source, relay, and final checkpoints each have their explicitly
  approved guarded 7,076-element creation proof; no codec, receiver, or remote
  apply step creates an additional high-detail proof.
- An owner below five percent of product time has direct owned evidence and
  remains intentionally unchanged.
- No endpoint exceeds five architecture attempts, and no resource-aborted or
  otherwise ineffective attempt is committed.
- The final formal unit, integration, E2E, CRDT, performance, lint, build, and
  Inspector gates pass.
- Every performance server response is selected by required `fileId`, resident
  before App/Agent readiness, and handed off as one `AiActionBatch` without
  request-time fixture I/O or materialization; response inbox reads remain
  separately reported harness overhead and the deterministic harness code is
  absent from the production bundle.
- The production build and ignored response overlay pass independent
  pre-Playwright attestations; no prepared response object crosses the
  Playwright process boundary, and canonical production `dist` remains free of
  response fixtures.
- Bulk APIs delegate singles to batch-of-one and preserve canonical evidence.
- The existing Factory journal and Undo stack serve local action history;
  Render/UI consumes ordinary canonical owner projection, and no AI/bulk
  forward/inverse artifact, applied-result mirror, post-action save/equality
  pass, or evidence clone exists. One separate minimal transport wire artifact
  serves Collaboration without `inverseEvents`, History evidence, rollback
  evidence, or payload aliases.
- Peer queues remain byte-bounded and exact publication order converges.
- Actor B has no Undo or echo side effects; Actor A and Actor B both have zero
  client persistence side effects.
- Existing performance budgets pass without lowering detail or weakening
  canonical, history, cooperative visibility, or publication semantics.
- The synchronized visual review passes from the same measured live App state.
- The plan remains active until the product owner explicitly accepts closure.

## Assumptions and Exclusions

- PR #101 and the current feature branch/local commits remain the recovery
  basis; do not recreate the branch or reset accepted work.
- Live network endpoint and API-key testing for the server-backed provider is
  outside this plan.
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
- the resource guard crosses its CPU, heartbeat, or stalled-progress limit; in
  that case all tracked test processes are stopped before any further command
  and the last phase plus Actor A/B counts are reported;
- an optimization changes IDs, ordering, detail, Undo/Redo,
  progressive visibility, partial result, rollback, or failure behavior;
- a required file falls outside the active step allowlist;
- existing platform capability would require an unapproved dependency or tool
  upgrade;
- the same focused gate fails three times;
- one endpoint reaches five materially different architecture attempts without
  an effective guarded proof.

If the final heavy gate fails, report only the first over-budget or incorrect
owner with evidence. Do not resume a local patch-and-tune loop.
