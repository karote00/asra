# Asyra Public Package Documentation Plan

## Status

Queued child plan of the
[Asyra Framework Website Program](asyra-framework-website-plan.md). This
workstream progresses in parallel with the sibling README, executable-example,
and visual workstreams against the same release candidate.

Implementation may begin only after a thin public-documentation contract, an
exact documentation-flow Inspector, executable content cases, source mapping,
and a bounded Definition of Done are complete and consistent.

## Goal

Create durable public documentation for every release Framework package and
for the cross-package flows that consumers actually build. README files remain
concise package entry points; complete guides and reference content live in one
maintained public-documentation system that both humans and AI coding agents
can retrieve.

## Ownership Boundary

This plan owns proposed public content under `docs/public/*`, its deterministic
content metadata and indexes, and documentation-specific validation. It does
not own:

- root, package, Asyra Design, CLI, or generated-app README files owned by the
  sibling README workstream;
- sample implementation code owned by `docs/examples/*`;
- website components, routes, styling, or search UI;
- package behavior, exports, manifests, versions, or release publication; or
- internal architecture contracts under `docs/ai/*`.

Canonical Framework and App contracts remain authoritative. Public pages must
declare exact source mappings and cannot become a conflicting behavior owner.

## Public Information Architecture

The first public content bundle must include:

1. Start
   - create a working Asyra Design app;
   - extend it directly or with an AI coding agent;
   - compose a minimal Preset `2D` consumer; and
   - compose a headless or profile `CUSTOM` consumer.
2. Learn
   - declarative information models;
   - visible, headless, and machine-facing composition;
   - intent and Feature execution;
   - canonical state owners;
   - transaction, rollback, undo/redo, and durability;
   - validation, loading, and app-owned migration; and
   - projection, registration, replacement, and extension.
3. Build
   - custom component, property, and schema;
   - transaction-safe Feature or session;
   - render layer or custom render engine;
   - hierarchy and Group behavior;
   - persistence and migration;
   - opt-in Collaboration and app-owned transport policy;
   - registered AI actions and permissions; and
   - headless AI retrieval/action with app-owned domain policy.
4. Reference
   - every public release package;
   - public entrypoints, types, lifecycle, errors, and relationships; and
   - support, migration, deprecation, security, and release boundaries.
5. Cases
   - Asyra Design as a source-linked reference product; and
   - conceptual guides that link to the executable Examples and Runtime Atlas.

## Package Guide Contract

All Framework packages in the exact release inventory, currently 19, require
an individual public guide. The manifest-derived inventory remains the owner
of the package set and count. Each guide must state:

- what the package owns and explicitly does not own;
- when a consumer should and should not compose it;
- prerequisites and supported public entrypoints;
- initialization, lifecycle, inputs, outputs, and failure behavior;
- package relationships without private or relative cross-package imports;
- one minimal supported use path linked to maintained example code;
- replacement, optionality, and disabled behavior where applicable;
- current support, migration, and deprecation boundaries; and
- canonical source links and last-reviewed release inventory.

Do not create one artificial standalone sample for every package when the
package is meaningful only as part of a real composition flow. Package guides
may share one maintained cross-package example while explaining their own
ownership precisely.

## Asyra Design Case-Study Content

The public semantic source must explain initialization, Preset composition,
app-owned Features, common APIs, canonical state, transactions, undo/redo,
load paths, rendering, hierarchy, optional Collaboration, optional AI actions,
disabled-system behavior, and Framework/Preset/App/Backend ownership. It must
also explain why AI-created content remains editable, reversible,
collaborative, and persistable through the same canonical routes. It must use
source-linked tested excerpts and approved public visual evidence.

This plan owns the content meaning. The site owns its presentation and may not
silently broaden Asyra Design behavior into a Framework capability claim.

## AI-Readable Documentation Contract

- Every task guide states prerequisites, exact public APIs, owner boundaries,
  expected result, validation commands, and forbidden shortcuts.
- Pages use stable Markdown, predictable headings, source links, and bounded
  context suitable for retrieval.
- A machine-readable content index and plain-text discovery surface may be
  produced only after their exact schema and exclusion rules are frozen.
- AI prompt examples help users request bounded work but never replace tests,
  validation, permissions, or product contracts.
- Search and AI indexes exclude secrets, private endpoints, historical audits,
  internal operational instructions, and obsolete contracts.

## Freshness Contract

- Every public page maps to canonical source files through metadata.
- A deterministic drift gate fails when mapped authority changes without a
  corresponding public-page review.
- Package versions, environments, exports, and support facts are generated
  from manifests, artifacts, declarations, and release records.
- API reference derives only from approved public entrypoints and declarations.
- Code blocks link to, import, or are verified against the executable-example
  workstream; unsupported copy-pasted variants are forbidden.
- Root, package, App, CLI, generated-app, website, support, migration, and
  release links participate in link and stale-version validation.

## Implementation Stages

1. Freeze the content schema, source mapping, page inventory, and exclusions.
2. Create the public-documentation Inspector and executable content cases.
3. Author Start and Learn paths, including visual and headless compositions.
4. Author Build guides around real cross-package consumer flows.
5. Author and verify all public package guides and generated API reference.
6. Author the Asyra Design case-study semantic source.
7. Generate AI-readable indexes and manifest-derived release facts.
8. Run drift, link, API-surface, readability, and content-case gates.
9. Review terminology and cross-links with the sibling README candidate.
10. Freeze the accepted content bundle for website consumption.

## Quality Gates

- all public release packages resolve to one complete guide;
- every behavior and support claim resolves to an active canonical source;
- all public API names resolve to published entrypoints or declarations;
- all code samples resolve to maintained executable evidence;
- source-map drift, broken-link, stale-version, and generated-inventory checks
  pass;
- visual, headless, Preset, App-domain, and AI-assisted language remains
  consistent with the umbrella product definition;
- Markdown remains readable without the website runtime; and
- the workstream does not mutate sibling README artifacts.

## Stop Conditions

- Canonical ownership or a public API contract is ambiguous.
- A guide requires undocumented package-private behavior.
- An example link has no maintained executable owner.
- A version, support fact, CLI command, or public URL is unverified.
- Content would expose private operations, credentials, or internal-only docs.
- The task would need to repair a sibling README, implementation, manifest, or
  release record outside this plan instead of returning the defect to its
  owner.

## Definition of Done

- All release Framework packages have complete, source-mapped public guides.
- Start, Learn, Build, Reference, and Case content supports beginner,
  experienced, visual, and headless paths.
- Asyra Design has one approved semantic case-study source.
- AI-readable content and indexes are bounded, current, and safe to publish.
- Generated facts and API reference match the exact verified release inventory.
- Documentation gates pass and the accepted bundle is ready for deterministic
  website ingestion.
