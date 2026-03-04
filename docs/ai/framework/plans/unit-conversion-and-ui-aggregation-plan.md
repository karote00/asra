# Unit Conversion and UI Aggregation Plan

## Goal

Complete the remaining auto-layout-oriented property work after schema validation rollout:
- deterministic unit conversion APIs (for example `px` <-> `%`) with layout context
- framework helper path for mixed-unit and mixed-value UI aggregation

## Context

Property schema validation and load/runtime fallback are already integrated.
Remaining work is about behavior semantics, not base validation:
- converting values when units change
- presenting mixed unit/value states consistently in UI aggregates

## Scope

In scope:
- unit conversion contract at system/core boundary
- conversion hooks that can use parent/layout context
- helper APIs for mixed value/unit aggregation (`MIX` semantics)
- app override extension points for custom aggregation rules

Out of scope:
- full auto-layout engine design
- app-specific panel UX details

## Implementation Slices

1. Define conversion contract
- API for unit change intent (`value`, `fromUnit`, `toUnit`, context)
- deterministic fallback rules for missing context

2. Implement core conversion hooks
- wire conversion through common write paths
- keep conversion logic out of UI controls

3. Add UI aggregation helpers
- helpers for single/multi-selection mixed values
- helpers for mixed units and stable output shape

4. Preset default wiring
- provide default helpers via preset registration
- keep app-level override path explicit

5. Tests and docs
- conversion correctness tests
- mixed-state aggregation tests
- docs for framework/preset/app responsibility boundaries

## Success Criteria

- unit changes are converted by system APIs, not UI-only logic
- mixed value/unit states are consistent across default UI paths
- app can override aggregation behavior without patching framework internals
