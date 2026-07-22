Feature: Pen Tool and Path Editing
  As a user
  I want to create and edit vector paths
  So that I can draw custom vector shapes

  Scenario: Create a new vector when pen is active
    Given I have the "Pen" tool selected
    And I am not in path editing mode
    When I mouse down on canvas
    Then a new vector should be created
    And first anchor point should be added

  Scenario: Append points to selected path-editing vector
    Given I have the "Pen" tool selected
    And path editing mode is active for one selected vector
    When I mouse down on canvas
    Then a new anchor point should be appended to that vector

  Scenario: Drag after appending connected point creates bezier handles
    Given I have the "Pen" tool selected
    And path editing mode is active for one selected vector
    And the new point has a connected previous point in the current subpath
    When I mouse down and drag on canvas
    Then bezier handles should be created for both the connected point and the new point
    And the selected point target should remain the new point anchor

  Scenario: Connected drag-to-add reaches peers before pointer-up
    Given two connected clients are editing the same vector
    When one client mouse downs to append a connected point
    Then the peer should receive the real anchor and segment before pointer-up
    When that client drags to create bezier handles
    Then the peer should receive each applied canonical curve frame
    And the complete drag-to-add action should remain one undoable action

  Scenario: Second-point micro drag below threshold keeps first segment straight
    Given I have the "Pen" tool selected
    And path editing mode is active for one selected vector
    When I create the second point with movement below drag threshold
    Then the first segment should remain straight
    And no unintended connected-point bezier handle should be created

  Scenario: Drag on first point of a subpath does not create bezier handles
    Given I have the "Pen" tool selected
    And I am adding the first point of a subpath
    When I mouse down and drag on canvas
    Then no bezier handle should be created for that first point

  Scenario: Moving selected anchor also translates its curve handles
    Given path editing mode is active with a selected anchor that has curve handles
    When I drag the selected anchor to a new position
    Then the connected curve handles should move with that anchor

  Scenario: Dragging selected handle updates handle position and keeps handle target
    Given path editing mode is active with a selected out-handle target
    When I drag that selected out-handle to a new position
    Then that out-handle position should update
    And the selected point target should remain out-handle

  Scenario: Prepend-point drag keeps new anchor selected
    Given I have the "Pen" tool selected in path editing mode
    And split/new-subpath mode is active with a valid endpoint continuation source
    When I drag to prepend a new connected point
    Then the newly inserted anchor should remain selected after drag end

  Scenario: Enter path editing mode with Enter key
    Given exactly one vector element is selected
    When I press Enter
    Then path editing mode should start for that vector

  Scenario: Enter path editing mode by double click
    Given exactly one vector element is selected
    When I double click within that vector bounds
    Then path editing mode should start for that vector

  Scenario: Escape disconnects pen continuation before exiting path editing
    Given path editing mode is active
    And the primary tool is pen
    And pen has a connected continuation preview
    When I press Escape
    Then path editing mode should remain active
    And pen should be disconnected from the current continuation

  Scenario: Escape removes a newly created single-point subpath
    Given path editing mode is active
    And the primary tool is pen
    And pen has created a new subpath with only one point
    When I press Escape
    Then that single-point subpath should be removed
    And path editing mode should remain active

  Scenario: Escape exits path editing after pen continuation is disconnected
    Given path editing mode is active
    And the primary tool is pen
    And pen is disconnected from the current continuation
    When I press Escape
    Then path editing mode should exit

  Scenario: Point selection in path editing mode
    Given path editing mode is active
    And primary tool is not pen
    When I click on a hovered vector point
    Then that point should become selected point state

  Scenario: Curve handle selection exposes handle data
    Given path editing mode is active with visible curve handles
    And primary tool is not pen
    When I click on a hovered out-handle
    Then that out-handle should become selected point target state
    And properties panel should show the selected handle target and coordinates

  Scenario: Closed subpath handle visibility wraps around selected endpoint
    Given path editing mode is active for a closed subpath
    And an endpoint anchor is selected
    Then curve handles for `n-1`, `n`, and `n+1` anchors should all be visible

  Scenario: Segment hover/selection in path editing mode
    Given path editing mode is active for one vector
    And primary tool is not pen
    When I hover a segment away from anchor/control points
    Then segment hover state should be set for that editing vector
    When I click that hovered segment
    Then segment selection state should be set for that editing vector

  Scenario: Pen preview mode controls ghost insert point visibility
    Given I have the "Pen" tool selected in path editing mode
    And continuation preview segment is connected
    When I hover a segment away from anchor/control points
    Then ghost insert point preview should stay hidden
    When split/new-subpath mode is active and I hover the segment again
    Then ghost insert point preview should be visible

  Scenario: Pen add mode only allows endpoint anchor hover
    Given I have the "Pen" tool selected in path editing mode
    And continuation preview segment is connected
    When I hover a non-endpoint anchor on the editing path
    Then hovered vector point state should stay empty
    When I hover an endpoint curve control point
    Then hovered vector point state should stay empty
    When I hover a valid endpoint anchor
    Then hovered vector point state should target that anchor

  Scenario: Connected endpoint click merges two subpaths
    Given I have the "Pen" tool selected in path editing mode
    And continuation preview segment is connected
    And there are at least two open subpaths in the editing vector
    When I click an endpoint anchor on a different subpath
    Then no new anchor point should be created by that click
    And those two subpaths should merge into one open subpath
    And split/new-subpath mode should become active

  Scenario: Connected endpoint click closes current subpath
    Given I have the "Pen" tool selected in path editing mode
    And continuation preview segment is connected
    When I click the opposite endpoint of the current open subpath
    Then that subpath should become closed in network data
    And split/new-subpath mode should become active

  Scenario: Segment split keeps split/new-subpath mode
    Given I have the "Pen" tool selected in path editing mode
    And I split a segment by clicking its insert preview point
    Then split/new-subpath mode should remain active
    And connected append preview segment should stay hidden
    And the inserted anchor should be shared by the two resulting segments

  Scenario: Split mode endpoint click sets continuation source before append
    Given I have the "Pen" tool selected in path editing mode
    And split/new-subpath mode is active
    When I click an endpoint anchor of the editing path
    Then that endpoint should become the selected continuation source
    When I add the next point
    Then append should continue from that selected endpoint

  Scenario: Path editing blocks other-element hover and selection
    Given path editing mode is active for one vector
    And primary tool is Select
    When I move pointer over a different element
    Then hovered element id should stay null for that non-editing element
    When I click that different element
    Then element selection should remain on the editing vector

  Scenario: Pen session keeps editing the new vector until Escape exit
    Given I create a new vector with the Pen tool
    When I continue clicking with Pen active
    Then additional points should keep appending to that same editing vector
    When I press Escape with no vector point or segment selection
    Then path editing should exit

  Scenario: Pen action creates new vector when current selection is non-vector
    Given a non-vector element is selected
    And I have the "Pen" tool selected
    When I click on canvas
    Then a new vector should be created for pen editing

  Scenario: Refresh keeps one render object per vector element id
    Given a vector exists on canvas
    When the page is refreshed
    Then each vector element id should map to exactly one render object
