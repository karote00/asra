# Asyra Design Conversational AI Drawing Performance Plan

## Status

Active Level 3 endpoint-ordered app performance closure. PR #101 is merged and
the existing
`codex/asyra-design-ai-conversational-drawing-performance` branch remains the
implementation base. Production implementation and formal validation continue
one Inspector owner step at a time, and every completed performance endpoint is
followed first by one guarded 16-item safety proof and then by one guarded
high-detail proof before another endpoint may advance.

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
whose selected document session always starts Collaboration. Contents remains
excluded by product direction.

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
independently and cannot borrow a later endpoint's expected improvement.
Contents and production persistence remain excluded.

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
required low-load checkpoint before the one guarded high-detail proof.

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
not build through the performance guard. The product owner's explicit
200-percent limit begins with the authenticated App runtime, while product
operation timing begins only at Actor A request submission.

The corrected 200-percent proof then stopped 1.281 seconds after the exact
creation request when aggregate test-owned CPU reached 210.5 percent. The
client-browser process group contributed 206 percent, while the App preview,
WebSocket server, and harness contributed approximately 1.9, 1.1, and 1.5
percent. Both Actors still reported one canonical element, zero Render
projection elements, and zero publications. That one canonical element is the
empty document Workspace created during Scene Tree initialization; Workspace
is deliberately absent from ordinary Render. It is not evidence that the AI
Group or first children batch was created.

The guard samples process CPU every 250 milliseconds, while the App heartbeat
can be delayed by a busy renderer and currently reports only the latest
completed owner phase. The 210.5-percent CPU sample and the retained Actor
counts are therefore not a co-temporal snapshot. The latest completed phase was
`ai-app:prepare-composition-slices`; no later phase had completed when the last
heartbeat was captured. This does not prove which phase was active when the
later CPU sample crossed the limit, and therefore does not yet exclude Group,
Core, publication, remote apply, or Render ownership. The first unresolved
interval begins after the last completed slice-preparation phase and ends at
the first phase-start/phase-end evidence captured around the guard stop.

On macOS, `ps %cpu` is a decaying average over as much as approximately one
minute rather than the CPU used during the guard's latest 250-millisecond
period. Reading it every 250 milliseconds does not turn it into an interval
measurement. A young Chromium process can therefore retain bootstrap, JIT,
navigation, compositor, or GPU work in a later sample. Summing the root browser,
renderer-or-worker, GPU, utility, and other browser values remains correct for host protection,
but the decayed value cannot be interpreted as the CPU consumed during that
specific sample window.

The corrected guard establishes two cumulative `ps time=` samples for one exact,
stable PID set and computes each 250-millisecond interval as total process CPU
time delta divided by monotonic wall-time delta. One interval above 200 percent
still stops the exact owned process groups immediately; the limit is not raised,
averaged away, or made dependent on consecutive failures. Before the stable
baseline exists, a decayed sample above 200 percent still fails closed as a
bootstrap overload. After baseline, the decayed value is retained only as a
diagnostic. Browser subprocess classes remain visible separately and all remain
inside the aggregate; a Web Worker hosted by a renderer is not falsely reported
as its own OS process.

Periodic and phase-boundary sampling share one serialized OS-sample and
state-consumption queue. No overlapping `ps` calls or out-of-order state update
may form an interval. A fixed 375-millisecond sample-gap ceiling fails closed
when sampling is delayed beyond the bounded observation window; it never
accepts a longer average that could hide a shorter unobserved spike.

Production build commands run only as separate setup outside the runtime guard
and product timing. Artifact attestation must succeed before Playwright may
start. Each runtime invocation then owns exactly one production preview and one
WebSocket server. It verifies that the intended ports had no pre-existing
listener, starts no Vite development server, and has no HMR path. Bootstrap
before guard-ready is safety-only: legal process registration or identity churn
resets the candidate baseline and is never attributed to a product owner. After
the App, Collaboration, and Agent UI settle, the harness resolves the prompt
field and submit control, performs prompt fill and actionability outside the
product boundary, and then takes one fresh stable pair that freezes the exact
request PID set. App-owned request acceptance or dispatch starts
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
5. If corrected interval CPU crosses 200 percent, terminate first and perform
   the required bounded replan. That replan may authorize the same 16-item case
   once with reduced motion. A material reduction with an equivalent
   `AiActionBatch` and
   canonical evidence assigns the first owner to loading/compositor work; no
   material reduction returns attribution to the remaining measured browser
   owners rather than guessing provider ownership.
6. If the 16-item case stays below 200 percent, run one guarded production
   single-Actor 1,280-item cat-prefix case. It preserves the same source and
   ordinary Vector route while increasing Runtime batch resolution, preview,
   and canonical work.
7. Only if the single-Actor 1,280-item result cannot distinguish Actor A and
   client-to-server work from peer relay or Actor B remote apply may one
   two-Actor 1,280-item case run.

These attribution cases report response inbox adapter seed, read, structured
clone, and handoff as separate external-backend/transport-adapter timing. That
timing remains recorded but is excluded from frontend product execution and
cannot affect Runtime, Render, or CRDT effectiveness. The cases then report an
ordered browser-monotonic product timeline for provider request/batch handoff,
Runtime batch resolution, `AiActionBatchPreview` projection, loading
evidence, Group, and plural children-batch work. One
request-wide cumulative process CPU-time boundary reports the harness, browser,
App, and optional server CPU-time deltas without pretending to retrospectively
split OS CPU among nested JavaScript spans. Every boundary snapshot also passes
through the same 200-percent safety evaluator as the 250-millisecond sampler.
Every boundary and 250-millisecond safety snapshot compares the same PID and
role identities. Any observed process identity change makes attribution invalid
rather than undercounted. An unobserved sub-interval helper shorter than the
sampling cadence cannot be reconstructed from `ps`, so request-wide OS CPU is
corroborating evidence and is never the sole owner-attribution signal. Each
safety sample retains its own heartbeat age and never turns a stale
latest-completed phase into an active-owner claim.

Local attribution uses an explicit `local-attribution` proof kind. It requires
only Actor A exact completion and carries no Actor B report; it must never
manufacture a zero-item completed peer or be accepted as an endpoint baseline.
The two-Actor 16-item activity diagnostic uses
`collaboration-attribution`; it requires exact completion from both Actors but
remains attribution evidence, not an accepted endpoint proof.
The pipeline fixes one required proof kind for the entire guarded invocation;
an endpoint, local-attribution, or collaboration-attribution run cannot switch
category in a later heartbeat.
The cases retain the 200-percent stop and terminate the exact test-owned process
groups. They never count as a 7,076 architecture attempt and cannot establish
product equivalence. The resulting attribution artifact routes to exactly one
owner contract—server response bootstrap/request-boundary contamination,
Runtime batch resolution,
App loading paint, local canonical composition, or receiver/collaboration
admission. Only that selected owner receives one complete architecture replan,
focused formal tests, and one implementation. Only then may the guarded 7,076
proof run again.

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

A second equivalent run was stopped when the old decayed signal reported
207.7 percent aggregate and 205.5 percent for the browser. Its last one-second
heartbeat retained 5/17 elements and first-visible at 1.078 seconds. This
decayed value is not a 250-millisecond CPU measurement, so it cannot establish
that the product consumed 207.7 percent during the stop interval, cannot select
a product owner, and does not consume an architecture attempt. It remains a
valid conservative stop: the guard terminated and verified the exact browser,
App, WebSocket, and harness process groups before returning.

The mismatch between the completed request-wide average and the later decayed
sample selects the guard measurement contract, not a speculative product patch.
After the interval guard and exact PID-set equality tests pass, one fresh
always-on 16-item run is the next permitted browser proof. No 1,280-item or
7,000-plus run is permitted until that corrected small proof stays within the
200-percent interval limit and reports a usable first-owner timeline.

### 2026-07-30 measured-window contamination and renderer split

The next fresh single-Actor 16-item run produced one valid
251.287-millisecond safety interval at 234.791 percent aggregate CPU. The
browser contributed the full interval, with the coarse `renderer-or-worker`
bucket at 218.873 percent, GPU at 11.939 percent, and root browser at 3.980
percent; App preview, WebSocket server, and the Node harness reported zero CPU
in that exact interval. The guard correctly terminated every owned process
group, so this remains a valid safety stop.

It is invalid for product-owner selection. `local-request` began before the
harness called the superseded `submitMockTurn(...)` helper, which still performed prompt
fill, locator resolution, actionability, click dispatch, loading visibility,
article-count, text, and attribute polling. Playwright causes several of those
operations inside the Browser process, so a zero Node-harness contribution
does not remove harness-induced Browser process work. The last heartbeat also
preceded the CPU sample and retained 0/17 elements; it is not co-temporal
evidence that canonical work had not begun.

The next run keeps the same 200-percent guard but corrects the measurement
contract before changing production. Prompt fill, locator resolution, and
actionability complete outside the product boundary. App-owned request
acceptance or dispatch starts `local-request`; no Playwright polling occurs
until an O(1) App completion signal ends product timing, after which UI
correctness assertions resume.

Browser attribution also stops collapsing every Chrome renderer into one
semantic owner. The guard retains each renderer PID's 250-millisecond CPU
delta. Actor A page-target CDP reports `TaskDuration`, `ScriptDuration`,
`LayoutDuration`, and `RecalcStyleDuration`; CDP-visible worker targets are
reported independently. CPU that remains inside a renderer process but is not
explained by page-target or visible-worker evidence is reported as residual
renderer cost, not guessed to be main-thread, Worker, raster, or compositor
ownership. GPU remains a separate process class and every subprocess remains
inside the 200-percent aggregate.

Static inspection also retains a separate downstream finding for the next
owner boundary: after first visible, each progressive slice currently performs
growing UI hierarchy reconstruction, Render parent-membership validation,
canonical snapshot seeding, and a possible retained-scene frame. This finding
does not expand the active Runtime implementation segment. After the Runtime
focused gates, one fresh guarded 1,280-item run must show the owned
pre-first-visible work improved by at least 15 percent without crossing the
200-percent safety limit. If the run still stops only after first visible, the
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

After that historical delay, one valid 252.599-millisecond interval crossed the fixed
limit at 221.695 percent aggregate CPU. One renderer PID contributed 201.901
percent, the second renderer PID contributed zero, GPU contributed 7.918
percent, and App preview, WebSocket server, and harness each contributed 3.959
percent. The guard terminated and verified every owned process group. At the
stop Actor A remained at 0/17 canonical elements, 0/17 Render projection
elements, zero Factory publications, and no completed canonical Group.

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

The next browser proof is the same guarded 16-item case. It must complete below
the fixed 200-percent host limit with exact canonical, Render, transaction, and
History evidence before any guarded 7,076-element proof is permitted.

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
   IDs, relationships, topology, bounds, styles, and formal slice ranges. The
   frontend builds no duplicate point-object or topology graph and performs no
   model validation, bounds calculation, or normalization.
2. Core builds one owner-to-relationship index before element creation.
3. Props performs one owner-indexed relationship traversal, one fixed batch
   materialization boundary, and one manager-owned affected-owner
   notification. It retains every property instance but creates no per-edge
   subscriptions and no per-record clone/save/equality boundary.
4. Scene Tree applies one map/parent boundary. Local `Computed` data projects
   from the same owner artifact and never enters shared data or CRDT.
5. Factory accepts the owner-issued rich local history artifact without
   rescanning its tree, derives the canonical inverse once, and sends that
   artifact to History and local projection. The shared-data boundary derives
   one separate transport wire artifact containing only one remote-apply
   payload, ordered IDs, and publication metadata.
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
3. **Factory local history and transport wire artifacts** — Factory phases were
   approximately 3.909 seconds. One rich immutable local artifact retains
   inverses and History evidence, while one separate transport wire artifact
   contains only one remote-apply payload, ordered IDs, and publication
   metadata without aliases.
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

Local-only and collaboration owners are judged by the same two-Actor
7,076-element creation-only benchmark; the Actor A side is also the local
interaction proof. A benchmark failure caused by its own obsolete assertion or
harness overhead is a benchmark defect, not evidence against a production
endpoint.

### Host Resource Guard

Production build commands are a separate setup step and never run inside the
project-owned runtime guard. Before Playwright starts, the pipeline attests that
the existing production App artifact embeds the required collaboration
endpoint. No 7,000-plus runtime benchmark may start without that attestation and
the project-owned guard. Before the AI request, the test sends an authenticated
`ready` heartbeat and waits until the guard confirms ownership and active CPU
sampling for the fixed
`test-harness`, `client-browser`, `app-server`, and `websocket-server` roles. A
missing or rejected registration or handshake prevents the request from
starting. Each invocation proves that its ports were free, then owns one
production preview and one WebSocket server; Vite development mode, HMR, and
pre-existing listeners are forbidden. The guard samples only these exact
test-owned process groups. Its aggregate includes every Chromium root,
renderer, GPU, utility, and other browser process. The report retains each
renderer PID's interval CPU delta as well as role breakdowns so browser App
work, local preview overhead, WebSocket server work, and test-harness overhead
are not attributed to one another. Page-target CDP reports main-thread task,
script, layout, and style-recalculation deltas; CDP-visible workers are named
separately; the remaining unexplained renderer contribution stays residual
rather than being guessed as a page or Worker owner. The benchmark sends one
bounded heartbeat without walking or hashing the canonical graph.

The immediate first sample records identities and cumulative CPU time. A second
sample with the same exact PID set establishes the interval baseline; later
samples run at most 250 milliseconds apart and calculate
`sum(cpuTimeDelta) / monotonicWallTimeDelta * 100`. The product request cannot
start before this stable baseline exists. Before baseline, the macOS decayed
value may only fail closed as bootstrap overload. After baseline it remains
diagnostic and cannot replace interval CPU. Periodic and phase-boundary
requests use the same serialized sample queue; a gap above 375 milliseconds
fails closed.

The fixed limits cannot be relaxed through runner configuration:

- any single aggregate test-owned process-tree interval above 200 percent CPU,
  which stops the benchmark immediately and marks that architecture attempt
  invalid;
- no heartbeat for 10 seconds while the process tree remains above the ordinary
  80 percent baseline;
  or
- no Actor A/B canonical progress for 20 seconds while the process tree remains
  above the ordinary 80 percent baseline.

Crossing a limit is a failed refactor architecture attempt, not a slow pass or a
benchmark warning. The guard sends termination to the fixed tracked
client-browser, App server, WebSocket server, and Playwright harness process
groups, waits at most three seconds, then force terminates only surviving
tracked test processes. It must report the last completed phase, Actor A and
Actor B element counts, publication progress, aggregate and separate role CPU
samples, and last owner timing. If exact process ownership or the heartbeat
cannot be established, the benchmark refuses to start rather than running
unguarded.

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
outside product timing, and a fresh stable pair freezes request identity.
App-owned request acceptance or dispatch then starts `local-request`, which
retains interval maximum and cumulative average CPU. No Playwright polling runs
inside that interval; an O(1) App completion signal closes it before UI
assertions resume.

### Endpoint Iteration and Effectiveness

Each endpoint uses this fixed loop:

1. replace the endpoint with one complete owner architecture rather than a
   parameter tweak, cache guess, fixture branch, or downstream patch;
2. pass focused formal tests and bounded review;
3. run one guarded 7,000-plus creation proof immediately;
4. accept the endpoint only when exact product equivalence holds and either its
   failing budget becomes green or its owned structural/span/queue metric
   improves by at least 15 percent without making an adjacent critical owner
   more than 15 percent worse;
5. if the result is ineffective, replace that endpoint's plan from the first
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

An endpoint has at most five architecture attempts. The project hard stop still
applies earlier when the same focused failure occurs three times, the host
resource guard fires, or exact canonical/history equivalence is lost. Only an
effective endpoint may receive a local commit and establish the next endpoint's
baseline. No ineffective attempt is committed.

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
→ FactoryMutationBatchArtifact
   ├─ one Undo/Redo journal action
   ├─ Preset/Render/UI projection
   └─ rollback compensation from local inverse evidence
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
  topology, bounds, styles, and formal slice ranges.
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
  topology graph in the frontend batch.
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
  paths, points, stable IDs, relationships, and topology and builds one
  `PreparedDrawingArtifact` containing flat canonical element/property batches
  before returning the `AiActionBatch`.
- The frontend submits each already-prepared slice range through the existing
  `Core.createElementsInParentFromCanonicalData(...)` route after the
  server-prepared loading bounds are visible. It performs no item, path, point,
  style, bounds, role, model semantic, or topology validation; no
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
- AI composition creates one Group through that canonical-data surface, crosses
  one browser paint opportunity after the Group, and only then submits
  deterministic ordered child ranges through the same route. Each range uses
  one fixed 2,048-point budget and a 64-element work-unit cap so thousands of
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
  their framework semantics. Core first builds one owner-to-relationship index
  instead of filtering the complete relation set for every element.
- Props Manager performs one whole-batch schema, ID, and relationship preflight,
  one owner-indexed traversal for child-first order, forward/reverse indexes,
  and owner ranges, then one fixed batch materialization and `registerMany`.
  Materialization performs no per-record structured clone, `.save()`, or
  `isEqual` reconstruction. A later invalid item leaves no committed prefix.
- Relationship change propagation uses the manager-owned relationship index and
  one affected-owner batch. It creates no per-edge subscription or one closure
  per child relationship.
- Scene Tree performs one map-registration phase, one parent children
  replacement, and one ordered batch evidence handoff. Required property and
  element instances remain one per canonical ID, but construction creates no N
  Core requests, Props registration phases, relationship graph traversals,
  observer registries, Scene map or parent replacements, Factory handoffs, or
  App transactions. Local `Computed` projection consumes the same owner-issued
  artifact instead of rebuilding complete topology through property-instance
  reads; it remains local Render evidence and never enters shared data.

### Factory Local History and Transport Wire Artifacts

`@asyra/factory` adds and owns:

- `FactoryMutationBatchArtifact`;
- `FactoryMutationBatchAppliedResult`;
- one minimal `SharedPublication` batch view;
- `LocalSharedDataChannel.appendBatch(...)`;
- `LocalSharedDataChannel.observeBatch(...)`;
- an ordered batch observer API.

Single-delivery conveniences delegate to batch-of-one. At the canonical owner
handoff, the active Factory transaction records ordered Props and Scene owner
evidence directly. The owner establishes isolation once; Factory and
`LocalSharedDataChannel` trust that boundary and perform no recursive frozen
tree scan.
The Reactive Events transaction contract forwards and observes this ordered
batch through one batch-only owner route; it does not retain a second scalar
transaction-owner implementation.
Core creation returns only ordered element IDs and never returns a Factory
delivery/evidence handle. The rich local artifact contains ordered canonical
changes, IDs, inverses, History intent, rollback evidence, and local projection
boundaries. Those framework fields cannot select App startup, provider, or
composition behavior.
The applied result separately records only delivery IDs that a shared channel
actually accepted. A failed or unavailable channel never causes the immutable
artifact to be rebuilt, and only the applied result can make retained History
evidence eligible for later Undo or Redo publication.

History and Render/UI consume the rich local artifact. Collaboration never
receives it. The canonical inverse is derived once and reused for History and
compensation. At the shared-data boundary, Factory derives one separate
`SharedPublication` exactly once. Its only hierarchy is:

```text
publicationId / artifactId / transactionId / origin / mode
→ ordered slices: sliceId / orderedIds
→ ordered channel batches: batchId / channel
→ remote deliveries: deliveryId / eventName / orderedIds / payload
```

Only an actual compensation publication or delivery carries its corresponding
`compensatesPublicationId` or `compensatesDeliveryId`. The wire view contains
no `inverseEvents`, History evidence, rollback evidence, reserved future
compensation IDs, top-level delivery alias, batch `records` or `changes` alias,
or nested record wrapper.

This public contract is cut over atomically across Factory and every direct
Collaboration, codec, and remote-apply consumer. The implementation never
contains parallel old and new publication shapes, a compatibility converter,
optional legacy aliases, or decode-time reconstruction of removed fields.
Later codec and remote-apply owner steps optimize their own execution over this
one already-selected shape; they do not preserve or reinterpret the old one.

Local observers receive the rich local canonical artifact; Collaboration
receives only the transport wire artifact. Transport framing never splits local
projection into one observer change per element. Consumers do not call
`.save()` to reconstruct evidence, rebuild snapshots from live owners, rescan
the immutable tree, or clone each observed delivery independently. An observer
mutation attempt cannot pollute another consumer.

During Undo and Redo, the retained artifact returns to the canonical owner
without reordering its Scene and Props evidence. Only an explicitly applied
owner result can ready the corresponding retained publication record. A
semantic no-op remains a failure; Factory must not infer that another owner's
side effect consumed it.

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
   inverse from the same `FactoryMutationBatchArtifact`.
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
- Receiver wire credit is returned after worker receipt. Main-thread canonical
  completion emits a separate `peer-applied` receipt.
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
  64-element work-unit cap independently prevents a large zero-point primitive
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
- Root `dev:all` and ordinary Playwright startup make the reference WebSocket
  server ready before the App begins its required document connection.
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

- Balanced cooperative plural-batch creation:
  - the guarded observed accepted-turn-to-Actor-A-settled time is at most
    30 seconds.
- Collaborative creation:
  - Actor B first visible canonical batch within 2 seconds of Actor A's first
    shared publication;
  - Actor B canonical convergence within 30 seconds of Actor A's canonical
    creation commit;
  - the guarded creation-only command, including harness overhead, completes
    within 180 seconds.
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
App action, one outer transaction, one rich local Factory artifact, and one
intended Undo. A later fatal child failure rolls back the complete action;
single-item calls retain the same batch-of-one canonical implementation.

### Local Drawing Progress

The exact validated composition bounds appear as runtime-only overlay state
before the first canonical mutation. Real ordinary Vector batches replace that
placeholder progressively, and actual accepted element counts drive the visible
progress until terminal cleanup.

### Separate Local History and Wire Artifacts

One rich `FactoryMutationBatchArtifact` serves local History and Render/UI. It
retains ordered inverses and slice boundaries, creates one intended Undo action,
and supplies precise compensation after rollback. One separate minimal
`SharedPublication` serves Collaboration with only one remote-apply payload,
ordered IDs, and publication metadata.

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

Each Inspector owner still completes focused formal tests and bounded review
before the next owner begins. The App, Core/Props/Scene, Factory, and local
projection owners together form one causal local source endpoint; because the
known browser workload is already unsafe, that endpoint receives one guarded
high-detail proof only after the complete sequence rather than after every
internal owner:

1. `contract-readiness-replan`: update this plan, Inspector, contract test, and
   BDD only.
2. `evaluate-endpoint-performance`: first implement and formally test the
   creation-only benchmark, heartbeat, process-tree resource guard, termination,
   bounded report, and pre-canonical 16/1,280-item attribution path. This
   infrastructure step runs no further 7,000-plus workload until its
   unit/integration gates identify the first chronological owner.
3. `project-visible-canonical-slices`: replace Pixi Application auto-render
   ownership with demand-driven framework frames, bound the optional performance
   evidence, and retain the ordinary Vector projection path. Its accepted
   zero-element comparison remains valid, but the 210.5-percent pre-canonical
   stop creates no accepted high-detail baseline for Render.
4. `preload-file-scoped-server-response` and
   `resolve-server-prepared-action-batch`: preload one exact
   `PreparedDrawingArtifact` by required `fileId`, then keep Runtime limited to
   its small action-batch control envelope and bounded preview.
5. Complete the local source endpoint in this fixed owner order:
   - `stage-local-interactive-composition`: create the Group, cross one browser
     paint opportunity, then submit already-prepared flat child-batch ranges
     through `Core.createElementsInParentFromCanonicalData(...)` with a fixed
     2,048-point and 64-element boundary.
   - `apply-canonical-property-scene-batch`: add Core owner indexes, Props fixed
     batch materialization and manager-owned relation propagation, and Scene
     local Computed projection from the same owner artifact.
   - `record-and-deliver-transaction-batch`: retain one rich local history
     artifact and inverse, then derive one separate minimal transport wire
     artifact.
   - `project-visible-canonical-slices`: consume the local batch directly and
     keep at most one ordinary Vector projection/flush per slice.
   Each owner gets focused tests and bounded review. Then
   `evaluate-endpoint-performance` runs one guarded 16-item proof. Only after it
   passes may one guarded 7,076-element proof run for the complete local source
   endpoint, not one proof per internal owner.
6. `encode-publication-frames`: consume only the minimal transport wire
   artifact, remove redundant main-thread payload ownership, and retain one
   worker binary encode/decode boundary. Its guarded 16-item proof must pass
   before any later receiver, remote, relay, or high-detail proof.
7. `admit-receiver-publication-frames`: retain valid committed ingress work,
   move the browser WebSocket data plane and wire credit into the Dedicated
   Worker, remove main-thread clone/freeze and duplicate header ownership, add
   receiver timing, then pass its guarded 16-item proof.
8. `apply-remote-publication-batches`: consume worker-valid evidence once and
   apply one linear Core request in one remote transaction, then pass its
   guarded 16-item proof.
9. `relay-frames-with-backpressure`: prove or correct receiver-driven relay
   admission, peer byte capacity, and independent receipts, then run the guarded
   16-item proof followed by the single guarded 7,076-element endpoint proof.
10. `evaluate-performance-and-equivalence`: after every endpoint is effective
    or formally non-material, run the final formal correctness, performance,
    and synchronized visual closure.

Existing committed results and current WIP are preserved and absorbed only
inside their matching owner step. No cross-owner WIP commit is allowed.

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
- Factory/pub-sub: one local history artifact, one ordered shared view, one
  batch observer registry snapshot, no synonymous flattened payload graph, and
  exact rollback/Undo/Redo.
- Receiver: frame acceptance and `frame-consumed` remain independent of App
  apply; bounded bytes and one active decoded publication survive slow consumer,
  terminal failure, disconnect, and teardown.
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
- Factory: one immutable artifact, one history action, full Undo/Redo, no
  transaction-end resending of cooperative slices, precise compensation, and
  observer isolation.
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

Each owner step runs focused unit and integration gates first, then exactly one
guarded 7,076 creation-only proof. The full multi-turn high-detail suite is not
repeated after every step.

## Final Gates

After all architecture owners are complete, run one heavy closure:

1. Inspector contract, all affected package unit/integration tests, Asyra
   Design full local tests, lint, and production build.
2. Default 16-item server-response AI CRDT correctness.
3. One 7,112-element balanced correctness run because canonical and transport
   paths changed.
4. One final invocation of the same guarded two-Actor 7,076-element endpoint
   proof, reporting product execution, artifact, encode, server queue/drain,
   worker decode, remote apply, Render, UI, and harness overhead.
5. Maximum-detail 27,471-element and 295,794-point gate.
6. `app-visual-review-sync` from the same measured live App state, with direct
   inspection of complete, uncropped Actor A and Actor B output, Styles, IDs,
   and hierarchy.
7. The 7,076-element two-window full recording only with explicit user opt-in.

Generated media, recordings, screenshots, traces, profiles, and thumbnails are
never committed.

## Definition of Done

- Every Step-local gate passes before its owner step advances.
- Every endpoint has one accepted guarded 7,076-element creation proof, or one
  proof that the owner is below five percent of product time and therefore
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
- One rich immutable Factory artifact serves local History and projection; one
  separate minimal transport wire artifact serves Collaboration without
  `inverseEvents`, History evidence, rollback evidence, or payload aliases.
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
