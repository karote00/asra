# Asyra Result-First Landing Page Plan

## Status

Current implementation contract. This contract replaces every previous public
website composition, including committed and uncommitted Landing work.

## Goal

Build one public Asyra page that reports the result first: people can bring
knowledge from any field and build the tool their world needs on Asyra. The
page then proves that the tool can grow, that people and AI use the same action
path, and that every view shares one source of truth. The product owner retired
the Visible Change proof and the later Impact Preview because change-impact
analysis is not a public product capability.

## Visual Authority

The checked-in user-approved result-first V04 image at
`docs/ai/framework/website/asyra-landing-v04-approved.png` is the only visual
authority. Its SHA-256 is
`e43980029f7bee21f5580d0f58b6869e4dec42fb5e7c84fb98c5b2b7bf7abd3b`.
Its
essential composition is:

- warm paper, near-black ink, restrained red, blue, green, and amber signals;
- a compact ASYRA header and short calls to action;
- a result-first two-column hero with the exact V04 modular core and its
  measurement grid;
- an unlimited-domain rail immediately after the hero;
- three spacious alternating proof sections without separator rules;
- six immutable product-owner-supplied Photoroom true-alpha masters, with
  source-bounded responsive lossless WebP derivatives that preserve their
  object count, topology, in-image labels, signal colors, and connectors;
- one reusable CSS illustration-stage treatment that draws a responsive
  engineering grid behind every transparent image and derives stronger depth
  from each image's alpha silhouette with asset-specific contact and cast
  `drop-shadow()` layers; each of the six illustrations owns a lower-right
  perspective vector matched to its apparent elevation, while dark stages add
  a restrained blue ambient reflection;
- prior V06, V08, V09, and experimental Grow assets remain preserved for
  history but are not selected by the page;
- domain labels embedded in one complete continuous generated domain rail with
  both edge assemblies, and the product-owner-approved V09 closing concept: a
  protected central domain core inside one continuous blue infrastructure loop
  with four directional bridges, presented over the shared code-drawn
  engineering grid;
- an open-source closing statement and compact footer; and
- modern system sans headlines and labels at regular-to-medium display weight,
  open line spacing, generous section padding, and responsive single-column
  reflow.

No existing website UI, CSS, illustration, route, or test is an implementation
input. Only the existing environment setup is retained: Next.js, React,
TypeScript, Yarn, Vercel configuration, site-origin plumbing, Playwright, and
the project test commands.

## Bounded Task Contract

- **Objective:** delete the current website implementation and rebuild one `/`
  page from the approved V04 reference while retaining environment setup.
- **Authorized mutation:** `apps/asyra-framework-site/app`,
  `apps/asyra-framework-site/public`, `apps/asyra-framework-site/artwork/v06`,
  `apps/asyra-framework-site/artwork/v07-desktop`,
  `apps/asyra-framework-site/artwork/v08-desktop`,
  `apps/asyra-framework-site/artwork/v09`,
  `apps/asyra-framework-site/artwork/v09-desktop`,
  `apps/asyra-framework-site/artwork/v10-desktop`,
  `apps/asyra-framework-site/artwork/v11-desktop`,
  `apps/asyra-framework-site/artwork/v12-desktop`,
  `apps/asyra-framework-site/artwork/v13-desktop`,
  `apps/asyra-framework-site/artwork/v14-desktop`, the V06 through V14 desktop
  asset builders, the V09 closing asset builder, directly affected Landing
  tests and smoke scripts, this plan, and the Landing Inspector.
- **Fixed discovery:** the approved V04 image, the product-owner copy decisions
  in this task, current Framework product truth, and existing environment
  configuration.
- **Required gates:** Inspector contract, semantic regression test, strict
  typecheck, site lint, production build, route smoke, no-JavaScript reading,
  reduced motion, and synchronized full-page plus section-level 1440px, 864px,
  820px, 390px, and 320px visual review, including CTA default, hover, and
  focus states.
- **Excluded:** Framework package behavior, Asyra Design behavior, new packages,
  tablet and mobile raster asset changes, analytics, and unrelated repository
  changes. Production deployment is authorized only after all required gates
  pass.
- **Stop:** a new dependency becomes necessary, a required claim is not current
  Framework truth, or the page cannot pass its focused gates.

## Product Cases

1. desktop editorial composition;
2. mobile single-column reflow;
3. result-first hero;
4. unlimited-domain examples;
5. growth without rebuilding the rest;
6. one shared human and AI action path;
7. one source across features and views;
8. clickable placeholder actions;
9. responsive true-alpha Photoroom raster assets;
10. adaptive code-drawn grids and alpha-aware shadows at every review size;
11. a 2026 open-source footer with no company identity; and
12. complete no-client and reduced-motion reading; and
13. public machine-readable discovery without restoring removed content pages.

## Content Contract

The page must include these exact anchors:

- `Build the tool your world needs.`
- `You bring the domain knowledge. AI builds with Asyra. Your tool stays easy to extend, automate, and undo.`
- `One foundation. Any field.`
- `Examples, not limits.`
- `Add what your workflow needs without rebuilding the rest.`
- `Build each feature once. People and AI use the same action path.`
- `One source of truth across every feature and view.`
- `Bring your domain. Keep its logic.`

Calls to action use only `Start building` and `See examples`. Navigation and
footer links may use placeholder destinations, but every link must have a
clickable non-empty `href` attribute. Public copy contains no Unicode em dash
or en dash.

The footer identifies the project only as `2026`, `OPEN SOURCE`, and
`MIT LICENSE`. It must not claim an Asyra company, corporation, or incorporated
owner.

The Website publishes the generated public documentation inventory at
`/llms.txt`. This machine-readable discovery surface mirrors
`docs/public/llms.txt`; it does not restore `/docs` or another human-facing
content route.

## Ownership Boundary

The app owns semantic server-rendered HTML, the paper visual system, responsive
layout, metadata, robots, sitemap, the generated `/llms.txt` discovery surface,
error state, not-found state, and project-local responsive WebP assets. The
selected source-of-truth files are
the six immutable product-owner-supplied PNG masters under
`apps/asyra-framework-site/artwork/photoroom`; their hashes are enforced by the
semantic regression test. `build-photoroom-assets.py` produces three
source-bounded, premultiplied-alpha, lossless WebP widths for each illustration.
Every selected derivative must contain both transparent and opaque pixels and
must not exceed its master width. The domain rail's native 2400px master is not
artificially enlarged; it may provide a minimum 1.1 source pixels per rendered
CSS pixel at the widest review size, while the other illustrations remain at
least 2x at their supported review sizes.

The app owns one shared `.illustration-stage` decoration for all six images.
Its pseudo-element draws minor lines, major lines, and intersection nodes with
CSS gradients. Grid spacing uses `clamp()` and stage-owned custom properties so
the same implementation adapts to Hero, Domain Rail, proof, Closing, desktop,
tablet, and phone dimensions. The grid is background decoration only: it must
not recreate, replace, or modify any diagram's internal mechanical topology.
The old `closing-grid-v07-desktop` raster remains preserved but is never
selected. Each image receives CSS `drop-shadow()` computed from its real alpha
silhouette. Hero, Domain Rail, Grow, Same Path, One Source, and Closing each
own distinct contact and cast offsets, blur, and opacity. Their lower-right
vectors follow the supplied top-left lighting and apparent elevation instead
of applying one generic vertical shadow. Dark stages may add a restrained blue
ambient reflection so the silhouette remains legible without changing source
pixels.

Prior V04 through V12 raster assets and the rejected V08 through V14 Grow
experiments remain preserved but are not selected. The retired Visible Change
assets also remain unselected. Background removal, responsive derivation, the
shared grid, and CSS shadow must not redesign topology, simplify geometry,
remove labels, drop construction details, or alter the approved subject color
payload.

The complete `apps/asyra-framework-site/artwork` tree is local-only design
input. Git and default CI exclude it; the committed responsive files under
`public/illustrations` are limited to the eighteen selected Photoroom
derivatives used by the page and are the production and deployment assets.
Unselected historical derivatives remain local-only beside the artwork
archive. Source-master hashes and historical design-build contracts run only through the explicit
`ASYRA_LOCAL_ARTWORK_TESTS=1` authoring gate. That gate is required whenever a
committed derivative is regenerated or replaced, but ordinary clean clones,
CI, production builds, and deployments do not require the 1.4GB local artwork
archive.

The active visual review must match these approved details:

- the hero's largest third tier has four raised corner fasteners with the same
  blue center, scale, and depth language used by the other mechanical fasteners;
- all ten domain-card icons match the V04 symbols, proportions, stroke weight,
  and placement while retaining the accepted 36px labels;
- Grow retains two parallel red pipes joining the active red module to the
  separate white module, including its collars and spacing;
- One Source places all four card labels at the V04 top inset and restores
  clearly visible light-and-shadow depth to the central topographic relief;
- the closing uses the exact V09 reviewed concept with a centered protected
  domain core, one continuous blue loop, four symmetric directional bridges,
  a complete gunmetal outer frame, with the shared adaptive grid visible
  behind it.

The implementation must not recreate complex diagram topology with SVG, CSS,
canvas, WebGL, or icon libraries. CSS is allowed only for the shared background
grid and alpha-derived drop shadow.

The page uses a modern system sans stack for display and body text. Display
headings stay at weight 500 or below with line height at least equal to their
font size, and multiline proof and closing headings use at least 1.04. It must
not use Baskerville, Iowan Old Style, Times New Roman, or another legacy display
serif. This keeps the typography neutral, current, and legible without adding
an external font dependency or network request.

The app does not execute Framework packages in the browser and does not reuse
the removed website implementation. The landing page remains server rendered;
the retired change-impact sections contribute no public HTML, CSS, JavaScript,
copy, or selected illustration.

## Quality Gates

- one static `/` content route and only required Next.js shell files under
  `app`;
- `/llms.txt` exactly matches the generated public documentation inventory while
  removed human-facing content routes remain absent;
- no import or copy from the removed website implementation;
- all information and actions remain readable without JavaScript;
- the retired Visible Change and Impact Preview sections are absent;
- every anchor has a clickable `href` and placeholder destinations are allowed;
- no horizontal overflow at 390px and 320px;
- phone, tablet, and desktop receive the supplied Photoroom WebP derivatives
  through `srcset` and `sizes`, with source-bounded density and no artificial
  enlargement of the 2400px Domain Rail master;
- default CI validates committed public illustration derivatives without the
  Git-ignored local artwork tree; `ASYRA_LOCAL_ARTWORK_TESTS=1` validates local
  source-master hashes and build contracts on an authoring workstation;
- all six image containers expose the same adaptive CSS grid contract plus six
  distinct alpha-aware contact and cast `drop-shadow()` vectors at 2048px,
  1440px, 864px, 820px, 390px, and 320px; dark stages retain a restrained blue
  ambient reflection;
- desktop and mobile screenshots pass a source-independent edge-contrast
  sharpness oracle in addition to the 2x density check;
- all selected complex visual groups use the six immutable, hash-locked
  Photoroom masters and their lossless responsive derivatives;
- the domain rail is one complete continuous composition with exact labels,
  reference card proportions, both edge assemblies, and reference bottom
  clearance; the closing uses the supplied transparent reviewed concept and
  its three responsive WebP sources;
- reference line breaks and two-column geometry match the 864px V04 authority;
- every heading and interface label resolves through the modern system sans
  stack without a legacy display serif;
- display headings use weight 500 or below and breathable computed line height;
- CTA hover and focus become brighter than the default red instead of darker;
- every feature section uses generous top and bottom padding and no separator
  line;
- CTA text remains on one line;
- keyboard focus remains visible and reduced motion removes nonessential
  transitions;
- public text contains no em dash, en dash, false company identity, or 2025
  footer year; and
- Inspector, tests, typecheck, lint, production build, route smoke, and visual
  review pass.

## Definition of Done

The homepage is a fresh implementation of the approved V04 composition, uses
the six immutable Photoroom true-alpha masters and their source-bounded
responsive derivatives, applies one adaptive CSS engineering grid and six
asset-specific alpha-derived directional shadow treatments to the illustration
stages, passes perceptual
sharpness oracles, preserves exact labels and topology, and preserves approved
line breaks without accidental visual reinterpretation. Local source artwork
is Git-ignored and excluded from default CI while committed public derivatives
remain independently buildable and deployable. It has no active
dependency on previous website code or assets, passes the formal gates, is
inspected from a synchronized local production preview, and is then deployed
to the linked official Website project for product-owner review. Every
full-page and section crop is inspected before completion is claimed.
