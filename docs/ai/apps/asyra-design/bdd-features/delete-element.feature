Feature: Delete Behavior
  As a user
  I want delete shortcuts to remove the correct target
  So that I can edit quickly without breaking my current mode

  Scenario: Delete selected element with Delete key
    Given path editing mode is inactive
    And exactly one element is selected
    When I press Delete
    Then the selected element should be removed
    And element selection should be cleared

  Scenario: Delete selected element with Backspace key
    Given path editing mode is inactive
    And exactly one element is selected
    When I press Backspace
    Then the selected element should be removed

  Scenario: Delete is no-op with no selected element
    Given path editing mode is inactive
    And no element is selected
    When I press Delete
    Then no element should be removed

  Scenario: Delete supports undo and redo
    Given path editing mode is inactive
    And exactly one element is selected
    When I press Delete
    Then the selected element should be removed
    When I trigger Undo
    Then the element should be restored
    When I trigger Redo
    Then the element should be removed again

  Scenario: Deleting hovered selected element re-evaluates hover target
    Given two elements overlap under the cursor
    And the top element is selected and hovered
    When I press Delete
    Then hover target should be re-evaluated from current pointer position
    And hovered element should not stay on the deleted element id

  Scenario: Path editing anchor delete removes selected point
    Given path editing mode is active for one vector
    And one anchor point is selected on that editing vector
    When I press Delete
    Then the selected anchor point should be removed
    And vector point/segment selection state should be cleared
    And active element selection should remain on the editing vector

  Scenario: Path editing mode blocks element delete
    Given path editing mode is active
    And one element is selected
    And no eligible anchor point is selected for point delete
    When I press Delete
    Then no element should be removed
