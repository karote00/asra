# Collaborative Conflict Policies Plan

## Status

Superseded on 2026-07-22 by the active
`network-collaboration-transport-plan.md` product contract.

This file remains only so historical decision links continue to resolve. It is
not an active framework plan and authorizes no framework implementation.

## Superseding Decision

`@asyra/collaboration` transports completed Factory publications and delivers
inbound publications to an app callback. It does not own application payload
meaning, dedupe, ordering, permission, conflict detection, merge, repair,
last-write-wins, rebase, or late-message policy.

These decisions belong to the app or backend because only that owner knows the
canonical domain invariants and desired product behavior. An app that needs a
formal conflict-policy plan must define it in the app/backend documentation and
compose it inside its inbound publication processor before canonical mutation.

Framework package invariants remain enforced by their ordinary canonical state
owners. They are not reconstructed by Collaboration.
