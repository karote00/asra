# Asyra

## Build product features, not infrastructure

Asyra is a composable Framework for products whose information must stay
editable, reversible, inspectable, persistable, and extensible. Use it to build
canvas-based editors, whiteboards, BIM workspaces, industrial tools,
simulations, and other domain products without coupling domain rules to one
renderer or UI framework.

Your App owns its product schemas, rules, workflows, services, and UI. Asyra
coordinates the shared infrastructure around them: intent routing,
registration, transactions, rollback, Undo/Redo, validation, persistence
boundaries, and downstream projections.

[Try Asyra Design](https://asyra-design.vercel.app/?fileId=demo) ·
[Read the documentation](docs/public/index.md) ·
[Install `@asyra/core`](#package-first-composition) ·
[Create an Asyra Design app](#complete-design-product)

## Try the demo

[Asyra Design](https://asyra-design.vercel.app/?fileId=demo) is the maintained,
complete design-tool product in this repository. It demonstrates App-owned
Features, editable information, the official `2D` Preset, rendering, Undo/Redo,
persistence, and explicit optional AI and collaboration composition on the
current browser/Core runtime.

The product UI and design-domain behavior belong to the App; they are not
silently installed by Framework Core. Follow the
[Asyra Design case study](docs/public/cases/asyra-design.md) from startup and
canonical state through rendering, transactions, persistence, collaboration,
and registered AI actions.

## One product behavior, one explicit owner

A conventional product often reconnects the same behavior across several
independent paths. An Asyra Feature keeps the App's decision in one explicit
owner and routes accepted work through established correctness boundaries.

| Reader question                       | Conventional product                                                      | With Asyra                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Where does intent enter?              | UI, shortcuts, automation, and AI may each grow a separate handler.       | Human, UI, automation, device, and AI intent enter an App-owned Feature or its API.                             |
| Who owns the write?                   | UI state, service code, and saved data can each appear authoritative.     | The Feature calls an App or Framework API; the canonical package owner performs the write.                      |
| How is failure handled?               | Validation, rollback, and cleanup are rebuilt around each caller.         | The same transaction, validation, and rollback boundaries apply to every caller.                                |
| What reaches the rest of the product? | Rendering, history, persistence, and synchronization need custom bridges. | Canonical changes feed History, projections, serialization, and App services through their declared boundaries. |

This is a behavior-ownership promise, not a claim that every product change
fits in one file. Large Features can have multiple focused modules while still
retaining one governed path.

## A real App-owned Feature

Asyra Design's Undo/Redo Feature is deliberately small. The App owns the
shortcut meaning and calls its own common API; `defineFeature` provides the
registered intent boundary:

```ts
import { defineFeature } from '@asyra/core'
import { historyApis } from '../../common-apis'
import { FeatureNames, InputSystemEvents } from '../../constants'
import type { SystemContextSnapshot } from '@asyra/utils'

export const undoRedoFeature = defineFeature(
  FeatureNames.UNDO_REDO,
  InputSystemEvents.INPUT_SHORTCUT_UNDOREDO,
  {
    priority: 100,
    exclusive: true,
    execution: async (snapshot: SystemContextSnapshot) => {
      if (snapshot.keyShift) {
        await historyApis.redo()
        return { redid: true }
      } else {
        await historyApis.undo()
        return { undid: true }
      }
    }
  }
)
```

- **The App owns meaning:** which input invokes Undo or Redo and which common
  API performs it.
- **The Framework supplies the boundary:** registration, priority, exclusivity,
  transaction replay, and lifecycle remain governed instead of caller-specific.
- **Other callers reuse the path:** UI, automation, or approved AI behavior can
  reach the same App API without creating another history owner.

For the complete lifecycle, failure, cancellation, rollback, and cleanup
contract, follow [Build a transaction-safe Feature](docs/public/build/feature-session.md).

## Choose your starting point

### Package-first composition

Choose this path when you want to model your own product deliberately or are
building something other than a design tool. `@asyra/core` is the public
composition facade for the current browser/Core runtime and does not impose a
UI framework or predefined product behavior.

```bash
npm install @asyra/core
```

Asyra is published as 19 public `@asyra/*` ESM packages. Required package
dependencies install automatically; Preset, Collaboration, AI, Design System,
and concrete rendering providers remain optional composition choices.

Continue with:

- [Custom composition](docs/public/start/custom-composition.md)
- [Model product information first](docs/public/learn/information-models.md)
- [Define an App-owned component and schema](docs/public/build/custom-schema.md)
- [Build a transaction-safe Feature](docs/public/build/feature-session.md)

### Complete design product

Choose this path when you want an immediately editable design-tool product and
will replace or extend its App-owned Features, schemas, services, and UI.

```bash
npx create-asyra-design-app my-product --package-manager=npm
cd my-product
npm run start
```

The CLI supports Yarn, npm, or pnpm. It installs the project dependencies and
prints the exact start command for the selected package manager. The generated
project is ordinary source code with bounded extension guidance for humans and
AI coding agents. See [`create-asyra-design-app`](create-app/asyra-design/README.md).

## How Asyra works

```mermaid
flowchart TD
  intent["Human / UI / automation / AI / device intent"]
  feature["App-owned Feature"]
  api["App or Framework API"]
  transaction["Transaction and validation boundary"]
  state["Canonical state owner"]
  projections["Render / UI / serialization / App services"]

  intent --> feature --> api --> transaction --> state --> projections
```

Loading, Undo/Redo replay, and accepted remote changes are state-application
paths. They run through migration, validation, conflict policy, and canonical
apply owners rather than becoming parallel product-decision runtimes.

### Ownership boundaries

- **Framework** owns deterministic runtime contracts, transactions, rollback,
  canonical state owners, validation, registration, and replaceable provider
  or output boundaries. It does not know the App's domain.
- **Preset** owns selectable official defaults and profile policy. Its current
  catalog is design-tool-oriented because it is the public baseline, not
  because design behavior belongs in Framework Core.
- **App** owns schemas, domain behavior, physical or business rules, workflows,
  permissions, search and index policy, custom engines, services, and product UI.
- **Backend or external services** own transport, authorization, durability,
  model-provider, and operational policy without becoming a second canonical
  product owner.

## Where Asyra can go

### Built and demonstrated today

The maintained Asyra Design product proves the current browser/Core
composition, official `2D` Preset, engine-neutral `CUSTOM` extension boundary,
editable canonical information, App-owned Features, rendering, Undo/Redo,
persistence contracts, and explicit optional collaboration and AI paths.

### Compose your domain

An App can bring the information, rules, engines, services, and workflows for a
whiteboard, BIM product, industrial digital twin, simulation, research tool, or
another domain. The reusable part is the ownership, transaction, validation,
projection, and persistence infrastructure—not hidden industry knowledge.

### Not turnkey modules

Asyra does not bundle BIM models, industrial rules, simulation engines, or
other industries' domain behavior. Production `3D`, `HYBRID`, auto-layout,
unit-aware aggregation, public Headless Core, and a multi-runtime Core Kernel
are not current capabilities.

## Current support

Current public support covers Node.js 24.x for package verification, public ESM
entrypoints with TypeScript declarations, the browser/Core composition, the
official `2D` Preset, and engine-neutral `CUSTOM` composition. Import safety in
Node does not establish a supported Headless Core or server/worker lifecycle.

- [Public support and release guide](docs/public/reference/support-release.md)
- [Runtime-boundaries roadmap](docs/public/learn/runtime-boundaries-roadmap.md)

## Documentation

- [Public documentation](docs/public/index.md) — Start, Concepts, Extend,
  Customize, Reference, and the Asyra Design case study.
- [Asyra Design case study](docs/public/cases/asyra-design.md) — one complete
  product's Framework, Preset, App, and backend ownership.
- [AI-readable discovery](docs/public/llms.txt) — the stable public page
  inventory for retrieval and coding agents.
- [Security policy](SECURITY.md) — private reporting for sensitive issues.

## Support and contribution policy

Asyra is publicly available for use, learning, inspection, and forking.

**This repository does not accept external issues or contributions, including
pull requests.**

The codebase is intentionally curated as one cohesive reference implementation
for Communication-Driven Development and AI-assisted workflows.

For security-sensitive reports, follow [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
