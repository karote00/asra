# Stroke Engine Failure Triage

This file defines the required classification flow for stroke rendering
failures.

Do not patch a visual symptom before classifying it.

## Failure Classes

### 1. Implementation Bug

Definition:

- The scenario is already supported in `stroke-engine-support-matrix.md`.
- The unit contract says the geometry should exist.
- The app-path visual does not match that contract.

Required checks:

- confirm the scenario is `SUPPORTED`
- run the package unit test for the relevant helper
- inspect generated packets and bounds
- run the matching visual spec

Allowed fix:

- minimal runtime correction in the helper that first produces the wrong
  packet/geometry

Forbidden fix:

- visual-only threshold change unless the probe is proven wrong

### 2. Missing Scenario Coverage

Definition:

- The scenario is product-relevant but not represented in the scenario matrix
  or support matrix.

Required checks:

- define scenario family first
- decide if it blocks a later phase
- run the three-question expansion self-review

Allowed fix:

- add unit contract and visual benchmark before runtime implementation

Forbidden fix:

- direct runtime patch without matrix entry

### 3. Product-Semantics Mismatch

Definition:

- Runtime behavior is deterministic, but the intended product behavior is not
  settled.

Examples:

- open path `inside` / `outside`
- self-intersecting constrained path fill rule
- multi-network ownership
- visually balanced dash corners versus strict arc-length semantics

Required checks:

- identify product decision needed
- record blocked/backlog status
- do not silently decide through implementation

Allowed fix:

- none until semantics are approved

### 4. Dist / Source Runtime Drift

Definition:

- `packages/preset/src` behavior differs from `packages/preset/dist`, and the
  app-path consumes dist.

Required checks:

- run `yarn workspace @asyra/preset build:preset`
- inspect dist for the changed helper
- rerun app-path visual

Allowed fix:

- rebuild preset dist

Forbidden fix:

- claiming app behavior from source-only unit tests

## Required Command Pattern

Use the smallest matching set:

```bash
yarn workspace @asyra/preset test:local <unit-test-files>
yarn workspace @asyra/preset build:preset
yarn workspace @asyra/asyra-design test:e2e <visual-spec> --workers=1
yarn workspace @asyra/asyra-design react:build
git diff --check
```

## Classification Checklist

Before fixing:

- [ ] scenario support status is known
- [ ] source family is known
- [ ] topology family is known
- [ ] helper/API owner is known
- [ ] unit or visual gap is known
- [ ] dist/source drift has been ruled out for app-path failures

After fixing:

- [ ] unit contract passes
- [ ] visual benchmark passes
- [ ] dist runtime is synchronized when preset changed
- [ ] support matrix or promotion ledger is updated
- [ ] decision history is appended only when the decision changes architecture,
      ownership, runtime boundary, or product semantics
