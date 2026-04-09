# E2E Definition Files

This folder stores definition files for benchmark-oriented E2E tests.

## Purpose

A definition file explains the visual oracle used by a rendering E2E test.
It is the place where a test declares:

- what fixture it builds
- what rendering contract it expects
- what observables it measures
- how those observables are measured
- what pass and fail mean

## Naming Convention

When an E2E test needs a benchmark or visual oracle, create a matching
definition file in this folder with the same basename:

- test: `reference-dashed-stroke-rendering.spec.ts`
- definition: `reference-dashed-stroke-rendering.definition.md`

## Rule

If a rendering E2E depends on a benchmark, contract, oracle, or measurement
protocol, the corresponding definition must live in this folder.

The test is the executable implementation.
The definition file is the human-readable contract.
