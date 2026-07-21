# Package: @asyra/utils

## Responsibility

Provide shared types, ids, registry primitives, and low-level helpers.

## Owns

- shared type definitions used across packages
- canonical `SharedDeliveryMode` timing plus `PositionData`, `Rect`, `Bounds`,
  `GeometryTransformMatrix`, and `RGBAColor` low-level contracts
- semantic geometry aliases such as `FillGradientHandle` and `GeometryBounds`,
  which retain consumer meaning without parallel shape declarations
- id generation and id loading helpers
  - `idCounter.setNamespace(value?)` optionally scopes every non-default
    registered counter prefix while preserving its numeric sequence
  - IDs from another namespace remain valid owner data but do not advance the
    local namespace's counter; clearing the counter also clears the namespace
- common registry utility primitives
- `RegistrationOwnerMetadata`, shared by extension and registration-graph
  metadata
- framework-safe helper functions/constants
- the domain-neutral own-property primitive used when canonical state and
  transaction replay must preserve special keys and explicit `undefined` as
  writable enumerable own values
- pure numeric and geometry primitives shared by render, preset, design-system,
  and app owners, including unit clamping, point projection/distance, cubic
  subdivision, and geometry bounds
- the optional diagnostic-counter dispatch primitive; counter names, budgets,
  and interpretation remain with the consuming owner, and diagnostics never
  control product behavior
- optional browser drag-phase measurement helpers that call the shared
  diagnostics sink without owning phase names, product budgets, or reporting
  policy

## Must Not Own

- runtime business policies
- package startup side effects
- app-specific behavior

## Rules

- Utils should stay pure and reusable across framework and apps.
- Shared types should be canonical (avoid duplicated shape definitions across packages).
- When a type is part of framework contract, define it here once.
- `ComputedDataPatchChange` distinguishes record addition from replacement by
  own `before` property existence. Its record-child value envelope permits
  explicit `undefined` because nested records may own that value; top-level
  scalar/value patch fields retain the ordinary `DataTypes` contract.
- `MapRegistry.register(key, value)` is the base registration primitive for map-like registries:
  - duplicate keys are rejected by default (throws)
  - optional duplicate hooks/messages are configured at call sites
- `ExtensionRegistry<Context>` is the framework-neutral primitive for bounded
  package-author additive extension:
  - target metadata uses a stable key, name, kind, owner, and explicit supported
    strategy list
  - supported strategies are `before`, `after`, and `append`
  - resolution is deterministic: `before -> default -> after -> append`,
    preserving input order inside each bucket
  - duplicate targets/extensions, missing targets, invalid/unsupported
    strategies, apply failures, and cleanup failures use
    `ExtensionContractError` with stable `EXTENSION_ERROR_CODES` and a structured
    result payload
  - installers return cleanup functions; apply rollback, target unregister, and
    application disposal invoke owned cleanup in reverse order
  - a cleanup failure keeps the target applied for deterministic retry while
    already-completed cleanup handles remain completed and are not repeated
  - metadata queries return detached values and do not expose registry authority
- `RegistrationGraph` is the framework-neutral startup composition primitive:
  - registration identity is a stable `{ kind, key }` pair with detached owner
    metadata; omitted owners receive `{ packageName: 'app', name: key }`
  - `nodesByRef`, `outgoingRelationsBySource`, and
    `incomingRelationsByTarget` keep small adjacency records while package
    registries remain definition source-of-truth
  - relation queries and recursive unregister traversal use stable sorted order
  - `detach` preserves and rebuilds a source registration;
    `unregister-source` queues the source for recursive owned cleanup
  - `RegistrationRelationError` exposes stable structured failure codes for
    closed composition, missing registrations/targets/relations, duplicate or
    dangling relations, active usage, relation removal, and cleanup failure
  - cleanup is reverse-order and retryable: completed resources do not rerun,
    pending resources remain queryable through the failure result, and the node
    remains registered until cleanup succeeds
  - retry reconciles each pending detach with current adjacency: an already
    removed edge is complete, while a newly defined same-name edge with a
    different target or policy is preserved and never passed to the old handler
  - `RegistrationDefinitionMetadata` lets a package definition carry optional
    owner metadata and local relation declarations without moving its full
    definition into the graph
  - `hasPendingCleanup(ref)` lets the coordinating owner block conflicting
    registration while a previous cleanup is retryable

## Extension Points

- shared type modules for new domain contracts
- reusable utility primitives for package implementers
- additive extension target registries for package authors
- Core-scoped registration graphs coordinated by the framework owner

## Validation Checklist

- Adding utility APIs does not introduce package coupling back to higher layers.
- Shared types are consumed via `@asyra/utils` imports across packages.
- Extension registry tests cover additive ordering, structured failure, apply
  rollback, unregister, and cleanup behavior.
- Registration graph tests cover detached metadata, deterministic relation
  order, structural detach, recursive hard cleanup, composition closure,
  dangling validation, cleanup retry, and current-adjacency reconciliation.
