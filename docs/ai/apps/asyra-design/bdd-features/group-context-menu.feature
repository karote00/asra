Feature: Group Context Menu
  As a designer
  I want a canvas-owned context menu for Group and Ungroup
  So that I can discover and invoke the existing commands at the pointer

  Scenario: Open the menu at the canvas pointer
    Given the pointer is inside the Asyra Design canvas
    When I open the native context menu at that pointer
    Then one app-owned context menu should open at the pointer client coordinates
    And the first command row should be "Group"
    And the second command row should be "Ungroup"
    And opening the menu should not change selection or canonical document state

  Scenario: Keep native context-menu behavior outside the canvas
    Given the pointer is over an editable field or non-canvas app surface
    When I open the native context menu
    Then the canvas Group Context Menu should not open
    And Asyra Design should not suppress the native context-menu event

  Scenario Outline: Show shortcuts from the app platform mapping
    Given the app uses the "<platform>" shortcut mapping
    When I open the Group Context Menu on the canvas
    Then the Group row should show "<group_label>" on the right
    And the Ungroup row should show "<ungroup_label>" on the right

    Examples:
      | platform      | group_label | ungroup_label |
      | macOS         | ⌘G          | ⇧⌘G           |
      | Windows/Linux | Ctrl+G      | Ctrl+Shift+G   |

  Scenario: Keep unavailable commands visible and disabled
    Given neither Group nor Ungroup is currently eligible
    When I open the Group Context Menu on the canvas
    Then the Group row should remain visible and disabled
    And the Ungroup row should remain visible and disabled
    And activating either disabled row should not dispatch a command
    And no canonical document or selection state should change

  Scenario: Invoke the existing Group feature from the menu
    Given the current selection is eligible for Group
    And the Group Context Menu is open
    When I activate the Group row
    Then the menu should close
    And the existing Group feature command should run exactly once

  Scenario: Invoke the existing Ungroup feature from the menu
    Given exactly one eligible official Group is selected
    And the Group Context Menu is open
    When I activate the Ungroup row
    Then the menu should close
    And the existing Ungroup feature command should run exactly once

  Scenario: Dismiss the menu without mutation
    Given the Group Context Menu is open
    When I press Escape, Tab, or the primary pointer outside the menu
    Then the menu should close without dispatching a command
    And no canonical document or selection state should change

  Scenario: Navigate the menu accessibly
    Given the Group Context Menu is open with at least one enabled command
    Then the menu and rows should expose standard menu semantics
    And focus should enter an enabled command row
    When I use ArrowUp, ArrowDown, Home, or End
    Then focus should move among enabled command rows
    When I press Enter or Space
    Then the focused enabled command should run exactly once

  Scenario: Keep the complete menu visible at viewport edges
    Given the pointer is near a visible app viewport edge or corner
    When I open the Group Context Menu on the canvas
    Then the complete menu and both command rows should remain visible

  Scenario: Replace an existing menu instance
    Given the Group Context Menu is already open
    When I open the native context menu at another canvas pointer position
    Then the existing menu should be replaced by one menu at the new position
    And the replacement should not change canonical document or selection state
