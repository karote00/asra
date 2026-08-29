# Asyra Result-First Landing Page Plan

## Status

Completed on 2026-08-10 as a child workstream of the accepted Asyra Framework
Website Program. The approved V04 composition, responsive product evidence,
and Preview-ready Landing gates passed the umbrella program's closeout.

This retained contract replaces every previous public website composition,
including committed and uncommitted Landing work.

## Goal

Build one public Asyra page that reports the result first: people can bring
knowledge from any field and build the tool their world needs on Asyra. The
page then proves that the tool can grow, that people and AI use the same action
path, that a PoC can continue into the product as the same bounded
implementation, and that every view shares one source of truth. A reader-first
Framework value comparison then shows why defining one Feature once replaces
repeated screen, AI, saved-work, undo, and synchronization logic. The product
owner retired the Visible Change proof and the later Impact Preview because
change-impact analysis is not a public product capability.

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
- one shared horizontal page geometry contract for Header, Hero, domain copy,
  PoC, proofs, Closing, and Footer, with one minimum page width, one maximum
  content width, and one responsive inline padding;
- an unlimited-domain rail immediately after the hero;
- one code-native PoC-to-product storyboard with two ordered Traditional and
  Asyra flows, four stages per flow, recurring human roles, and direct
  comparisons that contrast repeated handoffs and rebuilding with one bounded
  Feature continuing through engineering review;
- one semantic HTML and CSS Framework value comparison, placed after the PoC
  story and before the three proof sections, that contrasts the maintenance
  cost of separate product edits with one bounded change inside the Feature
  that owns the requested behavior;
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
- a domain-owned closing statement and compact navigation-only footer; and
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
  in this task, the product-owner PoC-to-product continuity decision, current
  Framework product truth, and existing environment configuration.
- **Required gates:** Inspector contract, semantic regression test, strict
  typecheck, site lint, production build, route smoke, no-JavaScript reading,
  reduced motion, and synchronized full-page plus section-level 1440px, 864px,
  820px, 390px, and 320px visual review, including the PoC-to-product
  storyboard and CTA default, hover, and focus states.
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
8. PoC-to-product continuity through the same bounded implementation;
9. one canonical runtime flow explainer;
10. connected in-page and Website Platform actions;
11. responsive true-alpha Photoroom raster assets;
12. adaptive code-drawn grids and alpha-aware shadows at every review size;
13. a navigation-only footer without redundant year or license metadata; and
14. complete no-client and reduced-motion reading; and
15. public machine-readable discovery independent from supporting content pages.

## Content Contract

The page must include these exact anchors:

- `Build the tool your world needs.`
- `You bring the domain knowledge. AI builds with Asyra. Your tool stays easy to extend, automate, and undo.`
- `One foundation. Any field.`
- `Add what your workflow needs without rebuilding the rest.`
- `People and AI follow the same governed action path.`
- `One source of truth across every feature and view.`
- `Prove it once. Keep what works.`
- `Keep validated work moving.`
- `What proves the idea becomes the starting point for the product.`
- `One feature request. One place to change.`
- `Bring your domain. Keep its logic.`

Calls to action use only `Start building` and `See examples`. Navigation and
footer links resolve to approved Website Platform or project source
destinations, and every link has a clickable non-empty `href` attribute. Public
copy contains no Unicode em dash or en dash.

The footer contains project navigation only. It does not repeat year, license,
open-source, company, corporation, or incorporated-owner metadata.

The Website publishes the generated public documentation inventory at
`/llms.txt`. This machine-readable discovery surface mirrors
`docs/public/llms.txt`. Supporting human-facing routes belong exclusively to
the Website Platform contract; they may be restored without changing or
contributing to this Landing route.

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

The Landing route owns one shared horizontal page geometry contract. A single
minimum page width prevents unsupported collapse, while one maximum content
width and one responsive inline padding establish the same left and right
content edges for Header, Hero, domain copy, PoC, all proofs, Closing, and
Footer. The Domain Rail is the only responsive edge exception: its continuous
track and both mobile rows touch the viewport edges below the 1720px maximum
content width, then align with the shared padded content edges once that maximum
width is reached.

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

The app also owns one semantic PoC-to-product storyboard built from eight
border-free direct raster crops of the product-owner-approved person storyboard
preview. The approved people and scenes must not be redrawn. Two ordered
Traditional and Asyra flows keep each path contiguous. Desktop aligns the flows
as two four-stage rows for direct comparison. Below 960px, the complete
Traditional sequence precedes the complete Asyra sequence instead of nesting
both paths inside each stage. At 680px and below, each storyboard panel stays
within 0.9 to 1.1 times the median rendered width of the three proof
illustrations so the comic does not overpower the surrounding product story.
The same recurring domain expert and engineer carry the narrative through idea,
validation, review, and delivery. Traditional shows a disposable prototype
crossing handoff and rewrite steps; Asyra keeps one visibly continuous bounded
Feature through domain validation, engineering review, hardening, and product
delivery. Semantic HTML labels expose the same meaning without relying on color
or illustration geometry. The storyboard must not claim that a PoC is
production-ready without engineering review, tests, security, or performance
hardening.

The app owns one code-native Framework value comparison immediately after the
PoC story. It explains change cost: one product request can become separate
maintenance edits for the product screen, AI action, saved work, undo/redo,
and synchronized users. With Asyra, the request stays inside the Feature that
owns the behavior as one bounded change. This comparison does not duplicate
the proof sections below it: Grow owns modular expansion, Same Path owns the
governed human and AI action path, and One Source owns authoritative
information across views.
The Landing must not require readers to understand API, transaction,
canonical-owner, state-application, projection, or integration terminology.
The comparison stays readable without color or connector geometry. At 1440px
and 820px, Without Asyra and With Asyra remain directly comparable columns. At
390px and 320px, the complete Without Asyra story precedes the complete With
Asyra story. The Documentation Overview owns its own compact technical
presentation and does not reuse the Landing renderer.

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

The implementation must not recreate the six supplied mechanical
illustrations' complex topology with SVG, CSS, canvas, WebGL, or icon
libraries. CSS is allowed for the shared background grid, alpha-derived drop
shadow, the storyboard's uniform 2px frame, and the semantic Framework flow
map's code-native borders and connectors.

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

- one static `/` Landing route whose content, imagery, and responsive behavior
  stay independent from Website Platform supporting routes;
- `/llms.txt` exactly matches the generated public documentation inventory;
- no import or copy from the removed website implementation;
- all information and actions remain readable without JavaScript;
- the retired Visible Change and Impact Preview sections are absent;
- every anchor has a clickable `href` that resolves to an in-page, Website
  Platform, or project source destination;
- no horizontal overflow at 390px and 320px;
- the Landing Framework value comparison preserves the exact semantic order of
  many traditional file changes, one Asyra Feature definition, and consistent
  product results at 1440px, 820px, 390px, and 320px; 1440px and 820px use two
  directly comparable columns, 390px and 320px read the complete traditional
  story before the complete Asyra story, and no engineering terminology is
  required to understand the outcome;
- the PoC-to-product storyboard preserves eight border-free direct raster crops
  from the approved person preview inside one uniform 2px CSS frame contract,
  the same recurring human roles, one continuous implementation path, legible
  role labels, and natural DOM order at 1440px, 820px, 390px, and 320px; below
  960px, all four Traditional stages precede all four Asyra stages; at 680px,
  520px, 390px, and 320px, each storyboard panel remains within 0.9 to 1.1
  times the median proof illustration width;
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
- Header, Hero, domain copy, PoC, proofs, Closing, and Footer resolve to the
  same computed content edges at every review width, while each visible Domain
  Rail row remains connected to both viewport edges below 1720px and adopts
  the shared inline padding at and above 1720px;
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
full-page and section crop, including the PoC-to-product storyboard, is
inspected before completion is claimed. The code-native Framework value
comparison is also inspected as its own section crop at desktop, tablet, and
phone widths and must make the define-once result understandable without
requiring the Documentation architecture flow.
The final page keeps a 320px minimum
page width and uses one 1720px maximum content width plus one responsive inline
padding for every constrained Landing section. The Domain Rail remains full
bleed below 1720px and adopts the shared inline padding at and above that
maximum. The maximum-width contract is verified immediately below, at, and
above 1720px as well as at 1920px, 2560px, and 3840px.
