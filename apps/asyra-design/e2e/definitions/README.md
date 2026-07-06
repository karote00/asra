# E2E Definition Files

This folder stores non-authoritative notes for benchmark-oriented E2E tests.
These files are reference material only. They must not define current stroke
semantics, stroke correctness gates, inspector owner stages, route conditions,
or product output rules.

## Purpose

A definition file explains the reference material used by a rendering E2E test.
It may describe:

- what fixture it builds
- what runtime evidence it observes
- what observables it measures
- how those observables are measured
- what report-only or later-phase pass/fail signals the E2E currently uses

Current stroke behavior is defined only by
`docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md`, with route and
owner sequencing in `stroke-flow-inspector.data.js`.

## Naming Convention

When an E2E test keeps benchmark or visual measurement notes, create a matching
definition file in this folder with the same basename:

- test: `reference-dashed-stroke-rendering.spec.ts`
- definition: `reference-dashed-stroke-rendering.definition.md`

## Rule

If a rendering E2E depends on benchmark notes or a measurement protocol, the
corresponding definition may live in this folder as reference material.

The test is the executable implementation.
The definition file is a human-readable reference note and is not stroke
source-of-truth.
