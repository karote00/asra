# Collaborative Conflict Policies Plan

## Parent Plan and Status

This is a deferred sub-plan of
`docs/ai/framework/plans/yjs-network-collaboration-plan.md`.

It must not be implemented before local transaction atomicity, remote canonical
apply, origin/dedupe handling, and collaboration provider boundaries are stable.

## Goal

Define advanced conflict-resolution policies for collaborative editing beyond default CRDT merge behavior.

## Scope

In scope:
- policy extension points for domain-level conflict handling
- deterministic precedence rules for conflicting edits
- diagnostics hooks for conflict decisions

Out of scope:
- replacing YJS/CRDT core merge semantics
- app-specific UX policy implementation details
- network provider, room/auth, awareness, offline persistence, and remote apply
  infrastructure (owned by the parent Yjs network collaboration plan)

## Target Areas

1. Selection and interaction conflict rules.
2. Property-level override/merge policies.
3. Topology/geometry conflict rules for vector editing.
4. Audit logging hooks for conflict outcomes.

## Implementation Slices

1. Define policy interface and registration contract.
2. Add policy invocation points in transaction/apply pipeline.
3. Add default no-op policy set in preset.
4. Add tests for deterministic outcomes under concurrent edits.
