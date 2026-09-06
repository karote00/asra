# Flow Inspector Core Proof

## Scope

This is the first bounded checkpoint of Phase 3, activated on 2026-09-07.
It verifies two real Factory flows in this repository and exposes their concrete
steps on a local board. It does not complete the full Control Plane roadmap.
Static schema version 2 and the static workspace remain read-only.

The supported flows are deferred transaction publication and immediate delivery
followed by cancellation. Both reuse the existing transaction Inspector's
`record-reversible-journal`, `finalize-transaction-state`, and
`settle-local-shared-projection` steps. Their semantics remain owned by
[Factory](../../framework/packages/factory.md) and the
[transaction contract](../../framework/plans/completed/transaction-atomicity-and-rollback-plan.md).
The tool never reimplements Factory, changes its runtime, or becomes its dependency.
The cancellation case explicitly selects `batchPublications: false` so its
forward publication crosses the existing Factory handoff before cancellation.

## Admission

The product-owned proof manifest names each flow's goal, its ordered selected
steps, the existing architecture source, the formal test file, and exact required
case names. The manifest is an explicit test mapping, not another architecture.
The selected slice must resolve every step and its owner, artifacts, routes,
conditions, bypasses, failure owner, and implementation boundary. External inputs
to the slice must be declared. Unknown steps, missing producers, contradictory
ownership, duplicate cases, empty requirements, and broken routes reject admission.
Preflight establishes structural readiness only, not behavioral correctness.

Each flow has three independent obligations: mutation-time journal isolation,
commit or inverse-replay outcome, and publication timing/compensation. Formal
Factory tests exercise its real public API and channel, observing outputs and
replay boundaries. Test configuration may change runtime code only for the
explicit negative demonstration; it must never change the assertions.

## Source and Evidence

Every attempt copies the declared Factory, Reactive Events, Utils, and Persistence source
closure plus test mapping, architecture, runner configuration, and package/lock
metadata into a task-owned snapshot under `tmp/flow-inspector/`. Symlinked inputs
are rejected. Vitest resolves those package imports to that snapshot's source;
undeclared project dependencies fail instead of using installed workspace output.
Installed third-party dependencies are reused; their lockfile and runner version
are recorded. This is a trusted local-development proof, not a sandbox for hostile
code or a verification of the entire dependency installation.

Evidence identifies the attempt, actor, scenario, selected flows, Git HEAD,
captured source digest, contract digest, runner version, and start/finish times.
The digest identifies the exact copied inputs, including uncommitted content;
Git HEAD alone is never presented as the tested source. Results describe that
snapshot, not deployment status or a continuously current working tree.

One invocation runs the required cases together. Results require exactly one
recognized observation per expected case, successful runner exit, and no suite
or runner error. Missing, duplicate, skipped, pending, malformed, unexpected,
and failed observations cannot pass. A successful wrapper is not evidence of
successful assertions. Infrastructure failures remain distinguishable from a
failed product obligation; the tool reports an observed failing obligation and
its contract owner, not an inferred universal root cause.

The negative scenario changes the built-in inverse's restoration value in the
isolated Factory source. The ordinary commit flow must still pass, while the
retained cancellation flow must fail its inverse/compensation obligations.
A subsequent baseline run must pass unchanged assertions. Negative proof is
successful only when those precise outcomes are observed, not on any error.

## Controlled Actions and Retention

Only registered baseline verification, negative demonstration, and cancellation
are supported. CLI and HTTP use the same action service and verifier. Unknown
actions, flows, scenarios, malformed bodies, and unauthorized requests are rejected
before creating a run or child process. The local server binds only to loopback,
checks Host and Origin, and requires a per-start capability for mutations.
It has no arbitrary command, path, upload, or external delivery endpoint.

The service admits one run at a time. Every run has a bounded deadline and output
size. Cancellation and shutdown terminate the owned process group and await
settlement before another run starts. Timeouts, signals, spawn failures, and
missing reports are non-passing results. Child environments omit ambient secrets;
the runner leader terminates its group if its service owner abruptly dies.
trusted tests still execute with the user's OS authority. Source-writing agents,
network containment, token budgets, tickets, and PR mutation are unsupported.

An attempt record contains its state and audit events in one atomically replaced
JSON file. A final record is immutable. Interrupted records are marked interrupted
when the store is reopened after obtaining exclusive ownership; restart cannot
turn them green. Late completion cannot overwrite another attempt. Persisted
records are validated on read. Raw reports and the captured source are local
artifacts, never committed test results. Only explicit local cleanup removes them.

## Board

The board displays each flow's goal, three concrete step cards, declared shared
owners, required case counts, and verification results. Architecture details come
from the selected Inspector; the board does not author a duplicate step model.
Cards launch the related flow's verification and show its outcome and failures.
The all-flow button runs the complete supported set of two flows. A negative run
is prominently labeled and never counted as current successful evidence.

Progress means observed verification progress, not task completion or deployment.
Untested steps remain unknown. Source identity and attempt history stay visible;
changing selection does not mutate or reinterpret evidence. Historical evidence
with a different contract digest stays in its original artifacts and cannot mark
the current cards as passed. A pending run can be
cancelled. A failed run can be followed by a baseline verification from the board.
The shared step links identify potential cross-flow impact; failed assertions
identify confirmed violations. This proof protects only its declared obligations.

The server URL is owned by `FLOW_PROOF_URL`, shared by the server and browser tests.
The public page and its scripts are served by the same server without a build or
new dependency. Static tool CSS conventions apply to this separate tool surface.
UI polling only reads existing attempt records; source capture and test execution
occur once per admitted action. No computation cache or workspace watcher is added.

## Cases and Completion

- Baseline: both real flows and all six obligations pass.
- Negative: commit remains passing, cancellation fails at the declared inverse
  and compensation obligations, then a baseline passes.
- Preflight: missing input producers, invalid owners/routes, unknown steps,
  duplicate/empty requirements, and missing case mappings reject admission.
- Evidence: zero-match, missing, duplicate, skipped, runner error, malformed
  report, and successful wrapper around failing cases reject completion.
- Actions: denial has no execution side effect; one request starts one runner;
  duplicate admission, timeout, cancellation, restart, and late completion are safe.
- Browser: baseline, negative failure details, recovery, retained attempt identity,
  and readable desktop/mobile layouts pass a permanent test and screenshot review.
- CI runs the focused tests, baseline gate, and exact negative proof as failing
  commands inside `validate`; existing static compatibility checks remain green.
- The PR's checks pass and the README provides reproducible local commands.

Remote required-check policy is a repository setting, not implied by this code.
Full Phase 3/4 mapping evolution, accepted-base policy, arbitrary-flow onboarding,
remote CI ingestion, team sharing, and broader retained-flow coverage remain future
work. No completion claim extends to those features.
