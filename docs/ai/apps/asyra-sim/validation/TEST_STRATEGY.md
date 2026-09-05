# Asyra Sim Testing and Credibility Strategy

This is the formal test plan for the implementation in progress. Individual
foundation tests do not establish that all product cases below have passed. The
[R0 contract](../specs/robot-workcell-v0.md) owns product semantics;
[FIRST_RELEASE.md](../release/FIRST_RELEASE.md) owns release acceptance.

## 1. Separate the Subjects of Verification

1. **Software verification**: does the code faithfully implement the input,
   workflow, unit, method, and result contracts?
2. **Numerical-method verification**: within declared mathematical assumptions
   and support limits, do results meet independent oracles and error bounds?
3. **Real-world model validation**: do user dimensions, trajectories, and
   assumptions sufficiently represent the actual workcell?

The first two are official delivery responsibilities. The third requires user
measurements and real-world evidence. The platform supports traceability,
comparison, and recording; passing the first two does not prove the third.

Coverage percentages, screenshot counts, recomputation with the same engine,
and "it did not crash" are not substitutes for correctness.

## 2. Evidence Available Without Confidential Factory Data

### Analytical and Independent Oracles

- Sphere-center distance minus radii: static sphere clearance/intersection,
  including exact contact.
- Axis-aligned boxes: known separation, containment, intersection, and
  face/edge/point contact.
- Known translational trajectories with calculable first-contact intervals.
- A small object passing through a thin obstacle at high speed: separated
  endpoints but an intermediate collision.
- A rotating link sweeping through an obstacle: endpoints or coarse samples
  must not hide intermediate contact.
- Simple one-/two-joint forward kinematics checked by independent formulas.

Oracles must not call the production helper to generate expected answers.
Retain synthetic data, expected values, derivations, and error budgets together.
Comparison with a second engine is supporting evidence; agreement is not proof
that both are correct. A snapshot of the current bug is not a valid baseline.

### Metamorphic and Numerical Boundary Cases

- Rigidly translate/rotate the entire local model within the supported envelope
  and preserve geometric relationships.
- Convert mm/m and deg/rad while retaining equivalent results within declared
  conversion errors.
- Change camera, zoom, DPR, viewport, or playback speed without changing
  source-space results.
- Insert equivalent intermediate keyframes without changing motion semantics
  or continuous-analysis conclusions.
- Refine conservative bounds or resolution according to the method's declared
  bounding/convergence properties. Do not assume arbitrary engines or all data
  sets converge monotonically.
- Exercise tiny gaps, contact error bands, extreme scale ratios, and coordinates
  near support limits. Uncertainty must not produce clear.

Dense sampling is not an oracle for complete continuous time. Formal methods
still need derivations or independent cases for conservative bounds and
termination. Any known missed collision blocks the affected method's release.

## 3. Permanent Product Cases

These IDs are stable names for formal tests, not an additional assertion
registry. Owner tests belong in `__tests__/`; UI cases belong in App `e2e/`.

| Case                                 | Given / when                                                            | Required result                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| SIM-01 Basic clearance               | Known sphere/box/capsule geometry, queried statically                   | All supported pairs meet independent oracles and method error bounds                  |
| SIM-02 High-speed crossing           | An object passes through a thin plate between keyframes                 | A finding or explicit unresolved interval, never complete clear                       |
| SIM-03 Rotational sweep              | An endpoint follows a joint arc through an obstacle                     | Analyze the actual joint path, not a straight line between endpoints                  |
| SIM-04 Self-collision and exclusions | Different rigid links intersect; another pair is explicitly excluded    | Check nonexcluded pairs and preserve exclusion reasons in the report                  |
| SIM-05 Units and hierarchy           | Convert units, move a parent, reopen the project                        | Equivalent pose/geometry conclusions without accumulating drift                       |
| SIM-06 Empty scope                   | No pairs, no trajectory, or background only                             | No-valid-scope or static-mode feedback, not a fabricated motion pass                  |
| SIM-07 Invalid import                | NaN, duplicate times, missing units/joints, wrong version               | Structured errors, no partial state, no silently skipped rows                         |
| SIM-08 Original-part geometry        | A supplied mesh has omitted table legs, holes or small features in a surrogate; visibility changes or a rerun is attempted | Never execute the surrogate as the original part; block unsupported input, preserve old evidence for read-only review |
| SIM-09 Unresolved/error band         | Clearance is too close to a threshold or an interval cannot be resolved | Preserve uncertainty/unresolved state; do not label it safe                           |
| SIM-10 Execution failure             | Cancellation, timeout, worker crash, invalid result                     | Correct terminal state, partial scope, cleanup, and no false success                  |
| SIM-11 Uncooperative method          | An adapter ignores abort                                                | Terminate the owned worker at the deadline; UI remains usable; no late mutation       |
| SIM-12 Editing during a run          | Geometry changes to B while run A executes                              | A retains its original snapshot and is distinguished from B; no mixed input           |
| SIM-13 Stale results                 | Change trajectory/threshold/method, or only the camera                  | Input changes affect freshness; camera changes do not                                 |
| SIM-14 Candidate comparison          | A/B/C use different scopes, methods, or exclusions                      | Differences are visible; incompatible results are not silently ranked                 |
| SIM-15 Persistence and recovery      | Save failure, quota exhaustion, missing asset, corrupt bundle           | No false saved state or damage to the original project; actionable recovery/rejection |
| SIM-16 Method replacement            | Replace a method with an independent example module and rerun           | No Core changes, same lifecycle, old results retain their version                     |
| SIM-17 Missing version               | Import a project referencing an unavailable method                      | Historical data remains readable; rerun is blocked; no automatic upgrade              |
| SIM-18 Load repair                   | Joint/dimension fields trigger Framework fallback                       | Show the repair and block analysis under the original assumptions                     |
| SIM-19 Output parity                 | Use one run in UI, JSON, CSV, HTML, and replay                          | Same source result, units, unknowns, scope, and versions                              |
| SIM-20 Offline/private data          | Launch the distribution without a network, import private data, rerun   | Core journey succeeds with no default exfiltration or required remote assets          |
| SIM-21 Injection and large files     | Malicious CSV/HTML strings, remote assets, oversized/corrupt input      | No content execution or unexpected traffic; size/resource limits apply                |
| SIM-22 User journey                  | A new user follows the docs through three candidates and reopening      | No code changes or maintainer data repair; user can explain limitations               |

## 4. Test Layers and Order

1. **Domain unit**: schemas, units, joint transforms, interpolation, scope, pairs,
   rules.
2. **Method tests**: analytical oracles, continuous-time coverage, numerical
   bounds, unsupported/unknown behavior.
3. **Integration**: snapshot -> worker -> result -> persistence, separation of
   Feature execution and transactions, late-response isolation.
4. **Extension conformance**: descriptors, versions, outputs, and failures;
   separate from method-correctness verification.
5. **Product E2E**: ordinary UI/import paths, three-candidate comparison,
   save/reopen, offline use.
6. **Visual QA**: workcell overview plus magnified problem areas, checking
   colliders, witnesses, time, and units.
7. **Performance/resources**: normal load, warning load, hard limits, repeated
   runs/cancellations, resource reclamation.
8. **Independent pilots**: external users complete workflows with the formal
   distribution; feedback becomes permanent tests.

Bug fixes are test-first: check existing coverage, add or strengthen formal
tests if needed, prove failure before changing production code. Do not discard
fixtures or tests after diagnosis.

## 5. The Role of Visual Evidence

Capture the same normal App state that users see, not a separate diagnostic
renderer. Establish a source-space oracle before E2E screenshots. Inspect both
the overview and magnified problem areas; record viewport, zoom, DPR,
run/pair/time, and artifact paths.

A screenshot without visible penetration does not prove numerical correctness.
Diagnostic geometry must not repair formal product projections.
Use the repository's visual-review and failure-replay workflows where
applicable. The owner scope determines required tool gates; do not
unconditionally expand testing to unrelated Apps.

## 6. Resource Baselines and Usability

M0 selects a publicly reproducible ordinary engineering-computer baseline,
rather than verifying only on a high-end GPU. The planned standard benchmark is
one six-axis robot, tool and workpiece, approximately 30 fixed analysis shapes,
approximately 200 keyframes, and three sequential candidates. This is a test
target, not a measured capacity claim.

Also include small analytical, near-threshold, and over-budget scenes. Record
hardware, OS, browser, engine version, shape count, pair count, time range,
segment count, numerical settings, wall time, measurable memory, cancellation
latency, and unresolved-interval counts.

- M0 defines numerical support and initial resource limits; M5 freezes measured
  release limits.
- Do not lower precision or skip pairs to meet a speed target while retaining
  the original method label.
- Where memory cannot be measured reliably, disclose the method and limitations;
  asset/workload caps provide additional protection.
- Cancellation needs a measurable deadline and must work for large files, long
  jobs, and uncooperative workers.
- Repeated run/cancel/restart must not retain unnecessary timers, workers,
  listeners, or GPU resources.
- Without numerical budgets and specified test hardware, the performance gate
  has not passed. "It feels smooth" is not evidence.

## 7. Partner Pilots Without Requiring Secrets

Verify the platform with public synthetic cases first. Partners can then run
known cases within their own networks and share only de-identified error
summaries and reproduction steps. Private geometry and complete recipes need
not be uploaded.

When real data is available, calibrate on one portion and retain another for
independent validation. Do not tune every case to pass and then claim reliable
generalization. Pilots run in shadow mode: no equipment commands, replacement of
safety systems, or sole basis for production decisions.

External pilots establish usability, understanding of assumptions, and
applicability to limited cases, not industrial safety certification.
If partners are unavailable, remain at internal/developer preview rather than
claiming the small-manufacturer R0 release is complete.

## 8. Maintenance and Release Evidence

Summarize gate output first: failing case, assertion, relevant owner, budget,
and artifact path. Keep formal tests, fixtures, analytical derivations, and
baseline settings in the repository. Manage large generated logs through
existing artifact policies; never commit users' private data.

Release evidence binds to the exact source commit, App/method versions, and
distribution artifact. Method updates rerun their oracles, consumer integration,
and affected cases. Numerical behavior changes require versioning and
traceability for old results, not silent changes to method meaning.

`yarn workspace @asyra/asyra-sim test:local` runs the tests currently implemented
in the App workspace. Its current foundation coverage is not completion of
SIM-01 through SIM-22. Type checks run through the workspace's `typecheck` script.

### Original-part local regression commands

Use the App's `APP_URL` from `.env` for both the development server and tests.
The 2026-09-05 local review used `http://127.0.0.1:3020/`, normal Core/CUSTOM
rendering, the production Worker, original sample sources, and default camera
unless a test explicitly records another view. Run the complete browser scope
in these bounded groups so the existing global timeout and process guards stay
effective:

```sh
yarn workspace @asyra/asyra-sim test:local
yarn workspace @asyra/asyra-sim test:e2e e2e/__tests__/visual-references.spec.ts e2e/__tests__/candidate-comparison.spec.ts e2e/__tests__/retained-runs.spec.ts e2e/__tests__/field-observations.spec.ts e2e/__tests__/projects.spec.ts
yarn workspace @asyra/asyra-sim test:e2e e2e/__tests__/methods.spec.ts e2e/__tests__/acceptance-rules.spec.ts e2e/__tests__/resources.spec.ts e2e/__tests__/workcell.spec.ts e2e/__tests__/original-part-admission.spec.ts e2e/__tests__/experiments.spec.ts
yarn workspace @asyra/asyra-sim test:e2e src/domain/__tests__/runtime.browser.spec.ts src/engine/glb/__tests__/runtime.browser.spec.ts src/storage/__tests__/runtime.browser.spec.ts src/analysis/__tests__/runner.browser.spec.ts src/analysis/__tests__/budget-baseline.browser.spec.ts src/analysis/methods/__tests__/runtime.browser.spec.ts
yarn workspace @asyra/asyra-sim test:e2e e2e/__tests__/theme.spec.ts e2e/__tests__/workbench-review.spec.ts e2e/__tests__/mechanical-review.spec.ts
```

Local result: 413 unit/integration tests and 52 browser cases passed. Browser
screenshots are in `apps/asyra-sim/test-results/`; inspect each group's output
before another group replaces it. Test attachments record state and timing.
The visual group covers light/dark themes, 600/960/1440 px panel layouts and
1600x1000 playback at DPR 1, including 0/4/8-second poses and a closer view.
`mechanical-closeup.png`, `mechanical-pose-*.png`, `light-workbench.png` and
`dark-workbench.png` are normal-App artifacts, not alternative renderers.
Agent screenshot inspection and the normal in-app 46-pair complete run are
separate evidence from the automatic gates. Geometry authority remains the
source-space tests; GPU PNG byte equality is not an Undo oracle. Theme screenshots
wait for computed colors and finish finite transitions before capture.

Remaining differences: the sample is authored, not manufacturer-certified;
the local SwiftShader timing is not reference-hardware evidence. Independent
numerical review, larger workload qualification and a rebuilt packaged release
are not implied by these local passes.
