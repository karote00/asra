# Project-Wide Code Readability Analysis and Refactor Plan

## Status

Completed and approved for closeout on 2026-07-22. The bounded audit leaves
package-root public facades as facades, keeps required test-runtime module
loading intact, and reports no remaining concrete readability finding that
warrants a behavior-preserving change.

This maintenance plan does not create a new product Flow Inspector, readiness
matrix, readability score ledger, or second semantic authority. A finding that
touches an active product contract or Inspector-backed flow must follow that
existing specification, owner route, and implementation boundary.

## Completion Record

- Final decision: preserve concise domain vocabulary and boundary-required
  names while removing redundant context, unnamed stable variants, empty-return
  noise, repeated local workflows, and misleading module responsibilities.
- Implementation summary: filenames, type compositions, control flow, module
  ownership, app test helpers, and public facades were reviewed and refactored
  only where semantic readability improved without changing behavior.
- Review snapshot: the final no-finding repeat used baseline `478bec0be`, the
  roots and exclusions in this plan, and the frozen filename, type-shape,
  empty-return, condition, function-body, and module-responsibility checks.
- Exit criteria: stale-path searches, focused TypeScript and Chromium E2E,
  repository tests, dependency validation, lint, and build passed; the product
  owner approved closeout on 2026-07-22.

## Goal

Scan the current repository for code whose naming, type structure, control flow,
module layout, or local expression shape makes its meaning unnecessarily hard
to understand; analyze the actual responsibility and contract; then execute
the smallest owner-correct refactor that improves readability without changing
supported behavior or flattening meaningful domain distinctions.

The result should:

- make filenames communicate the responsibility not already supplied by their
  directory or package context;
- give meaningful discriminated-union variants, request/result shapes, and
  reusable callback contracts their own names;
- keep public unions readable as compositions of named semantic variants;
- reduce unnecessary nesting, duplicated context words, ambiguous generic
  names, negative condition chains, and mixed responsibilities;
- preserve concise code when additional names or abstractions would add no
  meaning;
- keep framework, Preset, app, server, Render, test, and shared-infrastructure
  ownership explicit;
- preserve public behavior, transaction boundaries, persistence compatibility,
  runtime performance, and dependency direction.

## Readability Principles

1. Readability is semantic clarity, not the smallest line count or the highest
   number of extracted helpers.
2. A directory or package already provides context; filenames should not repeat
   that context unless the repetition distinguishes a real external boundary.
3. A named type must communicate a reusable or independently meaningful
   contract, not merely move an unreadable anonymous object elsewhere.
4. A long discriminated union should use named variants when each variant has a
   stable role, distinct required fields, or independent consumers.
5. A short single-use structural type may remain inline when naming it would
   not improve meaning or navigation.
6. Prefer positive conditions, early exits, and completed domain values over
   deeply nested or repeatedly negated branches.
7. Do not extract helpers that hide mutation, transaction, I/O, lifecycle, or
   failure behavior behind a generic name.
8. Do not move domain behavior into `utils`, `common`, or `shared` merely to
   shorten a caller.
9. Do not rename established public or persisted vocabulary without checking
   compatibility and migration ownership.
10. Use current source, types, schemas, formal tests, product specs, and active
    Inspectors as authority; deleted code and historical diffs are not current
    behavior authorities.

## Scope

Included candidate classes:

- filenames and directory names that repeat their parent context, use vague
  words such as `helpers`, `common`, `misc`, or `types` without one coherent
  responsibility, or fail to distinguish two real roles;
- long inline object unions, intersections, callback signatures, conditional
  types, generic constraints, and repeated anonymous request/result shapes;
- declarations whose name repeats every surrounding namespace word without
  adding domain meaning;
- functions with excessive responsibility, parameters, branching, nesting,
  boolean flags, early-return inconsistency, or distant mutation/failure
  effects;
- long condition expressions whose sub-decisions have stable domain names;
- ambiguous abbreviations, overloaded terms, misleading singular/plural names,
  and names that describe implementation rather than responsibility;
- modules that combine protocol, parsing, transport, runtime, persistence,
  projection, or app policy without an explicit owner reason;
- repeated type assertions, explicit return noise, wrapper functions, comments,
  and aliases that make the real contract harder to see;
- test names, fixtures, builders, and helpers whose structure obscures the
  behavior being proven;
- public exports, import paths, Inspector boundaries, and documentation that
  must change with an approved readability refactor.

Excluded from blanket refactoring:

- `node_modules`, build output, caches, coverage, screenshots, generated files,
  and temporary artifacts unless their source generator is the finding;
- historical decisions and completed plans except for broken references;
- third-party or vendored source;
- mechanical formatting already owned by Prettier/ESLint;
- short domain-standard names whose meaning is clear to their intended
  consumers;
- protocol or persisted keys whose compact form is an intentional payload
  contract;
- code whose apparent repetition is governed by the separate
  `project-wide-duplicate-contract-and-ownership-consolidation-plan.md`.

When a readability candidate is also a true semantic duplicate, use the
duplicate-contract plan's classification and ownership rules rather than
creating a second consolidation decision here.

## Candidate Classification

Every candidate must be classified before editing:

| Classification                  | Meaning                                                                                       | Default direction                                |
| ------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Redundant context               | A name repeats context already guaranteed by its directory/package                            | Remove only the redundant segment                |
| Ambiguous name                  | The current name does not reveal the owned role                                               | Rename to the narrowest responsibility           |
| Unnamed semantic variant        | A stable union member or request/result shape is inline                                       | Introduce a named variant and compose the union  |
| Incidental inline shape         | A short local shape has no independent semantic role                                          | Keep inline                                      |
| Mixed responsibility            | One module/function owns multiple independently changing concerns                             | Split by canonical owner or lifecycle            |
| Control-flow noise              | Nesting, negation, flags, or return syntax obscures one stable decision                       | Simplify without changing outcomes               |
| Boundary-required verbosity     | Additional words distinguish package, transport, persistence, protocol, or runtime boundaries | Keep the distinguishing context                  |
| Public/compatibility vocabulary | A name is externally consumed or persisted                                                    | Keep or migrate through the documented lifecycle |
| Unresolved semantics            | A clearer name or split depends on an undecided product owner or behavior                     | Stop for a decision                              |

## Named-Type Decision Rules

Introduce a named type when at least one of these is true:

- it is one independently meaningful discriminated-union variant;
- multiple fields form one request, response, error, state, or lifecycle
  contract;
- the shape is consumed from more than one declaration or runtime boundary;
- the name lets a reader understand the union or signature without expanding
  its implementation;
- the type needs focused tests, documentation, exports, or future compatible
  extension.

For example, prefer:

```ts
export type ServerMessage =
  | ReadyMessage
  | SuccessResponseMessage
  | FailureResponseMessage
  | UpdateMessage
```

over one long union of anonymous objects when those variants are stable wire
messages. Do not create names such as `TypeA` or `ServerMessagePart1`; the new
name must state the variant's role.

Keep a type inline when it is short, local, used once, and the surrounding API
already supplies all useful meaning.

## Filename Decision Rules

- Remove a package/folder name repeated by every file in that folder.
- Retain technology or boundary qualifiers such as `yjs`, `websocket`,
  `provider`, `persistence`, or `server` when they distinguish real
  responsibilities.
- Prefer a concrete responsibility such as `protocol.ts`, `lifecycle.ts`, or
  `factory-adapter.ts` over a repeated `<folder>-protocol.ts`, an unspecified
  execution-phase name such as `runtime.ts`, or a misleading `factory.ts`.
- Avoid generic `types.ts` when its contents form one clearer contract such as
  composition, protocol, geometry, registration, or persistence.
- Keep `index.ts` only as a package/directory export surface, not as a hidden
  implementation owner.
- Rename tests with the same rule, while preserving subject qualifiers needed
  outside a subject-specific directory.

## Execution Sequence

### 1. Establish baseline and authorities

- Record branch, dirty/staged state, active plans, and Inspector-backed flows.
- Inventory current framework packages, apps, servers, tests, scripts, and
  source-of-truth docs; exclude generated and historical artifacts.
- Identify public exports, package subpaths, persisted/protocol names, and
  released compatibility before proposing renames.

### 2. Discover candidates

- Use bounded `rg`, TypeScript AST/type inspection, file inventories, import
  graphs, and focused complexity/shape searches as navigation evidence.
- Search for long anonymous unions, repeated contextual prefixes, vague module
  names, deeply nested conditions, long boolean chains, large parameter lists,
  mixed runtime roles, and explicit syntax that exists only to satisfy a weak
  contextual type.
- Treat numeric thresholds and automated similarity/complexity output only as
  candidate signals, never as automatic findings.
- Group candidates by canonical owner and consumer boundary.

### 3. Analyze before editing

- Classify each candidate using the Candidate Classification table.
- State the current responsibility, correct owner, affected consumers, public
  and persistence impact, and why the proposed form is easier to understand.
- Compare a no-change option and reject extraction or renaming when it adds
  navigation without meaning.
- Check whether the separate duplicate-contract plan owns the issue.
- Identify exact formal tests and build/type/import gates for the proposed
  slice.

### 4. Execute owner-bounded slices

- Once analysis for a clear candidate is complete, implement it without a
  second report-only pause.
- Work within one package/app owner or one declared handoff at a time.
- For Inspector-backed flows, prepare the required Step Execution Card and stay
  inside its implementation boundary.
- Rename/move with all imports, exports, tests, manifests, scripts, Inspector
  paths, and current documentation updated atomically.
- When naming union variants, preserve discriminants, required/optional fields,
  runtime parsers, and external payload shape exactly unless a separately
  authorized behavior change is required.
- For behavior-preserving control-flow changes, use existing tests or add
  characterization tests where equivalence is otherwise unproven.
- For bugs or specification mismatches, follow bugfix test-first before
  production changes.

### 5. Validate and review each slice

- Search for stale filenames, symbols, import paths, and old public names.
- Run focused tests for the owner and affected consumers.
- Run TypeScript/build gates for moved or refactored modules.
- Run dependency validation for changed boundaries.
- Run the relevant Inspector contract tests for Inspector-backed flows.
- Run Prettier/ESLint and `git diff --check` on the affected slice.
- Review the diff for added indirection, changed behavior, hidden fallbacks,
  compatibility aliases, and unrelated formatter churn.

### 6. Complete repository verification

- Run `yarn test:local`;
- run TypeScript/build gates for every affected package and app;
- run `yarn lint:ci`, `yarn react:build`, and affected deployable server builds;
- run `yarn deps:validate` and all affected Inspector contract tests;
- run required integration, E2E, or synchronized visual gates only where
  observable product behavior changed;
- synchronize architecture, package, API, app, plan, Inspector, README, and
  decision documents whose current paths or contracts changed;
- confirm no audit-started process or port remains running.

## Finding Format

Each finding should remain bounded and include:

- exact location and current readability problem;
- classification and semantic responsibility;
- current owner and correct owner;
- proposed name, type composition, control-flow shape, or module split;
- no-change option and rejected alternatives;
- public, persistence, transaction, performance, and dependency impact;
- tests and gates required before and after editing;
- governing product specification or Inspector, when applicable.

Findings guide the immediately following implementation slices; they are not a
permanent readability registry or scorecard.

## Stop Conditions

Stop the affected candidate and request a decision when:

- a clearer name depends on unresolved product semantics or ownership;
- the product specification, Inspector, implementation, and tests disagree;
- a rename would break a released public or persisted contract without a
  decided migration path;
- a proposed extraction crosses package boundaries or reverses dependency
  direction;
- a proposed abstraction needs unrelated flags/callbacks to preserve behavior;
- tests cannot prove a behavior-preserving refactor equivalent;
- the required file is outside an Inspector implementation boundary;
- the change would overwrite unrelated staged or user-owned work.

Independent candidates may continue when their semantics and owner boundaries
remain clear.

## Definition of Done

This maintenance plan is complete when:

- every current in-scope source family has been scanned with filename,
  type-shape, control-flow, naming, and module-responsibility passes;
- every executed finding has a semantic readability reason rather than a line
  count or style preference alone;
- stable long union variants and reusable request/result contracts use clear
  names, while incidental local shapes remain concise;
- filenames avoid redundant parent context and retain only responsibility or
  boundary qualifiers that improve navigation;
- mixed responsibilities and confusing conditions are simplified at their
  canonical owner without broad utility dumping grounds or parallel behavior;
- stale imports, exports, filenames, symbols, scripts, Inspector paths, and
  documentation references are removed;
- focused and repository-level tests, TypeScript, lint, build, dependency, and
  applicable Inspector/product gates pass;
- public and persisted compatibility is preserved or migrated through its
  documented lifecycle;
- the user has reviewed the result and approved closing the plan.

Completion of this repository-maintenance plan does not close or advance a
framework release gate.
