# Project-Wide Documentation Contract Audit Plan

## Status

Completed and approved for closeout on 2026-07-22. Current owner, path,
plan-routing, Inspector navigation, and discoverability drift found by the
bounded audit was repaired without changing product behavior.

This audit is not a product runtime flow, so it does not create a Flow
Inspector, readiness matrix, audit ledger, or second semantic authority. If a
finding touches an active product plan or Inspector-backed flow, that product's
existing specification and Inspector remain authoritative.

## Completion Record

- Final decision: archive the documentation-contract audit after owner-bounded
  repairs and two frozen-scope maintenance reviews.
- Implementation summary: current framework, app, package, workflow, plan,
  Inspector, README, routing, and source-coverage documents were reconciled
  with their current owners; stale navigation and the final maintenance-plan
  routing gap were repaired.
- Review snapshot: the final no-finding repeat used baseline `478bec0be`, the
  roots and exclusions in this plan, and the previously frozen reference,
  routing, identifier, and ownership checks.
- Exit criteria: path/reference checks, repository tests, dependency
  validation, lint, build, focused TypeScript, and Chromium E2E passed; the
  product owner approved closeout on 2026-07-22.

## Goal

Re-scan the current repository so every active document:

- serves the correct contract layer;
- names the correct owner, boundary, input, output, and lifecycle;
- matches current implementation and executable contracts;
- uses current paths, identifiers, environment variables, and public APIs;
- is discoverable through the appropriate index and request-routing path;
- preserves historical and procedural writing where those document types
  require it.

The audit must find semantic drift without applying blanket prose rewrites or
turning documentation cleanup into product behavior changes.

## Core Analysis Principles

1. Classify the document before judging its wording.
2. Identify the source-of-truth owner before comparing claims.
3. Compare current documents with current source, configuration, tests, specs,
   and Inspectors; deleted code and historical diffs are not behavior
   authorities.
4. Distinguish documentation drift, implementation defects, unresolved product
   decisions, and formatting debt.
5. Repair only the first incorrect owner or contract layer after repair mode is
   explicitly authorized.
6. Validate cross-document navigation and naming, not only isolated prose.
7. Keep report output bounded and evidence-backed; do not dump the repository
   or create a parallel governance database.

## Scope

Included:

- framework architecture, rules, API surfaces, package contracts, current
  plans, and active Inspector contracts under `docs/ai/framework/*`;
- every current app context under `docs/ai/apps/*`;
- project workflows and skills under `docs/ai/workflows/*` and
  `docs/ai/skills/*`;
- repository protocols and project-owned agent instructions such as
  `AGENTS.md`;
- root, app, and package README files that define supported setup or usage;
- project examples and other user-facing documentation that claim supported
  behavior;
- source, configuration, manifests, and formal tests needed as evidence for a
  documented claim;
- indexes, request routing, source coverage, anchors, and referenced paths.

Excluded as current behavior authority:

- `node_modules`, build output, caches, screenshots, and temporary artifacts;
- generated output unless the audit is checking its generator contract;
- completed plans and released decision history, except for archive integrity,
  links, or an explicit historical claim;
- deleted files and removed tests;
- untracked one-time diagnostics that are not formal project artifacts.

## Document Classification Contract

| Document class                           | What it owns                                                              | Appropriate writing                                                 | Drift signal                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Architecture and package ownership       | Current owners, boundaries, invariants, and dependency direction          | Stable present-tense contracts                                      | Release-note narration, implementation diary language, or ownership assigned to a downstream consumer       |
| Rules and constraints                    | Mandatory, forbidden, and exception behavior                              | Normative `must`, `must not`, and bounded exception language        | Suggestions presented as requirements, conflicting hard rules, or rules that duplicate a lower authority    |
| API surfaces and configuration contracts | Callable inputs/outputs, types, errors, defaults, configuration authority | Exact behavioral verbs and signatures                               | Missing validation, stale names, undocumented public inputs, or duplicated authorities                      |
| Feature, spec, PRD, and BDD documents    | Observable behavior, product cases, supported and unsupported outcomes    | Runtime sequences and user-visible actions                          | Behavior that conflicts with tests, canonical owners, or the active product contract                        |
| Workflows, skills, and golden paths      | How an agent or developer performs work                                   | Procedural and imperative language                                  | Steps that bypass source-of-truth docs, owner boundaries, or required validation                            |
| Current plans                            | Bounded future/current scope, product cases, stop conditions, and DoD     | Planned outcomes and explicit non-goals                             | Execution diaries, unbounded task lists, or claims that bypass an active product authority                  |
| Inspectors                               | Exact package and data-flow architecture for an active product contract   | Owners, routes, artifacts, conditions, bypasses, and failure owners | Product semantics, implementation progress, or a route that contradicts its specification                   |
| Decisions and release history            | Why a decision was made at that time                                      | Historical and decision-oriented language                           | Rewriting old entries, presenting superseded history as current authority, or missing superseding decisions |
| README and setup guides                  | Supported installation, configuration, startup, and user workflows        | Concise user-facing instructions                                    | Commands or variables that disagree with manifests, configuration, or supported runtime behavior            |
| Index, routing, and source coverage      | Discoverability and authority navigation                                  | Exact current links and ownership mapping                           | Orphaned documents, stale paths, or routing to historical/generated copies                                  |

Verb choice alone is never a finding. For example, `resolves`, `loads`, or
`publishes` may be correct in an API or behavior flow but wrong when an
architecture section uses them to narrate a past implementation change or
assign work to the wrong owner.

## Execution Modes

### Mode A: Report-only audit

This is the default first pass.

- Inventory and classify the repository.
- Read current authorities and implementation evidence.
- Record bounded findings with exact paths and evidence.
- Do not edit code, docs, configuration, tests, indexes, or generated output.
- Stop for user review before proposing a repair sequence.

### Mode B: Owner-bounded repair

This mode requires explicit user authorization after the report-only findings.

- Repair one owner scope at a time.
- For an implementation defect, follow bugfix test-first before production
  changes.
- For a product-contract or Inspector contradiction, repair that authority
  before downstream docs or implementation.
- Update dependent references only after the owning contract is correct.
- Preserve staged and unrelated user changes.
- Validate each repair slice before advancing.

## Audit Sequence

### 1. Build the inventory

- Record branch and dirty/staged state before any repair work.
- Use `rg --files` and bounded Git inventories to enumerate current project
  files.
- Group documents by framework, app, package, workflow, skill, public README,
  active plan, Inspector, and historical record.
- Identify untracked current documents that require an index or owner.

### 2. Build the authority map

- Assign every document to one class from the classification contract.
- Identify its primary source-of-truth document and implementation owner.
- Identify whether the claim is framework-owned, preset default, app-owned, or
  user/server composition.
- Mark current plans and Inspector-backed flows so their exact owner contracts
  are checked before any later repair slice.

### 3. Perform the semantic pass

- Architecture/rules/packages: check owners, boundaries, invariants, lifecycle,
  and forbidden contributors.
- APIs/configuration: check public inputs, outputs, defaults, validation,
  failure behavior, and single configuration authority.
- Features/specs/BDD: check canonical action and state-application flows,
  boundary cases, and observable outcomes.
- Workflows/skills: check that procedure points to current authorities and does
  not invent product behavior.
- Plans/Inspectors: check scope, product cases, owner routes, implementation
  boundaries, failure owners, and DoD without treating them as progress logs.
- Decisions: preserve append-only history and check whether a newer decision
  supersedes an older claim.

### 4. Compare claims with reality

- Read the current implementation, manifests, configuration, and formal tests
  that own each claim.
- Prefer exact APIs, exported types, runtime validation, and executable contract
  tests over prose inference.
- Classify each mismatch as documentation drift, implementation defect,
  unresolved authority, obsolete reference, navigation gap, or formatting debt.
- Do not change implementation merely to make a non-authoritative document
  true.

### 5. Check cross-document consistency

- Compare names, paths, public identifiers, environment variables, defaults,
  lifecycle owners, teardown owners, and service boundaries across all
  consumers.
- Check that architecture, API, feature, package, app, plan, Inspector, and
  README statements agree at their handoff points.
- Check that manual workflows and automated tests use the same real project
  implementation unless a documented test boundary explicitly requires
  otherwise.
- Check that framework behavior is not reassigned to an app and app/server
  policy is not reassigned to the framework.

### 6. Check discoverability

- Verify every current module, plan, rule, workflow, and skill has the expected
  index or request-routing entry.
- Verify relative paths, anchors, renamed files, command names, and package
  references resolve.
- Ensure routing points to a current authority rather than a historical or
  generated copy.

### 7. Validate findings or repairs

- Run exact-match scans for stale names, duplicate configuration authorities,
  moved paths, and known forbidden ownership phrases.
- Run relevant Inspector contract tests and focused configuration/API tests.
- Run `git diff --check` for repair mode.
- Use formatter checks as evidence, but compare failures with the `HEAD`
  baseline before classifying them as new drift.
- Never mass-format historical decisions or unrelated documents merely to make
  an existing repository-wide formatter warning disappear.
- Confirm referenced project files exist and that no audit-started process or
  extra port remains running.

## Finding Format

Each reported finding stays small and includes:

- severity (`P0` unsafe/contradictory authority, `P1` public behavior or owner,
  `P2` stale reference or discoverability, `P3` wording or formatting);
- document and exact claim;
- authoritative source or implementation evidence;
- why the mismatch matters;
- first owner that would need repair;
- whether repair requires a product decision or active Inspector update.

Findings are a review report, not a persistent assertion registry or closure
ledger.

## Repair Order

When Mode B is authorized, use this order:

1. unresolved product specification or active Inspector authority;
2. framework hard rules and architecture owners;
3. package and public API/configuration contracts;
4. app architecture and module ownership;
5. feature, PRD, BDD, workflow, and skill consumers;
6. README, index, routing, source coverage, and historical superseding entries;
7. exact validation and bounded final review.

Do not repair a downstream description around an upstream product or owner
error.

## Stop Conditions

Stop the affected scope and report when:

- current specification, Inspector, implementation, and tests disagree on the
  product owner or supported behavior;
- resolving the mismatch requires a new product decision;
- repair would overlap staged or unrelated user work without a safe isolated
  edit;
- only deleted, generated, or historical material appears to support a claim;
- a proposed rewrite would erase valid behavior, procedure, or decision
  history merely to normalize prose style.

Other independent scopes may continue in report-only mode.

## Definition of Done

Report-only mode is complete when:

- every in-scope current document is inventoried and classified;
- every finding cites a current authority or is explicitly marked as an
  unresolved authority question;
- owner, path, identifier, configuration, lifecycle, and navigation drift are
  covered;
- findings are grouped by first repair owner and severity;
- no project file has been modified by the audit pass;
- the user receives a bounded report and chooses whether to authorize repairs.

Repair mode is complete only after separately authorized owner-bounded changes
pass their relevant contract tests, path/name scans, diff checks, and user
review. Completion of this maintenance plan does not close or advance any
framework release gate.
