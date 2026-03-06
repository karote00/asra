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

  Scenario: Drag-move position is undoable and redoable
    Given I drag a selected element to a new position
    When I trigger Undo
    Then that element position should return to the previous coordinates
    When I trigger Redo
    Then that element position should return to the moved coordinates

  Scenario: Drag-move on unselected target undoes both move and selection switch
    Given element A is selected
    And I drag unselected unlocked element B to a new position
    When I trigger Undo
    Then element B position should return to its previous coordinates
    And selection should return to element A
