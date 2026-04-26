Never record completed plans here.

# App Plans

## In Progress

1. Professional stroke engine architecture

- umbrella architecture plan for a professional-grade stroke system covering canonical geometry, paint separation, render/hit/export unification, and dirty-graph performance rules
- establishes the required pipeline and data contracts for solid/dashed, inside/center/outside, joins/caps, dash-gap, and solid/gradient stroke paint
- plan: `docs/ai/apps/asyra-design/plans/professional-stroke-engine-plan.md`

2. Professional stroke engine execution

- implementation-ready rollout plan for the canonical stroke architecture, with hard phase gates, supported/unsupported matrices, decision tables, debug deliverables, and migration rules
- canonical algorithm flow contract:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-algorithm-flow.md`
  - defines the helper/API sequence, input/output contracts, restrictions, and
    render/hit/export packet parity rules before implementation work begins
- source-of-truth routing:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-doc-source-of-truth.md`
- support matrix:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-support-matrix.md`
- promotion ledger:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-promotion-ledger.md`
- failure triage:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-failure-triage.md`
- manual QA checklist:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-manual-qa-checklist.md`
- fast resume / new-conversation handoff:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-handoff.md`
- active execution scope is now intentionally narrowed to formal uniform-width
  stroke completion only:
  - prioritize `inside` / `outside` / `center`
  - prioritize `solid` / `dashed`
  - include `miter` / `bevel` / `round` joins
  - include `butt` / `square` / `round` caps
  - include dash pattern / dash offset behavior on supported uniform-width
    path families
  - target Figma-like stroke behavior for supported Asyra Design shape/vector
    paths, not a representative-only sample matrix
- current Phase 5 center-placement baseline now promotes:
  - `solid + center + round join` on closed center geometry
  - `solid + center + round cap` on open center geometry
  - `dashed + center + round join` on a closed orthogonal vector
  - `dashed + center + round cap` on an open vector
- paint/color expansion and variable-width rollout are now future-feature work
  for this plan:
  - existing Phase 6 / Phase 7 notes remain as historical evidence and
    architecture-compatible backlog
  - they no longer outrank unfinished uniform-width stroke behavior
- every phase now follows a mandatory pre-expansion self-review:
  - if no later phase is blocked, move the case to backlog and continue
  - if an externally exposed interface would change, stop for approval
  - if the added work is more than `20%` of the current phase scope, stop for approval
- if future gradient work resumes, it remains paint-only:
  - geometry owns stroke-region output plus bounds / UV inputs
  - paint owns gradient application, color evaluation, and sampling behavior
- Phase 7 pre-promotion variable-width probes now explicitly cover the shared
  dashed frame slicer on:
  - seam-wrap dashed-path slicing
  - acute-join interval slicing
  - asymmetric non-rectangular dashed-overlap component detection
  - constrained `inside` legality clipping on asymmetric non-overflow geometry
  - constrained `outside` legality clipping on asymmetric non-overflow geometry
- Phase 1 (`solid + center + uniform width + solid paint`), Phase 2 (`solid + inside/outside + uniform width + solid paint`), Phase 3 (`dashed + center + uniform width + solid paint`), and Phase 4A (`dashed + center + solid` with overlap/ownership enabled) are now accepted for their currently supported matrices; Phase 4A closeout is locked by `center-dashed-overlap-visual.spec.ts` + `@asyra/preset test:local`
- Phase 4B bounded groundwork is complete at its declared stop boundary, and Phase 4C dashed constrained geometry now has:
  - a scenario-matrix contract
  - a helper-level full-loop visible interval slice
  - promoted shape-generated `rect inside/outside` full-loop constrained dashed slices
  - promoted shape-generated `oval inside/outside` full-loop constrained dashed slices
  - a first promoted vector-generated closed single-network rectangle-equivalent `inside/outside` pair on the same full-loop constrained dashed path
  - a first broader promoted vector-generated closed single-network
    non-rectangle-equivalent quadrilateral `inside/outside` pair on that same
    full-loop constrained dashed path
  - a first Family D equivalence gate proving shape-generated `rect` and that
    vector-generated rectangle-equivalent fixture keep matching full-loop
    constrained dashed coverage
  - a first Phase 5 Family D equivalence gate proving shape-generated `rect`
    and closed single-network rectangle-equivalent `vector` keep matching
    `full-loop + inside + round join` constrained dashed coverage
  - a next Phase 5 Family D equivalence gate proving shape-generated `rect`
    and closed single-network rectangle-equivalent `vector` keep matching
    `full-loop + outside + round join` constrained dashed coverage
  - a next Phase 5 Family D equivalence gate proving shape-generated `rect`
    and closed single-network rectangle-equivalent `vector` keep matching
    `single-edge + inside + round cap` constrained dashed coverage
  - a next Phase 5 Family D equivalence gate proving shape-generated `rect`
    and closed single-network rectangle-equivalent `vector` keep matching
    `single-edge + outside + round cap` constrained dashed coverage
  - a first Family B promoted shape-generated `rect inside/outside` single-edge
    visible constrained dashed pair on the same bounded product path
  - a next Family B promoted vector-generated closed single-network
    rectangle-equivalent `inside/outside` single-edge visible constrained
    dashed pair on that same bounded product path
  - a next broader Family B promoted vector-generated closed single-network
    non-rectangle-equivalent quadrilateral `inside/outside` single-edge
    visible constrained dashed pair on that same bounded product path
  - a first Family C promoted shape-generated `rect inside + bevel/miter`
    corner-spanning constrained dashed representative pair on the next bounded
    product path
  - a next bounded Family C promoted shape-generated `rect outside + bevel`
    corner-spanning constrained dashed representative on that same product path
  - a matching next bounded Family C promoted shape-generated
    `rect outside + miter` corner-spanning constrained dashed representative on
    that same product path
  - a first vector-generated Family C promoted closed single-network
    rectangle-equivalent `inside + bevel` corner-spanning constrained dashed
    representative on the same bounded product path
  - a matching vector-generated Family C promoted closed single-network
    rectangle-equivalent `inside + miter` corner-spanning constrained dashed
    representative on that same bounded product path
  - a next bounded vector-generated Family C promoted closed single-network
    rectangle-equivalent `outside + bevel` corner-spanning constrained dashed
    representative on that same bounded product path
  - a matching bounded vector-generated Family C promoted closed
    single-network rectangle-equivalent `outside + miter` corner-spanning
    constrained dashed representative on that same bounded product path
  - a first broader vector-generated Family C promoted closed single-network
    non-rectangle-equivalent quadrilateral `inside + bevel`
    corner-spanning constrained dashed representative on the next honest
    bounded product path
  - a matching broader vector-generated Family C promoted closed
    single-network non-rectangle-equivalent quadrilateral `inside + miter`
    corner-spanning constrained dashed representative on that same bounded
    product path
  - a next broader vector-generated Family C promoted closed single-network
    non-rectangle-equivalent quadrilateral `outside + bevel`
    corner-spanning constrained dashed representative on that same bounded
    product path
  - a matching broader vector-generated Family C promoted closed
    single-network non-rectangle-equivalent quadrilateral `outside + miter`
    corner-spanning constrained dashed representative on that same bounded
    product path
  - a first Family B / Family D crossover gate proving shape-generated `rect`
    and that vector-generated rectangle-equivalent fixture keep matching
    single-edge constrained dashed coverage
  - a first Family E blocked app-path visual gate proving shape-generated
    `rect` with multiple eligible constrained dashed strokes stays absent until
    4C ownership is promoted
  - a next Family E blocked app-path visual gate proving self-intersecting
    constrained dashed full-loop `vector` stays absent until that unsupported
    exact topology is promoted
  - a third Family E blocked app-path visual gate proving multi-network
    constrained dashed `vector` stays absent until that ownership path is
    promoted
  - a fourth Family E app-path visual gate corrected for open-path constrained
    dashed `vector`: authored `inside` / `outside` stays in scene data, while
    visible rendering falls back to centered placement instead of disappearing
  - additional product-path and app-path guards proving center-to-constrained
    switching stays correct for repeated dashed single-network vectors:
    - real-created open vector
      - centered visibility fallback only
    - real-created simple closed vector
      - constrained multi-interval inside/outside placement
    - closed cubic vector when the sampled closed legality domain is valid
      - constrained multi-interval inside/outside placement
    - the reported closed star-like vector when the sampled closed legality
      domain is valid
      - constrained multi-interval inside/outside placement
    - exact constrained open-path and true self-intersecting fill-rule
      multi-interval geometry remains backlog
  - a first Phase 5 promoted representative proving shape-generated `rect`
    constrained dashed `full-loop + inside + round join` now renders on the
    bounded app path
  - a next Phase 5 promoted representative proving shape-generated `rect`
    constrained dashed `full-loop + outside + round join` now renders on the
    bounded app path
  - a next vector-generated Phase 5 promoted representative proving closed
    single-network rectangle-equivalent `vector`
    constrained dashed `full-loop + outside + round join` now renders on the
    bounded app path
  - a next broader vector-generated Phase 5 promoted representative proving
    closed single-network non-rectangle-equivalent quadrilateral `vector`
    constrained dashed `full-loop + outside + round join` now renders on the
    bounded app path
  - a next Phase 5 promoted representative proving shape-generated `rect`
    constrained dashed `single-edge + inside + round cap` now renders on the
    same bounded app path
  - a next Phase 5 promoted representative proving shape-generated `rect`
    constrained dashed `single-edge + outside + round cap` now renders on the
    same bounded app path
  - a next vector-generated Phase 5 promoted representative proving closed
    single-network rectangle-equivalent `vector`
    constrained dashed `single-edge + outside + round cap` now renders on the
    same bounded app path
  - a next broader vector-generated Phase 5 promoted representative proving
    closed single-network non-rectangle-equivalent quadrilateral `vector`
    constrained dashed `single-edge + outside + round cap` now renders on the
    same bounded app path
  - a first vector-generated Phase 5 promoted representative proving closed
    single-network rectangle-equivalent `vector`
    constrained dashed `full-loop + inside + round join` now renders on the
    same bounded app path
  - a next vector-generated Phase 5 promoted representative proving closed
    single-network rectangle-equivalent `vector`
    constrained dashed `single-edge + inside + round cap` now renders on the
    same bounded app path
  - a next broader vector-generated Phase 5 promoted representative proving
    closed single-network non-rectangle-equivalent quadrilateral `vector`
    constrained dashed `single-edge + inside + round cap` now renders on the
    same bounded app path
  - a next broader vector-generated Phase 5 promoted representative proving
    closed single-network non-rectangle-equivalent quadrilateral `vector`
    constrained dashed `full-loop + inside + round join` now renders on the
    same bounded app path
  - a next Phase 5 promoted representative proving shape-generated `rect`
    constrained dashed `corner-spanning + inside + round join` now renders on
    the same bounded app path
  - a next Phase 5 promoted representative proving shape-generated `rect`
    constrained dashed `corner-spanning + outside + round join` now renders on
    the same bounded app path
  - a next vector-generated Phase 5 promoted representative proving closed
    single-network rectangle-equivalent `vector` constrained dashed
    `corner-spanning + inside + round join` now renders on the same bounded app
    path
  - a next vector-generated Phase 5 promoted representative proving closed
    single-network rectangle-equivalent `vector` constrained dashed
    `corner-spanning + outside + round join` now renders on the same bounded
    app path
  - a first Phase 6 promoted representative proving shape-generated `rect`
    constrained dashed `full-loop + inside + local-bounds linear gradient
    paint` now renders on the bounded app/runtime path while reusing the same
    constrained dashed geometry packet
  - a next Phase 6 promoted representative proving shape-generated `rect`
    constrained dashed `full-loop + outside + local-bounds linear gradient
    paint` now renders on the bounded app/runtime path while reusing the same
    constrained dashed geometry packet
  - a next vector-generated Phase 6 promoted representative proving closed
    single-network rectangle-equivalent `vector`
    constrained dashed `full-loop + inside + local-bounds linear gradient
    paint` now renders on the bounded app/runtime path while reusing the same
    constrained dashed geometry packet
  - a next vector-generated Phase 6 promoted representative proving closed
    single-network rectangle-equivalent `vector`
    constrained dashed `full-loop + outside + local-bounds linear gradient
    paint` now renders on the bounded app/runtime path while reusing the same
    constrained dashed geometry packet
  - a next broader vector-generated Phase 6 promoted representative proving
    closed single-network non-rectangle-equivalent quadrilateral `vector`
    constrained dashed `full-loop + inside + local-bounds linear gradient
    paint` now renders on the bounded app/runtime path while reusing the same
    constrained dashed geometry packet
  - a next broader vector-generated Phase 6 promoted representative proving
    closed single-network non-rectangle-equivalent quadrilateral `vector`
    constrained dashed `full-loop + outside + local-bounds linear gradient
    paint` now renders on the bounded app/runtime path while reusing the same
    constrained dashed geometry packet
  - a next Phase 6 promoted representative proving shape-generated `rect`
    constrained dashed `single-edge + inside + local-bounds linear gradient
    paint` now renders on the bounded app/runtime path while reusing the same
    constrained dashed geometry packet
  - a next Phase 6 promoted representative proving shape-generated `rect`
    constrained dashed `single-edge + outside + local-bounds linear gradient
    paint` now renders on the bounded app/runtime path while reusing the same
    constrained dashed geometry packet
  - a next vector-generated Phase 6 promoted representative proving closed
    single-network rectangle-equivalent `vector` constrained dashed
    `single-edge + inside + local-bounds linear gradient paint` now renders on
    the bounded app/runtime path while reusing the same constrained dashed
    geometry packet
  - a next vector-generated Phase 6 promoted representative proving closed
    single-network rectangle-equivalent `vector` constrained dashed
    `single-edge + outside + local-bounds linear gradient paint` now renders on
    the bounded app/runtime path while reusing the same constrained dashed
    geometry packet
  - a next broader vector-generated Phase 6 promoted representative proving
    closed single-network non-rectangle-equivalent quadrilateral `vector`
    constrained dashed `single-edge + inside + local-bounds linear gradient
    paint` now renders on the bounded app/runtime path while reusing the same
    constrained dashed geometry packet
  - a next broader vector-generated Phase 6 promoted representative proving
    closed single-network non-rectangle-equivalent quadrilateral `vector`
    constrained dashed `single-edge + outside + local-bounds linear gradient
    paint` now renders on the bounded app/runtime path while reusing the same
    constrained dashed geometry packet
  - a next Phase 6 promoted representative proving shape-generated `rect`
    constrained dashed `inside + bevel + corner-spanning + local-bounds
    linear gradient paint` now renders on the bounded app/runtime path while
    reusing the same constrained dashed geometry packet
  - a next vector-generated Phase 6 promoted representative proving closed
    single-network rectangle-equivalent `vector` constrained dashed
    `inside + bevel + corner-spanning + local-bounds linear gradient paint`
    now renders on the bounded app/runtime path while reusing the same
    constrained dashed geometry packet
  - a next broader vector-generated Phase 6 promoted representative proving
    closed single-network non-rectangle-equivalent quadrilateral `vector`
    constrained dashed `inside + bevel + corner-spanning + local-bounds
    linear gradient paint` now renders on the bounded app/runtime path while
    reusing the same constrained dashed geometry packet
  - a next Phase 6 promoted representative proving shape-generated `rect`
    constrained dashed `outside + bevel + corner-spanning + local-bounds
    linear gradient paint` now renders on the bounded app/runtime path while
    reusing the same constrained dashed geometry packet
  - a next vector-generated Phase 6 promoted representative proving closed
    single-network rectangle-equivalent `vector` constrained dashed
    `outside + bevel + corner-spanning + local-bounds linear gradient paint`
    now renders on the bounded app/runtime path while reusing the same
    constrained dashed geometry packet
  - a first Phase 6 Family D equivalence gate proving shape-generated `rect`
    and closed single-network rectangle-equivalent `vector` keep matching
    `full-loop + inside + local-bounds linear gradient paint` constrained
    dashed coverage on the same promoted geometry packet
  - a matching product-path unit contract plus app-path visual benchmark contract
- Phase 4B groundwork now includes:
  - canonical legality-domain viewer
  - packet-level constrained solid ownership overlay
  - ownership-aware legality clipping helper with no-op preservation on the
    current promoted slice
  - deterministic multi-network vector ownership-diagnostics merge without
    graphic-local id collisions
  - helper-level inside overflow clipping plus a declared outside single-edge
    convex sub-slice
  - convex outside corner-overflow partitioning into disjoint complement
    sectors
  - canonical shared overlap regions for two-candidate convex ownership
    components
  - exact candidate-set ownership regions for nested and partial-overlap
    convex multi-candidate ownership components
  - deterministic four-candidate partial-overlap chain support on the same
    convex exact-subset owner-domain path
  - deterministic four-candidate branch-topology support on the same convex
    exact-subset owner-domain path
  - mixed-topology multi-polygon candidate support on the same convex
    exact-subset owner-domain path
  - orthogonal non-convex single-polygon candidate support via deterministic
    canonical rectangle decomposition on the same exact-subset owner-domain
    path
  - non-orthogonal non-convex single-polygon candidate support via
    deterministic bounded ear decomposition on that same exact-subset
    owner-domain path
  - mixed-topology candidate support that includes orthogonal non-convex
    packet pieces on that same exact-subset owner-domain path
  - mixed-topology candidate support that includes non-orthogonal
    non-convex packet pieces on that same bounded ear-decomposition
    exact-subset owner-domain path
  - mixed-topology candidate support that includes multiple non-orthogonal
    non-convex packet pieces on that same bounded ear-decomposition
    exact-subset owner-domain path
  - orthogonal non-convex packet subtraction via the same canonical rectangle
    decomposition while preserving disconnected local remainders
  - non-orthogonal non-convex packet whole-drop when exact foreign-owned
    regions cover the whole non-owner packet on that same bounded
    ear-decomposition path
  - mixed-topology packet subtraction when the non-owner packet includes
    orthogonal non-convex pieces on that same bounded canonical-rectangle
    path
  - mixed-topology packet whole-drop when the non-owner packet includes
    non-orthogonal non-convex pieces and exact foreign-owned regions cover
    all packet pieces on that same bounded ear-decomposition path
  - mixed-topology packet subtraction when the non-owner packet includes
    non-orthogonal non-convex pieces on that same bounded ear-decomposition
    path
  - mixed-topology packet subtraction when the non-owner packet includes
    multiple non-orthogonal non-convex pieces on that same bounded
    ear-decomposition path
  - exact foreign-owned outside polygon removal plus convex partial
    foreign-owned region subtraction as the first true owner-domain clipping
    slices
  - real app-path visual benchmark proving owner stroke visibility while
    foreign-owned exact-match outside polygons remain absent
  - targeted closeout via `constrained-solid-legality-visual.spec.ts` + `@asyra/preset test:local`
- plan: `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

3. Dashed center geometry scenario matrix

- scenario-family-first test contract for Phase 3 dashed center geometry
- defines the required topology/angle/pattern families, benchmark semantics,
  and the rule that incident regressions must map back to explicit scenarios
- plan: `docs/ai/apps/asyra-design/plans/dashed-center-scenario-matrix.md`

4. Center dashed overlap / ownership scenario matrix

- scenario-family-first test contract for Phase 4A overlap graph, component
  extraction, ownership priority, and component-local bailout on center dashed
  geometry
- keeps overlap/ownership work anchored to geometry families instead of
  incident-specific ownership patches
- plan: `docs/ai/apps/asyra-design/plans/center-dashed-overlap-ownership-scenario-matrix.md`

5. Constrained solid ownership / legality scenario matrix

- scenario-family-first test contract for Phase 4B canonical legality domains,
  constrained eligibility, non-overflow preservation, and legality-domain
  viewer behavior on solid geometry
- keeps constrained legality work anchored to topology/ownership semantics
  instead of shape-specific clipping patches
- plan: `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`

6. Dashed constrained geometry scenario matrix

- scenario-family-first test contract for Phase 4C dashed constrained legality,
  ownership, and clipping
- starts with a deliberately narrow first slice: full-loop visible constrained
  dashed intervals on closed paths
- current promoted product slices are currently limited to:
  - shape-generated `rect`
  - `position: inside`
  - `position: outside`
  - one full-loop visible constrained dashed interval
  - shape-generated `oval`
  - `position: inside`
  - `position: outside`
  - one full-loop visible constrained dashed interval
  - vector-generated closed single-network rectangle-equivalent path
  - `position: inside`
  - `position: outside`
  - one full-loop visible constrained dashed interval
  - vector-generated closed single-network non-rectangle-equivalent
    quadrilateral path
  - `position: inside`
  - `position: outside`
  - one full-loop visible constrained dashed interval
  - shape-generated `rect`
  - `position: inside`
  - `position: outside`
  - one single-edge visible constrained dashed interval
  - vector-generated closed single-network rectangle-equivalent path
  - `position: inside`
  - `position: outside`
  - one single-edge visible constrained dashed interval
  - vector-generated closed single-network non-rectangle-equivalent
    quadrilateral path
  - `position: inside`
  - `position: outside`
  - one single-edge visible constrained dashed interval
  - shape-generated `rect`
  - corner-spanning promoted representatives:
    - `position: inside + join: bevel`
    - `position: inside + join: miter`
    - `position: outside + join: bevel`
    - `position: outside + join: miter`
  - vector-generated closed single-network rectangle-equivalent path
  - corner-spanning promoted representatives:
    - `position: inside + join: bevel`
    - `position: inside + join: miter`
- vector-generated closed single-network non-rectangle-equivalent
  quadrilateral path
- corner-spanning promoted representatives:
  - `position: inside + join: bevel`
  - `position: inside + join: miter`
- `position: outside + join: bevel`
- `position: outside + join: miter`
- open-path authored `inside` / `outside` vector strokes now fall back to
  centered rendering; open-path constrained clipping itself remains blocked
- simple closed single-network vector constrained dashed strokes with repeated
  multi-interval patterns now route through constrained inside/outside
  placement when the closed legality domain is valid
- true self-intersecting constrained dashed multi-interval geometry remains
  blocked until the fill-rule legality domain is declared and promoted
- broader corner-spanning beyond that first broader vector
  non-rectangle-equivalent `inside + bevel/miter` plus
  `outside + bevel/miter` representatives and broader non-full-loop
  constrained dashed slices remain blocked/pending
- broader multi-network / broader vector constrained dashed slices remain
  blocked/pending
- multiple eligible constrained dashed strokes remain blocked until 4C
  ownership is promoted
- plan: `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`

7. Constrained solid general owner-domain algorithm

- next algorithm-class plan once Phase 4B bounded expansion reaches its stop
  condition
- covers broader mixed-topology subtraction, broader general non-convex
  owner-domain construction, and the first promoted scenarios that require
  general polygon-boolean-class behavior instead of bounded normalization
- first promoted broader scenario now starts with deterministic exact
  candidate-set ownership on nested five-candidate constrained solid
  components beyond the former four-candidate cap
- second promoted broader scenario now extends that same path to nested
  six-candidate constrained solid components beyond the former five-candidate
  cap
- third promoted broader scenario now extends that same path to nested
  seven-candidate constrained solid components beyond the former six-candidate
  cap
- fourth promoted broader scenario now extends that same path to nested
  eight-candidate constrained solid components beyond the former seven-candidate
  cap
- fifth promoted broader scenario now extends that same path to nested
  nine-candidate constrained solid components beyond the former eight-candidate
  cap
- sixth promoted broader scenario now replaces the artificial nested-convex
  candidate cap with a subset-budget gate, proven by ten nested constrained
  solid components on the same exact candidate-set path
- seventh promoted broader scenario now extends that plan into mixed-topology
  five-candidate constrained solid components across disconnected
  multi-polygon sub-packets, with app-path visual coverage on a multi-network
  vector-generated path
- eighth promoted broader scenario now extends that same mixed-topology path
  to six-candidate constrained solid components across disconnected
  multi-polygon sub-packets, with app-path visual coverage on a multi-network
  vector-generated path
- ninth promoted broader scenario now extends that broader mixed-topology
  subtraction path to retained local miter remainders when a bevel owner clips
  disconnected vector-generated sub-packets, with app-path visual coverage on a
  multi-network vector-generated path
- tenth promoted broader scenario now closes the first Family D equivalence
  gate by proving shape-generated and vector-generated closed rectangles keep
  equivalent local miter remainders on that broader subtraction path
- eleventh promoted broader scenario now extends that broader mixed-topology
  subtraction family to a disconnected vector-generated path where one
  sub-packet is a non-orthogonal non-convex piece, and the local miter
  remainder still remains visible on the final product path
- twelfth promoted broader scenario now closes the first Family B
  equivalence gate for non-orthogonal non-convex mixed-topology input by
  proving two equivalent vector-generated paths keep deterministic owner-domain
  construction and equivalent local miter remainders on that broader
  subtraction path
- thirteenth promoted broader scenario now extends that broader
  mixed-topology subtraction family to vector-generated paths where multiple
  disconnected sub-packets are non-orthogonal non-convex pieces, while the
  local miter remainders still remain visible on the final product path
- current routing:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-algorithm-flow.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-promotion-ledger.md`

## Near-Term

1. Reduce app-level internal coupling

- remove internal-path imports (for example keymap source path)

2. Gradient move drag 120 FPS (multi-selection)

- plan: `docs/ai/apps/asyra-design/plans/vector-gradient-move-120fps-plan.md`


## Mid-Term

1. Advanced selection workflows

- marquee/lasso or richer multi-selection interactions

2. Property panel capability growth

- richer vector/path controls
- per-feature contextual property sections

3. Performance scaling

- hover/select hit-test strategy improvements for large documents

## Deferred

1. Auto-layout app UX once framework support is ready
2. Additional design-domain tools built on the same app architecture
