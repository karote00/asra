# Asyra Website Visual Implementation Handoff

## Authority And Selection

This handoff translates the inspected Material Blueprint direction into an
implementation contract. The selected direction is not a theme applied to a
generic documentation template. It uses a continuous working sheet, structural
registration marks, topology, transaction brackets, and evidence traces to make
Asyra's ownership model visible.

Material Blueprint is primary because it gives a worldwide non-engineer the
clearest entrance: what they can create, which knowledge they own, and why the
result remains understandable. Topology Observatory contributes coordinates and
route depth to Runtime Atlas. Signal Ledger contributes state, failure, evidence,
and timeline language. The rejected directions remain useful evidence, but their
technical density must not become the Landing page's price of entry.

The PNG boards are inspected visual evidence, not product copy, runtime truth, or
production assets. Recreate the selected language with repository-owned HTML,
CSS, SVG, Canvas, and verified runtime data. Do not import, crop, trace, or ship
the generated rasters in the website.

## Global Audience And Progressive Disclosure

The public site serves everyone worldwide, including people who do not identify
as engineers. The information order is fixed:

1. **Possibility and outcome:** build the visual or information product your
   world needs.
2. **Creator ownership:** the App supplies its domain knowledge, rules, and
   product decisions.
3. **Predictable action:** Asyra supplies reusable infrastructure that keeps
   actions, ownership, state, and results observable.
4. **Framework mechanics:** packages, APIs, transactions, owners, providers,
   projections, and evidence appear only when the reader asks for depth.

Whiteboards, design tools, BIM, VR, industrial simulation, AI-facing information
models, and other domains are App-owned possibilities. They are not bundled
Framework promises. Asyra Design is the current reference product and
`create-asyra-design-app` is the product-building beginner entrance. The sample
and Framework documentation remain the Framework-learning entrance. Neither path
is presented as lesser.

Use plain international English, short active sentences, and literal action
labels. Avoid idioms, culture-specific metaphors, and unexplained acronyms in the
first layer. Layouts must tolerate at least 35% text expansion without clipping,
overlap, or meaning loss.

## Responsive Composition

### Frame And Breakpoints

- `--page-max`: 1440px; the canvas remains centered above that width.
- `--reading-max`: 72ch for prose; preferred body measure is 62–68ch.
- `--content-gutter`: `clamp(20px, 4vw, 64px)`.
- `--section-block`: `clamp(64px, 9vw, 128px)`.
- Wide, 1024px and above: narrative and evidence may use a 7/5 or 8/4 split.
- Compact, 768–1023px: preserve two columns only when both remain at least
  320px; otherwise stack in DOM order.
- Narrow, below 768px: one continuous column, no off-canvas diagram overflow.
- Reference narrow widths are 390px and 320px. No required action may depend on
  horizontal page scrolling.

Breakpoints respond to content pressure, not device names. The logical DOM order
is narrative, action, explanation, evidence. CSS placement may create wide-screen
adjacency, but it must not reorder screen-reader or keyboard navigation.

### Structural Anatomy

Every major view may share these parts without requiring one universal component:

- **Header:** Asyra wordmark, primary destinations, release evidence, and one
  clear entry action.
- **Working frame:** warm reading sheet within the dark site shell; never a pile
  of interchangeable floating cards.
- **Section band:** eyebrow, outcome-led heading, concise explanation, then an
  optional technical reveal.
- **Semantic mark:** route, bracket, owner node, accepted diamond, failure X, or
  roadmap hatch only when it carries meaning.
- **Evidence rail:** verified source, owner, state, or next reading path.

On narrow screens, the header becomes a labeled menu button. The navigation sheet
is a modal dialog with a visible close action, focus trap, inert background,
Escape support, and focus return to the trigger. Reading content never slides
inside the navigation animation.

## Typography

- Display: `"Arial Narrow", "Aptos Display", "Helvetica Neue", sans-serif`.
  Use weight and tracking, not an external condensed-font dependency.
- Body: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif`.
- Technical: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
  "Liberation Mono", monospace`.
- Display scale: `clamp(48px, 8vw, 112px)` with line-height 0.88–0.98.
- H1 below the hero: `clamp(40px, 5vw, 72px)`; H2: `clamp(30px, 3.5vw, 48px)`;
  H3: 22–28px; body: 17–19px at 1.6–1.75; small evidence: 13–14px at 1.45.
- Do not set ordinary prose below 16px. Mono labels use uppercase only for short
  owner, state, coordinate, and evidence labels.
- Headings wrap naturally. Do not hard-code line breaks that become incoherent
  when translated.

## Color, Surface, And Contrast Tokens

| Token | Value | Semantic role |
| --- | --- | --- |
| `--paper` | `#F3EFE3` | primary reading and working surface |
| `--paper-elevated` | `#FAF7EF` | focused inset without glass effects |
| `--ink` | `#14171C` | body text and canonical neutral marks |
| `--shell` | `#071018` | site frame and Runtime Atlas surround |
| `--intent` | `#173F8F` | intent, canonical apply route, links, focus |
| `--transaction` | `#E25532` | transaction bracket and failure geometry |
| `--accepted` | `#2E6B4A` | committed or verified result |
| `--optional` | `#7655A8` | optional composition and provider route |
| `--roadmap` | `#76736C` | verified future boundary and muted metadata |
| `--rule` | `#B8B2A5` | ordinary divider and registration mark |

On `--paper`, contrast ratios are approximately 15.63:1 for ink, 8.52:1 for
intent, 5.51:1 for accepted, and 5.03:1 for optional. Transaction orange is
3.27:1 on paper: use it for brackets, thick geometry, icons, or large labels,
not small body copy. Error explanations use ink with an orange X and explicit
text. Paper on the dark shell is 16.66:1.

Surfaces use 1px rules, occasional 2px semantic routes, and square or 2–6px
corners. No glassmorphism, ambient gradient blobs, generic drop-shadow stacks,
or decorative card grids. Depth comes from containment, crop, coordinates,
overlap, and route continuity. Paper grain and architectural line texture must
be lightweight CSS or SVG patterns and must disappear under forced-colors or
when they reduce readability.

## Spacing And Density

Use a 4px base with the working set `4, 8, 12, 16, 24, 32, 48, 64, 96, 128`.
Control clusters use 8–12px gaps; related content uses 16–24px; narrative changes
use 48–96px. Documentation tables and evidence ledgers may be denser than prose,
but they must preserve 44×44px interactive targets and at least 8px separation
between adjacent targets.

Atlas density is earned by inspection. Landing density stays low until the first
plain-language promise and two beginner actions have been read.

## Semantic Shape Language

Color never carries meaning alone:

- solid indigo arrow: intent or canonical apply route;
- dashed violet arrow: optional Preset or Provider composition;
- vermilion bracket: open transaction boundary;
- green diamond plus `accepted` or `committed`: verified canonical result;
- vermilion X plus explanatory copy: failure with no canonical change;
- numbered owner markers: deterministic activation order;
- indigo current bar: supported current Framework capability;
- outline circle: App-owned product possibility;
- crosshatch plus source label: verified roadmap boundary;
- muted route: unavailable, bypassed, or not active, with a text reason.

Factory is the transaction owner. Scene and Props are canonical owners. Preset
defaults and Provider adapters are optional composition. UI Projection consumes
canonical state; it is not a canonical owner. Future non-visible runtime work is
roadmap and remains outside the current route.

## Interaction State Contract

- **Resting:** text and purpose are legible without hover.
- **Hover:** underline or route emphasis may move by at most 2px; layout does not
  shift and hover is never the only disclosure mechanism.
- **Focus visible:** 2px `--intent` outline with at least 2px offset on paper;
  use an equivalent light outline on the dark shell. Never remove native focus
  without replacing it.
- **Active/pressed:** preserve label and location; use inset rule or 1px
  translation, not scale-only feedback.
- **Selected/current:** combine shape, label, and `aria-current` or the matching
  control state.
- **Empty:** explain what is absent and name the next valid action.
- **Loading:** reserve final geometry, expose a polite status, and do not animate
  decorative skeletons indefinitely.
- **Failure:** identify the failed owner or validation, confirm whether canonical
  state changed, and expose retry or recovery only when valid.
- **Disabled:** retain readable contrast, state why when the reason is not
  obvious, and do not use disabled styling for permissions or roadmap content.

Links remain links; buttons perform actions. Copy controls announce success
without stealing focus. Technical reveals use a button with `aria-expanded` and
keep their content in the ordinary reading flow.

## Motion And Interruption Contract

| Token | Duration | Intended use |
| --- | --- | --- |
| `instant` | 0–80ms | state and focus acknowledgement |
| `short` | 160–200ms | controls and navigation sheets |
| `medium` | 240–320ms | routes, brackets, and one-time reveals |
| `long` | maximum 480ms | a composed explanatory sequence only |

Standard easing is `cubic-bezier(.2,.8,.2,1)`. Route travel may be linear only
when it literally describes traversal. Motion never delays navigation, state
correctness, or evidence availability.

Runtime Atlas follows five observable states: resting, intent received (320ms),
transaction open (200ms), commit/result (240ms), and projections updated
(240ms). Focus stays on the Run control. Escape cancels before commit; after
commit the result remains. A new run replaces only an uncommitted visual trace.
Validation failure closes or reverses the visual route and explicitly reports no
canonical change.

Landing motion is entry-only: topology lines may begin hidden and reveal once as
their section enters. No autoplay loop, parallax, scroll hijacking, or continuous
ambient pulse. Docs navigation enters over 160–180ms; link navigation itself is
instant, and closing returns focus to the menu trigger.

Under `prefers-reduced-motion: reduce`, replace travel, scale, parallax, bracket
drawing, and sequential owner activation with simultaneous semantic state
replacement and native scrolling. Content, order, focus, status, result, and
evidence remain identical. Reduced motion is an equivalent state, not a missing
explanation.

## Accessibility And Localization

- Provide a skip link, landmarks, one H1 per document, ordered headings, and
  descriptive page titles.
- Minimum target size is 44×44px. Keyboard order follows reading order.
- Diagrams require an adjacent text explanation and a structured list or table
  exposing the same owners, routes, state, and evidence.
- Runtime announcements use polite live regions for progress and assertive
  messaging only for blocking failure. Do not continuously narrate animation.
- Forced-colors mode keeps borders, focus, current state, brackets, accepted
  state, and failure state distinguishable.
- Zoom to 200% and narrow reflow must preserve content and actions without
  two-dimensional page scrolling. Code blocks may scroll within their own
  labeled region.
- Localized text may expand by 35%; controls grow vertically and never truncate
  required action or state labels.
- Decorative coordinates and registration marks are hidden from assistive
  technology. Meaningful diagrams use names and relationships, not generated
  path descriptions.

## Per-View Implementation Annotations

### Landing: Desktop And Mobile

Use `selected-landing-responsive.png` for composition evidence. The narrative
order is outcome, creator ownership, Asyra responsibility, concrete App-owned
possibilities, Describe–Act–Verify, two beginner entrances, then the technical
route. The panorama is code-native line work and progressively simplifies at
compact widths; it is never a raster background. Mobile retains the same order
and actions rather than becoming a reduced marketing page.

### Documentation: Desktop, Mobile Navigation, Mobile Reading

Use `selected-docs-responsive.png`. Desktop has a stable hierarchy rail, a
62–68ch article, and a concise page evidence rail when room permits. Mobile
navigation is the modal sheet defined above; mobile reading removes auxiliary
rails before it reduces type or target size. Support language links to the
project's support policy. Release labels are verified from manifests and must
not imply an unverified stable release.

### Runtime Atlas: Default, Active Flow, Failure

Use `selected-atlas-states.png`. Default state explains each layer without
motion. Active state traces intent to feature and API, opens the Factory-owned
transaction, numbers canonical-owner activation, commits, then projects. The
ledger reports time, event, owner, result, and evidence from verified runtime or
deterministic sample data. Failure identifies the first failing owner and states
that no canonical change was applied.

The generated board contains `WHY IT MATTERD`; authoritative production copy is
`WHY IT MATTERS`. This recorded raster typo proves why generated text is not
content authority.

### Asyra Design Case Study And Release/Roadmap Boundary

Use `selected-case-roadmap.png`. Present Asyra Design as a real reference product
built on the Framework. Separate what the Framework currently supplies, what the
App supplies, and what users may build. Use the indigo current bar, outline App
possibility, green accepted diamond, and sourced roadmap hatch exactly as defined
in the semantic language. Do not invent dates, packages, community programs, or
future runtime capabilities.

### Motion Storyboard

Use `selected-motion-storyboard.png` for state sequencing, timing, focus,
interruption, and reduced-motion evidence. It does not prescribe geometry as a
runtime fact. The actual Atlas must derive owners, routes, results, and evidence
from accepted public contracts and project-owned data.

## Implementation Boundaries

- No generated raster, external font, stock media, analytics SDK, UI kit, or new
  dependency is required by this handoff.
- Product copy remains owned by accepted public documentation and page contracts.
- Runtime topology remains owned by accepted package manifests and runtime
  contracts; the Atlas cannot infer support from visual placement.
- Prefer semantic HTML and CSS for layout and reading. Use SVG for labeled vector
  topology and Canvas only where verified interactive scale justifies it.
- Preserve ordinary URL navigation, selection, copy, print, and browser zoom.
- The selected direction is frozen input for Website Platform, Landing, Docs,
  Runtime Atlas, synchronized visual review, and launch tasks.
- The deferred second Reimage is images only after launch. It cannot reopen this
  handoff or mutate the implemented website.
