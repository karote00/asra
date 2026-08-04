# Asyra Framework Website Plan

## Status

Queued after the first stable Framework package and
`create-asyra-design-app` release contracts are publicly verifiable.

Implementation may begin only after the product content contract and website
Inspector define page ownership, public documentation sources, navigation,
examples, deployment target, and acceptance gates.

## Goal

Build a production-ready dark-mode marketing and documentation website for
Asyra, the Canvas Tool Framework. The site must introduce the Framework,
provide developer documentation and tutorials, present working examples, and
explain how Asyra Design is built with Asyra.

## Technology Contract

- Next.js 14 or newer with App Router.
- TypeScript in strict mode.
- Tailwind CSS.
- Lucide React.
- Responsive, accessible, production-oriented implementation.
- High-performance SVG/CSS visualizations.

The user has selected these primary technologies. Any additional third-party
dependency, hosted search service, analytics provider, CMS, binary, or
toolchain upgrade still requires explicit approval.

## Visual Direction

- Pure dark mode.
- Page background: `#030712` / Tailwind `gray-950`.
- Primary text: `#F9FAFB` / `gray-50`.
- Secondary text: `#9CA3AF` / `gray-400`.
- Accent and primary action color: `#10B981` / emerald.
- Minimal developer aesthetic inspired by shadcn/ui, Vercel, and Supabase.
- Thin `gray-800` borders and restrained elevation.
- Subtle dot-matrix or grid background suggesting a canvas.
- Sans-serif headings and a technical monospace face such as Fira Code or
  JetBrains Mono for code and labels.
- Motion must remain optional, accessible, and inexpensive.

## Proposed Ownership

- New website workspace: `apps/asyra-framework-site` unless the implementation
  readiness review selects a clearer repository owner.
- Framework public documentation remains the semantic authority for package
  behavior.
- Website content owns public presentation, navigation, tutorials, SEO, and
  examples; it must not invent new API or support contracts.
- Asyra Design docs remain authoritative for app-specific behavior.
- The website may curate and transform approved public content, but must have a
  deterministic drift check back to canonical source documents.
- Asyra Design deployment URL is linked only after a canonical public URL is
  explicitly recorded; do not invent or infer one from local Vercel metadata.

## Required Pages

### Landing page

Route: `app/page.tsx`.

Required sections:

1. hero with product name, concise value proposition, primary documentation
   CTA, secondary example CTA, and copyable `npm create` command;
2. interactive architecture flow with hover/focus explanations;
3. four-card feature grid:
   - Information Model;
   - Modules;
   - Collaboration;
   - AI-Native;
4. short code-first getting-started section;
5. Asyra Design reference example with verified Vercel link;
6. release/runtime support statement;
7. footer with documentation, repository, security, license, and release links.

### Documentation shell

Route: `app/docs/[[...slug]]/page.tsx`.

Desktop layout:

1. left navigation sidebar;
2. prose-styled main document;
3. right table of contents.

Responsive behavior:

- mobile navigation drawer;
- readable single-column content;
- accessible on-page table of contents;
- persistent search affordance only if a no-new-service implementation is
  accepted or an external service is separately approved.

## Documentation Information Architecture

Minimum first-release sections:

1. Introduction
   - What Asyra is
   - Why declarative information modeling
   - Supported environments
2. Getting Started
   - Install packages
   - Create Asyra Design app
   - Initialize Core and Preset 2D
3. Core Concepts
   - Information model
   - Features and input
   - Transactions and undo/redo
   - Validation and persistence migration
   - Render and engine boundaries
4. Modules
   - Core
   - Factory
   - Feature/Input/Reactive Events
   - Props/Scene Tree/Selection/System/UI Context
   - Render Engine and Pixi provider
   - Preset
5. Optional Capabilities
   - Collaboration
   - AI Agent Runtime
   - explicit disabled-side-effect guarantees
6. Guides and Tutorials
   - custom component
   - custom property
   - transaction-safe feature
   - save/load migration
   - Group operations
   - opt-in Collaboration
   - opt-in AI action plan
7. Examples
   - headless Core consumer
   - Preset 2D consumer
   - Asyra Design
8. API and Release
   - public entrypoints
   - support matrix
   - migration/deprecation
   - security and release notes

## Asyra Design Case Study

The example must explain, with source-linked diagrams and code excerpts:

- initialization and Preset composition;
- app-owned features and common APIs;
- property, Scene Tree, Selection, transaction, undo/redo, and load paths;
- replaceable rendering through the official 2D provider;
- optional Collaboration lifecycle and convergence;
- optional AI action planning through registered app actions;
- server/document persistence ownership;
- how disabled optional systems remain inert;
- which behavior belongs to Framework, Preset, and Asyra Design.

The case study must link to the verified deployed Asyra Design example and its
canonical repository documentation.

## Interactive Architecture Diagram

The landing diagram should visualize:

`Input / UI / Command -> Feature -> Public API -> Canonical State -> Render/UI`

Hover and keyboard focus reveal ownership, inputs, outputs, and example package
names. The diagram must:

- use semantic HTML plus SVG/CSS;
- work without pointer hover;
- avoid canvas/WebGL for basic navigation;
- respect reduced motion;
- remain readable on mobile;
- never represent AI, Collaboration, or Render as canonical state owners.

## Implementation Stages

1. Freeze public content contract and site map.
2. Create the website Inspector and executable page/content cases.
3. Establish Next.js, TypeScript, Tailwind, fonts, tokens, layout, metadata, and
   test foundation.
4. Implement shared header, footer, docs shell, navigation, prose, code blocks,
   and table of contents.
5. Implement landing page and interactive architecture diagram.
6. Author Getting Started, concepts, module, guide, API, release, and
   Asyra Design case-study content.
7. Add verified example and repository links.
8. Add accessibility, responsive, SEO, sitemap, robots, performance, and
   visual-regression coverage.
9. Create an isolated Vercel preview and verify routes, assets, metadata,
   navigation, and performance.
10. Review content drift and obtain explicit production deployment authority.

## Quality Gates

- strict TypeScript and production build;
- lint and tests;
- route and broken-link validation;
- code sample compilation where practical;
- keyboard navigation, focus order, landmarks, contrast, reduced motion, and
  responsive behavior;
- Lighthouse-style performance, accessibility, best-practice, and SEO budgets
  defined before implementation;
- visual review at mobile, tablet, and desktop widths;
- no invented package version, API, support statement, deployment URL, or
  roadmap capability;
- no exposure of secrets, internal-only operational docs, or private endpoints.

## Stop Conditions

- Public package/create-app version contracts are not stable.
- Canonical public documentation sources are ambiguous.
- The site requires an unapproved dependency, CMS, analytics, hosted search, or
  external asset license.
- The Asyra Design public deployment URL is unavailable or unverified.
- A page or diagram contradicts Framework/App ownership.
- Required accessibility, build, route, content, or performance gates fail.

## Definition of Done

- Landing and documentation routes are complete, responsive, accessible, and
  production-built.
- Developers can install Asyra, initialize a first app, follow tutorials, find
  public APIs, and understand support/migration contracts.
- The Asyra Design case study and verified deployment demonstrate the
  Framework without making the app the Framework authority.
- Content links resolve and code examples match published packages.
- A Vercel preview passes the defined functional, visual, accessibility, SEO,
  and performance gates.
- Production deployment remains separately authorized.
