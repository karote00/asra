# Asyra Framework Website Program Plan

## Status

This is the umbrella plan for the public Asyra documentation and website
program. It defines product meaning, workstream ownership, dependencies, and
program-level acceptance. Detailed implementation belongs only to the child
plans listed below.

Public documentation and executable-example work may proceed in parallel with
release preparation when it does not delay or take ownership of release work.
Website UI implementation is queued by default until the stable Framework
packages and `create-asyra-design-app` contracts are publicly verifiable.
Starting UI implementation against a release candidate requires a separate
explicit user decision and one exact reviewed artifact set.

README renewal remains a separate mandatory release task. This program neither
owns nor completes the root, package, Asyra Design, CLI, or generated-app README
updates.

## Product Definition

Asyra is a deterministic execution kernel and modular infrastructure for
declarative information-modeling products. Products may be visual, headless,
or both. A machine-facing product may exist primarily so AI systems and other
app-owned services can retrieve information and execute registered actions
without any Render or UI dependency.

Asyra is not limited to design tools or canvas products. Apps may use it to
build design tools, whiteboards, BIM systems, VR experiences, industrial
digital twins, 4D simulations, AI-facing information systems, or domains not
anticipated by the Framework. These are possible app-owned domains, not
turnkey capabilities claimed by the initial Framework release.

The public story must preserve these ownership boundaries:

- Framework owns deterministic runtime contracts, transaction boundaries,
  canonical state owners, validation, registration, and replaceable provider
  or output boundaries without knowing the app domain.
- Preset owns selectable official public defaults and profile policy. Its
  current design-tool-oriented catalog is an optional public baseline, not
  Framework domain knowledge.
- Apps own domain knowledge, schemas, behavior, physical or business rules,
  search and index policy, permissions, workflows, backends, and custom
  engines.
- Human, UI, automation, AI, device, and external command intent enters the
  same Feature -> API -> canonical-state model. Rendering, UI, serialization,
  search, and other consumers are downstream projections or integrations.

## Program Goal

Deliver a distinctive, trustworthy public learning and product-evaluation
surface that:

- supports engineers, product teams, and non-engineers working with AI coding
  agents;
- offers `create-asyra-design-app` as the working-product beginner entry and
  small Framework examples as the kernel-learning entry;
- documents every public Framework package without turning README files into
  complete manuals;
- keeps supported examples executable and version-aligned;
- lets visitors operate and inspect the real Framework through the required
  Asyra Runtime Atlas;
- explains Asyra Design as a reference product without making it the semantic
  owner of Framework behavior; and
- distinguishes verified capabilities, app-owned possibilities, and roadmap
  work without overclaiming.

## Workstream Ownership

The program is split into seven independently reviewable child plans:

1. [Public Package Documentation](asyra-public-package-documentation-plan.md)
   owns durable public guides, information architecture, package reference,
   AI-readable content, and semantic case-study content.
2. [Executable Examples](asyra-executable-examples-plan.md) owns maintained
   sample code and the formal gates that prove documented flows still work.
3. [Visual Reimagine](asyra-website-visual-reimagine-plan.md) owns generated
   concepts, interaction and motion direction, responsive states, and the
   accepted visual specification before composed UI code.
4. [Website Platform and Documentation Experience](asyra-website-platform-and-docs-plan.md)
   owns the site workspace, content adapter, documentation shell, search,
   reference/release surfaces, and common web foundations.
5. [Landing Page and Product Narrative](asyra-website-landing-page-plan.md) owns
   the homepage implementation and its interactive product story.
6. [Asyra Runtime Atlas](asyra-runtime-atlas-plan.md) owns the real-runtime
   interactive lab, its six required executable cases, and runtime evidence.
7. [Launch and Operations](asyra-website-launch-and-operations-plan.md) owns
   Preview closure and, only after explicit authorization, production
   deployment and post-deployment verification.

Asyra Design does not require a separate child plan. The public-documentation
workstream owns its source-linked semantic case-study content; website
workstreams own presentation of that approved content.

## External Release Dependency

The separate release task owns all README updates and their generation paths,
including the root repository's no-issues and no-external-contributions
declaration. Release must not wait for the website, but it must not omit those
README updates.

This program may consume only reviewed public documentation and verified
manifest, artifact, registry, or deployment facts. If a required release fact
is not verifiable, the dependent website surface stops rather than editing the
release-owned README or inventing the fact.

## Shared Audience and Entry Paths

### Start from a working product

`create-asyra-design-app` is the recommended beginner entry for someone who
wants an immediately usable product foundation and will extend it directly or
with an AI coding agent. Public guides must show what is generated, which
services are optional or required for each flow, which behavior belongs to the
App versus Framework, and how to make one bounded extension through public
APIs.

### Learn the Framework

Small examples and the Runtime Atlas teach information modeling, intent
routing, ownership, transactions, validation, projection, and replaceable
boundaries without requiring the complete Asyra Design service stack.

### Compose a custom product

Experienced consumers may begin with public Framework packages, headless Core,
Preset `2D`, or profile `CUSTOM`. Headless products whose only consumers are
app-owned services, automation, or AI retrieval and actions remain first-class.

## Shared Preset Contract

- The current catalog provides eight design-tool-oriented defaults as an
  optional public baseline.
- `applyPreset(core)` provides the complete official quick-start default set.
- Apps may select only required defaults; Preset expands public dependencies
  deterministically and installs nothing outside that closure.
- `defaults: []` installs no official product defaults.
- Apps may remove relations, unregister complete capabilities, redefine the
  supported property-type boundary, and install replacements before the first
  `core.start()`.
- The supported `2D` profile binds the official Pixi provider; `CUSTOM` leaves
  engine ownership to the App.
- Preset never infers the app domain or becomes a second behavior owner.

## Cross-Plan Handoff Contract

- Canonical `docs/ai/framework/*` and `docs/ai/apps/asyra-design/*` contracts
  remain semantic authority; public pages curate them through explicit source
  mappings.
- Public package documentation supplies the approved semantic content bundle.
- Executable examples supply maintained code and machine-verifiable expected
  behavior. Public pages link to or extract from those examples rather than
  copy unsupported variants.
- Visual Reimagine supplies the accepted visual and motion specification. It
  cannot change product semantics.
- The site platform transforms approved content for presentation but cannot
  silently rewrite its meaning.
- Landing and Runtime Atlas consume the common platform and accepted visual
  direction without becoming owners of package or release facts.
- Launch and Operations accepts only a completed Preview; it cannot waive
  failed product, content, visual, accessibility, or runtime gates.
- Package versions, exports, support data, and release inventory derive from
  manifests, artifacts, and release records rather than hand-written prose.

## Program Sequence

1. Freeze the public positioning and the child-plan boundaries.
2. Build and verify public package documentation and executable examples.
3. Produce and accept the image-first visual reimagine and motion direction.
4. Freeze exact approved website toolchain versions and implement the common
   platform and documentation experience.
5. Implement Landing and Runtime Atlas as separate owner slices.
6. Integrate approved Asyra Design, release, roadmap, and support content.
7. Close a verified Preview across all workstreams.
8. Obtain explicit production-deployment authorization and execute the launch
   plan.

Before implementation of any child plan, that task must have its own thin
product/content contract, exact flow Inspector, executable product cases, and
bounded Definition of Done. One child plan cannot borrow another plan's
Inspector to authorize its edits.

## Program Quality Gates

- all child-plan acceptance gates pass against the same release inventory;
- every public behavior or support claim resolves to a canonical source;
- every supported code flow resolves to an executable maintained example or
  an approved API-reference source;
- no public runtime surface imports package-private source or unpublished
  package paths;
- visible, headless, Preset, App-owned domain, AI-assisted, and optional-system
  boundaries remain consistent across documentation, Landing, and Atlas;
- route, anchor, search, source mapping, version, and broken-link checks pass;
- keyboard, touch, focus, responsive, reduced-motion, contrast, performance,
  and synchronized visual-review gates pass;
- exact registry-only onboarding and clean-consumer flows pass before final
  public release claims; and
- the website program has not mutated or taken ownership of release README
  artifacts.

## Stop Conditions

- A child workstream has no exact owner, Inspector, executable cases, or bounded
  acceptance contract.
- Product language presents Asyra as only a canvas or design-tool framework,
  requires Render/UI for canonical behavior, or presents possible app domains
  as built-in Framework capabilities.
- Preset is presented as mandatory or as the owner of app domain behavior.
- Release-owned README or manifest facts require repair from inside a website
  workstream.
- A package version, CLI command, public URL, support statement, or release
  capability is not externally verifiable when publication depends on it.
- A workstream requires an unapproved dependency, hosted service, analytics,
  CMS, external asset license, binary, or runtime upgrade.
- Any implementation diverges from the accepted content or visual handoff.
- A required child or program gate fails.

## Definition of Done

- All seven child plans are complete against one verified release inventory.
- The public experience explains Asyra as infrastructure for visible and
  non-visible information-modeling products without overstating built-ins.
- Every public package has usable documentation and every supported tutorial
  flow is backed by maintained executable evidence.
- `create-asyra-design-app` and small Framework examples provide complementary
  beginner paths, including one AI-assisted bounded extension.
- Landing, documentation, examples, releases, roadmap, Asyra Design, and
  Runtime Atlas surfaces are responsive, accessible, visually accepted, and
  production-built.
- The Atlas proves real public intent, transaction, canonical owner,
  projection, optional-composition, failure, and headless paths.
- Preview closure passes before any production write.
- Production deployment is complete only after separate explicit authority and
  deployed verification; publication, tagging, and unrelated release actions
  remain separately authorized.
