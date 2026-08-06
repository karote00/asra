# Trusted Publication and CRDT 7,076 Flow Realignment Plan

## Status

Completed on 2026-08-06 after product-owner closeout. Contract realignment, the
fixed `AiActionBatch` sample, trusted publication codec boundary, opaque socket
relay, backend materialization, and cooperative source-slice remote transaction
stages are implemented. The post-repair 32/64 profile retains the 32-element
default. Focused unit, integration, Inspector, server harness, production
build, lint, guarded two-Actor, formal Reset E2E, independent live-App visual,
and pull-request CI gates pass.

Final outcome: the product owner confirmed that the complete 7,076-element
flow is somewhat faster and materially less blocking. Some remaining jank is
accepted for this release. The permanent Reset control and the single formal
sample URL remain part of the App contract.

## Goal

Realign the 7,076-element Agent and CRDT flow so one owner-issued canonical
change is semantically admitted once, then remains trusted data through
publication, transport, remote apply, and backend materialization:

```text
checked-in ordered AiActionBatch instruction file
-> registered App action
-> local canonical owner admission
-> trusted SharedPublication
-> worker encoding
-> opaque socket sequence and relay
-> remote worker decoding
-> trusted batched canonical apply and cooperative presentation
-> backend ordered materialization
```

The repair must remove repeated payload-shape traversal, remove live socket
semantic document admission, make Actor B use the same cooperative presentation
model as Actor A, and replace the sample SVG with the exact ordered
`AiActionBatch` instruction file executed by the demo.

## Product Decisions

### One semantic data-admission boundary

- The local canonical owner is the only semantic data-admission boundary for
  a newly created document change. Scene Tree and Props Manager may validate
  the original local mutation before it commits.
- Factory creates `SharedPublication` only from successfully committed
  canonical owner evidence. From that point onward, its delivery payload is
  trusted product data.
- Transport code validates only the security and wire envelope it owns:
  authentication/session identity, protocol version, frame lengths, byte
  limits, chunk ordering, sequence metadata, and syntactic codec integrity.
- Transport, App routing, Core remote apply, and backend materialization must
  not recursively revalidate an already admitted delivery payload's product
  schema.
- `isSharedPublicationDelivery(...)` may remain only as a type-level contract
  or one shallow envelope parser at the first untyped boundary. It must not
  trigger a recursive payload traversal after the publication is trusted.
- A standalone `isJsonTransportValue(payload)` pre-walk is not part of the
  trusted hot path. The encoder and decoder own rejection of values their wire
  format cannot represent while performing their ordinary encode/decode pass;
  they must not add a second complete graph walk.
- This is a data-trust decision, not a decision to trust unauthenticated peers
  or malformed bytes.

### Decode is not semantic validation

- Actor B must decode received bytes to reconstruct the in-memory publication.
  That unavoidable reconstruction does not authorize a second product-schema
  validation pass.
- The live socket server does not need to decode the publication payload to
  allocate a sequence, deduplicate it, relay it, or enqueue it for persistence.
- If a future security policy requires server payload inspection, the server
  may decode once for that security decision while still relaying the original
  encoded payload. It must not decode, normalize, rebuild, and re-encode the
  product publication for peers.

### Apply failure is a synchronization failure

- Owner-issued changes are expected to apply on every Actor that has consumed
  the same preceding server sequence.
- Remote apply does not repeat the local payload-schema admission.
- The complete remote publication still applies atomically. An unexpected
  state/apply failure rolls back or commits no partial prefix, does not advance
  the applied sequence, and requires authoritative resynchronization.
- A client must not silently discard sequence `N` and continue with
  `N + 1`; doing so would make Actor state diverge even when the later payload
  is valid.

### The 7,076 sample is the formal ordered AI instruction file

- The sample's only drawing authority is one checked-in JavaScript or JSON
  instruction file exporting a versioned `AiActionBatch`, matching the formal
  provider output consumed by Runtime.
- The file contains the complete ordered registered App actions and their
  prepared arguments. The demo reads that file directly; it does not derive,
  regenerate, normalize, or reconstruct its instructions from another drawing
  format.
- Runtime executes the batch's `actions` in file order. Each registered action
  executes its ordered prepared slices through ordinary App common APIs and
  plural Core calls.
- `converted-vector-data.svg` is removed from the maintained sample and is not
  retained as an offline source, reference authority, fallback, or
  regeneration dependency.
- The batch does not contain direct Core calls because the formal provider
  contract returns registered App actions and AI providers do not own Core.
- The fixed sample URL, exact image/instruction match, ordinary socket session,
  Reset behavior, Undo/Redo ownership, and Actor B's CRDT-only receipt remain
  unchanged.

## Why the Current Constants Exist

`PREPARED_DRAWING_SLICE_ELEMENT_BUDGET = 32` is an empirically selected
responsiveness guard, not a protocol limit:

- a previous 256-element batch produced a perceptible main-thread block;
- the 64-element run reduced publication count but caused Actor A and Actor B
  work to overlap in larger CPU bursts; and
- the 32-element proof completed the 7,076-element action in about ten seconds
  while staying under the recorded aggregate CPU safety guard.

The independent 2,048-point cap prevents one geometrically dense slice from
becoming an unbounded unit. The 32-element cap prevents thousands of
zero/low-point primitives from collapsing into one large unit. One indivisible
element may exceed only the point cap.

The `512` Factory publication work-item window is a transport/publication
coalescing limit. It can contain approximately sixteen full 32-element source
slices. Therefore “16” describes the number of inner source batches in one
full publication window, not an Actor B element budget. Actor B does not have a
16-element slice contract.

The current 7,075-child artifact contains 239 prepared slices because both the
element and point limits can close a slice. Raising the element cap alone must
not be assumed to halve total time.

## Bounded Task Contract

### Authorized implementation scope after explicit implementation approval

- Asyra Design 7,076 ordered action-batch instruction file, one-time migration
  away from the current SVG, sample HTTP interceptor, and exact formal Agent
  request/response tests.
- Factory publication encoding handoff and directly affected protocol types.
- Asyra Design collaboration codec worker, socket server, App remote
  publication processor, persistence adapter, and backend materializer.
- Core/Factory/Preset batching surfaces only where required to make trusted
  remote publication apply cooperative and observable without altering
  canonical order.
- The active socket-authoritative and AI performance specifications,
  Inspectors, BDD cases, API surfaces, module reference, and direct tests.
- Focused profiling needed to select a new default element budget after the
  architectural costs are removed.

### Behavior that must remain unchanged

- One intended local action creates one intended Undo entry.
- Undo and Redo publish the actual inverse/forward canonical changes, not
  private History evidence or a full document.
- Remote apply creates no receiving-client Undo entry, outbound echo, or
  browser checkpoint save.
- One server sequence remains the total order for a document.
- Source acceptance, peer apply, and backend durability remain distinct
  acknowledgements.
- The App-owned outbox keeps unaccepted local publications recoverable.
- Reset remains a permanent toolbar function that only attempts to clear the
  stored checkpoint and always refreshes; it does not enter App mutation,
  History, or CRDT flow.
- The fixed three-second backend persistence window remains non-debounced
  unless separate product evidence changes that policy.
- Alt+drag or any operation that requires all clones to exist before subsequent
  offsets are applied may explicitly opt out of cooperative presentation. The
  framework default remains cooperative batching.

### Explicit exclusions

- Direct Core calls from an AI provider or sample fixture.
- Retaining SVG, VTracer input, another drawing-format source, or a
  regeneration fallback as part of the maintained 7,076 sample.
- SVG parsing, VTracer execution, geometry reconstruction, or document loading
  inside the 7,076 request path.
- Full-document save, equality comparison, or snapshot validation on Actor B.
- Repeated recursive product-payload validation after local canonical
  admission.
- Live socket `admissionDocument`, decoded deep-equality dedupe, or
  decode/re-encode fan-out.
- Cross-publication reordering or merging that changes sequence, transaction,
  History, compensation, or progress semantics.
- A fixture-specific renderer, CRDT route, remote apply path, or performance
  exception.
- New third-party packages, binaries, or runtime upgrades without separate
  approval.

### Stop conditions

- A proposed fast path can apply a partial publication without rollback.
- The server cannot preserve sequence and dedupe identity without interpreting
  product payload semantics.
- Backend persistence cannot retain the exact accepted opaque publication
  until ordered materialization.
- Cooperative remote presentation requires changing canonical order or
  creating receiver History.
- The active specification and Inspector remain inconsistent after the first
  contract segment.
- A new dependency or runtime upgrade becomes necessary.

## Target Owner Flow

### 1. Maintained ordered instruction file

The repository retains one JavaScript or JSON file containing the complete
versioned `AiActionBatch`. It is the formal provider response and sole drawing
authority for the sample. Its ordered actions and prepared slice arguments
fully describe the demo calls.

The migration may consume the current SVG once to create the initial
instruction file, but the completed change removes the SVG and every generator,
request path, test, or document dependency on it. Formal tests validate one
Group, 7,075 editable Vector children, deterministic ids, slice budgets,
bounded summaries, and ordered execution directly from the instruction file.

### 2. HTTP Agent response

The same-origin interceptor validates only the exact sample request identity
already required by the product case, reads the action-batch instruction file,
and returns it. Request-scoped control ids may be wrapped outside the large
prepared arguments only when the formal provider contract requires them. The
instruction file's prepared geometry is not rebuilt, cloned, normalized, or
traversed.

### 3. Local canonical admission and publication

Runtime validates the bounded `AiActionBatch` control envelope and preserves
the prepared argument identity. The registered App action calls ordinary common
APIs. Scene Tree and Props Manager admit each original local plural mutation
atomically. Factory publishes only accepted canonical evidence and brands or
otherwise owns the resulting trusted publication handoff.

The publication encoder consumes that owner-issued handoff directly. Unsupported
wire values fail during the encoder's own ordinary traversal; no prior complete
`isJsonTransportValue` walk is allowed.

### 4. Opaque socket sequence and persistence queue

The socket server consumes a bounded outer wire envelope containing document,
actor, request/publication identity, chunk metadata, and opaque encoded
publication bytes. It:

1. verifies session/security and wire bounds;
2. deduplicates by publication identity plus exact encoded-byte digest;
3. assigns one sequence;
4. stores the opaque accepted bytes in the pending persistence queue;
5. reframes only server-owned metadata for peers;
6. relays the original encoded payload bytes; and
7. acknowledges source acceptance.

The server does not construct or mutate a document admission snapshot.

### 5. Actor B trusted apply and cooperative presentation

Actor B's worker verifies and decodes the wire representation once. The decoded
publication crosses one typed trusted handoff to the App processor. Later
owners do not repeat route/payload schema traversal.

The App preserves publication order and source creation order. Compatible
creation deliveries become one publication-owned remote apply session, while
the framework's cooperative presentation scheduler yields at deterministic
source-slice boundaries so Render can display progress and input is not blocked.
Render may consume each visible slice; expensive hierarchy/UI projections that
do not need per-slice visibility coalesce to the declared batch boundary.

The remote transaction completes only after the publication's canonical apply
and required projections settle. It creates no Undo or echo.

Because ordinary browser paint cannot occur while a synchronous JavaScript
transaction callback is still running, Factory owns a progressive remote
transaction form that keeps one rollback journal open across cooperative
presentation boundaries. Each canonical source-slice apply remains
synchronous; only the scheduler boundary between slices is asynchronous.
Ordinary local action transactions cannot join that open remote transaction.

### 6. Backend materialization

The persistence backend receives the exact sequenced opaque publications. It
verifies batch identity and contiguous sequence, decodes each publication once,
and applies it atomically to the checkpoint in order. It does not maintain an
independent product-schema validator or reinterpret routes differently from the
App.

Failure preserves the previous durable sequence and exact retry batch. A
successful commit acknowledges only the highest contiguous durable sequence.

## Implementation Stages

### Stage 1 — Contract and Inspector realignment

Before production edits:

- update `specs/socket-authoritative-document-session.md` with the
  trusted-publication, opaque-live-relay, apply-failure/resync, and opaque
  persistence contracts;
- update the socket persistence Inspector so sequence allocation consumes an
  opaque publication envelope and backend materialization owns decoding;
- update the AI performance Inspector so the 7,076 request consumes the
  checked-in ordered action-batch instruction file and Actor B has an explicit
  cooperative presentation route;
- update affected API surfaces, module reference, and BDD cases;
- remove current contract language requiring server semantic structural
  admission before sequence allocation.

This stage changes target contracts only. It must not claim implementation
parity until later stages pass.

### Stage 2 — Formal 7,076 action-batch instruction file

Test first:

- prove the HTTP handler currently reads/parses the SVG on every accepted
  request;
- prove the returned response must equal the checked-in ordered
  `AiActionBatch` instruction file;
- prove Runtime executes every action and prepared slice in file order through
  common APIs, Core, Factory, and Render;
- prove the final sample has no SVG, alternate drawing source, or regeneration
  fallback.

Then migrate the existing sample once, check in the ordered instruction file,
make the interceptor read it directly, and remove the SVG plus its runtime,
test, script, and documentation dependencies.

### Stage 3 — Trusted publication handoff and exact-once codec work

Test first:

- count recursive payload traversals and prove current encode/decode performs
  more than the permitted pass;
- prove malformed wire data fails at the codec/security boundary;
- prove downstream App/Core consumers receive an already trusted publication
  without invoking recursive delivery guards;
- prove unsupported local wire values fail in the encoder's own pass.

Then introduce one owner-issued trusted publication/decode result and remove
redundant `isSharedPublicationDelivery` /
`isJsonTransportValue(payload)` hot-path walks.

### Stage 4 — Opaque socket relay and persistence

Test first:

- prove the live server currently decodes/materializes a publication before
  sequence allocation;
- prove peer payload bytes must be identical to source encoded payload bytes;
- prove dedupe rejects the same publication identity with different encoded
  bytes without decoded deep equality;
- prove the persistence queue and bootstrap tail preserve the accepted opaque
  bytes and sequence.

Then remove live `admissionDocument`, keep only outer security/wire admission,
relay opaque bytes, and move the one materialization decode to the backend.

### Stage 5 — Actor B cooperative batch apply

Test first:

- prove one 512-work-item publication can contain multiple original prepared
  slices and that “16” is batch count rather than element width;
- prove Actor B currently finishes the inner loop without a cooperative paint
  boundary;
- prove Actor B preserves canonical order, shows progressive Render output,
  coalesces unnecessary projection flushes, and remains input-responsive;
- prove remote apply still creates no Undo, echo, or browser save;
- prove an apply failure leaves no prefix, does not advance sequence, and
  enters authoritative resynchronization.

Then route remote publications through the framework-owned cooperative batch
surface. Do not add a 7,076-only branch.

### Stage 6 — Reprofile and select the slice budget

Only after Stages 2–5 remove the confounding costs, run the same formal artifact
with at least 32- and 64-element caps. A larger value may become the default
only when all of these remain true:

- point cap still bounds geometrically dense work;
- longest main-thread work unit and interaction latency meet the declared
  responsiveness budget;
- Actor A and Actor B separate CPU peaks and aggregate CPU stay within the
  formal safety guard;
- Actor B displays progressive completion rather than one terminal burst;
- total completion, Undo, and Redo improve or remain within accepted limits;
- action/transaction/publication semantics are byte- and state-equivalent.

If neither fixed value is consistently safe, keep a deterministic hard element
cap and add a framework-owned elapsed-work presentation budget only after an
equivalence test proves that presentation scheduling cannot change canonical
order or results.

The completed 2026-08-06 two-Actor 320-item comparison used the same current
App, socket, and backend code with isolated owned ports. Both profiles passed
exact create, Undo, Redo, convergence, one sender Undo, and zero receiver Undo:

| Element cap | Actor A complete | Actor B complete | Actor B Undo | Actor B Redo |
| --- | ---: | ---: | ---: | ---: |
| 32 | 5,664 ms | 8,557 ms | 3,820 ms | 10,177 ms |
| 64 | 8,355 ms | 13,750 ms | 4,746 ms | 11,965 ms |

The 64-element profile exposed Actor B's first visible result 1,196 ms earlier,
but regressed terminal Actor A, terminal Actor B, receiver Undo, and receiver
Redo. The product default therefore remains 32. The retained 2,048-point cap
continues to bound dense geometry independently.

### Stage 7 — End-to-end closure

The first final guarded 7,076 invocation reached ordinary progressive product
work without a CPU, transport, or persistence failure, but the harness rejected
the run after the AI turn completed before its post-dispatch
`loading-at-zero` waiter accepted two stable frames. The product contract
guarantees one loading paint opportunity, not two zero-element frames. A focused
source contract now fails unless `loading-at-zero` accepts that one paint while
`first-visible` continues to require two stable frames. The corrected assertion
is a new bounded harness iteration; the failed scheduling run is not an accepted
endpoint baseline and cannot be reported as product evidence.

The next corrected harness invocation proved the loading oracle but exposed a
separate startup contract gap: the guarded process registry started the App and
WebSocket server without the socket-authoritative document backend. Actor A
therefore reached ordinary progressive work, then correctly rejected
publication 5 because accepted changes could not become durable. The repair
must add one test-owned backend process group, dedicated port, backend health
gate, socket persistence URL, App proxy URL, aggregate CPU accounting, and exact
teardown confirmation. It must not weaken durable acceptance or retry a failed
publication in product code.

The backend-owned final invocation then completed the entire product flow:
Actor A reached 7,076 canonical and Render elements in 10,562 ms; Actor B
reached the same counts in 15,570 ms; Actor A emitted 15 accepted publications
and retained one Undo action; Actor B processed the same 15 publications with
zero local send and zero Undo; no publication failed and no CPU limit was
crossed. The post-completion reporter nevertheless rejected the evidence
because it compared 239 cooperative slice yields with 15 publication-owned
canonical work units. Cooperative yields are scheduler checkpoints inside
canonical work units, while publications are transport units. The corrected
report asserts a positive cooperative yield count independently and retains the
exact canonical-work-unit-to-publication equality. No additional high-detail
run is permitted for this reporter-only correction.

Closure evidence:

- Factory local tests pass: 12 files and 236 tests.
- Asyra Design local tests pass: 130 Node tests plus 53 Vitest files and 380
  tests, including the permanent Reset control and stored/storage-free Reset
  behavior.
- The server response harness passes: 6 files and 32 tests.
- The directly affected Inspector contract suites pass: 86 assertions, with
  the focused AI Inspector suite passing 21 assertions.
- The performance resource guard suite passes 77 assertions, and the guarded
  16-item two-Actor gate passes with one Actor A publication/Undo and zero Actor
  B local sends, Undo entries, or saves. All six test-owned process groups
  terminate.
- Production build and `yarn lint:ci` pass. Lint retains only the repository's
  pre-existing `no-console` warnings and reports no errors.
- The backend-owned high-detail 7,076 product flow completes with the metrics
  above and no disconnect, publication failure, or CPU stop. The only rejected
  post-completion assertion was the reporter's invalid equality between 239
  cooperative scheduler yields and 15 publications; its corrected relation is
  covered by focused guard tests and the passing guarded 16-item gate. The
  no-repeat budget intentionally prevents another high-detail invocation, so
  this plan does not claim a subsequently generated green endpoint report.
- Formal Reset E2E passes independently on isolated ports: one rectangle is
  persisted, Reset issues the document DELETE, reloads, and restores the empty
  document (`durableSequence = 0`, one root element). The captured empty-App
  screenshot was inspected.
- A separate fresh in-App browser tab against test-owned App, socket, and
  backend processes confirms the permanent Reset button, visible empty canvas,
  and zero console warnings/errors. All test tabs and isolated ports are closed
  afterward.
- Bounded scans confirm no production hot-path call to
  `isJsonTransportValue(payload)`, no live socket publication decode, and no
  maintained 7,076 SVG or alternate drawing source. Historical plan text and
  explicit absence tests may retain the removed names as historical evidence.

## Definition of Done

- The checked-in 7,076 HTTP mock is the formal ordered versioned
  `AiActionBatch` instruction file; the sample retains no SVG or alternate
  drawing source, and request handling performs no geometry reconstruction.
- One local canonical admission produces a trusted publication consumed without
  repeated product-schema traversal.
- Codec security/wire integrity remains enforced once at its owner boundary.
- The live socket server sequences, deduplicates, queues, and relays opaque
  encoded publication bytes without semantic document admission or
  decode/re-encode fan-out.
- Backend materialization decodes and atomically applies the contiguous
  sequence; it acknowledges no failed prefix.
- Actor B uses the framework cooperative presentation path, visibly progresses,
  remains responsive, and converges with Actor A after create, Undo, and Redo.
- Actor B creates no Undo, echo, or browser persistence save.
- The final 32/64 choice is based on post-repair A/B evidence rather than the
  historical mixed-cost profile.
- Specs, Inspectors, BDD, API surfaces, module docs, tests, and implementation
  contain no remaining contradiction inside this plan's bounded scope.

The performance harness installs the same formal HTTP `AiActionBatch` route
before navigation. It may fetch, decode, and attest its test-only compressed
backend artifact outside product timing, but it owns no startup page, IndexedDB
inbox, response preload, resident batch, or alternate client ingestion path.
