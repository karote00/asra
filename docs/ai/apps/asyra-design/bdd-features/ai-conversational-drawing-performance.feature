Feature: Conversational AI drawing performance
  As an Asyra Design user creating high-detail editable drawings
  I want canonical drawing, local projection, collaboration, and persistence to use one bounded framework flow
  So that high detail remains interactive without weakening identity, history, or persistence semantics

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

  Scenario: Core exposes one plural element creation path
    Given one validated AI composition contains one Group and many accepted children
    When the App executes the mutating turn
    Then it should call "Core.createElementsInParent" once for all accepted children
    And Core should return only ordered canonical element ids
    And a single-item create API should use the same batch-of-one canonical path
    And Group and children should remain inside one outer Factory transaction
    And Core should expose no Factory delivery handle, progressive handle, timing result, or transport receipt
    And no slice should repeat or split the canonical mutation

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
    And Scene Tree element-to-property target resolution should be read-only
    And Core should receive both complete owner plans before authorizing either apply
    And Props Manager should not mutate Scene maps or hierarchy
    And Scene Tree should not materialize property instances, rebind relationships, or register properties
    And a later invalid item should leave no committed owner prefix
    And an unexpected apply failure should roll back both owners through the outer Factory transaction

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
    And the public single-event transaction convenience should delegate to a batch-of-one
    And Factory should combine the owner batches into one immutable transaction artifact and one intended History action
    And every transaction should use the same record, commit, and rollback semantics
    And progressive visibility should observe the ordinary staged artifact status stream
    And progressive visibility should not be a transaction mode or option
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
    And different source publications should not be merged
    And App policy should validate the publication before Core canonical apply
    And Actor B should apply "UPDATE_PROPERTY" without receiving "UPDATE_COMPUTED_DATA" through CRDT
    And Actor B should derive computed state locally and update ordinary Render output
    And the consumer promise should resolve only after canonical apply completes
    And Actor B should create no Undo action
    And Actor B should create no echo publication
    And Actor B should perform no persistence capture, provider save, or IndexedDB write

  Scenario: Local persistence captures each committed state exactly once
    Given local action, Undo, and Redo commits are eligible for durability
    When each commit reaches the isolated persistence handoff
    Then each commit should capture one complete deeply detached snapshot
    And snapshots should reach the provider in FIFO order
    And one failed save should not drop or prevent a later eligible snapshot
    But a remote-origin transaction should capture and save no client snapshot

  Scenario: Fast Mock AI CRDT correctness stays bounded
    Given two browser actors share one fresh collaboration document
    And the default deterministic Mock AI CRDT fixture contains 16 items
    When Actor A accepts the fixture through the ordinary Agent route
    Then both actors should converge on identical canonical ids, topology, hierarchy, and styles
    And Actor A should gain one Undo action while Actor B gains no local Undo action
    And the 7112-element balanced correctness gate should remain change-aware or explicitly requested
    And high-detail performance and CRDT suites should remain independent and explicitly opt-in
    And the 7076-element two-window full recording should remain manual opt-in

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

  Scenario: Performance work preserves cancellation and failure semantics
    When the user cancels, a recoverable item fails, a fatal canonical error occurs, a frame is invalid, the transport closes, the worker tears down, or the app tears down
    Then recoverable siblings should still commit as one partial result
    And fatal failure should roll back the complete turn
    And an already-published immediate slice should use the same artifact inverse for compensation
    And no performance path should fabricate success, skip an owner, persist a remote transaction, or leave an extra history action
