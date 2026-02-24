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
    When I move mouse over the element bounds
    Then that element should become the hovered target
