Feature: Element Selection
  As a user
  I want to select and deselect elements
  So that I can edit the correct target

  Scenario: Select a single element from canvas
    Given there is an element on canvas
    And I have the "Select" tool selected
    When I click on that element
    Then the element should be selected

  Scenario: Deselect by clicking empty canvas
    Given an element is selected
    When I click empty canvas area
    Then no element should remain selected

  Scenario: Drag empty canvas to area select
    Given there are elements on canvas
    And I have the "Select" tool selected
    When I drag an empty canvas area covering the elements
    Then the elements inside the dragged area should be selected

  Scenario: Drag selected element to move
    Given an element is selected on canvas
    When I drag from the selected element to a new position
    Then the selected element should update its canvas position

  Scenario: Drag unselected unlocked element to move
    Given an unlocked element exists on canvas and is not selected
    When I drag from that unlocked element to a new position
    Then that element should become selected
    And that element should update its canvas position

  Scenario: Select from contents panel
    Given an element exists in the contents panel
    When I click the element row
    Then that element should be selected

  Scenario: Deselect from contents panel empty area
    Given an element is selected
    When I click empty area in contents panel
    Then no element should remain selected

  Scenario: Hover element on canvas
    Given there is an element on canvas
    When I move mouse over the element's visible geometry
    Then that element should become the hovered target

  Scenario: Hover an official Group through empty canonical bounds
    Given an official Group contains a visible child
    And the child has moved away while the Group canonical bounds remain unchanged
    When I move the mouse over the empty part of the Group bounds without a modifier
    Then the hierarchy-scoped Group should become the hovered target
    When I hold Meta or Ctrl over that same empty bounds position
    Then the Group bounds candidate should not become the hovered target

  Scenario: Keep element hover stable while dragging across another element
    Given element A is the hovered drag target
    And element B is elsewhere on canvas
    When I drag element A across element B without releasing the pointer
    Then element B should not become the hovered target during the drag
    And element A should remain the hovered target during the drag
