Feature: Viewport Navigation
  As a user
  I want to navigate the canvas quickly
  So that I can inspect details and overall composition

  Scenario: Zoom in with wheel + modifier key
    Given I am over the canvas
    When I scroll wheel up while holding Meta/Ctrl
    Then zoom level should increase

  Scenario: Zoom out with wheel + modifier key
    Given I am over the canvas
    When I scroll wheel down while holding Meta/Ctrl
    Then zoom level should decrease

  Scenario: Pan with wheel without zoom modifier
    Given I am over the canvas
    When I scroll wheel without Meta/Ctrl
    Then viewport position should pan

  Scenario: Zoom fit shortcut
    Given the document has content
    When I run zoom-fit shortcut
    Then viewport should frame all content with padding
