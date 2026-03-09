Feature: Properties Panel
  As a user
  I want to view and edit selected target values
  So that I can make precise adjustments

  Scenario: Show layout properties for selected element
    Given an element is selected
    When I open the properties panel
    Then I should see X, Y, W, H, and R fields

  Scenario: Hide layout properties when nothing is selected
    Given no element is selected
    When I open the properties panel
    Then layout fields should not be shown

  Scenario: Update numeric layout property
    Given an element is selected
    When I input a valid number in a layout field
    Then the element computed data should update

  Scenario: Reject invalid numeric input
    Given an element is selected
    When I input a non-finite value in a numeric field
    Then the update should be rejected
    And previous valid value should remain effective

  Scenario: Show vector point panel in path editing context
    Given path editing mode is active for a vector
    And a vector point is selected
    When I open the properties panel
    Then I should see point X/Y fields instead of layout fields

  Scenario: Show fills section for selected element
    Given an element is selected
    When I open the properties panel
    Then I should see the fills section
    And at least one editable fill row

  Scenario: Show fills section for selected vector element
    Given a vector element is selected
    When I open the properties panel
    Then I should see the fills section
    And at least one editable fill row

  Scenario: Update fill color via color picker
    Given an element is selected
    And the fills section is visible
    When I change a fill color from the color picker
    Then the selected element computed `fills` color should update

  Scenario: Seed gradient metadata when switching fill type
    Given an element is selected
    And the fills section is visible
    When I switch a fill type from solid to gradient
    Then that fill entry should include gradientType, gradientStops, and gradientHandles data
