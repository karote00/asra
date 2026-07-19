# Completed Plans: Load and Migration

## 1. Framework load validation pipeline

- Completed on February 28, 2026.
- Core now orchestrates load normalization and package validation across `props-manager`, `scene-tree`, and `system-context`.
- Load diagnostics are emitted through app-facing load diagnostics hooks after apply.
- Reference: `docs/ai/framework/plans/completed/props-manager-file-load-validation-plan.md`

## 2. App-level migration pipeline formalization

- Completed on July 19, 2026 as Framework Release Gate 1; final closeout was
  confirmed after the connected-dispatch contract shipped in PR #90.
- Apps own one connected linear migration chain, its domain transforms, and one
  conditional dispatcher. The dispatcher follows matching current-version
  transitions and passes an unmatched version through unchanged. Core retains
  one synchronous raw-document -> migration hooks -> package
  validation/fallback -> canonical apply -> observational diagnostics pipeline
  for direct and provider loads, without app target-version policy.
- Formal coverage closes ordering, failure atomicity, nullish no-document
  parity, validated-artifact ownership, diagnostics containment, and instance
  isolation without adding app schema history to framework packages.
- Reference:
  `docs/ai/framework/plans/completed/props-manager-app-level-migration-plan.md`
