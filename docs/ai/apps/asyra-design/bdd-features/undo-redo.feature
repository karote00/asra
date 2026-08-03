Feature: Undo and Redo
  As a user
  I want to undo and redo actions
  So that I can recover from mistakes

  Scenario: Undo element creation
    Given I created an element
    When I trigger Undo
    Then the created element should be removed

  Scenario: Redo element creation
    Given I created an element and then undid it
    When I trigger Redo
    Then the element should be restored

  Scenario: Multi-step undo/redo
    Given I created multiple elements
    When I trigger Undo multiple times
    Then element count should decrease step by step
    When I trigger Redo multiple times
    Then element count should increase step by step

  Scenario: Drag-create commits one compact undo step
    Given I create an element by dragging on canvas
    When I trigger Undo once
    Then that drag-created element should be removed
    And no extra drag-move history step should remain to undo

  Scenario: Drag-move position does not enter Undo history
    Given I drag a selected element to a new position
    Then the Undo history count should remain unchanged
    When I trigger Undo once
    Then Undo should affect the previous undoable action instead of the drag

  Scenario: Drag-move on an unselected target does not enter Undo history
    Given element A is selected
    And I drag unselected unlocked element B to a new position
    Then element B should be selected at its moved position
    And the Undo history count should remain unchanged
