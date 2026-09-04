# R0: Pluggable Methods and User Configuration

This document defines the R0 extension contract. The local SDK is not yet a
released package; public distribution still requires the release gates.

The R0 geometry protocol retains common distance/time convergence controls and
an iteration limit. A method declares which controls it uses. Method-specific
`settings.parameters` are bounded scalar data, validated by a declarative
number, boolean, or enum schema; they are never executable source. Old
experiments without this optional field retain their original representation.
New snapshots retain the installed descriptor as inert provenance. Historical
snapshots without descriptors remain readable, without inferred metadata or
permission to rerun.

See the [local SDK guide](extensions-sdk-v0.md) for the implemented source-level
composition, schemas, Worker protocol, independent example and verification commands.

## 1. Two Different Forms of Extension

### User Configuration Through the UI

Without writing code, users can add workcell/equipment instances, edit joints,
import trajectories, select methods, configure collision/clearance conditions,
adjust thresholds, duplicate experiments, and compare results. This is R0's
primary delivery; customization must not all be deferred to an SDK.

R0 rules are typed data: for example, whether a pair's minimum clearance is
below a specified length, which findings require attention, and AND/OR groups
of conditions. Rules may consume only metrics/evidence declared by the method.
Missing inputs remain unknown. Arbitrary string `eval`, arbitrary JavaScript,
and rules that automatically convert unknown into success are not supported.

### Developer-Supplied Capabilities

New geometric algorithms, physical models, and specialized equipment parsers
still need implementation and validation. Developers supply trusted extensions
for local composition. Factories may maintain them privately without returning
source code or data.

R0 supports build-time/pre-start installation. Users select methods from the
installed catalog. "Pluggable" does not promise in-run hot swapping, safe
execution of arbitrary uploaded code, or zero-effort compatibility with every
engine.

## 2. Required First-Release Extension Points

| Extension point                | Delivery                                                       | R0 boundary                                                      |
| ------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Workcell/equipment definitions | Schemas and data assets; instances editable through the UI     | Fixed-base serial mechanisms, not new dynamics                   |
| Data importers                 | Importer adapters, mapping schemas, diagnostics                | JSON, CSV, and restricted GLB first                              |
| Analysis methods               | Descriptors, input validators, worker adapters, output schemas | Official geometry and private methods share lifecycle contracts  |
| Decision rules                 | Typed predicates or trusted evaluator modules                  | Cannot rewrite raw evidence or hide incompleteness               |
| Result presentation            | Declarative metrics/findings and generic App views             | Arbitrary custom UI/shaders are not required R0 SDK capabilities |
| Renderer                       | Framework engine-adapter composition                           | Bound before startup; not authority over solver results          |

Do not first build a generic process/material/TCAD/remote-compute framework or
plugin marketplace. Future extensions may reuse experiment identity,
execution, and provenance without forcing every domain into a "collision
method" or assuming physical models are freely interchangeable.

## 3. Required Method Declarations

Each method declares:

- Stable ID, author/source, version, contract version, and license information.
- Purpose, supported geometry/motion types, units, and coordinate conventions.
- Supported scales, numerical/geometric errors, time precision, and exclusions.
- Required inputs, configurable parameters, defaults, and validation schema.
- Metric units, findings, coverage, and uncertainty semantics.
- Whether it provides formal continuous analysis, sampled preview, or static
  queries only.
- Randomness, seed configuration, and runtime/version reproducibility limits.
- Known CPU/memory requirements, cancellation, timeout, and cleanup behavior.
- Network, external-service, additional-file, and commercial-runtime use.
- Method tests, applicability evidence, and validation status. No evidence means
  no official-validation label.

"Registered," "schema-valid output," "SDK conformance passed," and "numerically
validated within a particular envelope" are distinct states.

## 4. Execution Protocol

1. Check capabilities before allocating execution resources. Unsupported input
   returns an actionable reason.
2. Receive a detached immutable snapshot, shared domain definitions, and
   explicit budget/signal.
3. Report progress or partial evidence without committing canonical scene
   mutations.
4. Return snapshot/method identity, coverage, findings, numerical bounds, and
   reasons with the result.
5. The platform validates structure and consistency before generic result views
   and exporters consume it.
6. Success, failure, cancellation, and timeout release owned resources. Late
   results cannot mutate another run.

A result claiming complete coverage must cover the requested pairs and time
interval. A nonconforming result is a method error, not something the App
repairs into success. The platform verifies structure and internal consistency;
a schema alone cannot prove arbitrary private algorithms mathematically correct.

The App and production Worker import the same `INSTALLED_METHOD_CATALOG`.
Snapshot-owner admission runs before Worker allocation and again at the message
boundary. An installed declaration must match retained provenance under the
same ID/version; object-key order is inert. Methods receive a frozen snapshot,
an owned abort signal, checkpoints and a bounded pair-evidence emitter. Worker
invocations settle once. Late emissions cannot reopen a completed invocation.
Method failures retain a stage label, not raw exception text; uncaught Worker
errors are also redacted. Cooperative cancellation is not the termination
guarantee: formal browser tests exercise a deliberately uncooperative method
and verify the parent runner's forced cancellation/timeout boundary.

## 5. Replacement and Versioning

- Each experiment specifies a method ID/version and settings. Changes create a
  new experiment revision and run.
- If an old method is unavailable, keep historical results readable and explain
  the missing dependency. Do not silently rerun with the latest version.
- Duplicate IDs or names fail registration; there is no backdoor for arbitrary
  overwriting of capabilities already in use.
- Core-related installation/removal happens before startup. Replacement requires
  stopping work, saving, and restarting.
- The App catalog can select among registered methods without changing the
  Framework's permanent composition lock.
- Project schema, method contract, and method implementation have explicit,
  separate versions. A common App version does not imply compatibility.
- Convert settings only through a declared migration. Preserve original
  revisions and never rewrite old evidence.
- Comparison discloses retained declaration differences even when IDs and
  versions match. A missing declaration is not equivalent to a present one;
  object-key order is inert. JSON, CSV and HTML reports preserve the retained
  declaration without consulting the current catalog. CSV assembles rows lazily
  and stops at the 64 MiB UTF-8 report limit, including repeated provenance.

## 6. Security and Trust

R0 does not promise execution of arbitrary untrusted code. Imported data carries
no executable capabilities, and a project cannot automatically install methods
it references.

A Web Worker provides execution isolation and termination, **not an automatic
security sandbox against data access or network transmission**. Private
deployers must review pre-start code and dependencies. Official bundles use
minimal network permissions and packet/browser tests to verify no default
exfiltration. Until stronger isolation is built and verified, do not offer
"download an unfamiliar plugin and run it safely."

Errors should redact private data, paths, and credentials. Users select and
preview reproduction data before submitting a report; the App does not upload
entire projects automatically. Disclose third-party solver licensing and fees
separately.

## 7. Extension Acceptance

Before R0, provide:

- SDK contracts, sample data, and examples of capability and error behavior.
- Formal conformance-runner tests, not just a successful-call example.
- One independent example analysis module, such as an analytical static
  sphere-to-sphere clearance method. It must use the same run/result/comparison
  path without modifying Core or adding fixture-specific UI.
- Formal tests for missing capabilities, incompatible versions, duplicate IDs,
  invalid output, false completeness, cancellation, timeout, worker crash, and
  absence of late mutations after restart.
- Project inspection with missing modules; only dependent reruns are blocked.

The example's mathematical cases can be public. Factories do not need to share
private methods, but those methods must not automatically receive an official
endorsement label.
