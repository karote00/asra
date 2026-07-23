# Rule: Bounded Task Scope and Closure

## Scope

This rule applies to every AI-assisted task in the repository, including code,
tests, documentation, plans, Inspectors, audits, reviews, cleanup, and visual
verification.

## Core Rule

The user request and the task contract define the work scope. Project rules may
block an unsafe or incorrect in-scope action, require evidence, or force the
task to stop, but they must not independently authorize or require additional
out-of-scope implementation.

Reading may expand when more context is needed to understand risk. Mutation
scope does not expand merely because another file, rule, candidate, or possible
improvement is discovered.

## Bounded Task Contract

Before the first edit, identify the smallest useful contract for the task:

- objective and observable completion condition;
- authorized owner, package, app, document, or file family;
- behavior and contracts that must remain unchanged;
- discovery methods or candidate classes when the task is an audit or review;
- required tests, checks, or product evidence;
- explicit exclusions and stop conditions.

The contract is semantic. It may authorize an owner or file family rather than
an exhaustive file list, and it should include the direct tests, consumers, and
current contract documentation normally required to complete the stated
behavior. This does not authorize adjacent cleanup or unrelated authorities.

For a narrow task this may be one concise statement. Do not create a matrix,
ledger, closure packet, or new plan document merely to record it.

Once editing begins, the contract is frozen. It may change only when:

- the user explicitly changes the request;
- formal evidence proves the current contract cannot achieve the requested
  result; or
- a project hard rule blocks the current approach.

When a material expansion is required, stop and request direction. Do not treat
replanning, a failing gate, an Inspector boundary, documentation sync, or a
newly discovered candidate as implicit authorization.

## Rule Applicability

Apply a specialized rule only to the behavior or contract it governs.

- A file mentioned by an Inspector does not make every internal edit to that
  file an Inspector semantic change.
- Inspector execution rules apply when the task changes or proves the governed
  step, route, owner, input, output, condition, bypass, artifact, contributor,
  failure owner, product case, or DoD.
- Documentation sync applies only to current authorities whose public behavior,
  owner, API, path, configuration, or lifecycle contract changed.
- Similar syntax, naming, or structure is a review candidate, not proof that a
  deduplication or refactor rule applies.

Never expand an Inspector, specification, architecture document, package API,
or shared utility merely to make an unrelated edit appear authorized.

## Discovery Freeze

Audit and review tasks must finish one read-only discovery pass before repair.
That pass fixes the baseline, roots, exclusions, candidate classes, and search
methods used for the task.

After the first edit:

- do not introduce a new repository-wide search method or candidate class;
- inspect only the changed contract, direct consumers, defined negative cases,
  and required gates;
- classify each candidate once as a concrete defect, intentional boundary,
  similar-but-distinct behavior, out-of-scope issue, or unresolved decision;
- do not reopen an intentional or similar-but-distinct candidate without new
  formal evidence.

Evidence about the current fix may deepen. The search universe may not broaden
because the agent is curious or wants additional confidence.

## Implementation and Review

Implement only confirmed in-scope findings. A rule-discovered prerequisite that
is not necessary for the requested result is deferred without modification. A
necessary out-of-scope prerequisite is a stop condition, not an automatic
follow-up edit.

Final review is limited to:

- the final diff and staged file list;
- direct consumers and public exports of changed contracts;
- regressions caused by the current diff;
- the tests and checks fixed in the task contract.

If final review finds a defect caused by the current diff, repair it and rerun
the same bounded checks. If it finds a pre-existing or unrelated issue, report
or defer it without reopening discovery.

A request to "check again" reruns the frozen checks against the same scope
unless the user explicitly asks for a broader audit.

## Repository-Wide and Repeated Work

A repository-wide audit is a snapshot, not an unlimited claim. It must bind to
one baseline commit, named roots and exclusions, fixed candidate classes, and
fixed discovery methods. Later findings produced by a different method are new
work and do not silently reopen the completed snapshot.

`task-iteration-replan.md` applies only when failure evidence invalidates the
current implementation plan. A task iteration may replace the approach inside
the authorized objective, but it must not broaden the mutation scope or create
new product decisions without user authorization.

Do not recursively review the review. One discovery pass, the required
implementation slices, and one final bounded review are the default closure
shape.

## Completion Claims

Completion is always relative to the bounded task contract. State the baseline
or affected scope, the checks performed, and any explicitly deferred issue.

Do not claim that the entire repository has no remaining problems. Claim only
that the fixed scope and fixed evidence set have no remaining concrete finding.

## Decision Guide

| Finding | Action |
| --- | --- |
| Required by the user request and inside the frozen scope | Fix and verify |
| Caused by the current diff | Fix and rerun the same checks |
| Required to satisfy an applicable hard rule but outside scope | Stop and request direction |
| Pre-existing, unrelated, or found by a new candidate class | Report or defer without editing |
| Similar syntax with distinct owner, lifecycle, or trust boundary | Keep unchanged |
| Requires a new product or ownership decision | Stop and request direction |

## Forbidden Patterns

- Adding files to an Inspector boundary only to authorize an unrelated edit.
- Updating unrelated docs because a general sync rule exists.
- Switching search heuristics after implementation and treating new candidates
  as proof that the completed task was incomplete.
- Turning a focused bug fix or refactor into repository cleanup.
- Repeating review loops until no imaginable improvement remains.
- Using green tests to claim broader semantic completeness than the tests prove.
