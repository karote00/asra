Feature: Element Creation
  As a user
  I want to create shapes on canvas
  So that I can build a design quickly

  Scenario: Create rectangle with single click
    Given I have the "Rectangle" tool selected
    When I click on the canvas
    Then a rectangle should be created
    And the new rectangle should be selected

  Scenario: Create rectangle by dragging
    Given I have the "Rectangle" tool selected
    When I drag on the canvas
    Then a rectangle should be created with drag-based size
    And the new rectangle should be selected

  Scenario: Create oval with single click
    Given I have the "Oval" tool selected
    When I click on the canvas
    Then an oval should be created
    And the new oval should be selected

  Scenario: Create oval by dragging
    Given I have the "Oval" tool selected
    When I drag on the canvas
    Then an oval should be created with drag-based size
    And the new oval should be selected
