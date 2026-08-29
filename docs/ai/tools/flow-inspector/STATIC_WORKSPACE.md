# Flow Inspector Static Workspace Contract

## Purpose

The Static Workspace is one directly openable browser surface for discovering
and navigating the Flow Inspectors that still describe the current Asyra
project. A persistent sidebar lists the current catalog; selecting an entry
loads that Inspector in an isolated main frame and updates a stable hash route.

The workspace is a static documentation tool. It does not report runtime
health, execute commands, ingest test results, or decide CI acceptance.

## Ownership

- `tools/flow-inspector/workspace/catalog.cjs` owns inclusion, exclusion,
  grouping overrides, and lifecycle metadata for discovery candidates.
- `tools/flow-inspector/workspace/generate-workspace.cjs` owns deterministic
  discovery, source loading, catalog validation, and generated browser bundle
  output.
- `tools/flow-inspector/src/` owns the React sidebar, search, group collapse,
  Overview, hash-route parsing, selection, and keyed target-frame navigation.
- `tools/flow-inspector/vite.config.ts` owns the classic-script static build
  emitted under `tools/flow-inspector/workspace/generated/`.
- `tools/flow-inspector/workspace/target.js` owns selected-target lookup and
  isolated target rendering.
- `tools/flow-inspector/viewer.js` and `tools/flow-inspector/viewer.css` remain
  the only shared schema version 2 renderer and presentation owners.
- `tools/flow-inspector/workspace/legacy-viewer.js` may present pre-v2 or
  plan-specific Inspector data read-only. It must not normalize that data into
  schema version 2 or invent missing semantics.
- Target data remains the semantic authority. Generated workspace data is a
  verified snapshot, never a second authored contract.

Framework and App runtimes must not import or depend on any workspace file.

## Discovery Input

The generator searches exactly these roots for files named
`*flow-inspector.data.cjs` or `*flow-inspector.data.js`:

1. `docs/ai/framework/plans/`
2. `docs/ai/apps/`
3. `docs/ai/tools/`

Every discovered file must appear exactly once as included or excluded.
Exclusion requires a stable reason such as `superseded` or
`replaced-historical-direction`. Filename location alone is not an exclusion
reason.

The initial exclusions are:

- Executable Examples, explicitly superseded and removed from the current
  website surface; and
- Website Visual Reimagine, a completed visual direction replaced by the
  current Result-First Landing contract.

All other discovered Inspector data is included in the static preview. This
includes retained architecture and reusable release records that still help a
reader understand the current project. The workspace does not claim that
inclusion makes a plan active.

## Catalog Contract

Each generated catalog entry contains only discovery and presentation data:

- stable catalog `id`;
- schema kind: `flow-v2`, `legacy-v1`, or `plan-contract`;
- source data path and optional existing standalone HTML path;
- title, group, subgroup, lifecycle label, order, and search labels; and
- the exact source snapshot consumed by the isolated target frame.

For schema version 2, catalog `id` must equal `target.id`. Legacy ids are
deterministically derived from the source filename unless the catalog declares
an explicit stable override. Catalog entries must never duplicate authored
steps, routes, artifacts, invariants, or acceptance semantics.

Generated browser data must match the current source objects exactly after
JSON-safe serialization. Generator drift is a formal failure.

## Routing and Isolation

- Overview route: `workspace.html`
- Inspector route: `workspace.html#inspector=<catalog-id>`
- Search and group-collapse state are presentation state and do not alter the
  route or target data.
- Unknown, excluded, or malformed ids render an explicit error and never fall
  back to another Inspector.
- The main target uses a React-keyed iframe. Every selection navigates a fresh
  iframe to
  `target.html?inspector=<catalog-id>#inspector=<catalog-id>`. The query makes
  each id a cross-document navigation identity; the matching hash remains the
  target route identity. A query/hash mismatch is an explicit error.
- The target frame reads only the generated bundle entry selected by the hash.
  It clears no parent state and cannot mutate catalog membership.
- Rapid switching must leave only the final selected target visible.

## Supported Behavior

- direct-open use from the repository through `file:` URLs;
- a checked-in classic-script React build with no server or module-loader
  requirement;
- Overview with static counts by group and schema kind;
- Framework, Apps, Release, and Tools groups;
- sidebar search by title, id, subgroup, and labels;
- collapsible groups;
- mouse and keyboard-accessible Inspector selection;
- trackpad pinch zoom from 20% through 250% inside the v2 flow viewport, with
  scale-matched scroll bounds, a visible reset control, and `Command+0`
  restoration to 100%;
- stable deep links and reload restoration;
- schema version 2 rendering through the shared renderer;
- read-only compatibility presentation for included legacy data; and
- links to an existing standalone entry when one exists.

## Unsupported Behavior

- runtime status or health colors;
- evidence/test mapping, provenance, freshness, or history;
- CI comparison or enforcement;
- API, CLI, commands, actions, process execution, or mutation;
- mapping reconciliation;
- remote data loading, hosted synchronization, permissions, or accounts; and
- editing target data from the workspace.

## Product Cases

1. Opening the workspace without a hash shows Overview and the complete current
   catalog without claiming runtime status.
2. Selecting Framework, App, Release, and Tool entries updates the route and
   renders the selected target in the same main region.
3. A deep link opened directly restores the selected Inspector.
4. Search filters sidebar entries without changing selection or catalog truth.
5. Rapidly switching targets cannot retain the previous target's title, flow,
   details, links, or globals.
6. A duplicate id, missing path, mismatched v2 target id, unclassified
   discovery candidate, or stale generated snapshot fails formal validation.
7. An unknown or excluded route reports a clear error without fallback.
8. Existing standalone HTML remains directly openable and renderer
   synchronized.
9. Included legacy data is visibly labeled compatibility content and is never
   presented as schema version 2.
10. The complete static artifact works without a local server.

## Definition of Done

- every fixed-root candidate is classified once;
- generated catalog and source snapshots pass exact validation;
- every included v2 target passes the shared structural contract;
- workspace Inspector routes, artifacts, and boundaries are valid;
- sidebar, search, collapse, Overview, deep-link, reload, unknown-route,
  rapid-switch, and isolation cases pass formal DOM tests;
- every catalog target renders through its declared renderer kind;
- all retained standalone entries pass direct-open and renderer-sync gates;
- synchronized browser inspection confirms desktop and narrow viewport
  usability, including v2 flow scrolling, pinch zoom, and exact zoom reset; and
- preview documentation contains no dynamic Control Plane claim.
