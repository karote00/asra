# Collaborative Conflict Policies Plan

## Parent Plan and Status

This is a required sub-plan of Framework Release Gate 2:
`docs/ai/framework/plans/yjs-network-collaboration-plan.md`.

It must not be implemented before local transaction atomicity, remote canonical
apply, origin/dedupe handling, and collaboration provider boundaries are stable.
It does not make app-specific conflict UX a framework responsibility.

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
3. Add tests for deterministic outcomes under concurrent edits.

## Release Scope

- Provide a replaceable policy registration/invocation contract at the remote
  canonical apply boundary.
- Keep collaboration-owned origin, dedupe, protocol, schema, route, payload,
  and permission validation ahead of every app policy; policies cannot replace
  those framework checks.
- Leave entity existence, hierarchy membership/order, property validation,
  geometry, and topology semantics in their canonical package or app owners.
  The collaboration policy pipeline does not reconstruct those decisions by
  reading canonical state.
- Permit apps to register domain policies for app-owned geometry, topology,
  locks, permissions, and workflow semantics without patching Yjs transport or
  canonical state owners.
- Keep awareness, selection presentation, merge dialogs, conflict indicators,
  and manual resolution UI outside the framework policy owner.
- A conflict policy may resolve, repair, or reject before canonical commit; it
  must not patch Render/UI output or create a second state authority.

## Definition of Done

- the matching Yjs Inspector names the policy input, owner, output, rejection,
  repair, bypass, and downstream canonical-apply routes;
- duplicate, reordered, concurrent, unauthorized, unsupported, and repaired
  operations converge or reject deterministically without echo through an
  explicitly registered app-domain policy;
- local undo excludes remote-origin work and rollback compensation re-enters the
  same conflict/origin pipeline;
- default pass-through and app extension points have formal instance-isolation
  and convergence tests;
- the parent Yjs gate and this sub-plan close together before Release Gate 3.
