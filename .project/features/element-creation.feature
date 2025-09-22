Feature: Element Creation
  As a user of the design tool
  I want to create new elements on the canvas
  So that I can build my designs

  Scenario: Successfully create a new rectangle
    Given I have the "Rectangle" tool selected
    And the canvas is empty
    When I click on the canvas at coordinates (100, 150)
    Then a new rectangle element should be created
    And the rectangle should be visible on the canvas
    And the rectangle's position should be (100, 150)

  Scenario: Attempt to create an element without a tool selected
    Given I have no tool selected
    When I click on the canvas at coordinates (50, 50)
    Then no new element should be created
    And a notification should inform me to select a tool

  Scenario: Create multiple rectangles
    Given I have the "Rectangle" tool selected
    And the canvas is empty
    When I click on the canvas at coordinates (10, 10)
    And I click on the canvas at coordinates (20, 20)
    And I click on the canvas at coordinates (30, 30)
    Then three new rectangle elements should be created
    And all three rectangles should be visible on the canvas
