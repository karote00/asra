# Asyra Design Durable Collaboration Server and Continuous Sync Plan

## Closeout

Closed without implementation on 2026-07-25 after the product owner cancelled
the durable backend proposal and approved the documentation-only outcome.

- Outcome: Asyra Design keeps its bundled WebSocket server as an explicitly
  non-durable development demo, while production app developers remain
  responsible for their own backend and persistence policy.
- Final decision: do not add SQLite, another database, durable
  acknowledgement, restart recovery, missed-publication replay, compaction,
  authentication, or multi-instance coordination solely to simulate a
  production service inside the reference app.
- Canonical record:
  `docs/ai/apps/asyra-design/plans/completed/durable-collaboration-server-and-continuous-sync-plan.md`.
- Exit criteria: the public app README, app collaboration reference, framework
  package README, app plan index, and decision history describe the same
  non-durable boundary; the abandoned dependency, implementation, tests, BDD,
  and Inspector artifacts are absent; focused formatting, dependency,
  collaboration package, server integration, and bounded diff gates pass.

This closeout completes the cancellation and documentation correction. It does
not claim that a durable collaboration backend was implemented.

## Product Decision

Asyra Design is an open-source design-tool reference app. It includes a live
two-window WebSocket collaboration demo, but it does not ship or simulate a
production collaboration backend.

The bundled reference server remains intentionally public, memory-only, and
single-process. Adding SQLite, another database, durable acknowledgement,
restart recovery, missed-publication replay, compaction, authentication, or
multi-instance coordination solely to make the reference app resemble a
production service is out of scope.

This is an app product decision, not a framework limitation. An app that
promises durable collaboration must provide its own backend and persistence
policy.

## Supported Reference Behavior

- A non-empty `fileId` activates the Asyra Design collaboration demo.
- Matching `fileId` values share live publications with currently connected
  peers through the app-owned WebSocket Provider and `MemoryHub`.
- Different `fileId` values remain isolated live rooms.
- The server retains no publication history.
- A disconnected peer misses publications sent while it is absent.
- Reconnect receives future live publications only.
- Server restart, redeploy, or process failure discards every live room.
- A successful send response means the live transport accepted the request; it
  is not a durable database acknowledgement.
- Browser-local snapshots are demo convenience only. They are not shared,
  cross-device, or server-authoritative recovery.
- Server health continues to report `durable: false`.

The demo must not be described as production-safe storage, continuous recovery,
or a durable collaboration service.

## App Developer Responsibility

An app developer may omit collaboration, keep the memory-only demo for
development, or provide an app-owned production server. A production
collaboration backend is responsible for its own:

- authentication, authorization, tenancy, and protected-file policy;
- durable canonical snapshot or operation storage;
- commit-before-acknowledgement semantics;
- ordering, idempotent retry, duplicate and collision handling;
- disconnect, reconnect, late-join, and missed-change recovery;
- corruption handling, backup, restore, compaction, and monitoring;
- process, instance, and deployment-topology coordination.

`@asyra/collaboration` remains optional and provider-neutral. It transports
completed Factory publications and ephemeral Awareness; it does not own an
app's document database, semantic history, recovery policy, or production
backend.

## Documentation Contract

The current boundary is documented in:

- `apps/asyra-design/README.md`;
- `docs/ai/apps/asyra-design/modules/collaboration-reference.md`;
- `docs/ai/framework/packages/collaboration.md`;
- `packages/collaboration/README.md`.

These documents must distinguish live demo transport from durable persistence
and must direct production adopters to supply an app-owned backend.

## Reactivation

Durable collaboration may be reconsidered only after an explicit
product-owner decision that Asyra Design itself will ship a real production
backend. That future decision requires a new bounded Level 3 plan based on the
actual deployment, storage, security, and operational constraints. This closed
proposal must not be silently reactivated or treated as backlog.
