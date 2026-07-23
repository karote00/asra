# Group Component and Hierarchy Behaviors Plan

## Status

Framework Release Gate 3: queued after the network collaboration transport
foundation closes.

This plan is a product contract for data and pipeline behavior, not a Group UI
specification. Before implementation begins, create a matching Inspector owner
flow for Scene Tree validation/mutation, Factory transaction and collaboration
delivery, Preset operations, load/save, and Render hierarchy projection.

## Current Baseline

- Scene Tree already owns parent ids, child arrays, container registration,
  sibling order, and add/remove parent/index replay evidence.
- Preset `CONTAINERS` already installs the official `GROUP` component, its
  invisible default Render strategy, and the Scene Tree-to-Render projection.
- Render already consumes canonical parent/index hierarchy information.
- The framework does not yet expose one complete atomic contract for grouping,
  ungrouping, reparenting/reordering, subtree removal, and their failure,
  replay, collaboration, and load invariants.

The implementation task extends this baseline. It must not register a duplicate
Group component or model a hierarchy move as deletion plus creation of a new
entity identity.

## Goal

Provide stable, UI-independent hierarchy behavior that lets a preset-based
design tool create and manipulate groups through public framework boundaries.

The release result must support:

- creating one Group around valid sibling elements;
- ungrouping one Group into its parent;
- moving or reordering existing elements and nested groups without changing
  their identities;
- deterministic nested-container and subtree behavior;
- exact rollback, undo/redo, save/load, CRDT convergence, and Render hierarchy
  projection;
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
- after Release Gate 2, remote apply validates and commits the same canonical
  hierarchy operation without echo or partial peer-visible state.

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
- two collaboration peers converge on group, ungroup, reorder, subtree delete,
  duplicate delivery, and concurrent hierarchy conflict cases;
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
  convergence policy remain app/backend contracts;
- Preset tests prove component installation, operation adapters, coordinate and
  bounds behavior, cleanup, and app override boundaries;
- Render/engine integration tests prove identity-safe hierarchy handoff and
  canonical order without a patch/fallback output path;
- package, monorepo, dependency, lint, build, app integration, and synchronized
  visual gates pass for the supported cases;
- framework/package/API/Golden Path docs and release decisions are synchronized;
- the plan is archived and Release Gate 4 may begin.
