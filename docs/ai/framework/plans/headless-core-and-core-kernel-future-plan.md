# Headless Core and Core Kernel Future Plan

## Status

Unscheduled post-release target. This file preserves future intent only. It is
not active implementation authority, has no delivery date, creates no current
release blocker, and must not be used to claim a supported Headless Core API.

Research authority:
[`../research/headless-core-and-core-kernel-architecture-research.md`](../research/headless-core-and-core-kernel-architecture-research.md).

## Future Objective

Explore and, when explicitly activated, design a deterministic runtime for
non-visible and machine-facing information-model products. The long-term target
may let apps use canonical state, validation, transactions, persistence
contracts, Features, and registered actions without activating Render, browser
Input, or UI adapters.

The broader Core Kernel direction may also separate deterministic infrastructure
from optional runtime adapters so visual, non-visible, AI-facing, server, worker,
and future domain products can share one owner model without making the
Framework responsible for app domain knowledge.

## Current Non-Goals

- no `createHeadlessCore()` or `startHeadless()` API in the initial release;
- no new `@asyra/core-kernel` package now;
- no claim that `@asyra/core` currently excludes Render/UI dependencies;
- no registry, Feature, event, transaction, or canonical-owner refactor in the
  current Input System task;
- no delivery estimate, package version, migration promise, or website support
  claim; and
- no multi-runtime isolation claim based only on fresh constructors.

## Candidate Phases When Activated

These phases are a research sequence, not an approved implementation plan:

1. Decision and product contract
   - choose capability level, environments, public surface, isolation target,
     lifecycle, and compatibility boundary;
   - re-audit the current repository and replace stale assumptions.
2. Runtime owner context
   - define how canonical owners, typed events, Features, registries, async work,
     transaction replay, and cleanup resolve one runtime.
3. Kernel boundary
   - separate deterministic composition/startup/readiness from optional browser
     and presentation adapters without a second canonical owner.
4. Optional adapters
   - compose Render, Input, UI, Collaboration, and AI only through explicit
     capability contracts.
5. Public API and migration
   - select package/subpath shape, compatibility facade, lifecycle errors,
     semver, docs, examples, and deprecation path.
6. Environment and isolation proof
   - verify clean Node and claimed worker/browser environments, no unintended
     activation, canonical operations, transaction replay, cleanup, and any
     promised multi-runtime isolation.

## Required Activation Decisions

Before implementation, the product owner must decide:

- one runtime per process or multiple isolated runtimes;
- subpath, new package, or internal kernel;
- no activation, no import, or no dependency-graph guarantee;
- shared versus runtime-owned definition registries;
- synchronous and asynchronous event/transaction owner resolution;
- supported Node, worker, edge, and browser targets;
- required canonical/Feature/persistence behavior without visual adapters; and
- compatibility guarantees for the existing default Core facade.

## Activation Prerequisites

Activation requires all of the following:

- explicit product-owner authorization and selected capability level;
- a new branch from the latest accepted main/integration state at that time;
- a fresh bounded plan and exact Inspector; this future note cannot serve as
  that Inspector;
- executable product cases and failing pre-implementation regressions for the
  chosen startup/isolation claims;
- package-boundary, transaction-replay, registry, Feature, and compatibility
  audits against current code;
- an explicit semver/migration decision; and
- clean-consumer evidence for every claimed environment.

## Stop Conditions

- The task cannot state which owner receives a canonical mutation or replay.
- A factory appears instance-owned while event subscribers or registries still
  mutate package defaults.
- “Headless” remains ambiguous between no activation, no import, and no package
  dependency.
- The proposed kernel duplicates canonical state or hides failures behind a
  fallback.
- Public documentation or website content would need to claim behavior before
  executable evidence exists.

## Future Definition of Done

A binding Definition of Done must be written only after the activation
decisions are made. At minimum, it will need exact public API, lifecycle,
environment, owner/isolation, transaction, compatibility, package, example,
documentation, and clean-consumer acceptance criteria.

## References

- [Architecture research report](../research/headless-core-and-core-kernel-architecture-research.md)
- [Completed Input System release task](completed/input-system-environment-neutrality-plan.md)
- [Framework Architecture](../ARCHITECTURE.md)
- [Framework Workflow](../WORKFLOW.md)
- [Bounded task scope and closure](../rules/bounded-task-scope-and-closure.md)
- [Inspector contract readiness](../rules/inspector-contract-readiness.md)
