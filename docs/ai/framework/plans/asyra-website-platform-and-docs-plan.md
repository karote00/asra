# Asyra Website Platform and Documentation Experience Plan

## Status

Completed, preview-ready child plan of the
[Asyra Framework Website Program](asyra-framework-website-plan.md). Public
content, executable examples, and the Material Blueprint visual handoff are
accepted on the integration branch. The common platform now production-builds
on its dedicated child branch against that exact release candidate; production
deployment remains owned by Launch and Operations.

Completion evidence includes 51 prerendered Next.js routes, a 49-endpoint
production route smoke, the exact 41-page/19-package/11-example content checks,
26 website tests plus the 11-case Inspector contract, four Chromium
desktop/mobile/reduced-motion/supporting-route cases, synchronized live visual
review, strict typecheck/lint, dependency and generated-content checks, the
full repository build, and all 21 repository `test:ci` workspace tasks.

## Goal

Build the common production website platform and documentation experience that
deterministically presents approved Asyra content. This workstream supplies the
foundation consumed by Landing and Runtime Atlas without owning their product
stories or runtime cases.

## Ownership Boundary

The proposed workspace owner is `apps/asyra-framework-site`. This plan owns:

- Next.js application foundation and shared web configuration;
- content loading, source metadata, and presentation adapters;
- documentation layout, navigation, table of contents, local search, and copy
  as Markdown;
- examples index presentation;
- Asyra Design case-study route presentation;
- releases, support, migration, roadmap, security, and package inventory
  presentation;
- shared accessibility, metadata, SEO, error, and responsive foundations; and
- common visual primitives derived from the accepted visual specification.

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
- Lucide React `1.31.0`.
- Static-first content and metadata; client runtime only where interaction,
  browser APIs, or real runtime composition requires it.
- Semantic HTML, SVG, and CSS for navigation and explanations. Basic content
  must not require canvas or WebGL.
- Website runtime code imports only public package roots or explicitly exported
  `@asyra/*` subpaths.

The user selected these primary technologies and authorized the integrated
implementation. The exact versions above are the bounded implementation
checkpoint. Any further dependency, CMS, hosted search, analytics, binary,
external asset, or toolchain upgrade requires explicit approval.

## Required Routes

- `/docs/[[...slug]]` for Start, Learn, Build, Reference, and API content;
- `/examples` for the deterministic executable-example inventory;
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
to stable headings and content IDs. Copy-as-Markdown must expose the approved
page content and canonical source links without internal-only metadata.

The site consumes the accepted `docs/public/*` content bundle, deterministic
example inventory, and stable README entry links. Presentation adapters may add
navigation and visual annotation but cannot silently rewrite content semantics
or duplicate package versions as constants. Candidate release facts remain
generated and visibly provisional until public reconciliation.

## Shared Platform Contract

- Design tokens and shared primitives implement the accepted visual handoff.
- Landing and Atlas receive stable layout, navigation, metadata, focus, error,
  responsive, and reduced-motion primitives.
- Content source mapping and release inventory are build inputs with drift
  checks, not ad hoc fetches.
- The site remains usable when interactive examples or Atlas runtime is
  unavailable; failure states never fabricate product output.
- Asyra Design links appear only after a canonical public URL is explicitly
  verified.

## Implementation Stages

1. Freeze exact toolchain, workspace owner, content adapter, routes, and
   website-platform Inspector.
2. Establish the site workspace, build/test foundation, metadata, tokens, and
   accessible navigation shell.
3. Implement deterministic public-content loading and source/drift metadata.
4. Implement docs navigation, table of contents, stable anchors, local search,
   and copy-as-Markdown.
5. Implement Examples, Asyra Design, Releases, and Roadmap presentation routes.
6. Expose stable shared foundations to Landing and Atlas owner tasks.
7. Run build, route, content, accessibility, responsive, performance, and
   synchronized visual gates.

## Quality Gates

- strict TypeScript, lint, tests, and production build pass;
- all required routes, anchors, navigation, search records, and Markdown-copy
  outputs resolve;
- source mapping, content drift, manifest-derived inventory, and broken-link
  checks pass;
- public content remains readable without client JavaScript where interaction
  is unnecessary;
- keyboard order, landmarks, focus, contrast, touch, responsive, and
  reduced-motion behavior pass;
- website code does not import package-private or unpublished source;
- no hand-written release version or unverified public URL exists; and
- synchronized screenshots match the accepted visual handoff within the
  defined review cases.

## Stop Conditions

- Public content, examples, or visual handoff is incomplete or inconsistent.
- Exact approved toolchain versions or workspace ownership are unresolved.
- A route would need to invent or locally rewrite a canonical product fact.
- The implementation requires an unapproved dependency or hosted service.
- A shared primitive would force Landing or Atlas to violate its owner
  contract.
- A required build, content, accessibility, or visual gate fails.

## Definition of Done

- The common site workspace production-builds with the approved exact
  toolchain.
- Documentation, Examples, Asyra Design, Releases, and Roadmap routes present
  the accepted content and generated facts correctly.
- Search, navigation, stable anchors, source links, and Markdown-copy work
  across supported responsive states.
- Landing and Atlas can build on stable accepted foundations.
- Preview-ready platform gates pass without claiming production deployment.
