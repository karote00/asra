# Flow Inspector Control Plane Actions and Integrations Plan

## Status

Deferred until the dynamic Evidence, Reconciliation, and CI Plan completes.
This plan owns executable actions and integrations and is not part of the
completed static `v0.2.0` companion release.

## Objective

Extend the proven state/action system to visual evidence, protected delivery
workflows, CI, and optional external adapters without weakening authorization,
audit, or canonical truth ownership.

## Entry Criteria

- mapping reconciliation and complete freshness are proven;
- UI, CLI, and API expose identical status and action behavior;
- action security and audit boundaries have survived representative local use;
  and
- each selected integration has an explicit product need and owner.

## Phase 5 — Typed Actions and Delivery Flow

- add the typed action registry, local runner, timeout, cancellation,
  capability, confirmation, and audit boundaries;
- add focused test and evidence actions;
- ingest and explain visual-review artifacts and screenshots;
- run registered visual-review actions through the established execution path;
- ingest CI results without making a CI vendor the panel truth owner;
- add Git diff/review preparation and final completion panels;
- require current evidence, resolved mapping candidates, and reviewed diff at
  completion gates; and
- add commit, push, release, or deployment actions only with their existing
  explicit authorization, confirmation, capability, secret, and audit
  boundaries.

## Phase 6 — External Adapters and Hardening

- add outbox-based task, source-control, CI, and communication adapters selected
  by explicit scope;
- support retry, deduplication, delivery state, and replay-safe audit history;
- resolve secrets indirectly and redact them from config, results, logs, and
  artifacts;
- isolate adapter failure from canonical panel state;
- profile and harden large-workspace storage, watchers, process cleanup, and
  crash recovery; and
- validate that the permission-shaped architecture can evolve toward team RBAC
  and remote runners without redesigning evidence or action identity.

## Definition of Done

- visual and CI evidence use the same provenance and freshness model as tests;
- every dangerous delivery action is denied without explicit authorization and
  required confirmation;
- adapter failure never changes canonical node truth and can be retried safely;
- no external service becomes the owner of mappings, results, or status;
- secrets do not appear in persisted public state or ordinary logs; and
- performance and recovery gates pass for the supported workspace scale.

## Stop Conditions

- an integration requires weakening action registry or secret boundaries.
- Git or release actions treat a UI click as standing publication authority.
- adapter state is required to derive canonical pass/fail status.
- team RBAC or hosted multi-tenancy expands scope without a separately approved
  product contract.

## Estimated Duration

Approximately 4–7 weeks after the Reconciliation and UI plan is accepted,
depending on the number of adapters selected. Team RBAC, remote runners, and
hosted multi-tenancy remain separate version 2 work.

## References

- [Workflow Control Plane Roadmap](flow-inspector-workflow-control-plane-roadmap.md)
- [Evidence and CI Plan](flow-inspector-control-plane-evidence-and-ci-plan.md)
