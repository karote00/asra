# Asyra Design Layer Tree Reparent and Reorder Plan

## Status

Approved on 2026-07-24 as the second sequential stage in the same combined app
review branch. Framework Release Gate 3 is present on `main` at `d54fa92fa`.
Production implementation remains blocked until:

1. `group-interaction-mvp-plan.md` owner steps and required gates are complete;
   and
2. this plan's matching Inspector owner flow and executable readiness contract
   tests pass.

Both plans remain open for one final user review. Neither plan may be closed or
merged automatically.

## Goal

Let a user reorder and reparent existing elements through the Layers tree while
preserving canonical identity, hierarchy, geometry, transaction, history,
persistence, collaboration, and Render behavior established by Gate 3.

The first release supports pointer-driven Layers interactions for:

- same-parent reorder;
- cross-parent reparent into the workspace or an official Group;
- moving a canonical ordered set of selected siblings;
- moving nested Groups without delete/recreate;
- deterministic cancel, rejection, rollback, undo/redo, save/load, and remote
  apply.

## Current Baseline

- Gate 3 exposes `hierarchyApis.moveElements(...)` through Asyra Design's
  common-API boundary.
- Scene Tree canonicalizes moved ids by current sibling order and evaluates
  `targetIndex` against the final target child list after moved ids are
  removed.
- Preset's public move adapter owns world-space-preserving coordinate and basic
  Group-bounds normalization when an official Group boundary is crossed.
- Render preserves entity and engine identity during canonical hierarchy
  handoff.
- The Group Interaction MVP supplies nested Layers rows, canonical visual
  depth, element selection, and local expand/collapse state.
- The app does not yet own a Layers pointer session, drop-intent calculation,
  drop feedback, or product selection policy for hierarchy moves.

## Product Ownership

### Asyra Design

- owns pointer-session routing, dragged-id selection policy, visible drop
  zones, drop feedback, provisional expand/collapse presentation, and the
  final app request;
- derives a presentation-level target parent/index from the canonical Layers
  projection;
- invokes exactly one `hierarchyApis.moveElements(...)` request for one valid
  drop;
- may reject an obviously unavailable interaction for UX, but may not replace
  Scene Tree's final validation.

### Framework owners retained from Gate 3

- Scene Tree remains the sole owner of parent membership, child order,
  canonical source ordering, cycle prevention, target-index validation, and
  hierarchy mutation.
- Preset remains the official Group coordinate/bounds adapter.
- Factory remains the transaction, rollback, undo/redo, and publication owner.
- App/backend remains the remote permission, domain ordering, duplicate, and
  concurrent conflict-policy owner.
- Collaboration remains transport-only.
- Render projects canonical hierarchy and preserves identity; it does not
  predict or repair a Layers drop.

## Product Contract

### Drag source and selected ids

- Only non-workspace Layers rows can start a move session.
- A locked source row cannot start a hierarchy drag. Visibility does not alter
  drag eligibility.
- If pointer-down begins on an unselected eligible row, the app replaces
  element selection with that row before starting the drag.
- If pointer-down begins on a selected row, the candidate moved ids are the
  current selected ids.
- A multi-id candidate is eligible only when all ids are unique, existing,
  non-workspace siblings with one common parent.
- Mixed-parent or stale multi-selection produces invalid feedback and no
  hierarchy request. The app must not silently move only a subset.
- Scene Tree, not the Layers projection, canonicalizes the final moved-id
  order.

### Pointer session

- Layers DOM pointer events are normalized into an app-owned hierarchy-move
  session. UI handlers do not mutate Scene Tree directly.
- Pointer-down establishes the selection/source intent.
- Pointer movement starts drag feedback only after the documented movement
  threshold.
- Hover/update changes UI-local drop intent and feedback only. It performs no
  canonical hierarchy or geometry mutation and creates no publication.
- Pointer-up over one valid drop target invokes exactly one common-API move
  request.
- Pointer-up without crossing the threshold behaves as the ordinary Layers row
  selection action.
- Escape, pointer cancel, unmount, lost capture, invalid target, and drop
  outside the Layers tree perform no hierarchy mutation and clear all drag
  feedback.
- Handler error or timeout rolls back the outer intended action through the
  Factory transaction owner.

### Drop zones and target meaning

Each visible row exposes up to three presentation zones:

- **before**: insert immediately before that row in its canonical parent;
- **after**: insert immediately after that row in its canonical parent;
- **inside**: append as the last direct child of an eligible official Group.

Additional rules:

- Before/after never changes the target row's parent.
- Inside is available only on an official Group that is not a moved id,
  descendant of a moved container, or locked.
- Dropping on the Layers empty area appends to the workspace.
- A successful inside drop on a collapsed Group expands that Group in
  UI-local state so the result is visible. This expansion is not document or
  history data.
- Before/after a Group row targets the Group's parent; it does not imply inside.
- The workspace is a target but never a rendered draggable row.
- This stage does not reparent into Frame or another registered container.
  Supporting additional container products requires a later explicit app
  contract even though Scene Tree remains generic.

### Target index

- The app derives one requested final insertion index from canonical visible
  sibling positions.
- The index follows Gate 3's contract: it is measured in the final target child
  list after every moved id already in that parent has been removed.
- Same-parent reorder and cross-parent reparent use the same calculation and
  public request.
- A same-parent drop that resolves to the existing canonical order is a
  successful semantic no-op with no mutation, history entry, or publication.
- Invalid, fractional, negative, or out-of-range indices never reach a
  corrective/fallback mutation.

### Validation and feedback

- The app may derive obvious invalid states for drop feedback: self/selected
  target, selected descendant target, locked target, mixed-parent source,
  missing projection data, and unsupported container target.
- Derived feedback is advisory. The final request always passes through Scene
  Tree's complete validation for existence, container registration, membership,
  order, workspace restrictions, index, self-parenting, and cycles.
- Invalid targets display a stable invalid state and do not show the valid
  insertion indicator.
- Valid before/after/inside targets display one unambiguous insertion
  indicator.
- Canonical rejection clears preview state and leaves hierarchy, geometry, and
  selection at the pre-request state. The app must not retry with a transformed
  subset, parent, or index.

### Intended transaction and selection

- One completed Layers drag/drop is one intended Factory transaction and one
  undo commit.
- When the drag begins on an unselected row, its source-selection change and
  successful hierarchy move belong to that same intended commit.
- A click without a completed drag retains ordinary selection behavior.
- Cancel after source selection but before a hierarchy mutation follows the
  Inspector-defined `commit-current` selection behavior; it must not fabricate
  a hierarchy history entry.
- After a successful drop, selection contains the moved ids in canonical moved
  order.
- Undo/redo restores exact selected ids, entity identity, parent, sibling
  index, child order, Group coordinates/bounds, and nested subtree data.
- Any failure after the transaction opens restores all rollbackable selection,
  hierarchy, and property state.

### Projection, geometry, and identity

- The Layers tree refreshes from canonical parent/child projection after
  commit, undo, redo, load, and accepted remote apply.
- Drag preview state never becomes a second hierarchy read model.
- Crossing an official Group boundary uses the existing Preset move adapter;
  app code does not calculate or patch child world/local coordinates or Group
  bounds.
- Same-parent reorder preserves world-space geometry.
- Cross-parent reparent preserves visible world-space appearance for moved
  elements and nested Groups within Gate 3's basic 2D Group contract.
- Render receives the canonical hierarchy handoff for the same entity and
  engine handle. Delete/recreate, duplicate visuals, stale parents, or
  Render-only reordering are forbidden.

### Save/load and collaboration

- Save/load reproduces exact moved identities, parents, indices, child order,
  nested Group data, and geometry.
- Pointer preview, insertion indicators, and expanded-after-drop UI state are
  not document data.
- One completed local move produces the existing one grouped Factory
  publication. Hover/update frames produce none.
- Accepted remote moves update Layers and Render through the ordinary
  app-owned remote transaction and Scene Tree validation path.
- A rejected duplicate/concurrent remote move leaves local canonical state
  unchanged according to app/backend policy.
- This plan may add product tests for the existing remote policy boundary but
  may not move dedupe, LWW, timestamps, conflict resolution, or semantic
  history into Collaboration.

## Product Cases

Formal product coverage must include:

- reorder one row earlier and later within the workspace;
- reorder several selected siblings while preserving canonical relative order;
- move one element from workspace into an expanded Group;
- move one element into a collapsed Group and reveal the accepted result;
- move one or several Group children back to workspace;
- move an existing nested Group across parents without changing identity;
- reorder siblings inside one Group;
- no-op same-parent drop;
- cancel before threshold, Escape cancel, pointer cancel, lost capture,
  unmount, invalid target, and outside drop;
- reject mixed-parent selected ids, locked source, locked inside target,
  missing/stale ids, workspace source, self-parent, descendant cycle,
  duplicate ids, unsupported container, and invalid index without partial
  state;
- exact rollback and undo/redo of selection, hierarchy, Group data, and
  geometry;
- exact save/load and accepted remote apply;
- stable Layers insertion indicators and no visible canvas jump;
- identity-safe Render handoff and separate-instance isolation.

## Explicit Non-Goals

- Group/Ungroup command authoring, which belongs to the prerequisite plan;
- canvas drag-to-reparent, automatic containment, or geometry-based parent
  inference;
- Frame or arbitrary custom-container drop targets in this first app release;
- keyboard reorder/reparent commands, context-menu move commands, breadcrumbs,
  layer rename, search/filter, or virtualized tree redesign;
- auto-expand-on-hover timers or spring-loaded navigation;
- mixed-source-parent multi-selection moves;
- Group resize/scaling, auto-layout, clipping/masking, constraints, symbols/
  components, Boolean operations, or snapping;
- backend conflict-policy design;
- a second hierarchy model, delete/recreate move, app geometry fallback,
  Render-only workaround, or fixture-specific exception.

## Required Inspector Readiness

After plan approval and prerequisite completion, create an exact Inspector and
readiness tests before production implementation. At minimum, the Inspector
must define:

1. **Layers pointer normalization**
   - DOM pointer inputs, threshold, capture/lost-capture/unmount conditions,
     normalized session outputs, editable/action-control bypasses, and UI-only
     preview boundary.
2. **Source selection and move intent**
   - selected/projection inputs, single versus multi-source output, mixed-parent
     rejection, lock policy, transaction start, and Scene Tree final-validation
     boundary.
3. **Drop candidate projection**
   - visible row/zone inputs, parent/index intent output, final-list index
     calculation, collapsed Group behavior, invalid feedback, supported
     containers, and forbidden canonical mutation.
4. **Feature session and canonical commit**
   - feature priority, exclusivity, cancel policy, start/update/end/cancel
     routes, exactly one common-API request, post-selection, rollback owner,
     semantic no-op, and failure behavior.
5. **Scene Tree/Preset/Factory handoff**
   - canonical request/result, complete validation, Group coordinate/bounds
     route, one transaction/undo/publication, rejected/no-op bypass, and
     forbidden app reinterpretation.
6. **Layers/Render projection**
   - commit/undo/redo/load/remote inputs, canonical row output, insertion-state
     cleanup, identity-safe Render handoff, and malformed/stale projection
     failure owner.
7. **App-owned remote apply**
   - accepted/rejected remote move, permission/domain-order/conflict policy
     boundary, one remote transaction, local selection isolation, and explicit
     Collaboration exclusions.

Every Inspector step must state owner, inputs, outputs, conditions, bypasses,
allowed contributors, forbidden contributors, implementation boundary,
failure owner, product cases, spec references, and DoD assertions. Readiness
tests must fail for missing routes, artifacts, failure ownership, cancel
behavior, index semantics, or contributor boundaries.

Implementation proceeds one Inspector owner step at a time. Bugs and missing
contract enforcement are test-first: prove the formal test fails before
changing production behavior.

## Expected Implementation Boundary

The Inspector may authorize narrowly scoped changes under:

- `apps/asyra-design/src/constants/*`
- `apps/asyra-design/src/common-apis/*`
- `apps/asyra-design/src/controllers/*`
- `apps/asyra-design/src/features/*`
- `apps/asyra-design/src/providers/*`
- `apps/asyra-design/src/contents/*`
- `apps/asyra-design/e2e/*`
- directly corresponding app contracts, BDD cases, and decision history.

No Framework/Preset/Scene Tree/Factory/Collaboration/Render production change
is pre-authorized. If formal evidence finds a Gate 3 owner defect, stop the app
step and obtain a bounded upstream plan/Inspector amendment. Do not hide it in
Layers or Render.

## Formal Test Plan

- Inspector readiness contract tests for every owner step, route, edge,
  artifact, product case, and DoD mapping.
- Unit tests for source selection, mixed-parent rejection, lock policy,
  before/after/inside projection, final-list target-index calculation,
  collapsed Group behavior, and feedback cleanup.
- Feature-session tests for threshold, pointer lifecycle, cancel policies,
  exactly one move call, semantic no-op, failure rollback, and one undo commit.
- App/common-API integration tests for same-parent reorder, cross-parent
  reparent, Preset Group geometry, exact undo/redo, save/load, remote apply, and
  instance isolation.
- Layers component tests for stable pointer targets, insertion indicators,
  invalid states, selected-row behavior, and virtualization/direct-consumer
  regressions.
- E2E tests driven only through visible Layers pointer interactions for
  reorder, reparent, nested Group, cancel, invalid drop, undo/redo, and reload.
- Synchronized live-app visual review proving correct Layers placement,
  visible feedback, no canvas jump, and no duplicate/stale Render object.

## Definition of Done

- the prerequisite Group Interaction MVP implementation and required gates are
  complete in this combined branch, and Gate 3 is on `main`;
- the approved plan, exact Inspector, and readiness tests agree before
  implementation;
- every Inspector owner step is implemented and reviewed separately;
- Layers pointer behavior matches the source, target, index, validation,
  transaction, selection, failure, projection, geometry, identity,
  persistence, and collaboration contracts in this plan;
- no delete/recreate move, second hierarchy state, app geometry fallback,
  Render workaround, or Collaboration conflict policy is introduced;
- all affected package/app tests, Inspector contract tests, Scene Tree/
  Factory/Preset/Render/app integration tests, TypeScript/build gates,
  dependency validation, lint, root production build, and synchronized visual/
  product gates pass;
- final diff review stays bounded to the approved plan, Inspector, touched
  owner steps, direct consumers, and required gates;
- the user completes manual product review before closeout.

## Manual Review Checklist

- Reorder one and multiple selected siblings in workspace and inside a Group.
- Reparent into an expanded and collapsed Group.
- Reparent Group children and a nested Group back to workspace.
- Try click, below-threshold movement, Escape, outside drop, locked rows,
  mixed-parent selection, self/descendant targets, and no-op targets.
- Verify selection, exact undo/redo, reload, and a second collaborative window.
- Confirm clear valid/invalid insertion feedback, no visible geometry jump, no
  duplicate row/visual, and preserved entity identity.

## Stop Conditions

- Gate 3 is not merged, or the Group Interaction MVP owner steps and required
  gates are incomplete in this combined branch.
- The product contract and Inspector disagree.
- Readiness contract tests fail.
- A canonical owner defect would require app/Render fallback state.
- The requested behavior requires Frame/custom-container targets, canvas
  containment, keyboard reparent, auto-layout, resize/scaling, clipping,
  symbols, or new remote conflict policy.
- Manual product review has not approved completion.
