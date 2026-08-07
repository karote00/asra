# AI Development and Debugging Reference

This is the human-readable reference for extending and diagnosing the Agent
drawing flow when an AI assistant is unavailable. The active Inspector remains
the exact architecture authority; this document explains how to work within
that contract.

## Current Drawing Flow

The production frontend consumes one server-prepared `AiActionBatch`. The
provider returns a small control envelope containing a `batchId`, ordered
registered actions, and bounded summaries. Large drawing arguments are already
prepared by the server and retain their identity through Runtime permission,
confirmation, and execution.

For a bulk drawing:

1. One registered action receives the complete server-prepared request.
2. The action opens one outer App transaction.
3. The App sends a prepared Group and deterministic child slices through
   `Core.createElementsInParent(...)`.
4. A request containing 100 Vector descriptors creates 100 independently
   editable Vector element records, plus one Group when grouping is requested.
   It never becomes one giant Vector record.
5. Props Manager and Scene Tree preflight and apply each plural request.
6. Factory's ordinary journal creates one Undo entry for the outer action.
7. Render and UI consume the ordinary local computed projection.
8. Collaboration receives a separate minimal `SharedPublication` containing
   only ordered canonical delivery data.

There is no alternate provider, local fixture provider, URL-selected AI mode,
client geometry reconstruction, or post-action `save`/`isEqual` verification.
The action path trusts the registered action and canonical owner results.
Incorrect output is a product bug to fix at its first incorrect owner, not a
reason to duplicate the complete document or geometry graph.

## Adding an AI Action

1. Add a stable action name to `src/constants/ai-actions.ts`.
2. Define one action in `src/ai/actions.ts` with:
   - one backend-facing `inputSchema`;
   - a bounded redaction-ready summary;
   - one `execute(args, context)` implementation.
3. Route every document mutation through `src/common-apis/*` or another
   registered App mutation boundary. Do not mutate Core, Props, Scene Tree,
   Render, or DOM state directly.
4. Set `undoable: true` for the canonical mutation. Use the existing outer
   Agent transaction so the user receives one intended Undo action.
5. Choose ordinary immediate shared delivery for progressive visibility or
   transaction-end delivery for an atomic mutation. Do not create a second
   history artifact, forward/inverse graph, or action-result mirror.
6. Return bounded action evidence. Never return the complete geometry in UI
   history, confirmation, logs, or diagnostic payloads.
7. Add focused action, permission, transaction, presentation, and server
   response tests. For document changes, add the smallest relevant headless
   App/CRDT test.

The server owns vendor credentials, model execution, input-image analysis, and
construction of the action arguments. The browser must not hold a provider API
key or rebuild the server's drawing artifact.

## Backend AI Model Configuration

The ordinary model-backed route is disabled until all three server-only values
are present:

- `AI_PROVIDER_ENDPOINT`: the HTTPS action-batch adapter endpoint
  (loopback HTTP is allowed for local development);
- `AI_PROVIDER_MODEL`: the model identifier passed to that adapter;
- `AI_PROVIDER_API_KEY`: the credential sent only as a Bearer
  authorization header.

The backend sends protocol version `1`, the configured model, the
backend-owned App domain prompt and image-tool catalog, and the original
`AiProviderInput` as JSON. The credential is never part of that JSON. The
adapter must return one JSON `AiActionBatch`; missing configuration fails
before network access, and upstream transport, status, or malformed response
fails before Runtime or canonical mutation.

The exact `crdt-7076` image and instruction are intentionally handled first.
That route reads and returns the checked-in ordered `AiActionBatch` without
loading the prompt module, provider configuration, or model path. A request
matching only the sample image or only the sample instruction fails and does
not fall back to the configured model.

## Canonical Preflight

Preflight is not a document snapshot and does not build Render topology. It is
the canonical data-layer admission pass immediately before a plural mutation:

1. Scene Tree validates the complete element batch, parent/index placement,
   unique IDs, and hierarchy before any element is registered.
2. Scene Tree resolves each registered element type into its ordinary property
   definitions and hands one owner list to Props Manager. Core only forwards
   the canonical plural request; it does not build a second graph.
3. Props Manager validates the complete owner list's schemas, property IDs,
   relationship descriptors, ownership, and relationship targets.
4. The prepared artifact retains validated root descriptors and captured
   registration contracts. It does not contain a document snapshot or a
   duplicated geometry graph.
5. Only after the entire request passes does Props Manager materialize property
   instances, bind its forward/reverse relationship indexes, and let Scene Tree
   register the element batch and emit canonical evidence.

The ordinary creation route uses the server-issued geometry data by shallow
field handoff. It does not call `Core.save()`, clone the complete geometry,
compare a before/after document, or create render-layer topology. A later
invalid item leaves no committed prefix. Removal and restore have their own
complete-evidence preflight for the same atomicity reason.

This validation is materially different from persistence. `save()` serializes
the current accepted document for durable storage after a transaction; it
cannot replace the admission check that prevents half of an invalid batch from
being committed.

## Property and Vector Editing

Every Property panel edit writes canonical Props data through the existing
common API and transaction boundary. Position, dimensions, rotation, fills,
strokes, and Vector point fields all follow the same route:

```text
Property UI
-> App common API
-> Core/Props canonical mutation
-> Factory transaction and History
-> Scene Tree local computed projection
-> Preset/Render/UI
-> minimal SharedPublication
```

`UPDATE_COMPUTED_DATA` remains a local projection event. It is deliberately not
shared data. Collaboration transports the canonical property change; each
client recomputes its own local projection. The selected Vector point
compatibility mirror observes the canonical point projection so the panel does
not retain a stale point object after an edit.

Continuous controls such as the color picker publish canonical changes while
dragging so the canvas and peers update immediately. One outer pointer
transaction closes on pointer-up, producing one Undo entry. This is the same
canonical route as every other property field, not a color-specific refresh
path.

## File-Scoped Persistence

Every ordinary required `fileId` opens the implemented mandatory socket
document session. Core loads the checkpoint-plus-tail bootstrap; local manual
actions, Agent actions, Undo, and Redo publish existing Factory
`SharedPublication` values; the socket assigns sequence and batches backend
materialization on the fixed three-second dirty window. The browser never
writes a materialized ordinary document snapshot.

`crdt-7076-sample` uses the same mandatory socket document session as every
other fileId. Its checked-in ordered `AiActionBatch` instruction file is the
only drawing authority and enters only through Actor A's same-origin HTTP
action-batch request. The sample retains no SVG, alternate drawing source, or
request-time geometry reconstruction. Socket unavailability keeps the ordinary
provisional local document and outbox active; there is no direct compressed-
document load, localStorage Reset, or sample-specific Collaboration bypass.

Scene Tree and Props semantically admit the original local mutation once.
Factory publication after that boundary is trusted product data. Codec and
socket owners retain security, byte, frame, ordering, and sequence checks, but
they do not recursively revalidate the delivery payload. Actor B decodes the
wire representation once, consumes the typed trusted publication, and applies
its ordered source slices through one remote transaction with cooperative paint
between visible slices. The backend alone performs the persistence decode for
ordered atomic checkpoint materialization.

Authority:
`../specs/socket-authoritative-document-session.md`.

## Awareness Integration

`@asyra/collaboration` already supplies the transport and state runtime:

- `collaboration.updateAwareness(state)` publishes local ephemeral state;
- `collaboration.leaveAwareness()` publishes an explicit leave;
- `collaboration.awareness.observe(...)` reports updated and removed actors;
- `getRemote(...)` and `remoteActors()` read detached remote snapshots;
- disconnect and provider failure clear observations;
- `expireAwareness()` applies the configured timeout.

A future App does not need to implement Awareness wire frames, clocks, stale
message rejection, disconnect fan-out, or room isolation. It does need an
App-owned presence adapter and UI policy for:

- user identity and display fields;
- viewport-to-document cursor coordinates;
- selected element IDs;
- pointer throttling/coalescing and heartbeat scheduling;
- timeout cadence;
- cursor, selection, and online-user rendering;
- privacy and authorization policy.

Awareness is ephemeral. Never use it for canonical geometry, permissions,
History, persistence, save/load data, or guaranteed delivery.

## Runtime Diagnostics

The only browser globals are human-operated DevTools handles:

```js
window.__Core__
window.__Collaboration__
window.__CanvasPipelineDebugger__
window.__AiDrawingPerformance__
```

Product code, automated tests, E2E, and scripts must never consume those
handles. Code uses imported owner APIs. The bounded performance harness uses
the document diagnostic request service, which exposes a fixed diagnostic
operation whitelist and detached evidence. Its reset operations clear only
diagnostic counters; they never mutate product data. A formal source scan
enforces this boundary.

Useful human checks:

```js
window.__Collaboration__?.getStatus()
window.__Collaboration__?.identity
window.__AiDrawingPerformance__?.snapshot()
window.__CanvasPipelineDebugger__?.getSnapshot()
```

## CPU and Timing Evidence

Performance limits use the operating system's current raw percent-CPU sample.
Never derive CPU percent from cumulative CPU time, divide by elapsed time,
normalize to a polling interval, or average snapshots for a formal peak.

Actor A and Actor B run in separate Chromium process groups. Each Actor reports
one complete browser-group peak containing that Actor's browser, renderer, GPU,
utility, and Worker processes. Do not add A and B together and call the result
one frontend Actor. Backend and harness roles remain separate. The aggregate
safety limit may include all declared roles, but backend CPU is never reported
as either frontend Actor's peak.

CDP `TaskDuration`, `ScriptDuration`, `LayoutDuration`, and
`RecalcStyleDuration` help attribute page-main-thread work. Worker targets are
reported separately. These durations do not replace the OS raw CPU safety
sample.

## Formal Test Ladder

Use the smallest gate that proves the changed owner:

1. owner package unit/integration tests;
2. App unit/integration tests;
3. headless Property panel tests for ordinary and Vector fields;
4. the two-Actor 16-item Agent CRDT case, including edit, Undo/Redo,
   persistence, and reload;
5. a fresh-file two-Actor non-Agent case, including Vector point edit,
   Undo/Redo, persistence, and reload;
6. production build and lint;
7. synchronized headless visual review when visual behavior changed.

The 7,076-, 7,112-, and 27,471-element gates are explicit high-detail
checkpoints. They are not routine debugging loops. Recording, tracing, and full
CPU profiling remain explicit opt-ins.

## Explicit Non-Goals

- no database-vendor, authentication-provider, backup-product, or deployment
  selection inside the socket-authoritative persistence plan;
- no built-in presence UI or product-specific Awareness schema;
- no create-app template parity in this CRDT correction;
- no alternate AI provider route or client-side response fabrication;
- no legacy payload, persistence, URL-mode, or dual-format compatibility;
- no AI-only Render path or computed-data publication;
- no Contents optimization in this correction;
- no default high-detail recording, trace, or profile capture;
- no product behavior selected by a performance query parameter.
