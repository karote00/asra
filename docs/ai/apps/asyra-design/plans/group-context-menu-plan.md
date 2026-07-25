# Asyra Design Group Context Menu Plan

## Status and Priority

Reopened on 2026-07-25 after post-closeout product review. The prior closeout
decision remains in append-only history but is superseded for this PR by the
explicit requirement to remove the Group and Ungroup buttons from the
Layers/Contents header.

This plan is active until that follow-up passes its Inspector/readiness,
formal, E2E, template, and synchronized visual gates and receives a new user
review. Context Menu and operating-system shortcuts are the only Group/Ungroup
command surfaces in scope.

Architecture authority:

- `docs/ai/apps/asyra-design/plans/group-context-menu-flow-inspector.data.cjs`
- `docs/ai/apps/asyra-design/plans/group-context-menu-flow-inspector.html`
- `docs/ai/apps/asyra-design/plans/__tests__/group-context-menu-flow-inspector.contract.test.cjs`

## Decision

Right-clicking the Asyra Design canvas opens an app-owned context menu at the
pointer position.

The first menu contains exactly two command rows:

1. `Group`
2. `Ungroup`

Each row displays the command name on the left and its operating-system-specific
keyboard shortcut on the right. The row invokes the same Group/Ungroup feature
command used by the keyboard shortcut; it is not a second implementation of
grouping behavior. The Layers/Contents header exposes no Group or Ungroup
buttons.

## Goal

Restore a usable app context-menu path and establish a reusable command-row
contract without moving feature policy into Input System or Design System.

The result must:

- open from a canvas right-click;
- show Group and Ungroup in the declared order;
- show accurate platform-specific shortcut labels;
- reflect the existing command eligibility;
- execute one existing feature command when an enabled row is chosen;
- close predictably; and
- leave canonical document state untouched when merely opening, navigating, or
  dismissing the menu.

## Current Baseline

- Input System recognizes right mouse down/up pointer keys.
- Input System currently installs a window-level `contextmenu` listener that
  unconditionally calls `preventDefault()`.
- No current app or Design System owner renders a context menu.
- The Group interaction plan defines the canonical Group/Ungroup feature,
  selection eligibility, shortcuts, one intended transaction, and failure
  behavior.
- The current Design System owns reusable React presentation primitives but has
  no public Context Menu component.

The unconditional browser suppression is not itself a context-menu feature.
The new path must replace that missing ownership with a scoped app interaction
and presentation flow.

## Ownership Contract

### Input System

- continues to normalize typed keyboard and pointer input;
- may expose the existing right-button input needed by the app;
- must not decide which menu opens, which commands appear, whether Group is
  enabled, or what document mutation occurs; and
- must not unconditionally suppress the browser context menu for unrelated
  surfaces once Asyra Design owns scoped suppression.

### Asyra Design canvas adapter

- owns the canvas `contextmenu` host event, pointer coordinates, and decision to
  open the app menu;
- calls `preventDefault()` only for a handled app context-menu invocation;
- keeps editable fields and out-of-scope surfaces on their documented native or
  existing behavior;
- captures the command eligibility source at render time without copying
  canonical hierarchy state; and
- owns dismissal, focus return, and menu positioning policy.

### Asyra Design command layer

- remains the owner of Group/Ungroup command descriptors, availability, feature
  dispatch, and product-facing failures;
- supplies one shared source for command id, visible label, shortcut binding,
  platform display label, enabled state, and execution callback; and
- prevents keyboard and context-menu rows from drifting into separate command
  semantics.

### Design System

- owns reusable accessible Context Menu and command-row presentation;
- owns layout for left command label and right shortcut label, row states,
  focus/keyboard presentation, tokens, and visual styling;
- exposes intent callbacks and presentation props only; and
- owns no selection, hierarchy, feature, Factory, Core, Render, or app command
  policy.

### Existing Group owners

- App selection policy determines which ids are the current command input.
- Preset owns official Group operation adapters and bounds/coordinates.
- Scene Tree remains the sole hierarchy validator/mutator.
- Factory retains one intended Group/Ungroup transaction and undo commit.
- Render remains a canonical projection and does not own menu state.

## Product Contract

### Open trigger and scope

- A native `contextmenu` event inside the canvas interaction surface opens the
  Asyra Design menu at that event's client coordinates.
- The custom menu is canvas-scoped in this stage. Right-clicking editable
  controls, the Layers panel, the Properties panel, or other app chrome does
  not open this canvas menu.
- Browser default suppression occurs only when the app accepts the canvas
  invocation.
- Opening a menu is UI-local state. It does not select, deselect, hover,
  transact, publish, save, or write canonical data.
- This first stage uses the current element selection as command input.
  Right-click does not retarget selection to the element under the pointer.
- A newly opened menu replaces any existing menu instance; two menus cannot be
  active at once.

### Command rows

- The menu shows exactly `Group` followed by `Ungroup`.
- The Layers/Contents header shows neither a Group button nor an Ungroup
  button. Context Menu and shortcuts are the only command surfaces.
- Both rows remain visible. A row whose existing command eligibility is false
  is disabled rather than removed.
- The left side shows the localized command name contract (`Group` or
  `Ungroup` for this stage).
- The right side shows a presentation-only shortcut label derived from the same
  command descriptor as the actual key binding.
- A disabled row cannot dispatch a feature or mutate selection/document state.
- Activating an enabled row closes the menu and invokes the existing
  Group/Ungroup command once.
- Canonical rejection uses the existing feature failure route. The menu cannot
  reinterpret or retry the request as a different operation.

### Operating-system shortcut labels

- macOS:
  - Group: `⌘G`
  - Ungroup: `⇧⌘G`
- Windows and Linux:
  - Group: `Ctrl+G`
  - Ungroup: `Ctrl+Shift+G`
- Platform detection is app-owned, deterministic, and test-injectable. It must
  not be duplicated inside individual rows.
- Shortcut text is not manually hardcoded at each command surface. One command
  metadata formatter produces the visible platform label.
- The display label never changes the actual Input System binding.
- The actual bindings remain functional through the existing Group feature:
  `Meta+G` / `Ctrl+G` invoke Group and
  `Meta+Shift+G` / `Ctrl+Shift+G` invoke Ungroup.
- The same command descriptor supplies the actual binding metadata and visible
  platform label so the menu cannot advertise a shortcut that routes a
  different command.

### Positioning and visual behavior

- The menu origin uses the pointer's client position.
- The complete menu is clamped or flipped inside the visible app viewport so no
  row is inaccessible beyond an edge.
- The menu renders above canvas and app chrome at the documented overlay
  layer, without becoming a Render engine object.
- A command row has one horizontal layout: command label aligned left and
  shortcut aligned right.
- Hover, focus, active, and disabled states use Design System tokens and remain
  legible at the synchronized app review scale.
- Menu dimensions come from content and Design System spacing tokens; product
  code cannot position the two labels with fixture-specific pixel offsets.

### Dismissal and accessibility

- `Escape`, an outside primary-pointer press, choosing an enabled item, canvas
  lifecycle teardown, and opening a replacement menu close the current menu.
- Dismissal performs no command and no canonical mutation.
- Focus enters the menu when it opens and returns to the invoking canvas host
  when it closes where browser focus behavior permits.
- The menu exposes standard menu semantics, command rows expose menu-item
  semantics, disabled state is announced, and visible labels remain available
  to accessible-name queries.
- Up/Down arrows move among enabled rows, Home/End select the first/last enabled
  row, and Enter/Space activates the focused enabled row.
- Tab dismisses the menu and resumes ordinary app focus traversal rather than
  trapping focus indefinitely.

## Product Cases

Formal coverage must include:

1. canvas right-click opens one menu at the pointer position;
2. a second right-click replaces and repositions the existing menu;
3. editable fields and non-canvas app surfaces do not open the canvas menu;
4. Group appears before Ungroup with left labels and right shortcut labels;
5. macOS and Windows/Linux labels render exactly from injected platform input;
6. valid multi-selection enables Group and invokes the existing Group feature
   once;
7. one selected official Group enables Ungroup and invokes the existing
   Ungroup feature once;
8. unavailable commands remain visible and disabled with no mutation;
9. menu-only interaction creates no Factory transaction, undo entry, shared
   publication, selection change, or save;
10. Escape, outside click, successful activation, replacement, and teardown
    dismiss correctly;
11. edge/corner opening keeps the full menu visible;
12. keyboard focus/navigation and accessible roles/names/disabled state are
    correct; and
13. separate app roots do not share menu open state or platform presentation.
14. macOS `Meta+G` / `Meta+Shift+G` and Windows/Linux
    `Ctrl+G` / `Ctrl+Shift+G` invoke the same existing Group/Ungroup feature
    contract advertised by the matching menu row.

## Explicit Non-Goals

- context menus for Layers rows, Properties controls, Toolbar, or other app
  chrome;
- right-click selection retargeting, hover recalculation, or Group traversal
  rules;
- additional commands, submenus, separators, icons, destructive confirmations,
  command search, or a general command palette;
- persisted menu state, collaboration publication, backend policy, or remote
  menu synchronization;
- changing Group/Ungroup canonical behavior, shortcuts, selection policy,
  transaction boundaries, or hierarchy ownership;
- native operating-system menu integration;
- app-specific ad hoc menu markup that bypasses the approved reusable Design
  System component.
- Group or Ungroup buttons in the Layers/Contents header.

## Required Inspector Readiness

The first production PR must create a matching Inspector and executable
readiness contract tests before production edits. It must define:

1. **Native context event intake**
   - Input System and canvas-host ownership, target scope, client-coordinate
     input, handled/default-prevention output, editable/non-canvas bypass, and
     cleanup.
2. **App menu session**
   - open/replace/dismiss state, positioning input/output, focus lifecycle,
     allowed UI contributors, and forbidden canonical-state writes.
3. **Command descriptor projection**
   - shared Group/Ungroup command metadata, current selection eligibility,
     actual Meta/Ctrl shortcut bindings, platform formatter input/output, and
     drift prevention across keyboard and menu surfaces;
   - explicit absence of Group/Ungroup controls from the Layers/Contents
     header.
4. **Design System presentation**
   - menu/item props, left/right row layout, visual states, accessible
     semantics, keyboard navigation, viewport fit boundary, and app-policy
     bypass.
5. **Feature execution handoff**
   - enabled-item activation, one-shot existing feature dispatch, close order,
     canonical rejection route, transaction owner, and disabled bypass.
6. **Teardown and instance isolation**
   - listener/portal/focus cleanup, app-root ownership, and no state sharing
     across instances.

Every step must define owner, input/output, conditions, bypasses,
allowed/forbidden contributors, implementation boundary, failure owner,
product cases, and Definition of Done. Production work advances one owner step
at a time.

## Planned Implementation Slices

1. Create the matching Inspector and failing readiness/product tests.
2. Remove unconditional global browser-menu suppression and establish scoped
   canvas context-event ownership without changing unrelated pointer behavior.
3. Add the reusable Design System Context Menu and command-row presentation.
4. Add app-owned menu session, viewport positioning, focus, and dismissal.
5. Add shared Group/Ungroup descriptors, platform labels, availability, and
   existing-feature execution handoff.
6. Complete app/template synchronization and synchronized product/visual
   validation.
7. Remove the superseded Layers/Contents Group and Ungroup buttons, migrate
   formal product setup to shortcuts or Context Menu, and rerun synchronized
   validation.

Each slice receives a bounded local commit only after its formal tests and
direct-consumer review pass.

## Required Validation

- affected Input System and Design System tests;
- Inspector contract tests;
- Asyra Design command, input, UI, and integration tests;
- synchronized Group interaction and Group Context Menu Gherkin contracts in
  the app BDD index;
- `create-app/asyra-design/template` synchronization checks;
- focused Playwright context-menu flows on macOS-style and
  Windows/Linux-style platform fixtures;
- focused Playwright shortcut execution on macOS-style and Windows/Linux-style
  platform fixtures;
- formal and visual proof that the Layers/Contents header exposes no Group or
  Ungroup buttons;
- TypeScript and affected package builds;
- dependency validation;
- lint;
- root production build;
- synchronized visual/product screenshots at center and viewport edges; and
- bounded final diff and direct-consumer review.

Tests belong in the nearest matching `__tests__` directory. Mock product paths,
fixture-specific offsets, app-only copies of Design System components, and
alternate Group implementations are forbidden.

## Definition of Done

- Canvas right-click reliably opens one accessible app context menu.
- Group and Ungroup rows show correct left labels, right OS-specific shortcuts,
  availability, and order.
- The advertised macOS and Windows/Linux shortcuts invoke the matching existing
  Group/Ungroup feature command.
- The Layers/Contents header exposes no Group or Ungroup buttons.
- Enabled rows invoke the existing commands exactly once; disabled rows and
  menu-only interaction never mutate canonical state.
- Browser default suppression is scoped to handled canvas invocations.
- The app BDD index and Gherkin contracts describe the shared Group/Ungroup
  behavior, platform shortcuts, and Group Context Menu product flow.
- Input System, App, Design System, Feature, Scene Tree, Factory, and Render
  ownership stays within the Inspector contract.
- All formal, type, lint, build, synchronization, and visual/product gates
  pass.
- The implementation PR remains open for user review; closeout and merge occur
  only after explicit user approval.
