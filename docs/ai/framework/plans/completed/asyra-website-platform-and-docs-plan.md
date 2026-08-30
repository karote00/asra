# Asyra Website Platform and Documentation Experience Plan

## Status

Completed on 2026-08-10 as a child workstream of the accepted Asyra Framework
Website Program. The common platform, documentation experience, supporting
routes, and Preview-ready evidence passed the umbrella program's bounded gates.

This retained contract governs every public Website route outside the accepted
Landing composition. It replaces the previous Cosmic Atlas whole-site
direction and extends the retained
[Result-First Landing contract](asyra-website-landing-page-plan.md) without
changing its content, geometry, illustrations, or responsive behavior.

Maintainer review on August 11, 2026, removed the separate Executable Examples
product surface: advanced documentation owns those learning flows, while Asyra
Design is the only directly operable product entry.

## Goal

Build the common production website platform and documentation experience that
deterministically presents approved Asyra content. This workstream supplies the
foundation consumed by Landing and Runtime Atlas without owning their product
stories or runtime cases.

## Ownership Boundary

The proposed workspace owner is `apps/asyra-framework-site`. This plan owns:

- Next.js application foundation and shared web configuration;
- content loading, source metadata, and presentation adapters;
- documentation layout, navigation, table of contents, local search, and
  reader-facing source links;
- Asyra Design case-study route presentation;
- releases, support, migration, roadmap, security, and package inventory
  presentation;
- shared accessibility, metadata, SEO, error, and responsive foundations; and
- common visual primitives derived from the accepted Result-First Landing.

It does not own documentation semantics, example code, Landing narrative,
Runtime Atlas execution, README files, package code, package versions, or
production deployment.

## Technology Contract

- Next.js App Router `16.3.0` on the repository-owned Node.js `24.x` and Yarn
  `4.3.1` runtime.
- Existing React and React DOM `19.1.0` resolutions; this child does not upgrade
  the repository React runtime.
- TypeScript strict mode.
- Existing TypeScript `5.8.3` lock resolution from the repository's `^5.7.2`
  contract.
- Tailwind CSS `4.3.3` with its official `@tailwindcss/postcss` `4.3.3`
  companion.
- Static-first content and metadata; client runtime only where interaction,
  browser APIs, or real runtime composition requires it.
- Content Security Policy permits React's evaluation-based diagnostics only in
  the local development runtime. Production responses must omit
  `script-src 'unsafe-eval'`.
- Semantic HTML, SVG, and CSS for navigation and explanations. Basic content
  must not require canvas or WebGL.
- Website runtime code imports only public package roots or explicitly exported
  `@asyra/*` subpaths.

The user selected these primary technologies and authorized the integrated
implementation. The exact versions above are the bounded implementation
checkpoint. Any further dependency, CMS, hosted search, analytics, binary,
external asset, or toolchain upgrade requires explicit approval.

## Required Routes

- `/docs` and `/docs/[...slug]` for Start, Learn, Build, Reference, and API
  content; the explicit root and detail entries must prerender every accepted
  page instead of relying on an optional-catch-all fallback;
- `/asyra-design` for the approved reference-product case study;
- `/releases` for manifest-derived inventory, support, migration, deprecation,
  security, and release notes;
- `/roadmap` for current, experimental, planned, and unsupported boundaries;
- shared foundations used by `/` and `/atlas`, owned by their child plans; and
- accessible not-found, content-failure, and unsupported-browser states.

## Documentation Experience

Desktop documentation uses left navigation, readable main content, and right
table of contents. Responsive behavior provides a mobile navigation drawer,
single-column reading, and accessible on-page navigation.

The first release uses local static search by default. Search results must map
to stable headings and content IDs. Source attribution stays in the approved
page content as reader-facing canonical source links. The public reading UI
does not expose authoring telemetry, Markdown-copy controls, or duplicate
source-path evidence.

The site consumes the accepted `docs/public/*` content bundle and stable README
entry links. Presentation adapters may add
navigation and visual annotation but cannot silently rewrite content semantics
or duplicate package versions as constants. Candidate release facts remain
generated and visibly provisional until public reconciliation.

The Documentation Overview may place one compact, docs-native technical flow
after the owner-model explanation. It presents product intent and existing
state as two distinct routes into the same canonical owners, followed by the
render, search, AI, save, and integration consumers. It uses the light reading
surface and normal documentation type scale instead of reusing the Landing's
dark presentation stage. The flow names intent, state-application, owner, and
projection boundaries exactly; it supplements the verified Markdown without
rewriting or duplicating its semantic authority. Other documentation pages do
not render this overview-only visual.

## Shared Platform Contract

- Design tokens and shared primitives extend the accepted Result-First Landing
  across every public route: warm paper, near-black ink, restrained signal red,
  adaptive engineering grids, dark mechanical stages, and square or lightly
  chamfered information surfaces.
- Supporting routes use modern system sans typography, compact uppercase
  evidence labels, generous whitespace, and code-native topology. They do not
  restore the retired Cosmic Atlas shell or introduce an unrelated visual
  identity.
- The current Landing remains unchanged. Its six selected illustration families
  and alpha-shadow treatments remain Landing-only; supporting routes use
  semantic HTML, CSS, and small code-native SVG marks rather than reusing those
  product illustrations as decoration.
- Landing and Atlas receive stable layout, navigation, metadata, focus, error,
  responsive, and reduced-motion primitives.
- Content source mapping and release inventory are build inputs with drift
  checks, not ad hoc fetches.
- The Releases route presents accepted Framework milestone records separately
  from the manifest-derived current package inventory. It records important
  releases rather than every package or website update.
- The site remains usable when Atlas runtime is unavailable; failure states
  never fabricate product output.
- Current synchronous static routes deliver their accepted content in the
  initial readable document. The App root has no global `loading.tsx` streaming
  boundary; a future asynchronous route must own any loading boundary locally.
- Asyra Design links appear only after a canonical public URL is explicitly
  verified.

## Implementation Stages

1. Freeze exact toolchain, the accepted Landing visual authority, workspace
   owner, content adapter, routes, and website-platform Inspector.
2. Establish the site workspace, build/test foundation, metadata, tokens, and
   accessible navigation shell.
3. Implement deterministic public-content loading and source/drift metadata.
4. Implement docs navigation, table of contents, stable anchors, local search,
   and reader-facing source links.
5. Implement Asyra Design, Releases, and Roadmap presentation routes.
6. Expose stable shared foundations to Landing and Atlas owner tasks.
7. Run build, route, content, accessibility, responsive, performance, and
   synchronized visual gates.

## Quality Gates

- strict TypeScript, lint, tests, and production build pass;
- all required routes, anchors, navigation, search records, and source links
  resolve;
- source mapping, content drift, manifest-derived inventory, and broken-link
  checks pass;
- public content remains readable without client JavaScript where interaction
  is unnecessary;
- keyboard order, landmarks, focus, contrast, touch, responsive, and
  reduced-motion behavior pass;
- website code does not import package-private or unpublished source;
- no release version exists outside an accepted Framework milestone record or
  the generated package inventory, and no unverified public URL exists; and
- synchronized screenshots preserve the accepted Landing and extend its visual
  language coherently across documentation, supporting routes, and Runtime
  Atlas within the defined review cases.

## Stop Conditions

- Public content or the accepted Landing contract is incomplete or
  inconsistent.
- Exact approved toolchain versions or workspace ownership are unresolved.
- A route would need to invent or locally rewrite a canonical product fact.
- The implementation requires an unapproved dependency or hosted service.
- A shared primitive would force Landing or Atlas to violate its owner
  contract.
- A required build, content, accessibility, or visual gate fails.

## Definition of Done

- The common site workspace production-builds with the approved exact
  toolchain.
- Documentation, Asyra Design, Releases, and Roadmap routes present
  the accepted content and generated facts correctly.
- Search, navigation, stable anchors, and source links work across supported
  responsive states.
- Landing and Atlas can build on stable accepted foundations.
- Preview-ready platform gates pass without claiming production deployment.

## Required Completion Evidence

- Contract and unit tests cover the exact content inventory, navigation,
  supporting routes, Runtime Atlas states, and current Landing preservation.
- Strict typecheck, site lint, production build, and route smoke pass.
- Synchronized browser evidence covers desktop, compact, 390px, and 320px
  documentation, search, Asyra Design, Releases, Roadmap, Landing, Runtime
  Atlas, reduced motion, not-found, and content-failure states.
- Production promotion remains separately authorized and does not occur as a
  consequence of this implementation task.
