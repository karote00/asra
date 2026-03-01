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

  Scenario: Drag on first point of a subpath does not create bezier handles
    Given I have the "Pen" tool selected
    And I am adding the first point of a subpath
    When I mouse down and drag on canvas
    Then no bezier handle should be created for that first point

  Scenario: Enter path editing mode with Enter key
    Given exactly one vector element is selected
    When I press Enter
    Then path editing mode should start for that vector

  Scenario: Enter path editing mode by double click
    Given exactly one vector element is selected
    When I double click within that vector bounds
    Then path editing mode should start for that vector

  Scenario: Escape behavior in pen path editing
    Given I am in path editing mode with pen active
    When I press Escape once
    Then current virtual connection should split to new subpath state
    When I press Escape again
    Then path editing mode should exit
    And primary tool should switch to Select

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
