# Rule: Computation Ownership and Data Reuse

## Scope and Failure Pattern

This project-wide rule applies to authorized framework, app, and tool work that
introduces or changes recurring execution paths, derived data, or shared results.
Apply it before the first relevant implementation slice and at its completion.
It does not require auditing untouched paths, adding caches, or moving ownership;
[bounded task scope](bounded-task-scope-and-closure.md) remains authoritative.

Reusing a function is not the same as reusing its computed result. A shared
helper may still rebuild an index, scan a document, clone admitted evidence, or
construct a report on every call. A cache inside a short-lived invocation does
not provide reuse across invocations. Correct output and isolated UI rendering
do not prove that the work behind them has the right lifetime.

## 1. Establish the Work Boundary Before Implementation

Trace the affected normal caller path through its helpers, constructors,
getters, and adapters to the material operations they actually perform. Do not
infer cost or lifetime from a function name, return type, folder, or cache field.
For those operations, identify:

- the canonical producer, authoritative inputs, and consumers of its output;
- which inputs affect that output, which change frequently, and which changes
  actually require recomputation;
- the output's valid lifetime and existing reuse path, including where the
  producer or retained state is created and disposed;
- the required validation, isolation, and asynchronous handoff boundaries;
- the expected work count or bounded work growth over a representative sequence,
  and the permanent test that will check it.

Record this briefly in the existing bounded task contract, design/spec, or
applicable Inspector Step Execution Card. Do not create a separate matrix,
ledger, or plan just for this rule. An unresolved dependency, owner, or lifetime
must be resolved before wiring consumers; adding a cache is not a substitute.

## 2. Consume Completed Work at Its Owning Boundary

- Prefer consuming an already-produced, valid artifact through its owner's
  approved API over reconstructing its meaning from raw inputs in each consumer.
  Do not create another authoritative or editable model to achieve reuse.
- Distinguish input ownership, computation ownership, and storage lifetime.
  One canonical document does not prevent several consumers from independently
  repeating the same projection or preparation.
- Separate invariant preparation, changing-input queries, and optional
  presentation/report work. For example, a changed pose requires a new spatial
  query, but does not itself change immutable mesh topology. A display needing
  admitted evidence must not construct a full report merely to discard its
  other outputs.
- Inspect the full work of a reused helper before adopting it on a recurring
  path. If it combines responsibilities with different lifetimes, separate them
  at the authorized owner, preserving its contract rather than duplicating it
  downstream. If that requires out-of-scope changes, stop and request direction.
- Do not repeatedly scan, serialize, validate, or clone an accumulating result
  when the owner can safely consume an admitted delta. Preserve required final
  completeness and cross-item checks; incremental processing must prove the
  same result and bounded work growth.
- Coalesce or share in-flight work only when requests are semantically
  equivalent and the owner preserves each consumer's cancellation, delivery,
  and error contract. Dropping distinct required inputs is not deduplication.

## 3. Reuse Must Be Valid, Bounded, and Evidence-Driven

First remove unnecessary work or route consumers to existing completed output.
Introduce retained computation caches only when profiling identifies material
cost; caches are optional, not a requirement for every value or helper.

For retained data, define the owner, retained value, all semantic key inputs,
invalidation, bounds, disposal, and uncached/miss behavior. Verify the actual
construction/disposal path: the retained state must survive the intended reuse
sequence, but must not leak into a successor document, session, or configuration.

- Key validity follows semantic dependencies, not a convenient label or time to
  live. Include relevant source revisions, methods, settings, units, tolerances,
  and sampled inputs. A partial result is not a complete result, and evidence
  for one pose or interval does not prove another.
- Immutable identity can establish validity only when all relevant content is
  immutable. Mutable inputs require an authoritative change contract covering
  every relevant write. Otherwise, use the correct recomputation path.
- Reuse preparation separately from dynamic query results. Reset per-invocation
  cancellation, deadline, work-budget, and error state as required by the owner;
  retained data must not bypass current checks or change numerical guarantees.
- Do not deep-compare or serialize an entire document or mesh on every event
  merely to discover that it is unchanged. Measure key/lookup cost as part of
  the normal path, not just the cached computation in isolation.
- Preserve validation at real trust boundaries, such as imports, plugins, or
  Worker messages. Revalidating untrusted data at a receiving boundary is not
  automatically redundant. Within the same admitted lifetime, consumers may use
  the owner's validated immutable artifact without repeating admission solely
  for convenience. Do not replace validators with unchecked casts.
- If recomputation is intentionally safer or cheaper than retention, document
  the concrete constraint in the existing task/spec and test its work boundary.
  Never satisfy a reuse count by serving stale, lower-fidelity, incomplete, or
  silently repaired output.

For Inspector-governed work,
[Inspector step execution](inspector-step-execution.md#performance-and-cache-work)
still controls owner boundaries, profiling, equivalence, and cache dimensions.
This rule grants no new cache owner or Inspector semantics. UI component
memoization remains prohibited by
[App Optimization and Maintainability](app-optimization-and-maintainability.md).

## 4. Prove Work and Correctness Together

Before fixing an existing repetition bug, follow
[bugfix test-first](bugfix-test-first.md): prove a permanent test detects the
unnecessary work before changing production implementation. Output-only tests
are insufficient when repeated work is the reported failure.

Use focused tests of the actual owner operations, not just a cache mock, wrapper
call, render count, or the existence of a retained map. Cover the relevant cases:

- cold use establishes correct output and the required initial work;
- repeated use with unchanged semantic inputs performs no unnecessary rebuild,
  read, clone, request, or projection;
- changing only a high-frequency input refreshes its dependent work without
  rebuilding unaffected preparation;
- changing a real dependency invalidates affected output and matches a fresh
  execution, including applicable edits, Undo/Redo, and configuration changes;
- cancellation, failure, disposal, and replacement do not reuse invalid output
  or deliver late results into a successor lifetime;
- multiple consumers or accumulating partial results preserve required
  validation and completeness without redundant full-result processing.

Choose applicable cases and explain concrete exclusions; this is not a mandate
for a new test framework or a combinatorial suite. Add a bounded normal-caller
integration case when construction, scheduling, or adapter lifetime could hide
repetition that a helper-only test cannot detect.

Assert meaningful operation counts or bounded scaling alongside result
equivalence. Count builds, canonical reads, scans, clones, validations, or API
requests according to the contract, not arbitrary private function calls.
Use representative input and respect existing test resource guards. Timings
supplement deterministic work evidence; machine-specific milliseconds are not
a universal performance guarantee.

## Completion Gate

Do not close the relevant slice solely because outputs, screenshots, or the
existing suite pass. Show that the defined work boundary is enforced along with
correctness and invalidation. Report before/after work evidence for an existing
regression, or the expected counts/bounds for new behavior.

If the test cannot distinguish the redundant path from the intended one, the
evidence is incomplete. Strengthen the owner-scoped test before claiming the
issue is resolved; do not leave the user to rediscover it through manual use.
