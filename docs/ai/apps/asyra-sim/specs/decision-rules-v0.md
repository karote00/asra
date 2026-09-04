# Typed Acceptance Rules v0

This is the bounded R0 acceptance contract, not a scripting language or a new
physical model. It supplements the geometry protocol's existing evidence and
keeps user judgment separate from execution and method findings.

## Inputs and Compatibility

An experiment rule keeps `version: 1`, `revision`, and `minimumClearance` in meters.
The last field remains the method's baseline finding/refinement threshold. An
optional `acceptance` expression defines the user's acceptance conditions. When
absent, the existing baseline-derived verdict and serialized shape are unchanged.
Loading never installs a default expression or rewrites old results.

Supported expression nodes are exact typed records:

- `{ kind: 'clearance', operator: 'above' | 'below', value: number }`: compare
  the minimum unsigned clearance across all queried pairs and the full interval
  with a finite threshold from 0 to 20 meters. Comparisons are strict.
- `{ kind: 'penetration', expected: 'present' | 'absent' }`: test established
  penetration evidence or established separation, not the absence of a finding.
- `{ kind: 'all' | 'any', conditions: [...] }`: AND or OR of two to eight nodes.

The root has depth one; maximum depth is four and maximum total nodes is 31.
Reject unknown keys, metrics, operators, nonfinite/out-of-range thresholds, empty
groups, excessive trees and cycles. Expressions contain no code, names requiring
resolution, arbitrary strings, negation of unknown, or automatic success defaults.
All predicates use geometry evidence protocol v1. To examine a different body
subset, create an experiment with that explicit analysis scope; per-predicate
pair selectors and custom metrics are outside this slice.

## Evaluation and Uncertainty

The snapshot owner validates and freezes the expression. The result owner alone
evaluates it after validating the method's retained evidence. Methods still emit
unmodified baseline findings and interval bounds; the renderer is not an oracle.

The global minimum's lower bound is the minimum pair lower bound, with zero for
any pair lacking evidence. Its upper bound is the smallest available pair upper
bound, or unknown when none exists. Missing evidence never raises a lower bound.
For `above`, lower > threshold proves true and upper <= threshold proves false.
For `below`, upper < threshold proves true and lower >= threshold proves false.
All other cases are unknown. An exact equality therefore does not satisfy a
strict comparison; no display rounding or epsilon changes this rule.

Penetration is established if any retained leaf declares validated penetration.
Absence is established only when every requested pair has strictly positive
separation bounds throughout. Neither a zero lower bound nor `penetration: false`
alone proves absence. Otherwise the predicate is unknown.

AND is false if any child is false, true if every child is true, and unknown
otherwise. OR is true if any child is true, false if every child is false, and
unknown otherwise. The final user verdict is `does-not-meet` for a false
expression; a true expression can yield `meets` only when execution completed
and method coverage is complete. Otherwise it is `cannot-determine`. Thus an
OR branch cannot turn an incomplete or failed analysis into a successful result.

An explicit expression replaces only the baseline-derived **user verdict**.
The method summary, findings, unresolved counts, coverage, errors and evidence
remain unchanged and visible. A user may deliberately accept a finding, but
the App still displays that finding. Acceptance is not safety certification.
Additional thresholds do not silently retune the method or trigger adaptive
reruns; insufficiently tight bounds produce unknown. Users can adjust the
baseline threshold, numerical settings or budget in a new experiment revision.

## Editing, History and Consumers

Ordinary UI controls create predicates and nested AND/OR groups as transient
drafts. Save is one existing editing Feature transaction. Any acceptance change
increments rule and experiment revisions; cancellation and Undo preserve old
definitions. Candidate duplication preserves the expression without shared
mutable objects. No Framework changes or new editable state store are needed.

Runs retain both the exact expression and a bounded evaluation tree containing
truth values and reasons. The final verdict is separate from that tree's raw
truth value because completeness may prevent acceptance. Historical validation
recomputes from retained evidence and rejects a forged verdict or evaluation;
it never uses the current method installation. Old runs without expressions
remain unchanged.

The ordinary result view and JSON/CSV/HTML reports expose the same retained
evaluation. Comparison discloses different acceptance conditions even when the
baseline threshold is equal. Neither reports nor UI independently decide a
verdict or erase unknown evidence.

## Formal Cases and Completion

Required cases: legacy roundtrip; each predicate and strict equality; nested
AND/OR truth tables; missing pairs and absent upper bounds; uncertain touching;
penetration witnesses; partial/cancelled/timed-out/failed runs with true OR
branches; preserved findings with a user-accepted condition; invalid/deep/cyclic
trees; detached frozen inputs; forged historical evaluation; changed-rule
revision and Undo; comparison and all report formats.

The slice is complete only after these owner tests, ordinary UI authoring and
real-Worker execution, retained export/reopen, inspected browser views, App
type/lint/build, and Inspector gates pass. This is not numerical validation of
a private method, a real-world outcome guarantee, or a completed R0 release gate.
