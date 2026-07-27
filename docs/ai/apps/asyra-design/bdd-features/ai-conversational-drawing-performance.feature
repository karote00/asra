Feature: Conversational AI drawing performance
  As an Asyra Design user creating high-detail editable drawings
  I want canonical drawing, collaboration, and Contents projection to use bounded batch boundaries
  So that high detail remains interactive without weakening identity, history, or persistence semantics

  Background:
    Given the committed 1672 by 941 tabby reference image
    And the production Asyra Design build uses exact "ai=mock" mode
    And product spans are separated from server, browser, assertion, screenshot, and recording overhead
    And one unmeasured warm-up precedes three measured reference runs

  Scenario: Profiling fixes the first architecture owners
    When the balanced high-detail collaboration profile is evaluated
    Then timing should distinguish product execution, Factory artifact construction, worker encode, server queue and drain, worker decode, remote apply, Render, UI, and harness overhead
    And the Contents present average should be 7.026 seconds
    And the Contents omitted average should be 7.074 seconds
    And the first implementation owner should be the receiver provider and worker handoff
    And head-only peer relay should amplify that delay rather than identify Node socket write as the owner
    And detached profiling should not alter canonical state, delivery, history, retry, cancellation, or terminal results

  Scenario: One composition uses one canonical bulk request
    Given one validated AI composition contains one Group and many accepted children
    When the App executes the mutating turn
    Then it should call "Core.createElementsInParentBatch" once for all accepted children
    And the result should retain ordered canonical element ids and one Factory-owned delivery handle
    And a single-item create API should use the same batch-of-one canonical path
    And point-aware progressive slices should begin at 2048 points and grow to 8192 points
    And one indivisible element may exceed the soft slice target
    And no slice should repeat or split the canonical mutation

  Scenario: Canonical batch preflight rejects a later invalid item atomically
    Given an accepted child batch contains a later invalid property or relationship
    When Props Manager and Scene Tree preflight the complete batch
    Then no property, instance, relationship, registry, hierarchy, parent child, or Factory evidence prefix should remain
    And a valid batch should perform one map registration phase
    And a valid batch should perform one parent children replacement
    And a valid batch should produce one ordered batch evidence handoff
    And necessary owner-local instance, relationship, observer, and Scene entry iteration should only block release when profiling proves a material bottleneck

  Scenario: Creation API choice follows data lifecycle rather than origin
    Given ordinary descriptors, detached canonical snapshots, and canonical data with active property owners are valid inputs
    When a client chooses the matching Scene Tree creation API
    Then ordinary descriptors should use "addNewElement" or "addNewElements"
    And detached canonical snapshots should use "addNewElementsFromCanonicalData"
    And canonical data with active property owners should use "addNewElementsFromCanonicalDataUsingActiveProperties"
    And no creation API should be blocked because the caller is local or remote
    But an active transaction owner should atomically accept canonical batch evidence

  Scenario: Replay removal API choice follows property lifecycle rather than origin
    Given ordinary removal owns complete property cleanup
    And retained history or collaboration evidence carries Scene and Props removal separately
    When a client chooses the matching Scene Tree removal API
    Then ordinary element data should use "removeElement"
    And an ordinary complete container hierarchy should use "removeSubtree"
    And retained Scene evidence with active properties should use "removeElementUsingActiveProperties" or "removeElementsUsingActiveProperties"
    And a retained complete container hierarchy should use "removeSubtreeUsingActiveProperties"
    And the single active-property removal API should use the same batch-of-one canonical path
    And retained removal and restore should preflight exact Scene, Props, relationship, parent index, id, and tombstone evidence
    And a later invalid item should leave no committed canonical, history-readiness, or publication prefix
    And no removal API should be blocked because the caller is local or remote
    But a semantic no-op should not be treated as an applied replay result

  Scenario: Factory emits one immutable transaction artifact
    Given the complete canonical child batch succeeds inside one outer App transaction
    When Factory records the canonical deliveries
    Then it should deeply detach and freeze one "FactoryMutationBatchArtifact"
    And History, Render UI, and Collaboration should consume the same ordered artifact
    And the turn should create exactly one intended Undo action
    And Undo and Redo should each restore the complete intended action
    And an observer mutation attempt should not affect another consumer

  Scenario: Progressive slices remain visible without new canonical writes
    Given the immutable Factory artifact contains point-aware progressive slice boundaries
    When Preset and Render consume the formal slices
    Then every slice should use the ordinary Vector strategy
    And every slice should cause at most one invalidation and one frame flush
    And Actor B should observe more than one increasing non-final element count
    And publication slices should create no new canonical writes or history actions
    And progressive output should not collapse into one final-only frame

  Scenario: Contents can scroll to the final canonical element
    Given Contents receives more than 100 ordered visible hierarchy rows
    When the user scrolls the actual inner scroll element to its tail
    Then the final canonical element should be rendered and interactive
    And mounted DOM rows should remain bounded to the viewport and overscan
    And collapse, expansion, hierarchy order, and selection should remain correct

  Scenario: Binary publication relay applies byte backpressure
    Given a shared publication batch is ready for Collaboration
    When the codec worker creates versioned binary publication frames
    Then control frames should remain JSON
    And publication payloads should transfer as ArrayBuffer values without JSON pre-serialization
    And the server should relay canonical payload bytes without decode or re-encode
    And the receiver should admit frames into a bounded 2 MiB worker ingress window
    And the worker should validate header, order, and duplicate identity before emitting "frame-consumed"
    And the provider should deeply freeze the worker-to-main publication once without repeated Provider or Collaboration clones
    And the receiver worker should expose one immutable decoded-publication lease at a time to App policy and canonical preflight
    And successful remote publication settlement should release the next decoded-publication lease
    And terminal remote apply failure should clear active and pending leases without releasing a later publication
    And each peer should enforce an exact 2 MiB unretired byte capacity
    And one oversized indivisible frame should be allowed only for an otherwise empty peer queue
    And "source-frame-admitted" should allow the provider to send only the next publication frame
    And already-admitted peer frames should continue in FIFO order through the bounded byte window before prior "frame-consumed" credit
    And frame retirement and capacity release should still require both the exact socket callback and exact "frame-consumed" credit
    And blocked peer admission should resume when contiguous retirement leaves exact capacity for the next frame
    And blocked publication admission should not pause the JSON control fast path
    And "server-accepted", "frame-consumed", and "peer-applied" should remain distinct receipts
    And the receiver worker should emit "frame-consumed" after accepting the transferable frame
    And remote apply should emit "peer-applied" only after canonical apply completes
    And client and server WebSockets should use "perMessageDeflate: false"

  Scenario: Remote publication apply does not create local side effects
    Given Actor B receives one valid source publication
    When the worker releases the publication for canonical apply
    Then Actor B should open exactly one remote Factory transaction for that publication
    And different source publications should not be merged
    And one batch observer delivery should preserve the ordered canonical events
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
