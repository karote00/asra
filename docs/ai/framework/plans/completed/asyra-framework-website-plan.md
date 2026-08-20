# Asyra Framework Website Program Plan

## Status

Completed on August 10, 2026. All nine child workstreams passed their bounded
gates and merged through PRs #116–#125 into the public-release integration
branch. The accepted outcome includes synchronized README and package docs,
maintained executable examples, the Material Blueprint visual direction, the
website platform, Landing, Runtime Atlas, and the verified production launch at
`https://asyra-framework.vercel.app`.

This completed umbrella record retains the product meaning, workstream
ownership, dependencies, and program-level acceptance used for implementation.
Detailed implementation remains in the child plans listed below.

The user selected one integrated release train: README alignment, public
documentation, examples, visual design, website implementation, release
verification, and website launch progress through explicit handoffs and share
one final completion decision. README work is not a standalone prerequisite
that must finish before the other workstreams begin.

Website UI implementation may begin before registry publication after the
content, executable-example, and visual handoffs are frozen against one exact
reviewed release candidate. Final public versions, commands, URLs, and support
claims remain generated or provisional until their public owners are verified.

## Product Definition

Asyra is deterministic, modular infrastructure for declarative
information-modeling products. The initial release supports the verified
browser/Core composition and visual product paths. Its long-term direction also
includes non-visible, machine-facing products built so AI systems and other
app-owned services can retrieve information and execute registered actions.
That direction is not yet a public Headless Core or Core Kernel runtime: public
content must not claim a Node startup lifecycle, no-Render/UI dependency graph,
or multi-runtime isolation before those contracts exist.

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

The program is split into nine independently reviewable child plans:

1. [Input System Environment Neutrality](../input-system-environment-neutrality-plan.md)
   owns DOM-neutral Input/Core imports, explicit browser listener lifecycle,
   and preservation of existing visual input activation. It must pass PR CI and
   direct product-owner testing before merge.
2. [Public README and Entrypoint Alignment](../asyra-public-readme-and-entrypoint-alignment-plan.md)
   owns the root, package, Asyra Design, CLI, and generated-app README release
   surfaces through their canonical owners and generation paths.
3. [Public Package Documentation](../asyra-public-package-documentation-plan.md)
   owns durable public guides, information architecture, package reference,
   AI-readable content, and semantic case-study content.
4. [Executable Examples](../asyra-executable-examples-plan.md) owns maintained
   sample code and the formal gates that prove documented flows still work.
5. [Visual Reimagine](asyra-website-visual-reimagine-plan.md) owns generated
   concepts, interaction and motion direction, responsive states, and the
   accepted visual specification before composed UI code.
6. [Website Platform and Documentation Experience](../asyra-website-platform-and-docs-plan.md)
   owns the site workspace, content adapter, documentation shell, search,
   reference/release surfaces, and common web foundations.
7. [Landing Page and Product Narrative](../asyra-website-landing-page-plan.md) owns
   the homepage implementation and its interactive product story.
8. [Asyra Runtime Atlas](../asyra-runtime-atlas-plan.md) owns the real-runtime
   interactive lab, its six required executable cases, and runtime evidence.
9. [Launch and Operations](../asyra-website-launch-and-operations-plan.md) owns
   Preview closure and, only after explicit authorization, production
   deployment and post-deployment verification.

Asyra Design does not require a separate child plan. The public-documentation
workstream owns its source-linked semantic case-study content; website
workstreams own presentation of that approved content.

## Integrated Release Ownership

README alignment is a sibling workstream inside this program, not an early
one-off task. Its child plan coordinates each README through the correct root,
package, App, CLI, or generator owner and must preserve the root repository's
no-issues and no-external-contributions declaration.

Framework package publication remains owned by
[Framework Package Patch Release](../framework-package-patch-release-plan.md).
Applicable CLI publication and generated-app proof must use a new bounded
release execution that follows the retained
[create-asyra-design-app release contract](create-asyra-design-app-release-plan.md)
and its Inspector. Root family alignment remains a later separately authorized
release stage. This program coordinates their handoffs but does not redefine or
inherit their external-write authority.

Before public verification, the site may consume one exact release-candidate
inventory clearly marked as provisional. After publication, generated public
facts must be reconciled against registry and deployment owners before the
production website can launch.

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

Experienced consumers may begin with public Framework packages, Preset `2D`, or
profile `CUSTOM` to compose a product around current public contracts.
Non-visible products whose consumers are app-owned services, automation, or AI
retrieval/actions remain an important future direction; the website must route
that topic to the Roadmap instead of inventing a current Headless API.

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
- Public README alignment supplies concise entry surfaces and stable links into
  the accepted documentation and examples; it does not duplicate full guides.
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

## Branch and Integration Strategy

The program uses one long-lived integration feature branch:

- `codex/asyra-public-release-program`

This branch was created from the latest accepted `origin/main` and owns the
umbrella plan, cross-workstream integration, shared Release Candidate state,
and final program gates. It is not an implementation free-for-all: child-plan
edits land only through their own reviewed branches.

Each child task receives a new branch from the latest validated integration-
branch checkpoint:

1. `codex/asyra-public-release-input-system`
2. `codex/asyra-public-release-readme`
3. `codex/asyra-public-release-docs`
4. `codex/asyra-public-release-examples`
5. `codex/asyra-public-release-visual-reimagine`
6. `codex/asyra-public-release-site-platform`
7. `codex/asyra-public-release-landing`
8. `codex/asyra-public-release-runtime-atlas`
9. `codex/asyra-public-release-launch`

Create a child branch only when that child task begins. Never reuse a completed
or merged child branch for a later task. If a child needs multiple bounded
implementation segments, keep them as reviewable commits on that same child
branch while it remains the active owner task.

### Integration Rules

- Before forking each dependency batch, fetch `origin/main` and integrate the
  latest accepted main state into the integration branch. The child then bases
  on that exact validated integration checkpoint, not on stale main and not on
  a sibling branch.
- A child branch may modify only its plan-owned implementation boundary and
  direct required contracts/tests.
- Every completed child branch opens a PR targeting
  `codex/asyra-public-release-program`, never directly targeting `main`.
- A child never merges another child directly. Shared outputs first land in the
  integration branch; dependent children start from or synchronize with the
  resulting accepted integration checkpoint.
- If the integration branch advances while a child remains active, merge the
  updated integration branch into that child before its final gates. Do not
  rewrite shared history or force-push to simulate a clean base.
- After each child merge, run the bounded integration gates for its declared
  downstream consumers before forking or advancing dependent work.
- External writes such as npm publication, tags, pushes, domain mutation, or
  website deployment remain separately authorized and do not occur merely
  because a child merged.
- After all children land, synchronize the integration branch with the latest
  accepted `origin/main`, rerun the complete program gates, and only then open
  or merge the final integration PR into `main` through the user-authorized
  repository workflow.

### Pull Request Policy

- Before the first child PR, publish the integration branch to the remote only
  after explicit push authorization. A remote child PR cannot target a parent
  branch that exists only locally.
- A child may open as Draft after its bounded contract and branch are ready.
  Mark it Ready only after the child plan's focused gates, staged-diff review,
  and handoff evidence pass.
- Every child PR uses `codex/asyra-public-release-program` as its base branch.
  The integration branch uses `main` as its base only for the final program PR.
- Use a normal PR merge commit by default so the child commits and PR boundary
  remain traceable. Squash, rebase, force-push, or history rewrite requires a
  separate explicit decision.
- A local merge may be used only on a disposable verification branch to test
  integration. It is not accepted as the completed child integration and must
  not replace the child PR, CI, review, or merge record.
- After a child PR merges, fast-forward the local integration branch from its
  remote owner, run the bounded integration gates, and use that accepted commit
  as the base for dependent children.
- Integration-only corrections may commit directly to the integration branch
  only when they are owned by the umbrella integration contract, do not belong
  to a child implementation boundary, and pass their focused gates. They must
  not become a route for bypassing child PR review.
- Pushing a parent or child branch, creating a PR, and merging a PR remain
  separate external operations and require the applicable user authorization.

### Dependency Batches

1. Runtime prerequisite: Input System Environment Neutrality lands only after
   its focused, integration, PR CI, and product-owner direct-test gates pass.
   No downstream workstream may turn Node-safe import into a Headless/Core
   Kernel support claim.
2. Foundation batch: README, Public Documentation, Executable Examples, and
   Visual Reimagine may progress in parallel after their shared contract is
   frozen. Examples must land before the final README/documentation content
   freeze; accepted Visual Reimagine must land before composed UI work.
3. Platform batch: Website Platform begins from the accepted foundation
   checkpoint.
4. Product-surface batch: Landing and Runtime Atlas begin from the accepted
   platform checkpoint and may progress in parallel.
5. Launch batch: Launch and Operations begins only after all eight upstream
   children and the integrated pre-publication Release Candidate pass.

## Integrated Release Train Sequence

### Phase 1: Freeze the shared public contract

- Freeze positioning, audience, package inventory, public entry paths,
  canonical sources, stable documentation routes, and child-plan ownership.
- Freeze one release-candidate identity without publishing or inventing final
  registry facts.

### Phase 2: Build the evidence foundation

- Complete and directly accept the Input System environment prerequisite before
  examples or content freeze browser lifecycle and Node-import claims.
- Inventory and prove the executable examples required by README and public
  guides.
- Freeze documentation metadata, source mapping, link conventions, and the
  visual brief.

### Phase 3: Run content and visual work in parallel

- Draft and verify all README entry surfaces against the same examples and
  public API inventory.
- Author public package guides, tutorials, AI-readable content, and the Asyra
  Design semantic case study.
- Complete image-first Visual Reimagine, responsive states, motion storyboard,
  visual inspection, and user acceptance.

README and full documentation remain separate owners, but cross-links and
terminology are reviewed together. Neither workstream waits for the other to be
fully complete before beginning.

### Phase 4: Freeze the integrated content candidate

- Verify README, public docs, examples, canonical sources, generated version
  inputs, and visual handoff as one internally consistent candidate.
- Regenerate generated-app README/output only through the canonical release
  generator after its source README is final for the candidate.

### Phase 5: Implement the common website platform

- Freeze exact approved toolchain versions.
- Implement content ingestion, documentation shell, navigation, local search,
  Examples, Asyra Design, Releases, and Roadmap surfaces against the candidate.

### Phase 6: Implement Landing and Runtime Atlas in parallel

- Landing consumes the accepted narrative and visual system.
- Atlas consumes the accepted examples and real public runtime boundary.
- Neither workstream may fork documentation semantics or example behavior.

### Phase 7: Close one pre-publication Release Candidate

- Run README, source mapping, content drift, example, artifact, package, CLI,
  site build, accessibility, performance, visual, Atlas, clean-consumer, and
  Preview gates against one exact source commit and candidate inventory.
- Do not publish or deploy while any workstream remains incomplete.

### Phase 8: Execute authorized public release writes

- Obtain explicit authorization for each applicable external write.
- Publish and verify Framework packages through their release owner.
- Execute any applicable CLI/root release stage through its own contract and
  authorization boundary.

### Phase 9: Reconcile final public facts

- Replace only generated/provisional registry, version, command, support, and
  deployment facts with externally verified values.
- Repeat registry-only examples, generated-app onboarding, public links,
  search, release inventory, and final Preview gates.

### Phase 10: Deploy and close the website

- Obtain explicit website production-deployment authorization.
- Deploy the exact final candidate, verify production, and close the entire
  release train only when every child and applicable release owner is complete.

Before implementation of any child plan, that task must have its own thin
product/content contract, exact flow Inspector, executable product cases, and
bounded Definition of Done. One child plan cannot borrow another plan's
Inspector to authorize its edits.

## Program Quality Gates

- all nine child-plan acceptance gates pass against the same release
  inventory;
- all root, package, App, CLI, and generated-app README surfaces agree with the
  accepted public docs, examples, support policy, and release facts;
- every public behavior or support claim resolves to a canonical source;
- every supported code flow resolves to an executable maintained example or
  an approved API-reference source;
- no public runtime surface imports package-private source or unpublished
  package paths;
- current visual, future non-visible, Preset, App-owned domain, AI-assisted, and
  optional-system boundaries remain consistent across documentation, Landing,
  Atlas, and Roadmap;
- route, anchor, search, source mapping, version, and broken-link checks pass;
- keyboard, touch, focus, responsive, reduced-motion, contrast, performance,
  and synchronized visual-review gates pass;
- exact registry-only onboarding and clean-consumer flows pass before final
  public release claims; and
- only the README workstream mutates its declared README owners, with generated
  output changed solely through the canonical generator.

## Stop Conditions

- A child workstream has no exact owner, Inspector, executable cases, or bounded
  acceptance contract.
- Product language presents Asyra as only a canvas or design-tool framework,
  requires Render/UI for canonical behavior, or presents possible app domains
  as built-in Framework capabilities.
- Preset is presented as mandatory or as the owner of app domain behavior.
- A workstream needs to mutate another workstream's README, documentation,
  example, visual, website, package, or release owner instead of returning the
  defect to that owner.
- A package version, CLI command, public URL, support statement, or release
  capability is not externally verifiable when publication depends on it.
- A workstream requires an unapproved dependency, hosted service, analytics,
  CMS, external asset license, binary, or runtime upgrade.
- Any implementation diverges from the accepted content or visual handoff.
- A required child or program gate fails.

## Definition of Done

- All nine child plans and every applicable package/CLI/root release owner are
  complete against one verified release inventory.
- The public experience explains current visual product composition and the
  future non-visible information-modeling direction without overstating
  built-ins or current runtime support.
- Every public package has usable documentation and every supported tutorial
  flow is backed by maintained executable evidence.
- Root, all release package, Asyra Design, CLI, and generated-app README
  surfaces are current, correctly linked, and preserve the required support and
  contribution policy.
- `create-asyra-design-app` and small Framework examples provide complementary
  beginner paths, including one AI-assisted bounded extension.
- Landing, documentation, examples, releases, roadmap, Asyra Design, and
  Runtime Atlas surfaces are responsive, accessible, visually accepted, and
  production-built.
- The Atlas proves real current public intent, transaction, canonical owner,
  projection, optional-composition, and failure paths; future Headless/Core
  Kernel work appears only as Roadmap content until executable support exists.
- Preview closure passes before any production write.
- Production deployment is complete only after separate explicit authority and
  deployed verification; publication, tagging, and unrelated release actions
  remain separately authorized.
