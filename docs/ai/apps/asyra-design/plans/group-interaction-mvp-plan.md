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
- see the canonical Group bounds as the ordinary canvas hover and selection
  box without making the invisible Group a canvas hit area;
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
- This presentation does not make the invisible Group a canvas hit target,
  create resize handles, mutate Group geometry, or introduce a second overlay
  layer, Group-specific mutable state, or app/Render fallback bounds.

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
- project normal and nested official Group hover/selection boxes from canonical
  computed bounds without adding a Group canvas hit area;
- keep hidden-descendant selection stable across collapse/expand;
- undo/redo Group and Ungroup with exact hierarchy, Group data, geometry, and
  selection restoration;
- reload an exact nested Group document;
- apply an accepted remote Group/Ungroup publication without remote selection
  takeover or a second UI hierarchy;
- keep separate app/Core instances isolated.

## Explicit Non-Goals

- layer-tree drag/drop, same-parent reorder, and cross-parent reparent;
- canvas drag-to-reparent or canvas Group hit-area interaction;
- context menus, a general command palette, breadcrumbs, resize handles, or
  custom Group-specific canvas affordances beyond the ordinary hover and
  selection box;
- custom Group naming or layer rename;
- Group resize/scaling of descendants, auto-layout, clipping/masking,
  constraints, symbols/components, Boolean operations, or snapping;
- arbitrary mixed-parent grouping;
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
5. **Group hover/selection overlay projection**
   - canonical selection and hovered-id inputs, official Group computed bounds,
     current Render transform, existing overlay-layer output, invalid-bounds
     bypass, no-hit-area boundary, and forbidden second layer/state/fallback.
6. **Factory history/publication and app remote apply**
   - one command/undo/redo publication boundary, local selection isolation,
     accepted remote canonical apply, rejected remote bypass, and explicit
     Collaboration exclusions.
7. **Save/load and Render verification**
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
- directly corresponding app contracts, BDD cases, and decision history.
- `packages/preset/src/render-layers/selection-overlay-render-layer.ts` and its
  directly corresponding `packages/preset/src/__tests__` regression tests,
  limited to projecting official Group hover/selection bounds through the
  existing registered layer.

Except for the exact Preset selection-overlay boundary above, Framework,
Preset, Scene Tree, Factory, Collaboration, and Render production changes are
not pre-authorized by this app plan. If formal evidence finds another upstream
Gate 3 contract violation, stop the current app owner step and obtain a bounded
upstream plan/Inspector amendment. Do not add an app fallback.

## Formal Test Plan

- Inspector readiness contract tests for every required owner step, edge,
  artifact, product case, and DoD mapping.
- Unit tests for command eligibility, selection policy, editable-input bypass,
  derived row depth/visibility, and collapsed-state behavior.
- Feature/common-API integration tests for one transaction, rollback,
  rejection/no-op, exact post-selection, and undo/redo.
- Layers component tests for enabled/disabled controls, nested rows,
  expand/collapse, visible-range selection, and stable selectors.
- Preset selection-overlay tests for selected, hovered, nested, invalid-bounds,
  duplicate-outline suppression, and unchanged non-Group behavior.
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
  expand/collapse, Group hover/selection boxes, failures, undo/redo, save/load,
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
- Hover and select normal and nested Groups; confirm the ordinary canvas box
  matches canonical Group bounds and no Group canvas hit area was introduced.
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
- A requested behavior requires layer-tree drag/drop, auto-layout,
  resize/scaling, clipping, symbols, or remote conflict policy.
- Manual product review has not approved completion.
