Feature: Element Selection
  As a user
  I want to select elements on the canvas
  So that I can modify their properties or transform them

  Scenario: Select a single element by clicking
    Given I have the "Select" tool selected
    And there is a rectangle at (100, 100)
    When I click on the canvas at coordinates (110, 110)
    Then the rectangle should be selected
    And a selection box should appear around the rectangle

  Scenario: Deselect element by clicking empty space
    Given I have the "Select" tool selected
    And a rectangle is currently selected
    When I click on the canvas at coordinates (0, 0) where there are no elements
    Then the rectangle should be deselected
    And the selection box should disappear

  Scenario: Select element via Contents Panel
    Given I have the "Select" tool selected
    And there is a rectangle named "Rectangle 1" in the Contents Panel
    When I click on "Rectangle 1" in the Contents Panel
    Then the rectangle "Rectangle 1" should be selected on the canvas

  Scenario: Deselect via Contents Panel
    Given I have the "Select" tool selected
    And a rectangle is currently selected
    When I click on an empty area in the Contents Panel
    Then the rectangle should be deselected
