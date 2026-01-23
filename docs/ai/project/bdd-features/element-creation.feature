Feature: Element Creation
  As a user
  I want to create new elements on the canvas
  So that I can build my designs

  Scenario: Create rectangle with default size on click
    Given I have the "Rectangle" tool selected
    When I click on the canvas at coordinates (100, 100)
    Then a new rectangle should be created at (100, 100)
    And the new rectangle should have default dimensions (e.g., 100x100)
    And the new rectangle should be selected

  Scenario: Create rectangle by dragging (Dynamic Size)
    Given I have the "Rectangle" tool selected
    When I press the left mouse button at (100, 100)
    And I drag the mouse to (300, 200)
    And I release the left mouse button
    Then a new rectangle should be created at (100, 100)
    And the new rectangle should have a width of 200
    And the new rectangle should have a height of 100
    And the new rectangle should be selected
