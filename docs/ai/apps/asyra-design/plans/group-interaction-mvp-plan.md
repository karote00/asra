# Asyra Design Group Interaction MVP Plan

## Status

Approved and active on 2026-07-24. Framework Release Gate 3 is present on
`main` at `d54fa92fa`.

The first implementation segment must create a matching Inspector owner flow
and executable readiness contract tests. Production edits may begin only after
those readiness tests pass.

Architecture authority:

- `group-interaction-mvp-flow-inspector.data.cjs`
- `group-interaction-mvp-flow-inspector.html`
- `__tests__/group-interaction-mvp-flow-inspector.contract.test.cjs`

## Sequence

This is the first app validation stage for Framework Release Gate 3. It makes
the existing Group primitives usable through Asyra Design without starting the
later layer-tree reparent/reorder interaction.

The follow-up `layer-tree-reparent-reorder-plan.md` may proceed in the same
combined review branch only after this plan's owner steps and required gates
are complete. The user will review both plans together before either closeout
or merge.

## Goal

Provide the smallest complete Asyra Design product flow that lets a user:

- group the current valid element selection;
- ungroup one selected official Group;
- discover both commands in the Layers panel and invoke their standard
  shortcuts;
- see canonical parent/child hierarchy as nested Layers rows;
- hover the canonical bounds of an invisible Group when no visible Render
  geometry is hit, while keeping that bounds candidate out of canvas
  click/selection, pointer-down move, and create-parent targeting;
- see the canonical Group bounds as the ordinary canvas hover and selection
  box;
- retain predictable selection, undo/redo, save/load, collaboration, and
  visual behavior.

This stage validates that Gate 3's public app/common API, Preset Group adapter,
Scene Tree hierarchy owner, Factory transaction/publication path, and Render
projection are usable from a real app feature. It must not repair a failed
canonical owner through app-only hierarchy state or Render/UI fallback output.

## Current Baseline

- Gate 3 exposes `hierarchyApis.groupElements(...)`,
  `hierarchyApis.ungroupElement(...)`, `hierarchyApis.moveElements(...)`, and
  `hierarchyApis.removeSubtree(...)` through the app common-API boundary.
- Scene Tree owns canonical parent membership, child order, cycle prevention,
  subtree membership, and hierarchy validation/mutation.
- Preset `CONTAINERS` owns the one official `GROUP` component, basic Group
  coordinates/bounds, and world-space-preserving Group adapters.
- Factory owns one intended transaction, rollback, undo/redo, and shared
  publication grouping.
- Render projects committed canonical hierarchy and preserves entity/render
  identity.
- Asyra Design currently exposes the common APIs for Gate 3 integration and
  visual tests, but has no user-facing Group/Ungroup feature, shortcut,
  post-operation selection policy, or nested Layers presentation.
- The Layers panel already consumes `flattenedElementIds`,
  `elementDataMap`, and element selection. The projection includes parent and
  child data; the panel currently renders every row at one visual depth.
- Preset already owns one registered selection overlay layer. Its generic
  Render-node bounds path does not expose the invisible Group's canonical
  computed bounds, so selected or Layers-hovered Groups currently lack the
  ordinary canvas box.

## Product Ownership

### Asyra Design

- owns command availability, selected ids, feature execution, shortcuts,
  Layers controls, post-operation selection, collapsed-row UI state, and
  product-facing error/no-op behavior;
- owns canvas hierarchy target resolution from the identity-safe Render hit,
  a hover-only canonical official Group bounds candidate, canonical hierarchy
  projection, current selection, and primary modifier state;
- routes model writes through app common APIs and public Core/Preset
  boundaries;
- derives the Layers row view from the canonical UI projection without keeping
  a second mutable parent/children tree;
- keeps selection local to the receiving app during collaboration.

### Framework owners retained from Gate 3

- Scene Tree remains the only canonical hierarchy validator and mutator.
- Preset remains the only official Group adapter and basic coordinate/bounds
  owner.
- Factory remains the transaction, rollback, undo/redo, and shared-publication
  owner.
- The app collaboration adapter remains the remote route, permission, domain
  ordering, duplicate, and conflict-policy owner.
- Collaboration remains transport-only and may not gain dedupe, LWW,
  timestamp ordering, hierarchy conflict resolution, semantic history, or a
  convergence registry.
- Render remains a downstream hierarchy projection and may not construct a
  fallback hierarchy.

## Product Contract

### Group command

- The product command accepts the current non-empty element selection when its
  ids are unique, existing, non-workspace siblings with one common parent.
- One selected sibling is a valid Group command input. Contiguous and
  non-contiguous sibling selections are both supported.
- Caller/selection order does not define child order. Scene Tree canonical
  sibling order does.
- A selected Group may be grouped again with its siblings, enabling nested
  Groups.
- App availability checks are presentation guidance only. The command must
  still call the canonical Preset/Core boundary, and Scene Tree performs the
  final complete validation before mutation.
- A successful command selects only the newly created Group.
- Child lock and visibility values are preserved. This MVP does not introduce
  an additional lock/visibility eligibility policy for Group creation.
- The official Preset Group default name is shown. Custom naming and rename
  behavior are outside this plan.

### Ungroup command

- The product command accepts exactly one selected existing official Preset
  Group with a valid container parent.
- A successful non-empty ungroup selects the former direct children in
  canonical child order.
- A successful empty-Group ungroup clears element selection.
- Nested child Groups retain their identities, data, descendants, and relative
  order.
- The operation preserves each direct child's world-space appearance while
  moving it to the former Group slot.
- Child lock and visibility values are preserved. This MVP does not introduce
  a separate lock/visibility gate for ungroup.

### Command surfaces

- The Layers header exposes visible Group and Ungroup controls.
- Controls expose stable accessible names and stable `data-testid` values.
- Group is disabled unless the projected selection satisfies the app's
  non-empty/common-parent eligibility check.
- Ungroup is disabled unless exactly one projected official Group is selected.
- `Meta+G` on macOS and `Ctrl+G` elsewhere invoke Group.
- `Meta+Shift+G` on macOS and `Ctrl+Shift+G` elsewhere invoke Ungroup.
- Editable text/number/color inputs retain their normal keyboard behavior and
  bypass these shortcuts.
- An unavailable shortcut performs no canonical mutation. A canonical
  rejection also leaves selection and hierarchy unchanged; the app must not
  reinterpret the request into another operation.

### Intended transaction and selection

- One Group or Ungroup command, including its post-operation element
  selection, is one intended Factory transaction and one undo commit.
- A semantic no-op or rejected command creates no hierarchy transaction,
  history entry, or shared hierarchy publication.
- A failure after a transaction opens rolls back hierarchy, Group geometry,
  properties, and selection completely.
- Undo/redo restores exact identity, parent, sibling index, child order, Group
  data, coordinates/bounds, and the app selection associated with the command.
- Feature execution is one-shot. It must define trigger, priority,
  exclusivity, repeated-trigger expectations, and failure behavior in the
  Inspector before implementation.

### Layers hierarchy projection

- Layers rows display canonical hierarchy in parent-before-descendant,
  canonical child order.
- Each non-root row receives a visual depth derived from its canonical parent
  chain. Workspace is not rendered as a row.
- Official Group rows expose an expand/collapse control and default to
  expanded.
- Collapsed Group ids are UI-local presentation state. Collapsing a Group does
  not mutate, save, publish, select, deselect, or remove canonical descendants.
- Shift-range selection uses currently visible row order. Existing canonical
  selections of hidden descendants remain selected when an ancestor is
  collapsed.
- Group/Ungroup, undo/redo, load, and accepted remote hierarchy publications
  update nested rows from the same canonical UI projection. React state must
  not retain an independent parent/children map.
- If the public projection omits or misorders a supported canonical Group
  child, implementation stops at readiness or the failing owner step. The app
  may not fabricate the missing hierarchy from Render objects or a
  mutation-time patch cache.

### Canvas hierarchy hover, selection, and create-parent target

- Render supplies only the identity-safe raw element hit. Asyra Design owns
  resolving that identity against canonical `flattenedElementIds` and
  `elementDataMap`; Render display-object ancestry is not a hierarchy source.
- A visible raw Render hit always takes precedence. When that hit is missing,
  canvas hover alone may test official Groups in reverse canonical flattened
  order against their canonical computed `x`, `y`, `width`, and `height`
  through each Group's current identity-safe Render transform. This produces a
  hover-only Group bounds candidate; it is not Render hit geometry and is
  never handed to click selection, pointer-down move, or create-parent
  resolution.
- The public Core Scene Tree facade supplies the canonical current workspace
  id. This makes the explicit workspace-parent result available even when the
  workspace has no projected child elements.
- Without selected elements and without `Meta`/`Ctrl`, the reference scope is
  the workspace. The resolved target is the outermost hit ancestor that is a
  workspace direct child.
- With selected elements and without `Meta`/`Ctrl`, each exact selected
  element `parentId` is a valid reference scope. The resolver walks from the
  raw hit toward the workspace and returns the nearest ancestor whose exact
  `parentId` matches one of those scopes.
- Numerical depth is never a scope. An element at the same depth but under a
  different parent is invalid without the modifier and cannot be hovered,
  selected, or used to begin a move.
- When a multi-selection spans more than one parent, each selected `parentId`
  is a valid scope and the nearest matching ancestor to the raw hit wins.
- With `Meta` on macOS or `Ctrl` on Windows, parent scope is bypassed and the
  resolved target is the identity-safe raw hit only when it is an existing
  non-Group element. This is the first non-Group element actually hit by
  Render; the hover-only Group bounds candidate is bypassed.
- For a visible raw Render hit, canvas hover, selection, and pointer-down move
  consume the same resolved target. Selection and move may not fall back to
  the raw hit when resolution rejects it. Only hover may additionally consume
  the Group bounds candidate after the raw Render hit is missing.
- Without selection, the ordinary workspace reference scope maps a nested
  Group bounds candidate to its workspace direct-child ancestor. With
  selection, the existing exact selected-`parentId` scopes remain authoritative:
  a candidate equal to one of those scope Group ids resolves to that Group,
  and a Group inside a valid scope resolves through the same nearest-ancestor
  rule. Candidates under a different parent scope remain invalid.
- Create-element mouse down consumes the same resolved hierarchy target.
  A resolved official Group is the create parent. A resolved non-Group uses
  its exact canonical parent only when that parent is an official Group;
  otherwise the create parent is the workspace root.
- A missing raw hit on an otherwise valid canonical projection may produce
  only the hover-only Group bounds candidate. Creation ignores that candidate
  and creates under the workspace root. The app passes that workspace id as an
  explicit `parentId`; it may not leave parent unspecified and activate Scene
  Tree's legacy `firstFrame` fallback.
- For a Group result, the app common API creates the element at the explicit
  workspace position and calls Preset `moveElementsWithGroupGeometry` for the
  identity-preserving reparent inside the same outer transaction. Preset, not
  the app or Render, owns the initial Group coordinate and bounds
  normalization.
- For every create drag geometry update, the mouse-down and current workspace
  positions are converted into the chosen parent Group's current local
  coordinates through that exact identity-safe Render handle. The canonical
  hierarchy projection chooses the parent; Render ancestry does not
  participate in that decision. After the geometry write, Preset
  `normalizeGroupsForElements` refreshes affected Group bounds and rebases
  coordinates inside the same transaction.
- Input mouse movement refreshes the current modifier snapshot before hover
  resolution. Existing dragging, non-element overlay, path-editing,
  lock/visibility, and selection-mutation behavior remains unchanged around
  the resolved target.
- Layers-row hover remains an explicit row-identity interaction and is not
  changed by this canvas-only policy.
- A missing, stale, duplicated, cyclic, or invalid-root hierarchy projection,
  a Group raw hit in modifier mode, a missing/non-finite/zero-area Group
  bound, a missing Group Render handle, or no matching parent scope fails
  closed with no fabricated target, element creation, or fallback hierarchy.

### Group canvas hover and selection overlay

- A selected official Group displays the ordinary selection box, and an
  unselected official Group with the canonical hovered id displays the
  ordinary hover box.
- The existing registered Preset selection overlay layer owns this projection.
  It consumes the Group's canonical computed `x`, `y`, `width`, and `height`
  together with the current identity-safe Render world transform.
- Nested Groups project their bounds through the same current transform chain.
  Selection takes precedence over hover so one Group is not outlined twice.
- Missing, invalid, or non-finite Group bounds fail closed without inferred
  geometry. A zero-area Group does not gain a fabricated visible area.
- This presentation consumes the app-owned hover-only Group bounds candidate.
  It does not make the invisible Group a click/selection, pointer-down move, or
  create-parent hit target; create resize handles; mutate Group geometry; or
  introduce a second overlay layer, Group-specific mutable state, or
  app/Render fallback bounds.

### World-space scene bounds and viewport fit

- The public Core Scene Tree facade owns deriving overall world-space scene
  bounds from canonical element geometry and canonical parent membership.
- A non-workspace element's computed `x` and `y` are local to its canonical
  parent. The bounds query accumulates every non-workspace parent offset up to
  the workspace root before unioning that element's width and height.
- Grouping must not change the overall world-space scene bounds when the
  visible child geometry is unchanged. Normal and nested Groups therefore
  produce exactly equivalent bounds before and after Group.
- The existing app zoom-fit common API consumes these completed world-space
  scene bounds. `Cmd+1` keeps the existing shortcut and `calculateZoomFit`
  behavior; neither app nor Render may reinterpret local Group coordinates.
- Empty content returns no bounds. A missing parent, cycle, invalid workspace
  chain, or non-finite required geometry fails closed without partial bounds,
  guessed offsets, a second hierarchy, or app/Render fallback geometry.

### Save/load and collaboration

- Save/load preserves exact Group data, parent, index, child order, nested
  hierarchy, coordinates/bounds, and entity identity.
- Collapse/expand state is not document data and is not required to survive
  reload.
- One local Group or Ungroup command produces the existing grouped Factory
  hierarchy publication behavior; UI-local selection and collapsed-row state
  are not reconstructed on peers.
- Accepted remote Group/Ungroup hierarchy changes update Layers and Render
  through the ordinary canonical apply path.
- Duplicate or concurrent remote hierarchy decisions remain app/backend
  policy. This plan must not add policy to Framework Collaboration.

## Product Cases

Formal product coverage must include:

- group one selected sibling;
- group contiguous siblings in canonical order;
- group non-contiguous siblings in canonical order;
- group an existing Group with a sibling to create a nested Group;
- ungroup a normal Group and select its former children;
- ungroup an empty Group and clear selection;
- reject empty, missing-id, duplicate-id, mixed-parent, workspace, and stale
  selection input without partial state;
- preserve visible world-space output across Group and Ungroup;
- project nested rows, depth, canonical child order, expand, and collapse;
- hover normal and nested official Groups through canonical computed bounds
  when no visible Render geometry is hit, while visible raw hits retain
  precedence and modifier mode bypasses the Group bounds candidate;
- project normal and nested official Group hover/selection boxes from canonical
  computed bounds without adding a Group click/selection, move, or
  create-parent hit area;
- preserve exactly equivalent world-space scene bounds before and after normal
  or nested Group, and make `Cmd+1` center and fit that complete content;
- keep hidden-descendant selection stable across collapse/expand;
- without selection and without `Meta`/`Ctrl`, resolve a nested raw hit to its
  workspace direct-child target;
- with selection and without `Meta`/`Ctrl`, resolve only within an exact
  selected `parentId` scope and reject an equal-depth element under a different
  parent;
- with `Meta`/`Ctrl`, resolve the first non-Group raw hit and use the same
  target for hover, selection, and pointer-down move;
- resolve multiple selected parent scopes by choosing the nearest matching
  ancestor to the raw hit;
- create inside the official Group selected by the same hierarchy target
  rules, preserving the mouse-down workspace position through exact parent
  local-coordinate conversion and Preset Group normalization;
- create under the explicit workspace root when mouse down has no raw element
  hit, including an empty workspace, regardless of the current selection or
  the legacy first-Frame fallback;
- fail closed for missing, stale, duplicated, cyclic, invalid-root, Group
  modifier hits, and unmatched parent scopes without raw-hit fallback;
- undo/redo Group and Ungroup with exact hierarchy, Group data, geometry, and
  selection restoration;
- reload an exact nested Group document;
- apply an accepted remote Group/Ungroup publication without remote selection
  takeover or a second UI hierarchy;
- keep separate app/Core instances isolated.

## Explicit Non-Goals

- layer-tree drag/drop, same-parent reorder, and cross-parent reparent;
- canvas drag-to-reparent or Group bounds targeting for click/selection,
  pointer-down move, or create-parent interaction;
- Render-owned hierarchy traversal, inferred Group hit areas, and
  modifier-only stationary-pointer refresh outside normal pointer input;
- context menus, a general command palette, breadcrumbs, resize handles, or
  custom Group-specific canvas affordances beyond the ordinary hover and
  selection box;
- custom Group naming or layer rename;
- Group resize/scaling of descendants, auto-layout, clipping/masking,
  constraints, symbols/components, Boolean operations, or snapping;
- arbitrary mixed-parent grouping;
- changes to zoom-fit shortcut routing, padding policy, viewport math, or
  unrelated zoom and pan behavior;
- backend permission, domain ordering, duplicate, or concurrent conflict
  policy changes;
- any second Group component, canonical hierarchy owner, or Render-only
  workaround.

## Required Inspector Readiness

After plan approval, create a matching exact Inspector and readiness contract
tests before production code. At minimum, the Inspector must define these owner
steps:

1. **App command eligibility and intent**
   - selected-id input, projected availability output, feature request output,
     invalid/stale bypass, allowed app query contributors, and Scene Tree as
     final validator.
2. **Group/Ungroup feature transaction**
   - trigger, priority, exclusivity, one-shot execution, common-API call,
     post-selection output, transaction boundary, rollback owner, repeated
     trigger behavior, and failure route.
3. **Input and Layers command routing**
   - keyboard and visible-control inputs, editable-input bypass, disabled
     behavior, feature handoff, and forbidden direct UI mutation.
4. **Layers hierarchy projection**
   - canonical projection inputs, derived depth/visibility outputs,
     expand/collapse UI state, selection interaction, malformed projection
     failure owner, and forbidden second hierarchy state.
5. **Canvas hierarchy hover/selection/create-parent target**
   - identity-safe raw Render hit, canonical hierarchy projection, canonical
     current workspace id, current selected ids, and `Meta`/`Ctrl` inputs;
     canonical official Group bounds plus identity-safe Render transform as a
     hover-only missing-raw-hit candidate; exact parent-scope or modifier
     output; shared raw-hit hover/selection/pointer-down-move handoff;
     hover-only candidate isolation; malformed projection and unmatched-scope
     bypass; explicit create parent,
     workspace-to-parent local-coordinate handoff; and forbidden raw-hit
     fallback, unspecified-parent `firstFrame` fallback, numerical-depth
     scope, Render ancestry, Render-owned Group hit geometry, or second
     hierarchy state.
6. **Group hover/selection overlay projection**
   - canonical selection and hovered-id inputs, official Group computed bounds,
     current Render transform, existing overlay-layer output, invalid-bounds
     bypass, hover-only bounds-candidate boundary, and forbidden second
     layer/state/fallback.
7. **Core world-space scene bounds for viewport fit**
   - canonical Scene Tree elements and parent-chain input, accumulated
     world-space bounds output, workspace-root termination, empty-content
     bypass, malformed-chain failure owner, exact Group before/after
     equivalence, and forbidden app/Render fallback.
8. **Factory history/publication and app remote apply**
   - one command/undo/redo publication boundary, local selection isolation,
     accepted remote canonical apply, rejected remote bypass, and explicit
     Collaboration exclusions.
9. **Save/load and Render verification**
   - exact hierarchy load output, Layers refresh, identity-safe Render handoff,
     load rejection owner, and no fallback projection.

Every Inspector step must specify owner, inputs, outputs, conditions, bypasses,
allowed contributors, forbidden contributors, implementation boundary,
failure owner, product cases, spec references, and the DoD assertions it
satisfies. Readiness contract tests must fail if any field, edge, artifact, or
required owner route is missing or inconsistent with Gate 3.

Implementation proceeds one Inspector owner step at a time. For every bug or
missing contract enforcement, first prove whether an existing formal test
fails; when it does not, add or strengthen the formal failing regression test
before production code.

## Expected Implementation Boundary

The Inspector may authorize narrowly scoped changes under:

- `apps/asyra-design/src/constants/*`
- `apps/asyra-design/src/config/key-combinations.ts`
- `apps/asyra-design/src/common-apis/*`
- `apps/asyra-design/src/controllers/*`
- `apps/asyra-design/src/features/*`
- `apps/asyra-design/src/providers/*`
- `apps/asyra-design/src/contents/*`
- `apps/asyra-design/src/init/*`
- `apps/asyra-design/e2e/*`
- `create-app/asyra-design/template/*`, only as generated synchronization
  output from the official `release:app` script after source app changes.
- directly corresponding app contracts, BDD cases, and decision history.
- `packages/preset/src/render-layers/selection-overlay-render-layer.ts` and its
  directly corresponding `packages/preset/src/__tests__` regression tests,
  limited to projecting official Group hover/selection bounds through the
  existing registered layer.
- `packages/core/src/apis/*` and directly corresponding
  `packages/core/src/__tests__` regression tests, limited to deriving canonical
  world-space scene bounds for the existing viewport-fit consumer.

Except for the exact Preset selection-overlay and Core Scene Tree facade bounds
boundaries above, Framework, Preset, Scene Tree, Factory, Collaboration, and
Render production changes are not pre-authorized by this app plan. If formal
evidence finds another upstream Gate 3 contract violation, stop the current app
owner step and obtain a bounded upstream plan/Inspector amendment. Do not add
an app fallback.

## Formal Test Plan

- Inspector readiness contract tests for every required owner step, edge,
  artifact, product case, and DoD mapping.
- Unit tests for command eligibility, selection policy, editable-input bypass,
  derived row depth/visibility, and collapsed-state behavior.
- Unit tests for canvas hierarchy target and create-parent resolution across
  workspace scope, exact selected-parent scopes, multiple selected-parent
  scopes, modifier bypass, different-parent rejection, missing raw hit,
  hover-only Group bounds candidates, raw-hit precedence, invalid Group
  bounds/transform, malformed projections, and cycles.
- Feature integration tests proving hover, selection, and pointer-down move
  consume the same resolved target without raw-hit fallback, and pointer input
  refreshes current `Meta`/`Ctrl` state.
- Create feature/common-API tests proving mouse down passes one explicit
  workspace or official Group parent, converts workspace position into nested
  parent-local coordinates for initial creation and drag geometry updates, and
  routes reparent/bounds normalization through Preset without activating the
  legacy `firstFrame` fallback.
- Feature/common-API integration tests for one transaction, rollback,
  rejection/no-op, exact post-selection, and undo/redo.
- Layers component tests for enabled/disabled controls, nested rows,
  expand/collapse, visible-range selection, and stable selectors.
- Preset selection-overlay tests for selected, hovered, nested, invalid-bounds,
  duplicate-outline suppression, and unchanged non-Group behavior.
- Core world-bounds tests proving normal and nested Group before/after
  equivalence plus empty, missing-parent, cycle, invalid-workspace-chain, and
  non-finite failure behavior.
- App viewport integration tests proving `Cmd+1` consumes the completed Core
  bounds through the existing common API and `calculateZoomFit`.
- App integration tests for save/load, accepted remote apply, local selection
  isolation, and instance isolation.
- E2E tests driven through visible controls and shortcuts, not
  `window.__AsyraE2E__`, for Group/Ungroup, nested Layers, undo/redo, and
  reload.
- Synchronized live-app visual review proving no visible geometry jump and
  correct nested Layers presentation before completion is claimed.

## Definition of Done

- the approved product contract and exact Inspector agree and readiness tests
  pass before implementation;
- every Inspector owner step is completed and reviewed independently;
- visible Layers controls and standard shortcuts execute the same feature
  contract;
- Group/Ungroup eligibility, post-selection, nested projection,
  expand/collapse, hierarchy-scoped canvas hover/selection/move/create-parent
  targeting, hover-only Group bounds targeting, Group hover/selection boxes,
  exact world-space scene bounds, `Cmd+1` fit, failures, undo/redo, save/load,
  and collaboration behavior match this plan;
- no second hierarchy state, second Group component, app-specific Render
  fallback, or Collaboration conflict policy is introduced;
- all affected app/package tests, Inspector tests, Scene Tree/Factory/Preset/
  Render/app integration tests, TypeScript/build gates, dependency validation,
  lint, root production build, and synchronized visual/product gates pass;
- final diff review is bounded to the approved plan, Inspector, touched owner
  steps, direct consumers, and required gates;
- the user completes manual product review before any closeout.

## Manual Review Checklist

- Group through the Layers control and keyboard shortcut.
- Group contiguous, non-contiguous, single, and nested selections.
- Ungroup normal and empty Groups.
- Verify post-operation selection and exact undo/redo.
- Expand/collapse nested Groups and shift-select visible rows.
- Move visible children away from part of a normal or nested Group's canonical
  bounds; hover that empty bounds area and confirm the ordinary hover box
  appears. Confirm visible raw hits still take precedence, modifier mode
  bypasses the Group bounds candidate, and the candidate does not become a
  click/selection, move, or create-parent target.
- With no selection, hover nested content with and without `Cmd`/`Ctrl`; verify
  the workspace direct child and first non-Group raw hit respectively.
- Select an element inside one Group, then hover siblings, nested descendants,
  and an equal-depth element inside another Group; verify only the exact parent
  scope is active without `Cmd`/`Ctrl`, while the modifier reaches the raw
  non-Group hit for hover, click selection, and pointer-down move.
- With the create tool, draw over eligible nested Group content with and
  without `Cmd`/`Ctrl`; verify the new element uses the Group selected by the
  same hierarchy target rules and does not visibly jump.
- Keep a Group selected, then draw on empty canvas outside every raw element;
  verify the new element is a workspace child rather than a child of the first
  top-level Group.
- Use `Cmd+1` before and after normal and nested Group operations; confirm the
  same complete visible content is centered and fitted without a position or
  scale jump caused by local Group coordinates.
- Reload a nested Group document.
- Confirm no canvas jump, duplicate visual, stale row, or remote selection
  takeover.

## Stop Conditions

- Gate 3 is not merged into `main`.
- The product contract and Inspector disagree.
- Readiness contract tests fail.
- Canonical Group projection is missing and would require an app fallback.
- Canonical Group computed bounds or the current Render transform are missing
  and would require fabricated overlay geometry.
- Canonical parent membership or computed geometry cannot produce exact
  world-space scene bounds without partial or fallback output.
- A requested behavior requires layer-tree drag/drop, auto-layout,
  resize/scaling, clipping, symbols, or remote conflict policy.
- Manual product review has not approved completion.
