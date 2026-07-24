Feature: Group and Ungroup interactions
  As a designer
  I want Group and Ungroup to use one canonical command contract
  So that hierarchy, selection, history, and collaboration remain consistent

  Scenario: Group an eligible selection
    Given the current selection is eligible for Group
    When I invoke the Group command
    Then one official Group should replace the selected siblings at their canonical slot
    And only the new Group should be selected
    And the visible child geometry should remain at the same world positions
    And the operation should create one intended undo commit

  Scenario: Ungroup one selected official Group
    Given exactly one eligible official Group is selected
    When I invoke the Ungroup command
    Then the former children should replace the Group at its canonical slot
    And the former children should be selected in canonical order
    And their identities and visible world positions should remain unchanged
    And the operation should create one intended undo commit

  Scenario: Reject an unavailable Group command without mutation
    Given the current selection is not eligible for Group
    When I invoke the Group command
    Then no hierarchy or selection state should change
    And no transaction, undo entry, or shared publication should be created

  Scenario: Reject an unavailable Ungroup command without mutation
    Given the current selection is not eligible for Ungroup
    When I invoke the Ungroup command
    Then no hierarchy or selection state should change
    And no transaction, undo entry, or shared publication should be created

  Scenario Outline: Invoke Group from the platform shortcut
    Given Group is currently eligible
    And the app uses the "<platform>" shortcut mapping
    When I press "<shortcut>"
    Then the existing Group feature command should run exactly once

    Examples:
      | platform      | shortcut |
      | macOS         | Meta+G   |
      | Windows/Linux | Ctrl+G   |

  Scenario Outline: Invoke Ungroup from the platform shortcut
    Given Ungroup is currently eligible
    And the app uses the "<platform>" shortcut mapping
    When I press "<shortcut>"
    Then the existing Ungroup feature command should run exactly once

    Examples:
      | platform      | shortcut          |
      | macOS         | Meta+Shift+G       |
      | Windows/Linux | Ctrl+Shift+G       |
