Feature: Tool Switching
  As a user
  I want to switch between different tools (Select, Rectangle)
  So that I can perform different actions on the canvas

  Scenario: Switch to Rectangle Tool via Shortcut
    Given I have the "Select" tool selected
    When I press the "R" key
    Then the "Rectangle" tool should be selected
    And the cursor should change to indicate creation mode

  Scenario: Switch to Select Tool via Shortcut
    Given I have the "Rectangle" tool selected
    When I press the "V" key
    Then the "Select" tool should be selected
    And the cursor should change to standard pointer
