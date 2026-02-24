Feature: Tool Switching
  As a user
  I want to switch between tools quickly
  So that I can perform different actions on the canvas

  Scenario: Switch to Rectangle tool via keyboard
    Given I have the "Select" tool selected
    When I press "R"
    Then the "Rectangle" tool should become active

  Scenario: Switch to Oval tool via keyboard
    Given I have the "Select" tool selected
    When I press "O"
    Then the "Oval" tool should become active

  Scenario: Switch to Pen tool via keyboard
    Given I have the "Select" tool selected
    When I press "P"
    Then the "Pen" tool should become active

  Scenario: Switch to Select tool via keyboard
    Given I have a non-select tool active
    When I press "V"
    Then the "Select" tool should become active

  Scenario: Switch tools via toolbar buttons
    Given the toolbar is visible
    When I click a tool button
    Then the clicked tool should become active
