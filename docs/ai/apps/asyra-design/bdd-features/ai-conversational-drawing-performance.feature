Feature: Conversational AI drawing performance
  As an Asyra Design user creating high-detail editable drawings
  I want canonical drawing, local projection, and collaboration to use one bounded framework flow
  So that high detail remains interactive without weakening identity or history semantics

  Background:
    Given the committed 1672 by 941 tabby reference image
    And the production Asyra Design build uses exact "ai=mock" mode
    And product spans are separated from server, browser, assertion, screenshot, and recording overhead
    And one unmeasured warm-up precedes three measured reference runs

  Scenario: Profiling remains observational
    When the balanced high-detail collaboration profile is evaluated
    Then timing should distinguish product execution, Factory artifact construction, worker encode, server queue and drain, worker decode, remote apply, Render, UI, and harness overhead
    And the Contents present average should be 7.026 seconds
    And the Contents omitted average should be 7.074 seconds
    And prior high-detail throughput evidence should retain the receiver provider and worker handoff timing
    And detached profiling should not alter canonical state, delivery, history, retry, cancellation, or terminal results

  Scenario: Exact-bounds loading state precedes local drawing
    Given one validated local AI composition has exact accepted workspace bounds
    When the App begins the mutating turn
    Then it should publish runtime-only drawing progress with those exact bounds
    And a connected App DOM overlay should commit with the exact transformed bounds before any canonical element is created
    And the overlay should be pointer-events none and never become canonical, persistent, shared, Render-owned, or an AI-only renderer
    And its CSS activity should animate only transform and opacity through the compositor
    And the App should cross a browser paint opportunity after DOM commit and before canonical mutation
    And the first completed drawing batch should use the ordinary Vector route
    And success, failure, cancellation, and teardown should clear the drawing progress

  Scenario: Local progressive composition becomes visible in cooperative batches
    Given one validated AI composition contains one Group and 7111 accepted children
    And the URL resolves exact "aiDelivery=progressive"
    When the local Agent executes the mutating turn
    Then the App should use deterministic point and element-count batch boundaries with at most 32 elements per ordinary work unit
    And it should call plural "Core.createElementsInParent" once per non-empty batch
    And every successful batch should complete ordinary projection and advance actual element progress
    And the next batch should begin only from a later browser task in the same serialized loop
    And a microtask-only yield or one independently scheduled timeout per range should not satisfy that boundary
    And the Feature-owned AbortSignal should be checked after every awaited boundary
    And all batches should remain inside one outer transaction
    And the complete turn should create one Undo action
    And fatal failure or cancellation should roll back the complete composition
    And no loading, progress, or slice-policy parameter should enter Core, Props Manager, or Scene Tree

  Scenario: Drawing progress keeps navigation responsive while edits stay locked
    Given one progressive local AI drawing turn is active
    And the App acquired its document interaction lock before the outer transaction
    When the serialized composition loop yields to a later browser task
    Then ordinary viewport pan and zoom should remain available
    And pan and zoom should repaint the same live loading frame and ordinary Vector output
    And navigation may continue through ordinary Feature execution and its existing transaction wrapper
    And navigation should produce no canonical mutation or History
    And navigation should not alter the AI action transaction evidence
    And every other tool interaction and document mutation should remain blocked
    And another mutating Agent turn, selection changes, property edits, deletion, Undo, and Redo should create no canonical mutation or history
    And AI cancellation should remain available
    And success, failure, cancellation, or teardown should release the App lock
    And a second reactive-events bus should not act as the scheduling or admission lock
    And the complete drawing turn should still create one Undo action

  Scenario: Core exposes one fixed plural element creation path
    Given one validated AI composition contains one Group and many accepted children
    When the App submits one atomic or progressive child batch
    Then it should call plural "Core.createElementsInParent"
    And Core should return only ordered canonical element ids
    And a single-item create API should use the same batch-of-one canonical path
    And Group and children should remain inside one outer Factory transaction
    And Core should expose no Factory delivery handle, progressive handle, timing result, or transport receipt
    And Core should receive no loading, progress, AI mode, slice size, or host-yield parameters
    And atomic mode should submit one all-children plural batch
    And progressive mode should submit multiple ordered plural batches without opening another transaction

  Scenario: Canonical element property replacement uses the update path
    Given group geometry, element geometry, stroke, fill, or property-panel changes replace complete canonical property field values
    When one or many elements receive those complete field replacements
    Then Core should use plural "updateElementProperties"
    And that API should not accept record set or remove operations
    And Scene Tree should resolve the complete element-to-property target plan without mutation
    And Props Manager should preflight every complete property value before one apply
    And a property-only request should require no Scene mutation plan
    And the result should contain only ordered affected element ids
    And a later invalid target or value should leave no property or evidence prefix

  Scenario: Canonical element property record delta uses the patch path
    Given a vector topology action contains typed record set or remove operations
    When one or many elements receive that ordered record delta
    Then Core should use plural "patchElementProperties"
    And record set or remove should not use the complete replacement API
    And Props Manager should preflight every child instance, owner relation, order, and field before one apply
    And setting a missing record should materialize its typed child only after complete preflight
    And removing a record should unlink its exact relation and remove only an otherwise unowned child
    And forward and inverse evidence should restore exact values, registry membership, relations, and order
    And "changeComputedData" and "changeComputedDataPatch" should not remain as canonical compatibility APIs

  Scenario: Props and Scene Tree apply separate owner plans
    Given an accepted batch contains property inputs and Scene lifecycle inputs
    When Core requests complete owner preflights
    Then Props Manager should validate schema, property instances, relationships, registration, and property evidence
    And Core should call public Props prepare and apply owner capabilities instead of package-private methods
    And active property value replacements and record patches should use one whole-batch preflight and apply
    And Scene Tree should validate Scene ids, maps, parent children, hierarchy order, tombstones, and Scene evidence
    And a canonical Scene insertion plan should expose its frozen owner relations for Core to pass unchanged to Props exact graph creation
    And Scene Tree element-to-property target resolution should be read-only
    And Core should receive both complete owner plans before authorizing either apply
    And Props Manager should not mutate Scene maps or hierarchy
    And Scene Tree should not materialize property instances, rebind relationships, or register properties
    And a later invalid item should leave no committed owner prefix
    And an unexpected apply failure should roll back both owners through the outer Factory transaction

  Scenario: Scene plural evidence remains sliceable without splitting records
    Given one accepted Scene batch contains many canonical elements
    When Scene Tree applies the complete insertion or removal plan
    Then Scene Tree should emit one plural Scene event
    And Scene Tree should expose one ordered shared record per element for "ADD_ELEMENTS" and "REMOVE_ELEMENTS"
    And a publication slice may group complete records but should not split one semantic record
    And progressive delivery should not create another Scene mutation or history action

  Scenario: Shared property updates fan out through Scene relations
    Given two distinct element relation tuples reference one compatible canonical property component id
    And each relation is identified by its element id and property name rather than by exclusive component ownership
    When either owner element requests the same canonical property update
    Then Scene Tree should group equivalent targets by property id into one property mutation
    And "UPDATE_PROPERTY" should remain source-only evidence without using the initiating element as fanout authority
    And Scene Tree should resolve both owner elements through its derived reverse relation index
    And both owner elements should receive computed projection through one ordered local batch
    And CRDT should publish the property source once without publishing computed projection
    But conflicting writes to the same shared field or record in one batch should reject atomically before Props preflight

  Scenario: Shared property roots survive until the final relation is removed
    Given two element relation tuples reference the same canonical root property graph
    And that graph contains a nested child which is also another element's canonical root
    When a direct Scene removal releases the first relation
    Then the Scene plan should record released and retained relations and retain Props
    And the remaining element relation should keep the same root and descendant component ids active
    When Core full lifecycle removes the final relation
    Then Scene Tree should identify the deduplicated orphan root from an exact relation-set read
    And Scene Tree should provide the complete retained root property ids from all planned remaining element relations
    And Core should pass orphan and retained root ids unchanged without inspecting the property graph
    And Props Manager should stop orphan traversal at every retained root
    And Props Manager should remove only the final orphan property graph exactly once
    And a changed relation set between prepare and apply should reject as stale before mutation
    And Undo and Redo should restore and remove the exact relation tuples and canonical component ids
    And remote exact removal should use one origin-neutral Core canonical-data path and consume its Scene and Props batches once
    And CRDT remote apply should preserve the same shared evidence without computed payloads or client persistence

  Scenario: Shared relation boundary remains minimal
    Given Props independently owns property/component identity, lifecycle, and the property-child graph
    And Scene independently owns element hierarchy and each element-slot-to-root relation
    Then that separation should remain the stable extension seam for future shared props, shared components, and shared elements
    But the current contract should not introduce generic owner kinds, reference-count APIs, multi-parent shared elements, shared-element DAG, permissions, leases, pinning, garbage collection, server persistence, server-owned lifecycle policy, or a universal relationship service

  Scenario: Typed subtree removal remains one Scene mission
    Given one non-empty Group owns nested editable elements and canonical property relations
    When Scene Tree calls "prepareSubtreeRemoval" with that one root
    Then the plan should contain the complete child-first canonical element order
    And the plan should contain one "CHANGE_SUBTREE" evidence record
    And the plan should delegate mutation to the same "applyElementMutationPlan" owner
    And a direct Scene apply should retain Props
    When Core full lifecycle applies that plan
    Then Core should pass the complete orphan and retained root ids unchanged to Props

  Scenario: Load relations preflight before any owner applies
    Given Scene Tree has an owner-issued load validation result and detached Props validated data
    When Scene Tree calls "preflightLoadPropertyRelations"
    Then a missing component id, wrong property type, or changed registration should reject
    And no owner should apply any state
    And the Core version should remain unchanged
    And no file load complete event should publish
    But compatible shared component relations should pass without materialization or active Props reads

  Scenario: Computed data remains a local Render projection
    Given Actor A updates one canonical property
    When Props Manager emits "UPDATE_PROPERTY"
    Then Factory may record and publish the property source evidence
    And the local property subscription should derive computed state
    And "UPDATE_COMPUTED_DATA" should reach Render through an ordinary local reactive event
    And computed evidence should create no History entry, SharedDataChannel batch, Collaboration publication, or persistence snapshot
    And Actor B should derive the same computed state locally after applying the property source evidence
    And a future local animation tick may update computed state without changing a property component or publishing CRDT data
    And the local computed API should accept no "EVENT_OPTIONS"

  Scenario: Raw element data and computed projection use distinct evidence
    Given one action changes a canonical raw element field and another changes local computed projection
    When Scene Tree prepares the raw mutation plan and separately projects computed state
    Then raw name, visibility, and lock should use canonical "UPDATE_ELEMENT_DATA" evidence
    And local computed values should use ordinary "UPDATE_COMPUTED_DATA" projection events
    And Factory should record the raw evidence
    But Factory, History, Collaboration, and persistence should never record the computed projection

  Scenario: SharedDataChannel has one required batch contract
    Given a framework shared channel receives one or many canonical changes
    When Factory delivers the ordered changes
    Then the channel should use required "appendBatch" and "observeBatch" methods
    And framework internals should use the same batch method for a one-item batch
    And public single-item append and observe conveniences should delegate to batch-of-one
    And the built-in batch should be deeply detached and frozen once
    And no atomicity flag, prototype identity branch, WeakSet capability check, or single-item fallback loop should run

  Scenario: Custom shared channels own their implementation correctness
    Given a developer registers a custom SharedDataChannel
    When the channel exposes the complete required batch method shape
    Then the framework should use that declared batch contract without probing its implementation
    And custom atomicity and correctness should remain the developer's responsibility
    But a channel missing the required method shape should fail registration
    And the framework should not repair, split, benchmark, or infer custom behavior

  Scenario: Factory keeps one transaction semantic
    Given one intended action mutates canonical property and Scene owners
    When Factory records the ordered source evidence
    Then each Props or Scene owner evidence emission should be accepted exactly once as one immutable ordered batch
    And canonical ordered ids and shared records should remain inside their owning transaction event
    And "updateTransactionBatch" should accept no parallel evidence parameter
    And the public single-event transaction convenience should delegate to a batch-of-one
    And Factory should combine the owner batches into one immutable transaction artifact and one intended History action
    And every transaction should use the same record, commit, and rollback semantics
    And observer evidence should publish only after the owner commit as one ordered batch
    But rollback or owner finalization failure should publish no observer prefix
    And progressive local composition may deliver ordinary immediate owner batches inside that transaction
    And progressive visibility should remain an App delivery policy rather than a Factory transaction mode
    And rollback should compensate every already-visible immediate batch from the same journal evidence
    And optional later publication slicing may observe the ordinary staged artifact status stream
    And the one active staged-artifact controller should reject ids absent from the current Factory journal
    And Factory should derive each eligible staged slice, committed remainder, or rollback compensation through the same "SharedPublication" route
    And an eligible staged publication should retain stable transaction, publication, slice, and inverse-compensation identity
    And acknowledged staged slices should use the same journal evidence for rollback compensation
    And commit should not republish an acknowledged staged canonical record
    And Undo and Redo should each restore the complete intended action

  Scenario: Collaboration Provider has one publication path
    Given Factory emits one ordered "SharedPublication" transaction batch
    When Collaboration sends or receives that publication
    Then Collaboration should use one required "sendPublication" path
    And Collaboration should use one required "onPublication" async consumer path
    And Collaboration should consume only Factory-owned "SharedPublication" artifacts instead of inferring publications from staged status
    And the outbound promise should resolve only after bounded Provider queue acceptance and delivery ownership
    And the inbound consumer promise should settle only after App canonical apply completes or fails
    And generic Collaboration should own no publication group size, concurrency constant, lease mode, or runtime capability branch

  Scenario: Binary publication transport applies byte backpressure
    Given Collaboration hands one publication to the Provider
    When the Provider codec worker creates versioned binary publication frames
    Then control frames should remain JSON
    And publication payloads should transfer as ArrayBuffer values without JSON pre-serialization
    And the server should relay canonical payload bytes without decode or re-encode
    And the receiver should admit frames into a bounded 2 MiB worker ingress window
    And the worker should validate header, order, and duplicate identity before emitting "frame-consumed"
    And each peer should enforce an exact 2 MiB unretired byte capacity
    And one oversized indivisible frame should be allowed only for an otherwise empty peer queue
    And already-admitted peer frames should continue in FIFO order through the bounded byte window before prior "frame-consumed" credit
    And frame retirement and capacity release should still require both the exact socket callback and exact "frame-consumed" credit
    And blocked peer admission should resume when contiguous retirement leaves exact capacity for the next frame
    And blocked publication admission should not pause the JSON control fast path
    And "server-accepted", "frame-consumed", and "peer-applied" should remain distinct receipts
    And those receipts should remain diagnostic status rather than alternate "sendPublication" completion modes
    And client and server WebSockets should use "perMessageDeflate: false"

  Scenario: Remote property follow-ups derive computed state locally
    Given Actor B receives one valid property-only source publication
    When the required async consumer opens the remote Factory transaction
    Then Actor B should open exactly one remote Factory transaction for that publication
    And the App should submit one ordered "CanonicalChange" request through "Core.applyCanonicalChanges"
    And different source publications should not be merged
    And App policy should validate the publication before Core canonical apply
    And Actor B should apply "UPDATE_PROPERTY" without receiving "UPDATE_COMPUTED_DATA" through CRDT
    And Actor B should derive computed state locally and update ordinary Render output
    And the consumer promise should resolve only after canonical apply completes
    And Actor B should create no Undo action
    And Actor B should create no echo publication
    And Actor B should perform no persistence capture, provider save, or IndexedDB write

  Scenario: Demo documents load empty without client persistence
    Given an ordinary local demo or collaboration demo starts
    When RenderApp starts Core for the demo session
    Then the ordinary local demo and each collaboration actor should load one canonical empty document after Core starts
    And collaboration should connect only after its empty document is loaded
    And the ordinary local demo should receive no client persistence provider
    And Actor A should receive no client persistence provider
    And Actor B should receive no client persistence provider
    And ordinary local actions, Undo, and Redo should perform no persistence capture, provider save, IndexedDB read, or IndexedDB write
    And Actor A local actions, Undo, and Redo should perform no persistence capture, provider save, IndexedDB read, or IndexedDB write
    And Actor B remote apply should perform no persistence capture, provider save, IndexedDB read, or IndexedDB write
    But demo reload durability and server database checkpoints should remain outside this plan

  Scenario: Fast Mock AI CRDT correctness stays bounded
    Given two browser actors share one fresh collaboration document
    And the default deterministic Mock AI CRDT fixture contains 16 items
    When Actor A accepts the fixture through the ordinary Agent route
    Then both actors should converge on identical canonical ids, topology, hierarchy, and styles
    And Actor A should gain one Undo action while Actor B gains no local Undo action
    And the 7112-element balanced correctness gate should remain change-aware or explicitly requested
    And high-detail performance and CRDT suites should remain independent and explicitly opt-in
    And the 7076-element two-window full recording should remain manual opt-in

  Scenario: One local interactive drawing run reports user-visible milestones
    Given one production browser starts with one empty canonical document
    And Contents, Collaboration, a second Actor, and IndexedDB are absent
    And the URL resolves exact "aiDelivery=progressive"
    When the local Agent creates the 7112-element balanced composition once
    Then the report should name connected-DOM loading, first compositor paint opportunity, first-Vector, 25, 50, 75, 100 percent, longest work-unit, cooperative-yield-count, settled, Render, UI, and harness times
    And milestone observation should use bounded runtime counters instead of full canonical snapshot polling
    And one terminal exact summary should preserve all 7112 projections, exact detail, and one Undo action
    And synchronized visual review should inspect the real connected DOM loading state and final ordinary Vector output from that same live App state
    But this local gate should not run a warm-up, repeat the high-detail creation, start CRDT, read IndexedDB, record video, or close deferred collaboration gates

  Scenario: Balanced atomic creation meets the local budget
    Given the URL resolves exact "aiDelivery=atomic"
    When Actor A creates the balanced cat-only composition
    Then the median accepted-turn-to-settled time should be at most 12 seconds
    And no measured run should exceed 20 seconds
    And Actor A should have exactly 7076 non-workspace canonical elements
    And the turn should create one intended Undo action

  Scenario: Balanced progressive creation and peer convergence meet their budgets
    Given two browser actors share one fresh collaboration document
    And the URL resolves exact "aiDelivery=progressive"
    When Actor A creates the balanced cat-only composition
    Then Actor A median accepted-turn-to-settled time should be at most 20 seconds
    And no Actor A measured run should exceed 30 seconds
    And Actor B should show its first canonical batch within 2 seconds of the first shared publication
    And Actor B should converge within 30 seconds of Actor A canonical creation commit
    And both actors should converge on identical ids, topology, hierarchy, styles, and background bounds
    And Actor A should gain one Undo action while Actor B gains no local Undo action

  Scenario: Existing-id follow-ups retain topology and meet the peer budget
    Given both actors converged on the balanced cat-only composition
    When Actor A changes existing whiskers to blue
    Then Actor B should converge within 5 seconds of Actor A settlement
    And all canonical ids and point counts should remain unchanged
    When Actor A changes existing pupils to red
    Then Actor B should converge within 5 seconds of Actor A settlement
    And all canonical ids and point counts should remain unchanged
    And each mutating turn should add exactly one Actor A Undo action

  Scenario: Maximum detail remains editable and meets its budget
    When Actor A creates the maximum-detail fixture
    Then the drawing should contain 27471 ordinary editable Vector elements and 295794 canonical points
    And median accepted-turn-to-settled time should be at most 60 seconds
    And no measured run should exceed 90 seconds
    And no item, path, point, payload, frame, or composition ceiling should reject the drawing
    And the turn should create one intended Undo action

  Scenario: The complete progressive product flow meets its budget
    When Actor A creates the balanced cat-only portrait and applies both existing-id follow-ups
    Then the three-turn product spans should total at most 90 seconds median and 120 seconds worst
    And the dedicated E2E command including harness overhead should finish within 180 seconds
    And generated screenshots, recordings, profiles, traces, and thumbnail media should remain ignored local artifacts

  Scenario: Production performance evidence remains detached from dev-only globals
    Given the production performance profile observes canonical and transaction evidence
    When the formal performance harness queries the measured App state
    Then it should receive detached canonical, history, Factory status, commit, and publication snapshots
    And dev-only "window.__Core__" should not satisfy production evidence
    And navigation, App readiness, collaboration readiness, Mock AI readiness, reference attachment, runtime evidence, and history baseline should remain named harness spans
    And the harness should not open, poll, normalize, stringify, or hash IndexedDB

  Scenario: Performance work preserves cancellation and failure semantics
    When the user cancels, a recoverable item fails, a fatal canonical error occurs, a frame is invalid, the transport closes, the worker tears down, or the app tears down
    Then recoverable siblings should still commit as one partial result
    And fatal failure should roll back the complete turn
    And an already-published immediate slice should use the same artifact inverse for compensation
    And no performance path should fabricate success, skip an owner, configure collaboration client persistence, or leave an extra history action
