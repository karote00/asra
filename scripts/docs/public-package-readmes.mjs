#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format } from 'prettier'

import { readApprovedReadmeInputs } from './public-readme-inputs.mjs'

const REPOSITORY_URL = 'https://github.com/karote00/asyra'

const PACKAGE_COPY = Object.freeze({
  'ai-agent-runtime': Object.freeze({
    description:
      'Optional orchestration for turning natural-language intent into registered, app-approved actions.',
    owns: [
      'provider requests and bounded action-batch validation',
      'permission, optional confirmation, ordered execution, progress, audit, and cleanup',
      'one app-supplied transaction-runner call around accepted executors'
    ],
    doesNotOwn: [
      'model vendors, credentials, app-domain actions, canonical state, Feature sessions, or transaction implementation'
    ],
    start:
      'Compose it only when an App has explicit action schemas, permissions, provider policy, and canonical action executors.',
    lifecycle:
      'Import and construction are inert. A run obtains bounded context, resolves registered actions, checks permission, optionally confirms, and executes through the App transaction runner. Invalid, denied, cancelled, aborted, or failed work applies no hidden canonical prefix.',
    code: "import { createAiAgentRuntime } from '@asyra/ai-agent-runtime'"
  }),
  collaboration: Object.freeze({
    description:
      'Optional provider-replaceable transport for completed Factory publications and separate ephemeral Awareness.',
    owns: [
      'explicit connection lifecycle and FIFO publication handoff',
      'exclusive inbound callback delivery, provider outcomes, Awareness, and owned-resource cleanup'
    ],
    doesNotOwn: [
      'canonical documents, payload validation, permissions, conflict policy, durable outboxes, checkpoints, or backend storage'
    ],
    start:
      'Compose it when an App already owns immutable Factory publications, a provider, and a validated canonical remote-apply route.',
    lifecycle:
      'Construction is inert. `start()` connects and subscribes; connected publications are sent once in FIFO order. Disconnected publications are skipped, not retained. `dispose()` releases only resources the composition owns.',
    code: "import { createCollaboration, MemoryHub, MemoryProvider } from '@asyra/collaboration'"
  }),
  core: Object.freeze({
    description:
      'Strict public composition facade and lifecycle coordinator for current Asyra Framework capabilities.',
    owns: [
      'composition closure, startup ordering, readiness, teardown, load coordination, and curated package facades',
      'one pre-start render-engine provider and engine-neutral default adapter'
    ],
    doesNotOwn: [
      'App-domain rules, UI presentation, concrete engine resources, backend policy, permissions, or the future Core Kernel'
    ],
    start:
      'Use Core for supported App composition and extensions that cross canonical package owners. Register composition before the first `core.start(...)`.',
    lifecycle:
      'Startup validates and closes composition, initializes required runtime owners, loads canonical data, and publishes ready only after success. A failure tears down owned work and never reports false readiness. The current no-provider compatibility branch is not a public Headless lifecycle.',
    code: "import core from '@asyra/core'"
  }),
  'design-system': Object.freeze({
    description:
      'Optional reusable React presentation components for product interfaces; it is not part of the Core execution kernel.',
    owns: [
      'maintained React components, component accessibility behavior, icon names, and package styles'
    ],
    doesNotOwn: [
      'Core, transactions, canonical documents, input normalization, canvas rendering, or App command policy'
    ],
    start:
      "Use it when a React App wants Asyra's maintained UI pieces. A custom product may use another design system without changing Framework behavior.",
    lifecycle:
      'Components consume ordinary React props and emit UI intent callbacks. Temporary focus, measurement, dismissal, and portal state remain presentation concerns; canonical mutations stay behind App Features and APIs.',
    code: "import { Button } from '@asyra/design-system'\nimport '@asyra/design-system/index.css'"
  }),
  factory: Object.freeze({
    description:
      'Canonical transaction grouping, rollback, Undo/Redo history, replay, and local shared-publication infrastructure.',
    owns: [
      'the active transaction journal, one outer commit, validation, rollback, history, replay, and publication evidence'
    ],
    doesNotOwn: [
      'product command meaning, package invariants, persistence durability, collaboration transport, or App conflict policy'
    ],
    start:
      'Use Factory whenever one intended canonical action needs atomicity, rollback, history, or shared publication. Core already coordinates the common App instance.',
    lifecycle:
      'Nested starts join one outer journal. A valid outer end creates at most one Undo entry; failure or rejected validation runs inverses in reverse order. Undo/Redo replays owner-issued evidence without creating a parallel mutation route.',
    code: "import factory from '@asyra/factory'"
  }),
  'feature-system': Object.freeze({
    description:
      'Deterministic Feature registration, priority, exclusivity, interaction sessions, cancellation, and non-mutating programmatic tasks.',
    owns: [
      'Feature definitions, trigger arbitration, one serialized interaction queue, sessions, cancellation policy, and task abort ownership'
    ],
    doesNotOwn: [
      'raw environment listeners, App command meaning, canonical package mutation, transaction history, or model-provider policy'
    ],
    start:
      'Compose it when inputs or commands require deterministic arbitration, a continuous session, or cancellable planning work.',
    lifecycle:
      'A session starts, updates, and then ends or cancels before conflicting work. Cancellation is explicit; handler errors and timeouts enter forced cleanup. Programmatic tasks are non-mutating and never replace canonical Feature/API execution.',
    code: "import { defineFeature, getFeature } from '@asyra/feature-system'"
  }),
  'input-system': Object.freeze({
    description:
      'Environment-neutral semantic input registration with explicit browser host attachment.',
    owns: [
      'normalized keyboard, pointer, wheel, and mapped-event routing',
      'instance-owned browser attachment, switching, detach, reset, and disposal'
    ],
    doesNotOwn: [
      'Feature decisions, scene mutations, render-layer behavior, context-menu policy, or unconditional native-menu suppression'
    ],
    start:
      'Import or construct it without browser globals; attach a browser host only when the runtime actually needs browser input.',
    lifecycle:
      'Attachment adds listeners to the selected host and target. Reattachment is idempotent and target switching removes prior listeners first. `reset()` preserves attachment; `dispose()` detaches and clears transient state. Node-safe construction does not imply Headless Core support.',
    code: "import inputSystem, { keyMap } from '@asyra/input-system'"
  }),
  persistence: Object.freeze({
    description:
      'Read-only load-source, replaceable provider, and synchronous load/save hook contracts with browser and memory references.',
    owns: [
      'load-source/provider contracts, synchronous hook types, and explicit IndexedDB, Local Storage, and memory provider behavior'
    ],
    doesNotOwn: [
      'Core save scheduling, canonical validation/apply, App version policy, collaboration logs, authorization, or production topology'
    ],
    start:
      'Compose a provider when the App needs a local or custom storage boundary; treat reference providers as examples rather than production backend policy.',
    lifecycle:
      '`load()` returns untrusted data. App migration and Core/package validation happen before canonical apply. Provider failure remains separate from runtime transaction settlement, and explicit save data goes only where the App sends it.',
    code: "import type { DocumentLoadSource } from '@asyra/persistence'"
  }),
  preset: Object.freeze({
    description:
      'Optional official design-tool baseline with selectable defaults and render profile policy.',
    owns: [
      'strict profile/default resolution, dependency expansion, deterministic installation, official defaults, and current `2D` provider selection'
    ],
    doesNotOwn: [
      'Core lifecycle, App-domain behavior, UI command policy, custom-engine implementation, or unavailable production profiles'
    ],
    start:
      'Apply all defaults, select only the defaults you need, choose `CUSTOM`, or omit Preset for a fully custom product.',
    lifecycle:
      'Preset validates the full selection, installs in catalog order, optionally binds the profile provider, and returns a frozen result. It never starts Core. Failed installation rolls back owned work; an empty defaults list installs nothing.',
    code: "import { applyPreset } from '@asyra/preset'"
  }),
  'props-manager': Object.freeze({
    description:
      'Canonical property definitions, values, property-child graph, validation, and registration lifecycle.',
    owns: [
      'property type definitions, schemas/defaults, runtime values, child relations, and prepared atomic mutation artifacts'
    ],
    doesNotOwn: [
      'scene hierarchy, UI controls, render projection, App-domain meaning, document migration, or presentation fallbacks'
    ],
    start:
      'Use it for structured canonical component properties and validation; use Core for cross-owner element/property operations.',
    lifecycle:
      'Complete definitions validate before publication. Runtime writes reject invalid explicit values before mutation. Prepared mutations are instance-bound, registration-bound, one-shot artifacts; stale, reused, foreign, or invalid artifacts fail before apply.',
    code: "import propsManager from '@asyra/props-manager'"
  }),
  'reactive-events': Object.freeze({
    description:
      'Typed cross-package communication, transaction-owner routing, persistence signals, and cooperative settlement primitives.',
    owns: [
      'typed event registration/publication/subscription, package-neutral payload contracts, transaction-owner routing, and cooperative host-yield policy'
    ],
    doesNotOwn: [
      'canonical package state, App command policy, a second transaction journal, renderer output, or provider networking'
    ],
    start:
      'Use typed routes when packages must communicate without transferring ownership. Apps normally prefer Core or App facades over low-level publication.',
    lifecycle:
      'Register stable definitions before use and release exact subscriptions. Missing owners, duplicate definitions, subscriber failure, or failed settlement stays explicit; no event fallback may mutate another package directly.',
    code: "import { eventRegistry } from '@asyra/reactive-events'"
  }),
  render: Object.freeze({
    description:
      'Engine-neutral projection, layers, strategies, interaction bridges, viewport orchestration, and demand-driven frames.',
    owns: [
      'canonical-to-render projection, render registration, provider lifecycle through the abstract contract, interaction mapping, resources, and frame orchestration'
    ],
    doesNotOwn: [
      'canonical documents, App Feature decisions, concrete SDK objects, Preset provider policy, or patch output for upstream bugs'
    ],
    start:
      'Compose it when canonical information needs visual projection or engine-backed interaction. Register strategies, layers, and targets before startup.',
    lifecycle:
      'Initialization validates and activates the selected provider. Dirty work requests one frame and explicit flush produces output. Provider, strategy, layer, interaction, resource, or cleanup failures remain explicit and never fall through to another engine.',
    code: "import { RenderAdapter, RenderGraphics } from '@asyra/render'"
  }),
  'render-engine': Object.freeze({
    description:
      'Engine-independent contract shared by Render, official engines, and custom provider implementations.',
    owns: [
      'engine/surface lifecycle, semantic commands and queries, opaque handles, normalized interactions, capabilities, errors, and conformance tools'
    ],
    doesNotOwn: [
      'a concrete SDK, canonical subscriptions, render layers, Feature policy, a default singleton, or unimplemented production modes'
    ],
    start:
      'Implement the contract when your App or package supplies a rendering engine; keep Render consumers dependent on this abstraction.',
    lifecycle:
      '`initialize(...)` may be asynchronous; command, query, destroy, and explicit frame flush behavior remains deterministic. Missing capabilities reject through structured errors instead of SDK-specific fallback.',
    code: "import type { RenderEngineProvider } from '@asyra/render-engine'"
  }),
  'render-engine-pixi': Object.freeze({
    description:
      'Official optional Pixi implementation of the public Render Engine contract for the current `2D` profile.',
    owns: [
      'Pixi application, surface, objects, resources, ticker, event normalization, abstract command translation, flush, and cleanup'
    ],
    doesNotOwn: [
      'Render subscriptions, Framework target mapping, canonical state, App Feature policy, custom-engine inspection, or fallback routing'
    ],
    start:
      'Use it through Preset `2D` or explicitly provide it in a browser composition. Apps with another engine do not import this package.',
    lifecycle:
      'Initialization creates one owned Pixi runtime behind opaque handles. Frame callbacks schedule and explicit flush renders. Destruction releases all owned objects and resources; partial initialization failure cleans up and never reports ready.',
    code: "import { createPixiRenderEngine } from '@asyra/render-engine-pixi'"
  }),
  'scene-tree': Object.freeze({
    description:
      'Canonical entity graph, parent/child hierarchy, identity, element/property relations, serialization, and local computed projection.',
    owns: [
      'entity lifecycle, hierarchy/order, relation indexes, batch-only local computed projection, and prepared atomic hierarchy artifacts'
    ],
    doesNotOwn: [
      'property definitions, UI policy, render objects, App Group command meaning, or computed data as canonical/shared/history state'
    ],
    start:
      'Use it for canonical entity and hierarchy products; coordinate property relations and cross-owner work through Core.',
    lifecycle:
      'Batches validate identity, membership, cycles, order, relations, and staleness before mutation. Prepared artifacts are instance-bound and one-shot. Local computed projection remains derived and never enters history, collaboration publication, or persistence.',
    code: "import sceneTree from '@asyra/scene-tree'"
  }),
  selection: Object.freeze({
    description:
      'Canonical named selection-channel state and explicit selection queries and operations.',
    owns: [
      'selected entity ids per registered channel plus deterministic replace, add, remove, clear, and query semantics'
    ],
    doesNotOwn: [
      'tool decisions, App eligibility, render overlays, entity mutation, UI state, or automatic builtin channel registrations'
    ],
    start:
      'Register the selection channels your product needs, or use the optional official defaults installed by Preset.',
    lifecycle:
      'Registration creates stable channel metadata. Selection operations update only that channel; duplicate or unknown registration and invalid input fail explicitly. Removing projection packages does not transfer selection ownership to UI state.',
    code: "import selection from '@asyra/selection'"
  }),
  'system-context': Object.freeze({
    description:
      'Registered managed global/runtime properties for modes, viewport values, and App/system flags.',
    owns: [
      'managed property registration, validation, observable values, snapshots, persistence eligibility, and one-shot load artifacts'
    ],
    doesNotOwn: [
      'entity graphs, component properties, UI binding, render output, default event subscriptions, or App command policy'
    ],
    start:
      'Use it for small global values that are not entity/property graph data. Define value, validation, and runtime-only policy before use.',
    lifecycle:
      'Runtime writes validate before update. Load produces an instance-bound artifact that applies once without validator replay. Missing, foreign, stale, reused, or invalid artifacts fail before mutation; runtime-only values remain outside persistence.',
    code: "import systemContext from '@asyra/system-context'"
  }),
  'ui-context': Object.freeze({
    description:
      'Optional derived UI-property registration and aggregation runtime.',
    owns: [
      'derived property definitions, compute callbacks, managed observables, aggregate/mixed/empty semantics, and cleanup'
    ],
    doesNotOwn: [
      'canonical model state, mirror stores, automatic controls, field mappings, App command policy, or polling-based recompute'
    ],
    start:
      'Use it when panels and controls need reusable derived values. A custom App may derive directly from public owner subscriptions.',
    lifecycle:
      'Registration creates one managed derived source; canonical dependency changes request recompute and only the final derived value is published. Compute failure is a UI derivation failure and cannot replace or roll back canonical state.',
    code: "import uiContext from '@asyra/ui-context'"
  }),
  utils: Object.freeze({
    description:
      'Pure shared types, ids, geometry and numeric helpers, registries, registration graph primitives, and diagnostics dispatch.',
    owns: [
      'neutral low-level types, id helpers, pure calculations, shared registries, structured registry errors, and low-level diagnostics primitives'
    ],
    doesNotOwn: [
      'runtime business policy, startup side effects, canonical App state, rendering, Feature decisions, or domain-specific meaning'
    ],
    start:
      'Import a public type or pure primitive when multiple Framework owners need the neutral contract; keep App-domain helpers in the App.',
    lifecycle:
      'Pure helpers return detached deterministic values. Registries own explicit registration and reverse-order retryable cleanup. Importing Utils creates no listener, timer, or mutable product runtime.',
    code: "import { isRecord } from '@asyra/utils'"
  })
})

const bulletList = (values) => values.map((value) => `- ${value}`).join('\n')

const packageReadme = async (packageRecord) => {
  const copy = PACKAGE_COPY[packageRecord.directory]
  if (!copy) {
    throw new Error(`Missing package README copy for ${packageRecord.name}`)
  }
  const guideUrl = `${REPOSITORY_URL}/blob/main/${packageRecord.guide.path}`
  const exampleLinks = packageRecord.examples
    .map(
      (example) =>
        `- [${example.title}](${REPOSITORY_URL}/blob/main/${example.source}) — \`${example.runCommand}\``
    )
    .join('\n')

  return format(
    `# \`${packageRecord.name}\`

${copy.description}

## Requirements

- Node.js 24.x
- Yarn 4.3.1 for this repository's maintained workflows

## Install

\`\`\`bash
npm install ${packageRecord.name}
\`\`\`

\`\`\`ts
${copy.code}
\`\`\`

Use only the package root and the explicitly documented public subpaths.

## Owns

${bulletList(copy.owns)}

## Does not own

${bulletList(copy.doesNotOwn)}

## Start here

${copy.start}

## Lifecycle and composition

${copy.lifecycle}

## Learn more

- [Complete package guide](${guideUrl})
${exampleLinks}
- [Framework release support](${REPOSITORY_URL}/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](${REPOSITORY_URL}/blob/main/LICENSE).
Follow the [security policy](${REPOSITORY_URL}/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](${REPOSITORY_URL}) for the
current support boundary.
`,
    {
      parser: 'markdown',
      semi: false,
      singleQuote: true,
      trailingComma: 'none'
    }
  )
}

export const generatePublicPackageReadmes = async ({ repositoryRoot }) => {
  const root = path.resolve(repositoryRoot)
  const inputs = await readApprovedReadmeInputs({ repositoryRoot: root })
  const expectedDirectories = new Set(
    inputs.packages.map(({ directory }) => directory)
  )
  const copyDirectories = Object.keys(PACKAGE_COPY)
  if (
    copyDirectories.length !== expectedDirectories.size ||
    copyDirectories.some((directory) => !expectedDirectories.has(directory))
  ) {
    throw new Error(
      'Package README copy inventory does not match the release inventory'
    )
  }
  const readmes = await Promise.all(
    inputs.packages.map(async (packageRecord) =>
      Object.freeze({
        content: await packageReadme(packageRecord),
        path: packageRecord.readmePath
      })
    )
  )
  return Object.freeze(readmes)
}

export const writePublicPackageReadmes = async ({ repositoryRoot }) => {
  const root = path.resolve(repositoryRoot)
  const readmes = await generatePublicPackageReadmes({ repositoryRoot: root })
  readmes.forEach((readme) => {
    fs.writeFileSync(path.join(root, readme.path), readme.content)
  })
  return readmes.length
}

export const checkPublicPackageReadmes = async ({ repositoryRoot }) => {
  const root = path.resolve(repositoryRoot)
  const readmes = await generatePublicPackageReadmes({ repositoryRoot: root })
  const stale = readmes
    .filter(
      (readme) =>
        fs.readFileSync(path.join(root, readme.path), 'utf8') !== readme.content
    )
    .map(({ path: readmePath }) => readmePath)
  if (stale.length > 0) {
    throw new Error(`Stale package READMEs: ${stale.join(', ')}`)
  }
  return readmes.length
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectInvocation) {
  const mode = process.argv[2]
  if (!['--check', '--write'].includes(mode) || process.argv.length !== 3) {
    throw new Error(
      'Usage: node scripts/docs/public-package-readmes.mjs --check|--write'
    )
  }
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..'
  )
  const count =
    mode === '--write'
      ? await writePublicPackageReadmes({ repositoryRoot })
      : await checkPublicPackageReadmes({ repositoryRoot })
  process.stdout.write(`Public package READMEs ${mode.slice(2)}: ${count}\n`)
}
