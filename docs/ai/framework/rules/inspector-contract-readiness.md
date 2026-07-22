# Rule: Inspector Contract Readiness

## Scope

Subject to `bounded-task-scope-and-closure.md`, this rule applies when a task
changes or proves the semantics, public contract, architecture flow, product
cases, or DoD of an active plan, Inspector-backed workflow, product-flow
Inspector, or implementation slice governed by one. A file merely appearing in
an implementation boundary does not make every unrelated internal edit to that
file Inspector-governed work.

## Core Rule

Readiness comes from a thin product contract, an exact architecture flow,
executable product cases, and a bounded definition of done. It does not come
from additional documents that attempt to prove one another complete.

The product specification owns user-visible behavior and public contracts. The
Inspector owns package and data-flow architecture. Formal tests and visual
cases prove the implementation. None may redefine another authority.

## Required Product Contract

Before implementation begins, the product specification must state only what
is necessary to implement and judge the feature:

- supported and unsupported behavior;
- public input and output contracts;
- package ownership and forbidden boundaries;
- shared-product requirements across render, hit, export, or other consumers;
- representative valid, boundary, empty, invalid, and visual cases;
- forbidden fallback and error behavior;
- a concrete definition of done.

Internal algorithms, helper types, artifact subdivisions, identity formats,
cache keys, diagnostics, and performance optimizations belong in the product
contract only when they change public behavior or a non-negotiable package
boundary.

## Required Inspector Contract

The Inspector is an architecture map, not an implementation design or
execution ledger. Each step must declare:

- one owner;
- inputs and outputs;
- conditions and bypasses;
- allowed and forbidden contributors;
- implementation boundary;
- specification references;
- failure owner;
- cache dimensions only when profiling has justified a retained candidate.

Routes and artifacts must resolve, and downstream consumers must not recreate
an upstream product value. The Inspector may use a small number of high-level
steps when that is sufficient to preserve ownership and handoff boundaries.

## Implementation Readiness

A bounded implementation slice is ready when:

- its public behavior is decided in the product contract;
- its matching Inspector step and routes have complete inputs, outputs, owners,
  boundaries, and failure handling;
- affected product cases and negative cases are named;
- the formal tests to add or run are known;
- the relevant DoD gates are explicit;
- no unresolved contradiction or hidden fallback is known.

Readiness does not require the implementation to exist or runtime gates to have
passed. Runtime completion is reported by the actual formal tests, integration
checks, performance measurements, and visual review required by the DoD.

## Evidence

Prefer executable evidence over governance prose:

- source-space or semantic unit tests for product behavior;
- integration tests for package handoffs and channel parity;
- synchronized visual cases for rendered output;
- profiling evidence before adding cache or other optimization paths.

A short implementation plan or Step Execution Card may record the active slice.
It must not be promoted into a second semantic authority.

## Reopen Conditions

Re-review the affected slice when its supported behavior, public API, package
owner, Inspector input/output, route, artifact consumer, forbidden boundary,
product case, or DoD changes. Unrelated implementation details do not reopen the
entire feature contract.

## Forbidden Patterns

- Readiness matrices, assertion registries, audit ledgers, closure packets, or
  validators that primarily validate those governance records, unless the user
  explicitly requests that process for a specific task.
- Expanding the product specification with speculative internal design merely
  to make it appear exhaustive.
- Designing cache before profiling identifies a material cost and an exact
  equivalence oracle.
- Treating one visual screenshot as the semantic authority.
- Advancing implementation while the product contract and Inspector disagree.
