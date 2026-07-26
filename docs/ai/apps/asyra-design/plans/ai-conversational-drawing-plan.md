# Asyra Design Conversational AI Mock Drawing Plan

## Status

Active cross-cutting app plan. It follows the completed Framework Release Gate
4 AI Agent Runtime and does not reopen that gate.

Implementation may begin only after this product contract, the matching
Inspector, the bounded Gherkin cases, and the readiness gates agree. Work then
advances one Inspector owner step at a time.

Architecture authority:

- `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-flow-inspector.data.cjs`
- `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-flow-inspector.html`
- `docs/ai/apps/asyra-design/plans/__tests__/ai-conversational-drawing-flow-inspector.contract.test.cjs`

Framework prerequisite:

- `docs/ai/framework/plans/completed/ai-agent-runtime-plan.md`
- `docs/ai/framework/plans/ai-agent-runtime-flow-inspector.data.cjs`

Queued performance successor:

- `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-plan.md`
- `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-flow-inspector.data.cjs`

The successor profiles and reduces local creation, shared publication, remote
apply, Render projection, and E2E overhead. It does not close this active plan
or authorize reduced drawing detail, changed canonical identity, split
history, an AI-only renderer, or a collaboration bypass.

## Goal

Provide a usable Asyra Design AI conversation experience before a live model
endpoint or API key exists.

In explicit mock mode, a user can open an app-owned conversation panel, enter a
natural-language request, observe deterministic operational progress, receive
a mock provider plan, and see ordinary Asyra elements created or updated
through the completed AI Agent Runtime and app common APIs.

The first representative conversation is:

1. The user drops or adds one tabby reference image to the Agent prompt.
2. `請依照這張圖繪製` pauses before mutation and offers `Balanced detail` or
   `Maximum detail`, each with its expected element count and resource impact.
3. Choosing one detail option creates one editable cat-face composition based
   on the original turn attachment.
4. `把眼睛放大一點` updates the existing eye elements from the drawing turn.
5. `把鬍鬚改成藍色` updates the existing whisker elements.

Each mutating user turn is one intended undo commit. A message bar exposes Undo
or Redo only while that AI turn remains the applicable top history action.

## Current Baseline

- `@asyra/ai-agent-runtime` is complete, optional, provider-replaceable, and
  inert until an app composes it.
- Asyra Design has an exclusive programmatic AI Feature, context provider,
  explicit permission and confirmation adapters, and one app transaction
  adapter.
- The current action catalog contains only `set_element_visibility` and
  `select_elements`.
- There is no user-facing AI trigger, conversation panel, progress projection,
  mock provider mode, drawing action, incremental conversation targeting, or AI
  history message bar.
- The current confirmation handler already pauses the runtime by awaiting an
  app Promise and races that wait against the Feature-owned `AbortSignal`.
- A resolved app action result may already contain detached partial evidence.
  A rejected executor remains a transaction-level failure and rolls back
  rollbackable writes.

## Product Decisions

### Explicit mock activation

- Asyra Design enables this experience only when the app URL contains the exact
  query `ai=mock`.
- Mock mode accepts one App-owned collaboration delivery flag:
  `aiDelivery=atomic` or `aiDelivery=progressive`. Missing, duplicated, or
  unknown `aiDelivery` values resolve to the safe backward-compatible
  `atomic` mode. The delivery flag never enables AI by itself.
- Missing, empty, or unknown `ai` values preserve the existing AI-disabled
  startup: no runtime, provider, AI Feature, mock timer, observer, conversation
  controller, or AI UI is constructed.
- Mock mode performs no model network request and reads no API key. The exact
  URL opt-in and a concise `Mock mode · no API key` status identify the mode
  without presenting a provider or speaker name in the conversation UI.
- The generated app template remains AI-disabled by default. The official
  generation script may synchronize the opt-in mock capability without making
  it an implicit startup side effect.
- A live HTTP provider, model credentials, backend proxy, streaming transport,
  and production authorization are not part of this plan.

### Conversation surface

- A toolbar `AI` control is present only when mock mode is enabled.
- The toolbar, a canvas Context Menu `Toggle Agent Panel` command, and the
  platform shortcut `Meta+I` on macOS or `Ctrl+I` on Windows/Linux route to one
  app-root-local toggle command. Editable fields bypass the shortcut except for
  the Agent prompt itself, where the same shortcut can close the open panel.
- Activating any entry opens one docked right-side, non-modal conversation
  panel over the canvas so the user can continue to see and edit the drawing
  result. Opening focuses the prompt; closing restores focus to a safe,
  connected invoker.
- The panel contains:
  - ordered user and assistant turns, visually distinct without any `You` or
    `Mock AI` speaker/provider labels in the header, messages, or Message Bar;
  - one multiline intent input and Send control;
  - one `Add image` control and one drag-and-drop target for local PNG, JPEG,
    or WebP reference images;
  - attachment thumbnails in the editable draft and submitted user turn, with
    an accessible remove action before submission;
  - inline drawing-detail choices when the same reference can be represented by
    materially different editable element counts;
  - an in-flight Cancel control;
  - one concise operational-status timeline for the active turn;
  - an inline confirmation request when app policy returns `confirm`; and
  - terminal success, partial, cancelled, unavailable, or failed summaries
    with the elapsed time from accepted submission through settlement.
- A submitted turn requires trimmed text and may include one or more image
  attachments. Sending a draft without trimmed text performs no runtime call,
  whether or not an image remains in the editable draft.
- The App reads accepted local images into detached, immutable turn attachment
  descriptors containing only the file name, media type, byte size, and image
  data required by the provider handoff. Attachments remain in-memory,
  app-root-local conversation data; they are not uploaded, written into the
  canonical document, persisted, or collaboration-shared.
- Unsupported files and browser read failures remain in the draft UI as
  concise errors and do not submit a Feature task. Adding, removing, dropping,
  or selecting images is disabled while one turn is active.
- While one AI Feature task is active, Send is disabled and a second turn is
  not queued.
- Every accepted turn records one non-negative monotonic elapsed duration in
  its immutable settled record. Empty, rejected, or overlapping submissions do
  not create timing records, and timing does not add an interval, listener, or
  second lifecycle owner.
- Closing the panel does not cancel a settled conversation. Closing it during
  an active turn asks the app controller to cancel that turn and removes owned
  timers/listeners after settlement.
- Conversation state is in-memory and app-root-local in this first stage. It is
  not persisted, shared, or restored after reload.

### Drawing detail clarification

- A generic draw-this-image request with an accepted reference attachment does
  not silently choose between materially different editable representations.
  The mock provider returns one registered, non-mutating
  `request_drawing_detail_choice` action.
- The action resolves as structured no-change evidence. The first turn settles
  without canvas mutation, history, or Undo, and the Agent panel presents two
  App-owned choices:
  - `Balanced detail` — 7,111 editable Vector elements and at least 115,000
    canonical points; faster to create and lighter to edit.
  - `Maximum detail` — 27,471 valid editable Vector elements and 295,794
    canonical points from the highest live-validated VTracer candidate;
    preserves substantially more photographic texture than Balanced detail but
    may take longer, use more transient memory, and make the App temporarily
    less responsive.
- Choosing an option creates one new accepted conversation turn with an exact
  App-owned detail-selection intent and the immutable attachments retained from
  the clarification turn. Only that second turn may produce a drawing plan.
- The user may ignore the choices and send another prompt. No runtime,
  confirmation, transaction, or hidden Promise remains pending after the
  clarification result settles.
- This clarification is not Framework confirmation. Framework confirmation
  remains the binary permission pause for an already prepared action, including
  destructive delete; the App continues to own its Allow/Deny impact UI.

### Operational progress, not hidden reasoning

- The UI may show stable operational phases such as:
  - `Understanding the request`
  - `Preparing an action plan`
  - `Validating app actions`
  - `Waiting for confirmation`
  - `Applying changes`
  - `Completed`, `Partially completed`, `Cancelled`, or `Failed`
- The runtime exposes an optional detached progress observer so the App can
  project actual orchestration phases instead of reconstructing them with
  unrelated UI timers.
- Progress is observational only. It cannot change permission, confirmation,
  transaction, action order, canonical state, retry, cancellation, or terminal
  results.
- Observer exceptions are contained and cannot fail or alter an invocation.
- Progress contains stable phase, attempt, plan/action identity where safe, and
  redacted summary metadata only. It contains no raw provider body, secret,
  action arguments, canonical state, or model chain-of-thought.
- The mock provider may delay its final candidate to make `Preparing an action
plan` visible. It returns a concise explanation such as `Create a high-detail
tabby cat portrait from editable Asyra vector layers`; it does not fabricate
  private reasoning tokens.

### Deterministic mock provider

- Mock behavior is selected from deterministic, schema-valid fixtures rather
  than a hidden model or general natural-language parser.
- The provider recognizes the bounded Traditional Chinese and English phrases
  declared in its fixture table. At minimum:
  - draw according to the attached reference image, including
    `請依照這張圖繪製`, when the provider input contains an accepted image
    attachment, by first returning the non-mutating drawing-detail
    clarification action;
  - the exact attached-reference instruction
    `Draw only the cat from the reference image. Exclude the original
background and place the cat on a pure white background canvas with exactly
the same width and height as the uploaded photo.` directly through the
    balanced cat-only portrait fixture. The fixture contains one pure-white
    ordinary editable background Vector whose workspace bounds equal the
    uploaded image's decoded intrinsic pixel width and height, and excludes the
    original photographic background;
  - exact App-owned balanced and maximum detail-selection intents with the
    retained accepted image attachment;
  - create/draw a cat face, including both ordinary and explicitly detailed
    phrases, through the balanced frontal tabby portrait with 7,111 ordinary
    editable VTracer-derived polygon layers, at least 115,000 canonical points,
    and at least 90 editable colors;
  - the maximum-detail reference portrait through 27,471 ordinary editable
    VTracer-derived polygon layers and 295,794 canonical points;
  - enlarge the current cat-face eyes;
  - recolor the current cat-face whiskers blue;
  - recolor the current cat-face pupils red through only the revalidated
    canonical ids exposed under the `pupils` semantic role;
  - delete the current cat face through a confirmation-required action;
  - a deterministic partial-outcome fixture;
  - a deterministic provider-failure fixture; and
  - an unsupported-request no-mutation fixture.
- Tests inject a scheduler/clock and use zero or controlled delay. Product mock
  mode uses finite documented delays and every delay is abortable.
- The same provider contract remains replaceable by the existing generic HTTP
  provider; the App UI and action contracts do not depend on mock-only result
  shapes.
- Mock fixture selection, delay, retry count, and terminal outcome are isolated
  per app/runtime instance.

### App-owned drawing and update actions

- The first action catalog adds only the bounded actions required by the mock
  conversation:
  - `request_drawing_detail_choice`
  - `insert_vector_composition`
  - `update_composition_elements`
  - `remove_ai_composition`
  - the existing visibility and selection actions
- `insert_vector_composition` accepts one strict batch descriptor rather than a
  sequence that depends on unresolved outputs from earlier runtime actions.
- The batch descriptor is strict about supported primitive kinds, finite
  workspace bounds, supported style fields, semantic role, one requested
  parent/insertion target, and no extra keys. It imposes no artificial item,
  subpath, per-path point, or composition point-count ceiling.
- A Vector item may describe one ordinary path or a finite set of independent
  subpaths. Both forms materialize as ordinary canonical Vector topology
  networks and use the same Render path; multi-path texture is not an AI-only
  renderer or fallback scene.
- App code generates all canonical element, property, topology, and group ids.
  Provider output cannot choose internal ids or call arbitrary property paths.
- `update_composition_elements` accepts exactly one bounded geometry update or
  exactly one supported `strokeColor`/`fillColor` key per target. Whiskers use
  the ordinary primary-stroke common API and pupils use the ordinary
  primary-fill common API; both revalidate the target immediately before
  mutation and preserve element and topology ids.
- The cat-face fixture creates ordinary editable Asyra oval/vector elements,
  creates the one canonical Group from the validated composition bounds before
  streaming ordered memory-bounded element batches directly into that Group,
  and returns detached mappings from semantic roles such as `left-eye`,
  `right-eye`, `left-pupil`, `right-pupil`, `pupils`, and `whiskers` to
  generated canonical ids. It does not first materialize the complete
  composition in the workspace and then perform a second full-scene read,
  move, and per-child geometry rewrite.
- Scene Tree's validated batch hierarchy owner replaces each next parent
  membership array directly without routing the growing `children` list
  through generic Setter `cloneDeep`/`isEqual` change capture. The ordered
  per-element `ADD_ELEMENT` records remain the sole transaction, replay,
  undo/redo, Render, persistence, and optional Collaboration evidence for that
  batch; the clone-free internal write adds no second history or projection
  route.
- Because Vector topology is canonically stored in workspace coordinates, the
  RenderLayer establishes the canonical render hierarchy before invoking the
  ordinary Preset Vector strategy, which subtracts the complete Group ancestor
  origin for grouped vectors. Direct grouped creation supplies group-local
  computed bounds while retaining every original workspace topology point;
  later document projection preserves the same visible workspace geometry
  without rewriting topology points or applying the Group origin twice.
- `update_composition_elements` accepts only bounded geometry/style updates for
  ids that the current context exposes and the App revalidates immediately
  before mutation.
- `remove_ai_composition` targets the current conversation composition, uses
  the ordinary subtree removal boundary, and requires confirmation.
- Every executor mutates only through `src/common-apis/*` and ordinary
  canonical owners. Render is derived output and receives no AI-specific
  drawing path.
- `request_drawing_detail_choice` accepts no provider-selected labels, counts,
  warnings, attachments, or canonical ids. The App action returns the
  structured choice kind and App-owned option ids as a no-change result; the
  presentation owner supplies all visible option wording and resource impact.

### Partial and fatal failure classification

- Provider shape/schema failure, unknown action, permission denial, and
  confirmation cancellation still terminate before mutation.
- Recoverable item failure is an app-owned resolved action result. Examples
  include:
  - a duplicate semantic role rejected before its canonical write;
  - a follow-up target that no longer exists;
  - one optional item that fails bounded app semantic preflight.
- A recoverable item is skipped, successful siblings continue, and the action
  returns detached evidence:

```ts
{
  status: 'partial',
  appliedElementIds: ['...'],
  skipped: [{ role: 'right-whisker-2', reason: 'missing-target' }]
}
```

- App preflight must classify recoverable failures before invoking a nested
  common API path whose rejection marks the outer transaction rollback-only.
- An executor rejection means the App can no longer guarantee canonical
  consistency. It remains fatal and the app transaction runner rolls back all
  rollbackable writes from the turn.
- Runtime does not reinterpret an App partial result as failure and does not
  implement item-level compensation.
- A turn with at least one committed mutation reports `executed` with a
  complete or partial app result and produces one undo commit.
- A turn with no canonical mutation produces no empty undo record and reports a
  stable no-change or failed outcome owned by the App action contract.

### One turn, one transaction, one history message

- One accepted mutating conversation turn enters one app transaction runner
  call.
- All successful mutations in that turn use `undoable: true`.
- `aiDelivery=atomic` maps every AI mutation to ordinary
  `sharedDelivery: 'transaction-end'`; Collaboration receives one publication
  only after the outer transaction commits.
- `aiDelivery=progressive` maps the same canonical writes to ordinary
  `sharedDelivery: 'immediate'`. Creation yields to the host after each
  point-aware child batch. Each progressive child batch retains the existing
  256-item transient maximum and targets at most 2,048 canonical topology
  points; one element whose intact topology alone exceeds that soft target
  remains one complete batch. The point budget never rejects, truncates, or
  caps total items, paths, or points. Multi-target updates yield after each
  applied canonical update, so a connected peer can observe ordered partial
  progress before the Agent turn settles. This does not reduce accepted detail,
  split the app transaction, or create a second synchronization protocol.
- One successful or partially successful turn creates exactly one intended
  undo commit.
- Undo once reverts every successful mutation from that turn. Redo once
  reapplies the same committed mutations through the ordinary Factory replay
  path. Factory retains the source delivery mode for shared replay:
  progressive Undo/Redo may publish the same canonical event batches
  incrementally, but each direction remains one local history action and one
  Message Bar operation.
- If a progressive turn or replay fails after an immediate publication,
  Factory owns the linked compensation publications and restores canonical
  consistency before the operation settles.
- The App transaction adapter correlates its own commit with the active
  conversation turn. The runtime does not own history UI or store canonical
  snapshots.
- After a mutating turn settles, one app-owned message bar shows the concise
  result and an Undo control.
- After that Undo succeeds, the same bar shows Redo.
- A later committed action invalidates an older AI bar as an actionable
  top-of-history control. The bar must not undo an unrelated newer action.
- Failed, denied, cancelled, unsupported, or zero-mutation turns show no
  enabled Undo control.

### Confirmation handshake

- `confirm` means the runtime pauses and awaits the app confirmation handler.
  It does not prescribe a complete-plan or visual preview.
- In this App, the active conversation panel presents a concise impact request
  containing:
  - what kind of action will occur;
  - affected target/count when known;
  - whether the action is undoable; and
  - any external or destructive effect.
- The App may derive this summary from the redacted prepared plan but does not
  show verbose low-level action arguments by default.
- Accept resolves the handler and execution continues. Reject resolves the
  handler as cancelled and opens no transaction.
- Feature cancellation, panel teardown, or app teardown aborts a pending
  confirmation wait without leaving a pending Promise or hidden UI.
- A policy returning `confirm` without a mounted app handler is a configuration
  failure or cancellation, never an invisible indefinite wait.

### Incremental follow-up targeting

- The App conversation controller owns a stable conversation id and ordered
  turn ids.
- A successful creation result records semantic-role-to-element-id mappings as
  non-authoritative session hints for that conversation.
- Before every follow-up request, the context provider revalidates hinted ids
  against current canonical state and includes only existing, permitted
  targets.
- Current canonical scene state is the source of truth. Prior user text and
  assistant summaries are semantic context only.
- A follow-up plan updates existing ids. It does not delete and regenerate the
  original composition or merge the entire original prompt into a replacement
  scene.
- Missing or ambiguous targets produce a bounded no-mutation response or an
  explicit confirmation/request for clarification; they never fall back to
  whole-composition regeneration.
- Reload, conversation disposal, or deletion of the composition removes the
  session hint. Persistent AI semantic tagging is outside this first stage.

## Ownership Contract

### `@asyra/ai-agent-runtime`

- retains provider orchestration, registry, complete preflight, permission,
  confirmation wait, transaction wrapping, cancellation, and terminal result
  ownership;
- adds only an optional detached operational progress observer;
- treats resolved app action output as successful evidence, including
  app-declared partial results;
- treats executor rejection as fatal and delegates rollback to the app runner;
  and
- owns no React state, mock phrase policy, conversation history, target
  semantics, Message Bar, Undo/Redo UI, or canonical state.

### Asyra Design AI Feature and conversation controller

- own toolbar trigger, panel lifecycle, turn ordering, one active-turn rule,
  Feature invocation/cancel, mock-mode availability, and in-memory conversation
  records;
- carry accepted detached image attachment descriptors from the immutable UI
  intent into the Feature/runtime provider context and settled user-turn
  projection without uploading them or turning them into canonical state;
- supply a stable turn correlation to progress, confirmation, transaction, and
  terminal result projection;
- retain non-authoritative semantic target hints and revalidate them through
  app queries before every follow-up; and
- do not open a second execution queue beside Feature System.

### Asyra Design mock provider

- owns deterministic phrase-to-fixture mapping, finite abortable delay,
  provider explanation, and fake failure scenarios;
- recognizes the bounded reference-image phrase only when the detached provider
  input contains an accepted image attachment, then returns the non-mutating
  detail-choice candidate;
- recognizes only exact App-owned balanced or maximum selection intents with a
  retained accepted attachment before returning the corresponding
  VTracer-derived fixture;
- emits only the public candidate-plan shape; and
- owns no executor, permission, transaction, history, or canonical-state
  access.

### Asyra Design actions and common APIs

- own strict drawing/update schemas, semantic preflight, recoverable item
  classification, canonical id generation, ordinary common API calls, and
  detached action results;
- own the provider-wording-free `request_drawing_detail_choice` schema and its
  structured no-change result;
- use one outer app transaction per accepted turn;
- throw only when canonical consistency cannot be guaranteed; and
- never expose arbitrary code, raw property maps, package internals, Render
  handles, or renderer objects to model output.

### Asyra Design UI

- owns panel presentation, operational timeline, impact confirmation,
  drawing-detail option labels/resource explanations, Message Bar, and button
  accessibility;
- projects controller/runtime/history state without becoming canonical state;
  and
- invokes Feature, confirmation, and history APIs instead of mutating document
  state directly.

### Factory, canonical owners, Render, and Collaboration

- Factory remains transaction, rollback journal, history, replay, and shared
  settlement owner.
- Scene Tree, Props, Selection, and app schemas remain canonical validators and
  mutation owners.
- Render remains an ordinary downstream projection.
- When Collaboration is already active, AI changes use only Factory's ordinary
  `transaction-end` or `immediate` delivery selected by the App-owned
  `aiDelivery` mode. Conversation text, progress, and mock thinking labels are
  not collaboration document state.
- Atomic mode publishes once after commit. Progressive mode publishes one
  ordered ordinary publication per yielded creation batch or applied update so
  peers can render step-by-step while the same outer transaction remains
  active. Factory history and replay remain the sole Undo/Redo owner.
- The local public reference WebSocket server does not impose the `ws` default
  100 MiB message ceiling on a valid finite canonical publication. It does not
  perform server-side splitting; publication boundaries are produced only by
  the selected ordinary Factory delivery semantics, never by an AI-specific
  transport, another synchronization protocol, or a second undo owner.

## Product Cases

Formal product cases cover:

1. AI-disabled startup and unknown `ai` query values create no AI side effect or
   UI.
2. Exact `ai=mock` activation exposes one toolbar trigger and one isolated
   mock conversation controller without network or secret reads.
3. Opening, closing, and reopening the non-modal panel preserves settled
   in-memory turns for the mounted app root and leaks no listeners or timers.
4. The Agent prompt accepts local PNG, JPEG, and WebP images through either
   drag-and-drop or `Add image`, shows removable draft thumbnails, and
   preserves submitted thumbnails in the user turn. A draft without trimmed
   text performs no Feature or provider call; one active turn
   disables attachment changes and Send and rejects overlap without another
   queue.
5. A submitted reference image plus `請依照這張圖繪製` first produces one
   no-mutation clarification result with App-owned `Balanced detail` and
   `Maximum detail` options, exact element-count explanations, and the maximum
   resource warning. The turn creates no history or Undo, and choosing an
   option retains the original immutable attachment in one new turn.
6. Choosing `Balanced detail`, `畫一個貓臉`, and
   `畫一個精緻的貓臉` route to one deterministic
   7,111-item frontal tabby portrait after an abortable mock delay. The portrait
   uses ordinary editable Vector elements, records role/id hints, and contains
   at least 115,000
   canonical points and 90 editable colors across head/ear shading, layered
   eyes, organic forehead and cheek stripe fur, muzzle, nose, mouth, fur flow,
   markings, and whiskers
   while preserving one undo commit and using no artificial composition-count
   ceiling.
7. Submitting the exact English cat-only reference instruction with the local
   tabby test image directly routes to the balanced cat-only fixture. The
   original photographic background is absent, the ordinary editable
   background Vector is pure white, and its bounds are exactly the uploaded
   image's intrinsic width and height.
8. Choosing `Maximum detail` with the retained reference routes to one
   deterministic 27,471-item VTracer portrait with 295,794 canonical points;
   every item has at least one finite editable subpath, and the resource warning
   is visible before this plan is requested. The one canonical Group is created
   before its ordered child batches so the finite result can settle within the
   explicit 900-second live E2E budget without a post-hoc 27,471-child move or
   geometry rewrite. Each batch applies its validated next Group membership
   through the Scene Tree owner's clone-free internal write so intermediate
   growing `children` snapshots are not retained or needlessly deep-cloned.
   The original 120,941-item / 642,388-point research trace remains retained as
   source evidence, but three live attempts exhausted the browser renderer near
   4.4 GiB before a canonical, undoable, replayable result could settle; it is
   therefore not advertised as the production Maximum choice. This is a
   validated representation choice, not an action-schema acceptance ceiling.
9. Unsupported files and failed image reads produce a concise draft error,
   preserve the editable draft, and create no Feature/provider request.
10. No progress event or assistant message exposes raw provider output, action
    arguments, secret-like values, or private chain-of-thought.
11. One successful cat-face turn creates one transaction and one undo commit;
    Message Bar Undo/Redo follows the current history top.
12. `把眼睛放大一點` updates the existing eye ids in one new transaction without
    recreating the face, ears, nose, or whiskers.
13. `把鬍鬚改成藍色` updates existing whisker ids and preserves unrelated
    composition members.
14. `make the pupils red` updates only the existing revalidated pupil ids,
    preserves their topology and every unrelated composition member, and does
    not regenerate the portrait.
15. A recoverable missing/duplicate item in the same balanced fixture
    returns partial evidence, commits
    successful siblings, reports skipped roles, and remains one undo unit.
16. A fatal canonical/executor rejection rolls back rollbackable writes and
    exposes no partial accepted result or Undo control.
17. A confirmation-required delete pauses visibly, accept executes once, reject
    opens no transaction, and abort/teardown releases the wait.
18. Mock cancellation during delay or runtime work removes timers/listeners and
    applies no later mutation.
19. Mock provider failure and unsupported prompts produce stable no-mutation
    conversation results.
20. A later non-AI committed action prevents an older AI Message Bar control
    from undoing that unrelated action.
21. Two mounted app roots keep mock provider state, progress, conversation,
    confirmation, target hints, and Message Bars isolated.
22. Existing generic HTTP and deterministic provider contracts remain
    replaceable without changing App action or conversation result semantics.
23. A two-actor collaboration E2E opens the same document in independent
    browser contexts, records both 1280-by-720 live app views side-by-side in
    one 2560-by-720 WebM, and drives Actor A through image drag-and-drop, the
    exact cat-only same-size-white-background request, blue-whisker follow-up,
    and red-pupil follow-up. Before every retained screenshot, both actors'
    compact canonical snapshots converge, existing ids and point counts remain
    stable across follow-ups, and only Actor A gains one undo entry per
    mutating turn. The recording compositor is presentation evidence only;
    direct live-app screenshots and canonical assertions remain the oracle.
    The finite creation publication must cross the ordinary local reference
    WebSocket transport without an artificial message-size ceiling.
    Before submission, each actor computes a non-canonical viewport
    scale/position from its actual visible canvas and the known 1,672-by-941
    output bounds, leaving safe padding so the complete white canvas and cat
    remain visible throughout drawing and synchronization. The explicit E2E
    command owns dedicated App/collaboration ports and never reuses a stale
    long-running development server.
24. Exact `aiDelivery=atomic` publishes a mutating AI turn once after commit.
    Exact `aiDelivery=progressive` lets the peer observe more than one ordered
    canonical creation batch while Actor A is still working, then converges to
    the same ids and topology. Both modes retain one Actor A undo entry per
    mutating turn. Progressive Undo and Redo reuse canonical replay and the
    source batch boundaries without becoming multiple local history actions;
    rollback after an already-published batch emits linked Factory
    compensation. Progressive creation uses a 2,048-point soft batch target
    plus the existing 256-item transient maximum; an intact over-target element
    remains accepted in one batch, so the target is never a composition or
    topology ceiling.
25. Generated-template synchronization preserves explicit mock opt-in and
    AI-disabled default startup.
26. Every terminal conversation outcome shows a concise elapsed duration
    measured from accepted submission through final settlement.

## Explicit Non-Goals

- a live model vendor, API key, backend proxy, production authentication,
  quotas, billing, or rate limits;
- raw or summarized private model chain-of-thought;
- streaming model tokens, tool calls, web search, image generation, or video
  generation;
- remote image upload, persistent attachment library, URL import, camera
  capture, OCR, or a live multimodal/model provider;
- a visual ghost/dry-run scene before confirmation;
- arbitrary drawing, scripting, expressions, plugins, package-private APIs, or
  unrestricted property mutation;
- persistent/shared conversation history or durable semantic tags;
- background agents, autonomous loops, parallel AI turns, or another session
  queue;
- regeneration of a complete composition as fallback for a missing follow-up
  target;
- changing existing canonical transaction, undo/redo, collaboration,
  persistence, or Render ownership;
- making mock mode the default production or generated-app startup path.

## Inspector Owner Steps

The matching Inspector defines these exact owner steps:

1. **Accept mock conversation intent**
   - toolbar/panel input, local image add/drop/remove draft, mock-mode
     condition, App-owned drawing-detail choice activation,
     empty/invalid/overlap bypass, and one app-root UI intent artifact.
2. **Manage one conversation turn**
   - conversation/turn ids, Feature invocation/cancel, target-hint
     revalidation, detached attachment handoff, active-turn isolation, and
     terminal record ownership.
3. **Produce deterministic mock candidate**
   - bounded phrase fixture, abortable delay, provider explanation, stable
     clarification/balanced/maximum fixtures, stable failure fixture, and no
     mutation authority.
4. **Orchestrate runtime preflight and progress**
   - context, provider request/result, complete plan validation, permission,
     optional progress observer, confirmation request, and no-mutation exits.
5. **Resolve app confirmation**
   - concise impact request, visible pending state, accept/reject/abort, and no
     required low-level or visual preview.
6. **Execute one app composition transaction**
   - strict action schemas, semantic preflight, canonical common APIs,
     non-mutating detail-choice result, complete/partial/fatal classification,
     one transaction, and detached result.
7. **Project conversation and current history action**
   - ordered messages, operational timeline, result/warning summary, current
     drawing-detail option UI, Message Bar Undo/Redo, accessibility, teardown,
     and instance isolation.

Every step declares owner, inputs, outputs, conditions, bypasses, allowed and
forbidden contributors, implementation boundary, specification references,
failure owner, product cases, and Definition of Done.

## Planned Implementation Slices

Each slice starts with a Step Execution Card and receives a bounded local commit
only after its focused formal tests and direct-consumer review pass.

1. Close plan/Inspector/BDD readiness and synchronize the Gate 4 partial/fatal
   and confirmation clarification.
2. Add the optional runtime operational progress observer with redaction,
   abort, observer-failure containment, lifecycle, and package tests.
3. Add exact mock-mode startup parsing, deterministic abortable provider
   fixtures, and disabled-route tests.
4. Add strict batch composition/update/removal schemas, app semantic preflight,
   common API execution, role/id results, partial/fatal tests, and one-turn
   transaction evidence.
5. Add the app conversation controller, Feature correlation, target-hint
   revalidation, incremental follow-up behavior, cancellation, and instance
   isolation.
6. Add the toolbar trigger, non-modal panel, operational timeline,
   confirmation request, result summaries, and accessible controls.
7. Add the transaction-correlated Message Bar with top-history-safe Undo/Redo.
8. Add focused E2E mock conversations, canonical source-space assertions,
   synchronized visual review, full app/package gates, and official generated
   template synchronization.

## Required Validation

### Plan and Inspector readiness

- target-specific Inspector contract test;
- shared Flow Inspector structural/viewer test;
- AI Agent Runtime readiness, Inspector, and BDD contract tests;
- exact plan/Inspector/BDD authority and anchor resolution;
- no contradiction between current runtime behavior and clarified
  recoverable/fatal wording.

### Framework runtime slice

- focused `@asyra/ai-agent-runtime` progress, redaction, abort, observer-failure,
  confirmation, partial-result, fatal-rejection, and lifecycle tests;
- package build and example;
- no change to provider replacement or AI-disabled side effects.

### App behavior slices

- focused App unit/integration tests for mode parsing, mock provider,
  conversation controller, confirmation, actions, context, transaction
  correlation, Message Bar, and UI state;
- panel tests for add/drop/remove, accepted image media types, immutable
  attachment submission, unsupported/read-failure bypass, thumbnail
  projection, busy-state locking, and cleanup;
- provider/action/controller/presentation tests prove a generic attached-image
  request settles as no-change clarification, visible option
  labels/counts/warning are App-owned, selection retains the original
  attachment, and only the selected second turn requests balanced or maximum
  drawing;
- deterministic controller-clock tests prove elapsed time covers the accepted
  turn through every terminal settlement without adding a timer lifecycle;
- one resolved partial result commits successful siblings in one undo entry;
- one fatal executor rejection rolls back through ordinary Factory ownership;
- one follow-up updates exact existing ids and creates no replacement
  composition;
- one later non-AI action invalidates the AI bar's history command.

### Product and release gates

- focused Playwright flows for success, follow-up edit, partial, confirmation,
  cancel/failure, and Undo/Redo;
- one explicit resource-aware two-actor Playwright flow records both independent
  1280-by-720 live app contexts side-by-side in one 2560-by-720 WebM while
  Actor A drag-drops the local reference, requests only the cat on a pure-white
  canvas with the uploaded photo's exact width and height, recolors existing
  whiskers blue, and recolors existing pupils red;
- the explicit recording flow starts fresh PID-tracked test servers on
  dedicated ports and frames the complete known 1,672-by-941 output bounds in
  each actor before Actor A submits the drawing request;
- the high-detail creation E2E attaches a real local reference image through
  the visible Agent panel before submitting `請依照這張圖繪製`;
- canonical ids, types, bounds, roles, styles, group membership, and transaction
  evidence asserted before screenshots;
- the two-actor recording asserts canonical convergence, stable ids/topology,
  same-size white background, incremental colors, and exactly one Actor A undo
  entry per mutating turn before retaining each paired live screenshot;
- synchronized live-app visual review for:
  - the drawing-detail choice with both resource explanations before mutation;
  - mock panel while planning;
  - completed cat face and success Message Bar;
  - the high-detail tabby fixture at a close enough view to inspect both eyes,
    forehead/cheek stripes, ear and muzzle fur, nose, mouth, and whiskers;
  - partial warning;
  - visible confirmation wait;
  - Undo then Redo;
- `yarn workspace @asyra/asyra-design test:local`;
- affected package and App builds;
- dependency validation;
- `yarn lint:ci`;
- `yarn react:build`;
- official generated-template synchronization and template check/build.

## Definition Of Done

- The active product contract, Inspector, BDD cases, package/App docs, and
  release decision history agree.
- Exact `ai=mock` mode provides the complete conversation experience without an
  API key, network request, live provider, hidden chain-of-thought, or
  AI-default startup side effect.
- The Agent prompt accepts local reference images through both file selection
  and drag-and-drop, previews and removes draft attachments accessibly, and
  carries submitted attachment data through the App-owned turn context without
  upload, persistence, collaboration state, or canonical canvas mutation.
- A generic reference request pauses as a settled no-mutation clarification
  with balanced and maximum editable-detail choices; no canvas/history work
  begins until the user chooses, and the maximum option carries an explicit
  resource warning grounded in the validated fixture.
- The cat-face creation and two incremental follow-up examples mutate ordinary
  canonical elements through registered app actions and common APIs.
- Every mutating turn creates one intended undo commit and the App Message Bar
  never applies Undo/Redo to an unrelated newer action.
- Atomic and progressive AI collaboration delivery are exact App-owned modes;
  progressive peers observe ordered canonical batches before settlement while
  transaction, compensation, and history remain Factory-owned.
- Recoverable item failure commits successful siblings with structured partial
  evidence; fatal executor/canonical failure rolls back.
- Confirmation visibly pauses through the app-owned handler and is released by
  accept, reject, abort, panel teardown, and app teardown.
- Current canonical state, not regenerated original prompt text, owns follow-up
  target truth.
- App/runtime/provider instances, timers, observers, confirmations,
  conversations, target hints, and UI state remain isolated and disposed.
- Focused tests, full affected gates, generated template checks, and
  synchronized visual evidence pass.
- The final bounded review finds no second execution queue, arbitrary model
  action, UI-owned canonical state, patch drawing path, Render bypass, secret
  exposure, or out-of-scope live-provider implementation.

## Stop Conditions

Stop and request direction if implementation requires:

- exposing or simulating private chain-of-thought rather than operational
  status and concise explanation;
- a second canonical scene, preview scene, execution queue, history stack, or
  transaction owner;
- App UI or mock provider mutation outside registered action/common API paths;
- catching a rollback-only canonical failure and committing an inconsistent
  prefix;
- regenerating the complete composition as fallback for an unresolved
  follow-up target;
- enabling AI or mock mode by default in production/generated startup;
- a live endpoint, API key, external service, or broader action catalog; or
- files outside the Inspector implementation boundaries and this frozen plan.
