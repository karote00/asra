# Project-Wide Duplicate Contract and Ownership Consolidation Plan

## Status

The authorized consolidation repair and repository verification are complete.
The final pass reports no remaining concrete duplicate or misplaced owner that
can be consolidated without erasing a trust boundary, app policy, or required
test-runtime contract. The plan remains active only for the user-review
condition in the Definition of Done and must not be archived until the user
approves it.

This maintenance plan is not a product runtime flow and does not create a new
Flow Inspector, readiness matrix, audit ledger, or second semantic authority.
If a finding touches an active product contract or Inspector-backed flow, that
existing product specification and Inspector remain authoritative, and the
affected implementation slice must follow their owner boundary.

## Goal

Find repeated declarations, predicates, validation decisions, transformations,
and misplaced responsibilities across the current repository; determine
whether each repetition is redundant, intentionally boundary-local, or
semantically distinct; then execute the smallest owner-correct consolidation
that improves reuse without erasing valid domain differences.

The result should:

- provide one canonical owner for genuinely shared contracts and invariants;
- keep app policy, Preset defaults, framework runtime behavior, and shared
  infrastructure in their correct layers;
- remove repeated type guards, declarations, constants, schemas, conversions,
  and condition chains only when they implement the same semantics;
- prefer stronger data contracts, discriminated unions, schemas, or public
  domain APIs when repetition exists because the canonical contract is weak;
- preserve intentional validation at trust boundaries and intentional adapters
  between independently owned packages or runtimes;
- prevent generic utility packages from becoming collections of unrelated
  domain behavior;
- keep public behavior, transaction ownership, persistence compatibility, and
  dependency direction explicit throughout the refactor.

## Core Principles

1. Similar syntax is a candidate, not proof of semantic duplication.
2. Determine the data, invariant, lifecycle, and public-contract owner before
   choosing a destination.
3. Centralize behavior in its domain owner, not automatically in
   `@asyra/utils` or `@asyra/core`.
4. Prefer one discriminator or canonical field over redundant flags that can
   represent contradictory states.
5. Keep validation repeated where separate trust boundaries must independently
   reject malformed input.
6. Preserve package independence when a small adapter is the correct boundary.
7. Do not introduce a shared abstraction whose parameters merely encode the
   previously separate implementations.
8. Do not use deduplication to move app business policy into framework
   packages or framework invariants into the app.
9. Use current source, exported contracts, formal tests, product specs, and
   active Inspectors as authority; deleted code and historical diffs are not
   behavior authorities.
10. Repair the first incorrect owner or data contract rather than hiding its
    consequences behind downstream helpers or fallback behavior.

## Scope

Included candidate classes:

- repeated interfaces, type aliases, unions, enums, result/error shapes, and
  local structural types;
- repeated type guards, predicates, nullable lookups, equality checks,
  capability checks, and state classifiers;
- repeated constants, tokens, event names, feature ids, property keys,
  configuration keys, and protocol identifiers;
- repeated schema definitions, runtime validators, normalizers, coercers,
  serializers, decoders, migrations, and data-shape reconstruction;
- repeated id generation, parsing, sorting, ordering, path, geometry, and
  topology rules;
- repeated lifecycle, transaction, ownership, permission, routing, cleanup,
  and failure-condition branches;
- repeated app/common API and package API behavior that may indicate a missing
  public owner surface;
- declarations or decisions located in the wrong framework, Preset, app,
  server, Render, test, or shared-infrastructure layer;
- production and formal-test helpers when tests duplicate production behavior
  instead of asserting it through an independent oracle;
- documentation needed to identify or synchronize the resulting canonical
  owner and public contract.

Excluded from blanket consolidation:

- `node_modules`, build output, caches, coverage, screenshots, temporary
  artifacts, and generated output unless its generator contract is the finding;
- historical decisions and completed plans, except for broken references;
- third-party source and vendored code;
- superficial wording or formatting similarity with no contract consequence;
- intentionally independent browser, Node/server, worker, persistence,
  protocol, or security-boundary validation;
- test expectations that intentionally form an independent behavioral oracle;
- specialized performance paths unless profiling and equivalence evidence show
  that they are accidental duplicates.

## Candidate Classification

Every candidate cluster must be classified before editing:

| Classification            | Meaning                                                                           | Default action                                           |
| ------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Exact duplicate           | Same inputs, outputs, semantics, failure behavior, and owner                      | Consolidate at the canonical owner                       |
| Semantic duplicate        | Different syntax or names implementing the same contract                          | Consolidate or strengthen the canonical contract         |
| Weak-contract symptom     | Repetition compensates for an imprecise type, schema, discriminator, or API       | Repair the owning contract first                         |
| Misplaced ownership       | Logic is valid but lives in a downstream or unrelated layer                       | Move it to the actual owner and expose a bounded surface |
| Boundary-local repetition | Similar checks are independently required at distinct trust or runtime boundaries | Keep locally and document the boundary when unclear      |
| Similar but distinct      | Shape is alike but domain meaning, lifecycle, errors, or consumers differ         | Keep separate and clarify naming if confusion is likely  |
| Compatibility adapter     | Duplication intentionally preserves a released public or persisted contract       | Keep or migrate through the documented lifecycle         |
| Unresolved authority      | Current specs, Inspectors, source, and tests do not identify one owner            | Stop that cluster for a product decision                 |

The analysis must compare more than function bodies. It must include:

- semantic input and output types;
- mutation and transaction boundaries;
- validation and failure behavior;
- synchronous or asynchronous lifecycle;
- persistence and migration impact;
- public API and compatibility status;
- allowed and forbidden contributors;
- dependency direction and consumer count;
- whether callers need the same complete contract or only happen to share a
  small implementation detail.

## Ownership Decision Rules

Use the narrowest existing owner that can truthfully own the complete contract:

- data shape, discriminator, and invariant helpers stay with the package that
  owns that domain model;
- generic dependency-free primitives with no Asyra domain meaning may belong in
  `@asyra/utils`;
- orchestration and public facade behavior belong in `@asyra/core` only when
  Core already owns that lifecycle or handoff;
- optional official defaults belong in `@asyra/preset` and remain replaceable;
- product interaction, aggregation, and workflow policy remain app-owned;
- server authentication, permission, room, and deployment policy remain at the
  app/server composition boundary;
- Render remains a downstream projection owner and must not become a duplicate
  data or product-decision authority;
- tests may share fixture/builders but must not call production logic as the
  oracle for the same behavior they claim to verify.

For example, a repeated predicate over a domain-owned discriminator should be
considered for export by that domain owner. It should not be moved into a
generic utility package merely because multiple callers need it, and it should
not be replaced by an additional redundant boolean field.

## Allowed Decisions

Each analyzed cluster receives one bounded decision:

- keep unchanged because the repetition is intentional;
- keep separate but rename or document the semantic distinction;
- export an existing canonical declaration or predicate from its current owner;
- strengthen an existing discriminated union, schema, or public result type;
- remove a redundant field and use the canonical discriminator or state;
- move a declaration or behavior to the correct package/app owner;
- introduce a narrow owner-local module when no suitable module currently
  exists;
- replace downstream reconstruction with a bounded public API or adapter;
- retain a compatibility adapter with an explicit migration/removal contract;
- stop for a product or ownership decision.

Creating a broad `shared`, `common`, or `utils` module is not an allowed default
decision. It requires proof that the contained contract is domain-neutral and
that dependency direction remains correct.

## Execution Sequence

### 1. Establish repository and authority baseline

- Record branch, staged/unstaged state, current active plans, and Inspector
  routes before edits.
- Read current framework/app/package ownership documents relevant to each
  candidate family.
- Exclude generated, historical, deleted, and build artifacts from current
  behavior authority.
- Identify pre-release versus released public contracts before planning moves
  or compatibility handling.

### 2. Discover candidates

- Use bounded `rg` inventories and AST/type-aware inspection where useful to
  find repeated declarations, names, literal unions, type predicates, schemas,
  condition sequences, conversions, and exported/local equivalents.
- Search by structure and behavior in addition to identical names.
- Include inline conditions that repeat a named helper's semantics.
- Group findings into candidate clusters by domain and likely owner; do not
  dump raw search results as findings.
- Treat automated similarity output only as navigation evidence. Human semantic
  analysis remains required.

### 3. Analyze necessity and ownership

- Classify each cluster using the Candidate Classification table.
- Compare the complete semantic contract, not only code similarity.
- Identify the first canonical owner, current consumers, dependency direction,
  and public/persisted compatibility impact.
- Check whether a stronger type, discriminator, schema, or owner API would
  remove the need for repeated checks.
- Check whether independent trust boundaries require local validation.
- Record a bounded finding with evidence and one recommended decision; avoid a
  permanent duplicate registry or governance database.

### 4. Order owner-bounded implementation slices

Prioritize in this order:

1. unresolved or contradictory product/Inspector ownership;
2. data contracts, discriminators, schemas, and public types;
3. framework/app/Preset/server/Render ownership violations;
4. constants, events, feature ids, configuration, and protocol identifiers;
5. validators, type guards, conversions, and canonical lookups;
6. lifecycle, transaction, routing, cleanup, and failure branches;
7. low-risk local helper duplication.

Each slice must stay within one canonical owner or one declared handoff. If a
slice touches an Inspector-backed flow, prepare its required Step Execution
Card and use only that Inspector step's implementation boundary before editing.

### 5. Prove behavior before consolidation

- Determine whether current formal tests already protect the shared behavior
  and every affected consumer boundary.
- For a bug or specification mismatch, add or strengthen the formal failing
  test before production changes.
- For a behavior-preserving refactor, use existing tests or add focused
  characterization/contract tests where the equivalence is otherwise
  unproven.
- Test the canonical exported contract and representative consumers; do not
  make tests pass by reusing production implementation as their oracle.
- Define migration and load tests before changing persisted shapes or removing
  released fields.

### 6. Execute the owner-correct change

- Implement the smallest complete consolidation at the chosen owner.
- Update public exports and consumer imports without deep cross-package paths.
- Remove superseded local declarations and branches in the same slice.
- Do not leave unreleased compatibility aliases or fallback behavior unless a
  real external or persisted contract requires them.
- Preserve unrelated staged and unstaged user changes.
- Update source-of-truth package, API, architecture, app, and decision docs only
  where the canonical contract or owner changed.

### 7. Validate each slice and the completed plan

For every slice:

- run focused owner tests and affected consumer tests;
- run owner and consumer TypeScript/build gates;
- run dependency-boundary validation when imports or ownership move;
- run the relevant Inspector contract test when an Inspector-backed flow is
  touched;
- run `git diff --check` and a bounded staged/unstaged review.

Before completion:

- run `yarn test:local`;
- run TypeScript/build gates for all packages and apps affected by the audit;
- run `yarn lint:ci`;
- run `yarn react:build` and deployable server/build targets affected by the
  changes;
- run `yarn deps:validate`;
- run required integration, E2E, or synchronized visual gates only for product
  flows whose observable behavior changed;
- verify no duplicate local declaration remains for every consolidated cluster;
- verify every intentionally retained repetition has a clear boundary reason;
- synchronize current documentation and archive this plan only after user
  review and completion approval.

## Finding Format

Each finding should remain reviewable and include:

- candidate cluster and exact current locations;
- classification and evidence;
- shared or distinct semantic contract;
- current and correct owner;
- affected public, persistence, transaction, and dependency boundaries;
- recommended decision and rejected alternatives;
- tests and validation required before editing;
- whether an existing product specification or Inspector governs the change.

Findings are a bounded review artifact, not a persistent assertion registry.

## Stop Conditions

Stop the affected cluster and request a decision when:

- current product specification, Inspector, implementation, and tests disagree
  on semantics or ownership;
- two similar declarations encode genuinely unresolved product choices;
- consolidation would reverse dependency direction or create a package cycle;
- a proposed shared abstraction needs app-specific flags or callbacks to
  reproduce unrelated behavior;
- a persisted or released public contract lacks a decided migration path;
- the correct owner would require an undeclared public API or package boundary;
- formal tests cannot distinguish the intended canonical behavior from the
  duplicate implementation;
- repair would overwrite unrelated staged or user-owned work.

Independent candidate clusters may continue when their authorities and owner
boundaries remain clear.

## Definition of Done

This maintenance plan is complete when:

- all current in-scope source families have been searched using both name- and
  structure/behavior-based discovery;
- every reported cluster has been classified by semantics and owner rather
  than syntax alone;
- every genuine duplicate has one canonical owner or an explicitly approved
  reason to remain separate;
- misplaced responsibilities have moved to the correct layer without creating
  reverse dependencies, broad utility dumping grounds, or parallel authorities;
- weak data contracts identified by repeated checks have been strengthened or
  explicitly deferred with an owner decision;
- superseded local declarations, redundant fields, imports, and branches are
  removed without hidden compatibility fallbacks;
- focused and repository-level test, TypeScript, lint, build, dependency, and
  applicable Inspector/product gates pass;
- public API, package, architecture, app, migration, and decision documents
  match the resulting owners and contracts;
- no audit-started process or extra port remains running;
- the user has reviewed the result and approved closing the plan.

Completion of this repository-maintenance plan does not close or advance a
framework release gate.
