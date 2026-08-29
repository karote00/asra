# Headless Core and Core Kernel Architecture Research

## Research Status

Retained architecture research and future-work index. This report records the
2026-08-10 release-scope decision; it is not an active implementation plan, an
Inspector, a public support promise, or a delivery schedule.

The corresponding unscheduled target is
[`../plans/headless-core-and-core-kernel-future-plan.md`](../plans/headless-core-and-core-kernel-future-plan.md).
The release-scoped Input System work is
[`../plans/completed/input-system-environment-neutrality-plan.md`](../plans/completed/input-system-environment-neutrality-plan.md).

## Executive Conclusion

The initial public release does not need a first-class Headless Core or an
independent Core Kernel. Implementing either safely would require decisions and
owner refactors that are substantially larger than removing an eager DOM side
effect from Input System.

The release should therefore:

1. make `InputSystem` import and construction environment-neutral;
2. preserve existing Core and Asyra Design visual integration;
3. describe non-visible, machine-facing information-model products as a future
   product direction, not as a supported initial-release runtime; and
4. retain this report so a later architecture task begins from known ownership
   risks instead of repeating or shortcutting the research.

There is no committed date for activating the future work.

## Scope and Question

The research asked whether fixing Input System's eager `window` dependency was
enough to introduce a public API such as `createHeadlessCore()` or an isolated
Core Kernel for Node, workers, AI retrieval/action services, and non-visible
products.

The answer is no. DOM-neutral package import is a small environment-safety
boundary. A truthful Headless/Core Kernel product contract must additionally
define startup, composition, canonical-owner isolation, transaction replay,
registries, optional adapters, multi-runtime behavior, and compatibility.

## Current Verified Architecture

### Input System

The release-scoped correction is owned by
[`packages/input-system/src/input-system.ts`](../../../../packages/input-system/src/input-system.ts):

- construction can initialize instance state without `window` or `document`;
- browser keyboard and pointer/wheel ownership can be activated explicitly;
- target and document changes can remove the exact old listeners; and
- reset and disposal can have distinct attachment semantics.

The default package entry still constructs a default singleton and installs the
existing event subscriber in
[`packages/input-system/src/index.ts`](../../../../packages/input-system/src/index.ts).
The visual watched-element route is implemented in
[`packages/input-system/src/subscribe.ts`](../../../../packages/input-system/src/subscribe.ts).

This proves Node-safe import/construction for Input System. It does not by
itself prove a usable Headless Core.

### Current Core startup

[`packages/core/src/core.ts`](../../../../packages/core/src/core.ts) exposes the
full Core facade and creates one default Core from default package owners. Its
current `start(container, renderOptions)` lifecycle:

1. closes and validates composition;
2. prepares optional Collaboration;
3. initializes the selected renderer;
4. normalizes only the default renderer's missing-provider error to a
   `{ canvas: null, instance: null }` result;
5. activates input only when a canvas exists;
6. initializes data observers, loads canonical data, initializes Features,
   activates Collaboration, and publishes readiness.

That missing-provider branch is useful browser-shaped no-canvas compatibility.
It is not an explicit Node Headless entrypoint: `start` still requires an
`HTMLElement`, the full facade imports Render/UI-related packages, and the
runtime has no separately frozen non-visible lifecycle contract.

The Core input facade in
[`packages/core/src/apis/input-system.ts`](../../../../packages/core/src/apis/input-system.ts)
correctly preserves typed event routing rather than directly invoking another
package's default owner.

## Owner and Isolation Findings

### Default singleton subscribers own event replay paths

Several public package entries initialize subscriptions against module-default
owners:

- Scene Tree entry and replay:
  [`packages/scene-tree/src/index.ts`](../../../../packages/scene-tree/src/index.ts)
  and
  [`packages/scene-tree/src/subscribes.ts`](../../../../packages/scene-tree/src/subscribes.ts)
- Props Manager entry and replay:
  [`packages/props-manager/src/index.ts`](../../../../packages/props-manager/src/index.ts)
  and
  [`packages/props-manager/src/manager/subscribes.ts`](../../../../packages/props-manager/src/manager/subscribes.ts)
- Input System entry and watched-element subscription:
  [`packages/input-system/src/index.ts`](../../../../packages/input-system/src/index.ts)
  and
  [`packages/input-system/src/subscribe.ts`](../../../../packages/input-system/src/subscribe.ts)

A naive factory can allocate fresh class instances while event-driven mutation
or replay continues to reach these defaults. That would look isolated at the
constructor boundary while remaining behaviorally coupled.

### Registries and accessors are not uniformly runtime-owned

Current definition/runtime coordination includes process-scoped registries or
accessors:

- Props Manager uses package registries and a component-accessor context in
  [`packages/props-manager/src/manager/props-manager.ts`](../../../../packages/props-manager/src/manager/props-manager.ts).
- Feature System owns module-level registry, session manager, package binding,
  pending registrations, event bindings, task registry, and execution state in
  [`packages/feature-system/src/core/feature.ts`](../../../../packages/feature-system/src/core/feature.ts).
- UI Context exports a package-level property registry through
  [`packages/ui-context/src/index.ts`](../../../../packages/ui-context/src/index.ts)
  and
  [`packages/ui-context/src/property-registry.ts`](../../../../packages/ui-context/src/property-registry.ts).
- Core consumes component, property, Feature, Render-strategy, event, and UI
  registries directly in
  [`packages/core/src/core.ts`](../../../../packages/core/src/core.ts).

Some definition registries may intentionally remain shared and immutable after
composition. Others may need per-runtime ownership. That policy must be decided
before claiming isolated kernels or multiple concurrent runtimes.

### Transaction replay requires an explicit owner model

Factory constructs an instance transaction owner and wraps its direct undo/redo
operations in
[`packages/factory/src/factory.ts`](../../../../packages/factory/src/factory.ts).
Reactive Events also maintains a registered transaction owner and temporary
override in
[`packages/reactive-events/src/transaction-owner.ts`](../../../../packages/reactive-events/src/transaction-owner.ts).

The Core Kernel design must state which runtime owns replay when:

- multiple Core instances exist in one process;
- package-global subscribers receive a replay event;
- async work crosses an owner-context boundary; or
- a server/worker runtime has no browser interaction lifecycle.

Without that contract, a fresh `createHeadlessCore()` could direct ordinary API
calls to one owner while undo/redo reaches another.

## Why a Small `createHeadlessCore()` Factory Is Unsafe

A factory that merely constructs new Factory, Props Manager, Scene Tree,
Selection, System Context, Input System, and Render objects would not prove a
fresh runtime. The current package graph mixes:

- instance-owned state;
- default-singleton subscribers;
- process-scoped registries and accessors;
- module-level Feature state; and
- registered/overridden transaction owners.

Publishing such a factory before these boundaries are decided would create
false isolation: the object graph would appear fresh, but some mutations,
replay, registrations, or Feature execution could still resolve through
defaults. That is harder to repair after users adopt the API than it is to
defer the API now.

## Capability Levels

The future work should not use “headless” as one undifferentiated promise.

| Level | Meaning | Relative difficulty | Current status |
| --- | --- | --- | --- |
| A | Public package import/construction does not require DOM globals | Low | Input/Core import safety addressed by the release-scoped Input change |
| B | One process-scoped Core can start through an explicit non-visible lifecycle | Medium | Future; no public contract or API |
| C | A Core Kernel imports/activates no Render, Input, or UI adapters unless selected | High | Future; package and facade boundaries undecided |
| D | Multiple isolated kernels can coexist in one process with correct registries, Features, transactions, and replay | Very high | Future research/architecture target |

Level A must never be documented as evidence for Levels B–D.

## Potential Future Architecture

The likely direction is a small deterministic kernel plus optional adapters,
but this is a hypothesis to validate, not an accepted design:

```text
App domain / registered actions
             |
        Core Kernel
  composition · canonical owners
  transactions · load/save contracts
  validation · readiness · owner context
             |
   optional runtime adapters
 Render · Input · UI · Collaboration · AI
```

Possible implementation shapes include:

- a new `@asyra/core-kernel` package;
- an internal kernel used by a backward-compatible `@asyra/core` facade;
- an explicit runtime-owner/context container passed across canonical packages;
- instance-owned transaction replay and event routing;
- an explicit distinction between shared definition registries and mutable
  runtime registries; and
- optional Render/Input/UI/Collaboration/AI adapters with no activation unless
  selected.

Package separation alone is insufficient. Dependency direction and runtime
owner routing must be proven through clean-consumer tests.

## Decisions Required Before Activation

1. Is the first target one non-visible runtime per process or multiple isolated
   runtimes?
2. Is the public surface an `@asyra/core` subpath, a new package, or an internal
   kernel behind the existing facade?
3. Does “headless” promise no activation, no import, or no package dependency on
   Render/Input/UI?
4. Which definition registries are shared, immutable after composition, or
   runtime-owned?
5. How do typed events and transaction replay resolve the active owner across
   synchronous and asynchronous work?
6. Which environments are supported: Node, Web Worker, Service Worker, edge,
   browser without canvas, or all of them?
7. What is the non-visible startup/readiness/destroy lifecycle?
8. Which canonical model and Feature APIs are guaranteed without Render, Input,
   or UI?
9. How does the existing default singleton facade remain compatible?
10. Which server/worker/multi-runtime clean-consumer proofs define support?

## Activation Entry Conditions

Future implementation should begin only when the product owner explicitly
activates the plan and chooses the intended capability level. At that time the
task must:

- re-audit the current code rather than treating this dated report as current
  behavior authority;
- freeze a new thin product contract, exact Inspector, executable product
  cases, bounded scope, and Definition of Done;
- add failing isolation/startup/replay tests before implementation;
- decide migration and semver impact before publishing any entrypoint; and
- prove clean Node, worker where applicable, browser compatibility, and any
  claimed multi-runtime behavior.

## Website and Documentation Consequence

The initial website may describe non-visible and AI-facing information-model
products as Asyra's future direction and explain why the architecture is being
designed toward them. It must not present a public Headless Core entrypoint,
no-Render dependency guarantee, Node runtime lifecycle, or multi-runtime
isolation as an initial-release capability.

Executable examples and Runtime Atlas cases must be backed by current public
APIs. Future Headless/Core Kernel concepts belong on the Roadmap and may link to
the public summary derived from the future plan when that content owner is
implemented.
