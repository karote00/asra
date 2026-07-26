Feature: Conversational AI drawing performance
  As an Asyra Design user creating high-detail editable drawings
  I want local and collaborative drawing to settle within explicit budgets
  So that high detail remains usable without weakening canonical or history semantics

  Background:
    Given the committed 1672 by 941 tabby reference image
    And the production Asyra Design build uses exact "ai=mock" mode
    And product spans are separated from server, browser, assertion, screenshot, and recording overhead
    And one unmeasured warm-up precedes three measured reference runs

  Scenario: Profiling identifies the first product-owned bottleneck
    When the balanced cat-only turn creates 7075 editable Vectors and one Group
    Then timing should distinguish App batching, Scene Tree apply, Factory recording and publication, Collaboration transport and remote apply, local Core persistence snapshot capture and provider save, and Render projection
    And timing should include Actor A and Actor B first-visible and settled milestones
    And detached profiling should not alter canonical state, delivery, history, retry, cancellation, or terminal results
    And the next optimization should belong only to the largest over-budget Inspector owner

  Scenario: Fast Mock AI CRDT correctness stays bounded
    Given two browser actors share one fresh collaboration document
    And the default deterministic Mock AI CRDT fixture contains 16 items
    When Actor A accepts the fixture through the ordinary Agent route
    Then both actors should converge on identical canonical ids, topology, hierarchy, and styles
    And Actor A should gain one Undo action while Actor B gains no local Undo action
    And the 7112-element balanced correctness gate should remain change-aware or explicitly requested
    And high-detail performance and CRDT suites should remain independent and explicitly opt-in

  Scenario: Contents panel attribution stays diagnostic
    When matched profiling runs keep the Contents panel present and diagnostically omit it
    Then canonical output, history, delivery mode, and non-UI inputs should remain identical
    And the comparison may attribute cost to Contents or UI projection
    But neither diagnostic variant should satisfy a release performance budget

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
    And Actor B should observe at least two increasing non-final element counts before Actor A settles
    And Actor B remote commits should not capture or save client persistence snapshots
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
    And no item, path, point, payload, or composition ceiling should reject the drawing
    And the turn should create one intended Undo action

  Scenario: The complete progressive product flow meets its budget
    When Actor A creates the balanced cat-only portrait and applies both existing-id follow-ups
    Then the three-turn product spans should total at most 90 seconds median and 120 seconds worst
    And the dedicated E2E command including harness overhead should finish within 180 seconds
    And generated screenshots, recordings, profiles, traces, and thumbnail media should remain ignored local artifacts

  Scenario: Performance work preserves cancellation and failure semantics
    When the user cancels, a recoverable item fails, a fatal canonical error occurs, the transport closes, or the app tears down
    Then profiling state should be released with the existing owner lifecycle
    And recoverable siblings should still commit as one partial result
    And fatal failure should still roll back the complete turn
    And no performance path should fabricate success, skip an owner, or leave an extra history action
