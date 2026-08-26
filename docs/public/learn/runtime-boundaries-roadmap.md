# Current runtime and future Core Kernel

Asyra's long-term direction includes non-visible and machine-facing information
products: canonical models that an AI can retrieve, reason about, and act on
without requiring a visual interface. The current release provides important
building blocks for that direction, but it does not yet provide a public
Headless Core or independent Core Kernel runtime.

## What is future

The retained research explores a deterministic kernel with optional Render,
Input, UI, Collaboration, and AI adapters. Before such a runtime can be
published, Asyra must decide:

- one runtime per process or multiple isolated runtimes;
- a Core subpath, a new package, or an internal compatibility kernel;
- whether “headless” means no activation, no import, or no dependency;
- ownership of registries, Feature state, typed events, and transaction replay;
- Node, worker, edge, and browser environment guarantees; and
- exact startup, readiness, cleanup, migration, and semver contracts.

The research found that constructing fresh package classes is not sufficient:
some current subscribers, registries, and owner routes can still resolve
module-default state. Publishing a small `createHeadlessCore()` factory now
would risk false isolation.

## What you can build now

You can build browser/Core information products whose canonical data is not
intrinsically visual, and compose visual output only where your product needs
it. Use [custom composition](../start/custom-composition.md) and prove the exact
environment you deploy.

For a service that retrieves app information or requests actions today, keep
the service and domain policy app-owned. Register bounded actions through the
current AI runtime and route accepted work through the same canonical Feature
and transaction paths. See
[Build app-owned retrieval and action](../build/app-retrieval-action.md).

## Do not claim yet

- `createHeadlessCore()` or `startHeadless()`
- a published Core Kernel package
- no Render/Input/UI dependency in Core
- supported Node or worker startup for the full Framework
- multiple isolated Core runtimes in one process
- a delivery date for any of the above

## Canonical sources

- [Future plan](../../ai/framework/plans/headless-core-and-core-kernel-future-plan.md)
- [Architecture research report](../../ai/framework/research/headless-core-and-core-kernel-architecture-research.md)
- [Current Core contract](../../ai/framework/packages/core.md)
- [Current Input System contract](../../ai/framework/packages/input-system.md)

The future plan is intentionally unscheduled and cannot serve as current API
authority. A later implementation must begin from fresh product decisions,
contracts, tests, and clean-consumer evidence.

## Next

- [Model information before output](information-models.md)
- [Read current support boundaries](../reference/support-release.md)
