# Group Component and Hierarchy Behaviors Plan

## Status

Framework Release Gate 3 completed and approved for closeout on 2026-07-24.
The dedicated Inspector remains the architecture authority for the completed
product contract.

This completed record does not authorize beginning Framework Release Gate 4.

## Completion Record

- Final decision: keep Scene Tree as the sole canonical hierarchy owner,
  Factory as the one-transaction/undo/publication owner, Collaboration as
  transport-only, Preset as the official Group geometry adapter, Render as a
  projection, and app/backend code as the interaction and remote-policy owner.
- Implementation summary: public ID-based group, ungroup, reparent/reorder, and
  subtree operations now preserve identity, exact order, rollback, replay,
  save/load, grouped publication, 2D world-space appearance, and identity-safe
  Render handoff without a second Group component or fallback hierarchy.
- Validation snapshot: at baseline `474b030a1`, all PR checks passed, including
  ordinary and collaboration browser E2E, repository validation, production
  build, dependency checks, lint with zero errors, generated-template sync,
  Inspector contracts, package/integration tests, and synchronized product
  gates.
- Exit criteria: the supported hierarchy cases, failure boundaries, ownership
  rules, documentation, and direct consumers match this contract; the product
  owner approved closeout on 2026-07-24.

## Completed Baseline

- Scene Tree already owns parent ids, child arrays, container registration,
  sibling order, and add/remove parent/index replay evidence.
- Preset `CONTAINERS` already installs the official `GROUP` component, its
  invisible default Render strategy, and the Scene Tree-to-Render projection.
- Render already consumes canonical parent/index hierarchy information.
- The framework exposes one complete atomic contract for grouping, ungrouping,
  reparenting/reordering, subtree removal, and their failure, replay,
  collaboration, and load invariants.

The completed implementation extends this baseline without registering a
duplicate Group component or modeling a hierarchy move as deletion plus
creation of a new entity identity.

## Goal

Provide stable, UI-independent hierarchy behavior that lets a preset-based
design tool create and manipulate groups through public framework boundaries.

The release result must support:

- creating one Group around valid sibling elements;
- ungrouping one Group into its parent;
- moving or reordering existing elements and nested groups without changing
  their identities;
- deterministic nested-container and subtree behavior;
- exact rollback, undo/redo, save/load, transport grouping, app-owned remote
  apply, and Render hierarchy projection;
- app-owned invocation, selection decisions, shortcuts, hover/click behavior,
  and presentation.

## Ownership

### Scene Tree

- sole canonical owner of parent membership, child order, cycle prevention,
  subtree membership, and hierarchy mutation validation;
- exposes ID-based hierarchy operations through the Core facade rather than
  requiring apps to hold internal Group instances;
- validates the complete operation before the first canonical mutation;
- preserves existing element identity and exact before/after parent/index
  evidence for replay and collaboration.

Scene Tree must remain generic to every registered `isContainer` component. It
must not hardcode Preset Group UI or design-tool selection policy.

### Factory and collaboration pipeline

- one user-visible group, ungroup, move, or reorder request is one intended
  transaction and undo commit;
- rollback and undo/redo restore exact membership, sibling order, identities,
  and canonical data;
- shared delivery preserves transaction grouping and hierarchy provenance;
- after Release Gate 2, Collaboration transports every completed publication in
  order without dedupe or semantic interpretation;
- the receiving app validates route, payload, permission, domain order, and
  conflict policy before asking Scene Tree to validate and apply the accepted
  canonical hierarchy operation inside one Factory remote transaction;
- Factory remote origin suppresses local undo capture and outbound echo, but
  Factory and Collaboration do not decide whether a repeated or concurrent
  hierarchy request is accepted.

### Preset

- `CONTAINERS` remains the owner of the official Group component/defaults;
- provides basic ID-driven group and ungroup operation adapters through public
  Core/Scene Tree and property APIs;
- owns the default 2D coordinate normalization needed to preserve world-space
  appearance when elements enter or leave the invisible Group container;
- keeps Group geometry consistent with its direct children for the supported
  basic translation/bounds contract.

Preset must not inspect app selection, bind shortcuts, choose the active Group,
create hover/click policy, install product UI, or bypass canonical Scene Tree
mutation APIs.

### Render and app

- Render projects the committed canonical hierarchy and keeps existing element
  identity/engine ownership through reparent or reorder handoff;
- the app decides which ids to operate on, which feature/command triggers the
  request, post-operation selection, UI tree presentation, hover/click targets,
  menus, shortcuts, and product-specific interaction policy.

## Public Input and Output Contracts

### Scene Tree hierarchy request

The Core-facing generic hierarchy operation is ID-based:

```ts
interface MoveHierarchyRequest {
  elementIds: readonly string[]
  targetParentId: string
  targetIndex: number
}

interface HierarchyLocation {
  parentId: string
  index: number
}

interface HierarchyMove {
  elementId: string
  before: HierarchyLocation
  after: HierarchyLocation
}

interface MoveHierarchyResult {
  elementIds: readonly string[]
  moves: readonly HierarchyMove[]
}
```

- `elementIds` must be non-empty, unique, existing, non-workspace siblings with
  one current parent.
- `targetParentId` must identify an existing registered container.
- `targetIndex` is an integer in the final target-parent insertion range after
  the moved ids have been removed from that parent.
- Scene Tree canonicalizes `elementIds` by current sibling order and returns
  exact before/after locations. A same-parent no-op returns a successful result
  with no canonical mutation or transaction entry.
- Rejection throws before the first canonical mutation and exposes no partial
  result. Preset, App, Collaboration, Factory, and Render must not reinterpret
  an invalid request into a different hierarchy.

The public subtree removal boundary accepts one existing non-workspace
`elementId`. Its result identifies the deterministic descendant-first removal
order and exact saved parent/index evidence used for rollback and undo/redo.
Removing a container means removing its complete subtree; moving its children
out is the separate ungroup operation.

### Preset Group operations

Preset exports ID-driven adapters bound to one supplied Core:

```ts
groupElements(core, elementIds, options?) =>
  { groupId, elementIds, bounds }

ungroupElement(core, groupId, options?) =>
  { groupId, elementIds, removed: true }
```

- `groupElements` accepts only the Scene Tree sibling request defined above,
  creates the already-registered official `GROUP`, inserts it at the first
  selected sibling index, moves children in canonical order, and applies the
  supported 2D coordinate/bounds normalization inside one transaction.
- `ungroupElement` accepts one existing official Preset Group with a valid
  container parent, moves its direct children to the Group slot, normalizes
  coordinates, and removes the empty Group inside one transaction.
- The adapters return detached operation results. They do not select elements,
  name Groups for a product, register commands, or own UI policy.

### Remote hierarchy apply

One received Factory publication remains one Collaboration callback. The app
may reject a repeated or concurrent hierarchy publication, accept it unchanged,
or transform it according to app/backend policy. Only an accepted canonical
request enters one Factory remote transaction and the same Scene Tree
validation/mutation boundary used locally.

Framework Collaboration must not add publication dedupe, hierarchy operation
identity, timestamp ordering, last-write-wins, rebase, conflict resolution,
semantic history, or a convergence registry. Therefore duplicate delivery and
concurrent hierarchy convergence are app/backend product cases, not Framework
convergence guarantees.

## Supported Product Contract

### Group

- Input ids are non-empty, unique, existing, non-workspace siblings with one
  common parent.
- Canonical sibling order, not caller input order, determines child order.
- The Group is inserted at the first selected sibling position and the selected
  elements become its children in their previous relative order.
- Nested groups are allowed.
- Preset establishes the default Group bounds/position and converts child
  coordinates so visible world-space output does not jump.
- Direct-child membership or geometry changes rederive the default Group bounds
  through one canonical Preset-owned path; rebasing must not create a visible
  jump, recursive mutation loop, or second geometry authority.

### Ungroup

- The target is one existing Preset Group with a valid container parent.
- Direct children move into the Group's parent at the Group's sibling slot and
  retain their relative order and identities.
- Preset converts child coordinates back to the parent coordinate space so
  visible world-space output does not jump.
- The empty Group is then removed. Ungrouping an already-empty Group
  deterministically removes that Group and makes no child mutation.

### Reparent and reorder

- Move/reorder accepts existing ids, a valid target container id, and a bounded
  target index.
- The target index is evaluated against the final target child list after the
  moved siblings have been removed, so same-parent reorder and cross-parent
  reparent use one unambiguous index contract.
- A move preserves entity identity and cannot make an element its own parent,
  place a container under its descendant, duplicate membership, orphan an
  element, or create a cycle.
- Moving multiple siblings preserves their canonical relative order.
- Same-parent reorder and cross-parent reparent share one validated hierarchy
  mutation contract; the exact public request/result names are finalized by the
  Inspector before implementation.

### Subtree and lifecycle

- Removing a non-empty Group removes its complete owned subtree unless the
  caller explicitly chose the separate ungroup operation.
- Subtree removal and restoration are deterministic, bounded, and reversible;
  descendants cannot remain registered with a missing parent.
- Save/load preserves one parent per non-workspace element, exact child order,
  nested groups, and Group data.
- Load rejects or normalizes malformed hierarchy only at the documented load
  validation boundary; runtime mutations never silently repair invalid input.
- Destroy, reload, re-registration, and instance teardown release observers and
  projections without sharing hierarchy state across Core instances.

## Unsupported and App-Owned Behavior

- selection and post-operation selection policy;
- keyboard shortcuts, context menus, toolbar actions, and command routing;
- hover, clickability, hit-area presentation, outlines, handles, breadcrumbs,
  layers-panel UI, and accessibility UI;
- app-specific naming, locking policy, permissions, snapping, layout, and
  constraint systems;
- Group resize/scaling of descendants, auto-layout, clipping/masking, Boolean
  operations, symbols/components, and arbitrary cross-parent multi-selection
  grouping in this release gate.

Unsupported behavior must fail explicitly or remain absent. It must not be
simulated through Render-only output, app-specific fallback state, or duplicate
hierarchy ownership.

## Product Cases

- group contiguous and non-contiguous siblings while preserving canonical
  order and world-space appearance;
- group a nested Group with another sibling;
- ungroup normal and empty Groups deterministically;
- reorder within one parent and reparent across two valid containers;
- reject missing ids, duplicate ids, mixed parents for group, invalid target,
  workspace movement, self-parenting, descendant cycles, and invalid index
  before mutation;
- delete and undo a multi-level subtree with exact identities/order restored;
- rollback a mid-operation failure with no partial parent/child/property state;
- undo/redo and save/load reproduce the exact hierarchy and Group geometry;
- Factory publishes one grouped hierarchy action, undo, redo, or rollback
  compensation without Collaboration splitting, deduplicating, or reordering
  its hierarchy deliveries;
- app-owned remote apply accepts or rejects group, ungroup, reorder, and
  subtree-delete publications before canonical mutation; duplicate delivery
  and concurrent hierarchy conflict outcomes are covered by explicit
  app/backend policy tests rather than a Framework convergence guarantee;
- Render reparent/reorder performs one abstract hierarchy handoff for the same
  canonical element identity and never leaves a duplicate visual or stale
  parent;
- separate Core instances remain isolated;
- apps can invoke the operations without importing Scene Tree internals or
  receiving any framework-owned UI behavior.

## Definition of Done

- the product contract and exact Inspector owner flow agree and every route,
  artifact, failure owner, and implementation boundary resolves;
- Scene Tree formal tests cover hierarchy validation, atomicity, ordering,
  subtree lifecycle, replay, load, and instance isolation;
- Factory/collaboration tests prove one transaction, exact inverse, publication
  transport, and app-owned remote canonical apply; hierarchy conflict and
  convergence policy remain app/backend contracts, and Collaboration gains no
  dedupe, timestamp/LWW, ordering, conflict, or semantic-history owner;
- Preset tests prove component installation, operation adapters, coordinate and
  bounds behavior, cleanup, and app override boundaries;
- Render/engine integration tests prove identity-safe hierarchy handoff and
  canonical order without a patch/fallback output path;
- package, monorepo, dependency, lint, build, app integration, and synchronized
  visual gates pass for the supported cases;
- framework/package/API/Golden Path docs and release decisions are synchronized;
- the plan is archived and Release Gate 4 may begin.
