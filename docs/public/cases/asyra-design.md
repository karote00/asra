# Asyra Design as a reference product

Asyra Design is a complete app built on Asyra Framework. It demonstrates one
coherent design-tool product—not the only product shape Asyra supports and not
a set of behaviors that Core silently installs.

Use it to study how a real app composes public packages, Preset defaults,
app-domain Features, common APIs, rendering, document sessions, optional AI,
and backend services while retaining one canonical owner model.

## Ownership at a glance

| Layer            | Owns                                                                                                                                             | Does not own                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Framework        | canonical packages, registration contracts, transactions, hierarchy, validation, render abstraction, typed communication, lifecycle coordination | design-tool commands, panel behavior, document service policy, AI domain meaning       |
| Preset           | official selectable design-tool defaults, current 2D provider policy, Group and basic geometry adapters                                          | Core readiness, app workflows, backend policy, a universal design product              |
| Asyra Design app | product schemas, Features, common APIs, tool policy, command eligibility, UI, migration, collaboration/AI composition                            | Framework internals, provider credentials in the browser, backend durability authority |
| Backend/services | app wire protocol handling, server-only AI provider configuration, socket sequencing, checkpoints, persistence, service authorization policy     | browser UI, Core/Factory/Collaboration instances, canonical mutation shortcuts         |

The socket server and document backend import no `@asyra/*` packages. The app
protocol is an app-owned boundary; the browser adapter is the only bridge that
submits decoded accepted changes through Core's remote-apply facade.

## Startup composition

The app follows one ordered startup:

1. `initApp()` calls `applyPreset(core)` while composition is open.
2. Preset selects profile `2D`, installs the complete official defaults, and
   stores the Pixi provider without constructing the engine.
3. App startup registers diagnostics, derived-state projections, capabilities,
   input mappings, Features, and optional AI composition.
4. RenderApp requires one non-empty `fileId` and constructs the app-owned
   document session.
5. Core prepares the optional collaboration lifecycle, accepts the read-only
   checkpoint source, initializes the renderer/engine, activates input,
   validates and loads canonical data, initializes Features, applies pending
   remote work, activates live transport, and only then publishes ready.
6. The mount owner requests `core.destroy()`; Core disposes the registered
   session before renderer resources and keeps teardown idempotent.

Preset completion is not runtime readiness. React mounting is not canonical
document readiness. Only the successful Core lifecycle publishes ready.

## Product intent and common APIs

The app's primary flow is:

```text
Input or UI intent
→ app Feature
→ app common API/controller
→ Core and canonical Framework owner
→ Factory transaction
→ Scene local projection / Render / UI Context
→ React providers and UI
```

`src/features/*` owns deterministic interaction behavior, priority,
exclusivity, and sessions. `src/common-apis/*` owns reusable app mutation and
query operations. Controllers connect UI intent to those APIs. React reads
derived state and never becomes the document owner.

This is the important reusable pattern: app behavior remains easy to find and
test, while canonical writes stay behind public Framework facades.

## Canonical state and rendering

Props Manager owns property definitions, values, and validation. Scene Tree
owns element identity, relations, hierarchy, and raw entity data. System
Context owns registered global mode/viewport properties. Selection owns its
registered channels. Factory owns transaction history.

Render consumes canonical and local computed projections. For Vector moves,
canonical topology stays unchanged while Render can retain engine-local draw
geometry and apply transform deltas. A Pixi object, React value, overlay, or
pixel is never the geometry owner.

Property-panel edits follow the same route as canvas interactions:

```text
Property control
→ app common API
→ Core / Props canonical mutation
→ one Factory transaction and History entry
→ Scene local computed projection
→ Preset / Render / UI Context
→ optional SharedPublication
```

## Hierarchy and Group behavior

The app exposes ID-based common APIs for group, ungroup, move/reparent/reorder,
and subtree removal. Preset supplies official Group coordinate/bounds adapters;
Scene Tree validates canonical parent membership, cycles, target index, order,
identity, removal, and restoration. The app owns selection, shortcut, menu,
naming, and command-eligibility policy.

A hierarchy move preserves entity identity. It is not delete-and-recreate, DOM
reorder, or a render-layer-only result. Rollback, Undo, Redo, save/load, and
remote apply use the same canonical owner evidence.

See [Build hierarchy and Group behavior](../build/hierarchy-groups.md).

## Transactions, Undo, and Redo

Finite common-API mutations use public `runTransaction(...)`. Interactions that
span input events open one outer transaction, apply ordered updates, then end or
roll back. One intended drag, draw, group, or approved AI action creates one
intended Undo entry even when progressive projection/publication exposes
intermediate visible slices.

Undo and Redo replay ordinary owner evidence. The app keeps no UI-owned history
stack, geometry snapshot, or AI-specific inverse graph. A failed mutation
rolls back recorded Scene, Props, Selection, and other canonical changes before
rethrowing.

## Document session, Collaboration, and persistence

Every required `fileId` uses the app's socket-authoritative document-session
path. Core retains checkpoint load validation and explicit serialization.
Factory's immutable `SharedPublication` is the browser document-change unit;
private Undo history, Selection, Awareness, local computed projection, Render,
UI state, and diagnostics never become document persistence.

The app/provider owns socket connection and protocol. The app validates inbound
routes and payloads, then submits accepted canonical slices through one Core
remote transaction. `@asyra/collaboration` preserves publication and live
connection order; it owns no permission, conflict, retry, persistence, or
reconnect-replay policy.

The backend sequences accepted publications, materializes ordered checkpoints,
and reports durability independently from socket acceptance and peer apply.
Disconnected editing uses the declared provisional document and app-owned
recovery behavior; it does not select a second canonical document mode.

See [Build opt-in collaboration](../build/collaboration.md) and
[Build persistence with app-owned migration](../build/persistence-migration.md).

## Optional AI actions

AI is user-initiated and app-owned. The server owns model/provider
configuration, the Asyra Design domain prompt, image-tool catalog, and
preparation of one bounded `AiActionBatch`. The browser receives none of the
provider authentication values or backend-only prompt data.

The app invokes AI through an exclusive programmatic Feature. AI Runtime
resolves registered actions, evaluates the app permission map, optionally asks
for confirmation, and enters one app transaction. Executors call the same
`src/common-apis/*` used by human interactions.

For a large drawing, the accepted action creates ordinary independently
editable elements—optionally inside one Group—through canonical plural
preflight/apply. It does not become one opaque image, one giant Vector, a
render-only overlay, or a special AI document.

Therefore AI-created content remains:

- **editable**, because it is ordinary Props/Scene information;
- **reversible**, because one accepted action uses Factory History;
- **collaborative**, because ordinary canonical delivery produces the same
  SharedPublication path; and
- **persistable**, because the backend materializes the same accepted document
  sequence.

See [Build registered AI actions](../build/ai-actions.md) and
[Build app-owned retrieval and action](../build/app-retrieval-action.md).

## Disabled and failure behavior

- Without AI invocation/configuration, no provider request or canonical AI
  mutation occurs; ordinary editing remains independent.
- A product that omits Collaboration creates no generic Collaboration runtime.
  Asyra Design itself chooses a required document-session composition for its
  `fileId` product contract and reports its disconnected state explicitly.
- Provider, permission, confirmation, schema, preflight, or executor failure
  must not leave a partial canonical AI action.
- Renderer/engine initialization failure prevents false ready; the app does not
  display fallback output as proof of success.
- Invalid hierarchy, property, load, or remote evidence rejects before a
  partial owner prefix.
- Optional DEV diagnostics are dynamically imported and excluded from
  production behavior; product code and tests do not consume browser debug
  globals.

## What to reuse and what to replace

Reuse the ownership pattern, Feature/common-API route, transaction discipline,
public package imports, explicit optional composition, and formal test ladder.

Replace the design-tool schemas, tools, panels, key maps, Group command policy,
document protocol, backend topology, permissions, domain prompts, and product
visual language with your own app knowledge. A BIM or simulation product should
not rename Asyra Design objects and keep its domain rules hidden in UI code.

To begin from the product, use
[create-asyra-design-app](../start/create-design-app.md). To begin from
Framework composition, use the [official 2D baseline](../start/preset-2d.md) or
[custom composition](../start/custom-composition.md).

## Executable evidence

- `yarn examples:run generated-design-app-extension`
- `yarn examples:run ai-registered-action`
- `yarn examples:run collaboration-two-memory-actors`
- `yarn examples:run app-versioned-load-migration`
- `yarn workspace @asyra/asyra-design test:local`
- `yarn workspace @asyra/asyra-design test:e2e`

Use the smallest owner-focused test first, then the synchronized visual,
collaboration, high-detail, or release gate appropriate to the changed product
flow.

## Canonical sources

- [Asyra Design essentials](../../ai/apps/asyra-design/APP_ESSENTIALS.md)
- [Asyra Design architecture](../../ai/apps/asyra-design/ARCHITECTURE.md)
- [Initialization and startup](../../ai/apps/asyra-design/modules/init-and-startup.md)
- [Common APIs](../../ai/apps/asyra-design/modules/common-apis.md)
- [Verified generated-app extension](../../../apps/asyra-design/examples/review-queue-extension.mjs)
