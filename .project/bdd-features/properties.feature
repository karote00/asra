Feature: Property Management
  As a user
  I want to view and edit element properties
  So that I can customize my design

  Scenario: Show properties for selected element
    Given a rectangle is selected
    When I look at the Properties Panel
    Then the panel should display the rectangle's properties (x, y, width, height)
    And the values should match the selected element

  Scenario: Show empty state when no selection
    Given no element is selected
    When I look at the Properties Panel
    Then the panel should show an empty or default state
    And no specific property fields should be active

  Scenario: Update position via properties panel
    Given a rectangle is selected with position (100, 100)
    When I change the "x" input field to "200"
    And I press Enter or blur the field
    Then the rectangle's x position should update to 200 on the canvas

  Scenario: Update dimensions via properties panel
    Given a rectangle is selected with size (100x100)
    When I change the "width" input field to "300"
    And I press Enter or blur the field
    Then the rectangle's width should update to 300 on the canvas
