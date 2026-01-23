Feature: Viewport Navigation
  As a user
  I want to navigate the canvas
  So that I can view different parts of my design

  Scenario: Zoom In with Mouse Wheel
    Given I am looking at the canvas
    When I scroll the mouse wheel UP
    Then the viewport should Zoom In
    And the zoom level should increase

  Scenario: Zoom Out with Mouse Wheel
    Given I am looking at the canvas
    When I scroll the mouse wheel DOWN
    Then the viewport should Zoom Out
    And the zoom level should decrease
