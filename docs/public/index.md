# Asyra Framework

Asyra is infrastructure for building products around app-owned information and
rules. A product may project that information as a design tool, whiteboard,
BIM environment, simulation system, or another visual tool. The
Framework does not own the meaning of a building, manufacturing rule, chemical
constraint, design object, or AI task; that remains your product's domain.

The same separation also points toward future non-visible, machine-facing
information products. That direction is documented as a roadmap, not as a
supported Headless Core API in the current release.

## Choose your entry

Install `@asyra/core` when you want to compose from public Framework packages
without inheriting a UI framework or predefined domain behavior. Follow the
[custom composition guide](start/custom-composition.md) to select the current
browser/Core owners and optional capabilities deliberately.

Use [create-asyra-design-app](start/create-design-app.md) when you want a
complete design-tool product that you or an AI coding agent can use and extend.
It is a product-first route to real behavior: editing, hierarchy, transactions,
persistence, optional collaboration, and optional AI actions. It is one use of
the Framework, not its default product model or UI stack.

Use the [official 2D Preset](start/preset-2d.md) when you are building a visual
product from Framework packages and want Asyra's maintained design-tool
baseline.

Use a [custom composition](start/custom-composition.md) when you want to select
the information, interaction, rendering, persistence, collaboration, and AI
boundaries yourself.

These are complementary paths. Package-first guides teach how to compose Asyra
itself, while the generated design app provides a complete working product that
can be used and extended immediately.

## The owner model

Asyra stays extensible by assigning each concern one owner:

- your app owns domain schemas, product rules, commands, permissions, migration
  meaning, and service policy;
- Core coordinates public Framework capabilities and lifecycle;
- canonical packages own state, transactions, hierarchy, validation, and
  typed communication within their declared boundaries;
- Preset optionally installs an official, selectable design-tool baseline;
- Render projects canonical information without becoming its owner; and
- optional Collaboration and AI packages participate only when the app
  composes and configures them.

Start with [information models](learn/information-models.md), then follow one of
the maintained [Build guides](build/custom-schema.md). Every guide links to
advanced implementation guides and canonical source contracts; the website is a
presentation of these Markdown sources, not a second documentation owner.

## Current support

The initial release supports the current browser/Core composition and the
official `2D` Preset profile. Production `3D`, `HYBRID`, auto layout,
unit-aware aggregation, a public `createHeadlessCore()`, and an independent
Core Kernel are not current capabilities. See
[Support and release boundaries](reference/support-release.md) and
[Current runtime and future Core Kernel](learn/runtime-boundaries-roadmap.md).

## Learn from implementation guides

The task guides turn Framework verification knowledge into implementation
material: copyable public-API code, the module where it runs, the owner call
sequence, the observable result, and the failure or disabled path.

Begin with [information models](learn/information-models.md), then choose a
focused build guide for schemas, Feature sessions, persistence migration,
render-engine replacement, collaboration, or registered AI actions. Runtime
Atlas lets you operate six of those owner flows in the browser while the guides
explain how to implement them in a product.

## Canonical sources

- [Framework Essentials](../ai/framework/FRAMEWORK_ESSENTIALS.md)
- [Framework Architecture](../ai/framework/ARCHITECTURE.md)
- [Build guides](build/custom-schema.md)
