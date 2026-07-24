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
    When I press the left mouse button on the canvas
    Then a rectangle using its element initial size should be visible on canvas and in Contents before release
    When I drag without releasing the left mouse button
    Then the rectangle should remain visible with drag-based size
    And the selection outline should match the rectangle in the same frame
    When I release the left mouse button
    And the new rectangle should be selected

  Scenario: Create oval with single click
    Given I have the "Oval" tool selected
    When I click on the canvas
    Then an oval should be created
    And the new oval should be selected

  Scenario: Create oval by dragging
    Given I have the "Oval" tool selected
    When I press the left mouse button on the canvas
    Then an oval using its element initial size should be visible on canvas and in Contents before release
    When I drag without releasing the left mouse button
    Then the oval should remain visible with drag-based size
    And the selection outline should match the oval in the same frame
    When I release the left mouse button
    And the new oval should be selected

  Scenario: Create inside a nested Group selected by hierarchy targeting
    Given nested Groups contain a visible non-Group element
    And I have the "Rectangle" tool selected
    When I mouse down on that content using the canvas hierarchy modifier rules
    Then the new rectangle should have the resolved official Group as its parent
    And its visible world position should not jump
    And affected Group bounds should remain canonical during drag

  Scenario: Create on empty canvas while a Group is selected
    Given an official Group is selected
    And I have the "Rectangle" tool selected
    When I mouse down where there is no raw canvas element hit
    Then the new rectangle should be a direct child of the workspace
    And it should not use the first top-level Group as an implicit parent
