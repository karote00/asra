/* global window */
;(() => {
  const groups = [
    'All',
    'Interaction',
    'State Commit',
    'Render Cache',
    'Stroke Pipeline',
    'Shared Geometry',
    'Fill',
    'Final Faces',
    'Render',
    'Diagnostics'
  ]

  const lanes = [
    'Interaction',
    'State Commit',
    'Render Cache',
    'Stroke Pipeline',
    'Shared Geometry',
    'Fill',
    'Final Faces',
    'Render',
    'Diagnostics'
  ]

  const latestRules = [
    'Plan completion means complete Figma stroke parity for the vector stroke families exposed by Asyra Design, proven by the Step 13 matrix and Step 30 rule-driven visual gates. The 2026-05-20 filled-star review reopened the plan because the previous rules misclassified the central filled face with an internal-hole label.',
    'Vector data changes start in feature/input code and enter state only through common APIs, validation, and transaction-bounded mutation.',
    'Render consumes committed state deltas; render code is never the authority for vector topology, stroke position, dash placement, legality, ownership, or product support.',
    'Stroke work is stage-owned and dirty-key driven: source path, normalized stroke spec, topology, shared geometry, source-family support, stroke domains, intervals, source spans, candidates, arrangement, ownership, legality, resolved regions, paint, FinalFace, render/hit/export, diagnostics, and final visual evidence.',
    'Geometry is resolved before paint. Fill, stroke, hit-test, export, diagnostics, and future shadow attach paint/effects to canonical geometry instead of rebuilding competing geometry truth.',
    'Each vector network revision builds one shared PathTopologyModel and one shared resolved vector geometry model. Shared region, loop, winding-rule, face, and boundary evidence is reused by fill, stroke-domain selection, side-resolution, legality, diagnostics, hit/export, and visual gates.',
    'Open vector path inside/outside behavior is verified as center-equivalent runtime support for the currently exposed Figma-like vector stroke matrix.',
    'Simple closed inside/outside strokes use authored source-path one-sided geometry on the resolved legal side; they must not be substituted by widened center-stroke clipping.',
    'Self-intersecting closed inside/outside solid and dashed strokes share filled-face/exterior domain evidence, but not product geometry. Shared geometry resolves filled faces, vector regions/loops, winding-rule basis, real unfilled holes, filled-filled internal adjacency, global exterior boundaries, and open path boundaries before model-specific consumption.',
    'solidMaskModel is the solid product contract: source center-stroke geometry at doubled width, authored source-vertex join/miter semantics, and an inside-fill or outside-exterior mask. Its visible render projection must draw the authored doubled source stroke through an upstream mask descriptor; flattened exact-boolean annulus polygons are not a valid outside solid visible-render source when they expose bridge/cut seam edges. Boundary split endpoints are not solid caps or joins, and boundary domains are only mask/provenance evidence.',
    'dashIntervalModel is the dashed product contract: for every selected dashed boundary split segment, both range ends receive dashed terminal half-dash coverage. The same boundary split segment must not draw into its own adjacent terminal gap; when another crossing boundary visually overlaps that gap, tests must use provenance/packet ownership to avoid mistaking crossing coverage for a full dash on the current boundary segment. Normal-length boundary split segments establish the redistributed reference gap for the current stroke, and shorter segments choose their middle dash count from that reference rhythm. The final average gap for the chosen dash count must be solved once before interval positions are emitted. There is no minimum gap clamp. Dash continuity must not cross a true self-intersection split boundary. A smooth/tangent-continuous authored source vertex on the same outside legal coverage may form one continuous dashed coverage interval before candidate generation; it must not be repaired later by post-merging terminal packets.',
    'Inside selects every filled face for sharedDomainEvidence and mask/domain eligibility. The central filled pentagon in the Figma star is a filled face and must be able to reveal inside constrained stroke. Outside selects only filled-to-exterior evidence and excludes filled-filled internal adjacency.',
    'Butt is the base dashed geometry. Square and round caps are dashed-only additive endpoint geometry attached after the base terminal dash intervals are allocated; then the assembled dashed geometry goes through overlap, legality, FinalFace, and render/export projection. A self-intersection boundary split endpoint is a dashed terminal/cap boundary, not a line-join boundary. Only authored sharp or tangent-discontinuous source vertices are line-join boundaries: when visible dashed terminal half-dashes from adjacent source segments meet at the same authored sharp source vertex on the same legal outside boundary, dashed product geometry may emit source-vertex-join coverage that responds to miter/bevel/round. Authored smooth/tangent-continuous vertices and curve-internal high curvature are continuous offset-curve coverage, not join-type coverage, and must preserve same-coverage-unit continuity without boundary-terminal-join. Cap type must not alter dash allocation, and final visual tests must not treat ordinary gap midpoint sampling as cap correctness.',
    'Fill regions, region loops, winding rules, face occupancy, real holes, and legal-boundary evidence are sharedDomainEvidence. They must not be recreated downstream as replacement geometry and must not become solid product stroke paths.',
    'Legality clips or filters existing candidate geometry only. For solid, it applies the fill/exterior mask to the doubled center-stroke candidate and preserves a seam-free visible render descriptor for masked source-stroke drawing. Exact boolean solid coverage may remain a legality, hit/export, or diagnostic oracle, but must not be painted as outside visible render when bridge/cut seams are present. For dashed, legality enforces each interval candidate’s boundary-domain filled-face/exterior side and eligibility. It must not convert filled-filled internal adjacency into outside stroke or construct replacement geometry.',
    'A single visible dash interval must remain one connected product coverage unit after legality/mask clipping. High-curvature outside clipping may prune tiny numeric residue or stitch same-interval clip fragments upstream, but renderer draw must never hide disconnected slivers.',
    'Overlap is resolved before product FinalFace/export output only when it does not erase split-range terminal identity. Self-intersecting constrained dashed product overlap collapse is scoped to a visible dash coverage unit: same-interval fragments may be arranged, but independent interval faces must not be merged into a new arranged face and boundary-terminal-join geometry must not enter product, render, hit, or export output. Boundary-terminal-join records are allowed only as explicit diagnostics, never as visible coverage or replacement terminal provenance. Constrained dashed render projection may partition bbox-connected FinalFace paint polygons inside one render entry solely to prevent alpha overdraw, but must not reintroduce render-stage masks, paint-composite masking, high-curvature global union packets, boundary-terminal-join product packets, or cross-interval FinalFace arrangement.',
    'Typed metadata carries owner, network, contour, legal-domain, interval, source-span, support, blocked, dirty-stage, side-resolution, and revision state. No helper may parse geometryId, packet order, or rendered pixels to recover semantics.',
    'FinalFace[] is the canonical source for render, hit-test, and export projection. Renderer entries draw upstream FinalFace-derived geometry and upstream solid visible-render descriptors faithfully and never repair stroke semantics. Consuming a precomputed masked-source-stroke descriptor is not renderer repair; inventing one in renderer draw code is.',
    'Final visual E2E is a rule-driven product gate: deterministic probes, global screenshot review, local zoom screenshot review, and reload performance gates must verify the Figma-like rules above, including solid miter/join parity, solid mask boundaries, no split-end cap artifacts in solid, no high-curvature solid cracks, no exact-boolean bridge/cut seam painted in outside solid visible render, every visible dashed boundary split-segment terminal half-dash, redistributed middle dash/gap placement, visible central filled-face inside stroke, exterior-only outside stroke, no high-curvature disconnected dash slivers, no double-opacity render overdraw, no product overlap created by old-flow replacement geometry, and no expensive ownership arrangement diagnostics on the normal self-intersecting solid reload path.',
    'Self-intersecting inside/center/outside solid and dashed behavior remains active until final-pixel probes prove the region-boundary domain rules for newly captured Figma cases.',
    'Reference screenshots are rule-discovery evidence only. They are not automated golden images. A captured mismatch reopens the earliest owning upstream step instead of being repaired in render output.'
  ]

  const currentExecutionState = {
    totalSteps: 30,
    planStatus: 'active-solid-mask-model-visible-render-aligned-encoded-slice',
    nextExecutableStepId: 'visible-final-result',
    nextExecutableStepNumber: 30,
    nextExecutableStepStatus: 'broader-visual-validation-next',
    stopRule:
      '2026-05-26 self-intersecting solidMaskModel Step 17/20/24/25/30 encoded slice is green for packet, vector-6 unit, focused visual, render/export metadata, reload, build, solid join-matrix, outside solid tp-13/tp-16 deterministic crack probes, and dashed regression gates. The full constrained dashed packet suite is deterministic with single-worker execution after the long split-range stress oracle was split into named parameterized cases and must not be skipped. Solid product output no longer uses boundary-domain product ribbons, sampled topology provenance, dashed terminal/cap metadata, same-paint dark-overdraw above the anti-aliasing threshold, or exact-boolean bridge/cut seam polygons as outside visible render in the encoded self-check star. The full stroke engine is still active, not complete: Step 30 needs broader global/local visual review across the remaining matrix. The 2026-05-24 outside dashed smoothness and terminal/cap gates remain dashed-only evidence. Do not rewrite dash allocation/cap/terminal/high-curvature logic for further solid repairs.',
    requiredImplementationSequence: [
      'Keep the current dashed baseline guarded with the full constrained dashed packet suite, focused dashed packet gates, arrangement, self-check star, and visual gates; do not skip the full suite. If runtime regresses, bisect by the named parameterized stress cases.',
      'Treat the current Step 17/20 solidMaskModel geometry as accepted for the encoded packet/provenance, dark-overdraw, and outside solid tp-13/tp-16 crack-probe slices only. Any new high-curvature crack mismatch must add a failing local probe and exact-boolean bridge/cut seam visibility assertion before implementation.',
      'Keep Step 17 product builders separate: solidMaskModel uses doubled authored center-stroke with source-vertex join/miter before masking; dashIntervalModel keeps dashed interval allocation, terminal half-dash, additive cap, and high-curvature continuity unchanged.',
      'Keep Step 20 solid mask legality as clipping of the doubled center-stroke candidate with inside filled-face or outside exterior masks, while preserving a seam-free visible render descriptor for masked source-stroke drawing. Do not build boundary-ribbon solid substitutes or renderer repairs.',
      'Keep Step 24/25 model metadata distinct: solid records carry solidMaskModel plus mask/domain provenance, solidMaskModelVisibleRender, solidMaskModelCoverageOracle, solidMaskModelMaskSide when present, and no dashed terminal/cap metadata; dashed records keep interval/terminal/cap/boundary metadata.',
      'Before Step 30 alignment, generate and review global screenshots plus local zoom crops for miter apex, high-curvature endpoints, self-intersection joins, and mask boundaries, and pair those crops with deterministic black-crack assertions.',
      'After every solid slice, rerun dashed regressions immediately; a dashed failure must narrow or revert that slice rather than rewrite dash allocation, terminal half-dash, additive cap, or dashed high-curvature continuity.',
      'Do not revive the rejected segment-piece/body solid rewrite without bounded-cost failing tests; it regressed vector-6 performance, polygon count, and bridge probes.'
    ],
    currentSolidMaskModelSliceEvidence: [
      {
        id: 'solid-mask-model-focused-packet-contract',
        command:
          'yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-solid-stroke-packets.test.ts -t "(require self-intersecting inside solidMaskModel|require self-intersecting outside solidMaskModel|keep self-check self-intersecting solid join matrix|keep self-intersecting solid reload path off boundary-domain packet generation)" --reporter=verbose',
        currentResult: 'passes after Step 17/20 solidMaskModel slice',
        evidence: [
          'self-intersecting solid packets carry authored source-vertex provenance',
          'self-intersecting solid packets use :solid-mask geometry ids instead of boundary-domain product geometry',
          'self-intersecting solid packets carry no dashed terminal metadata',
          'single solid star render avoids constrained-solid:self-intersecting-boundary-domain-packets',
          'self-check solid join matrix rejects boundary-domain ribbon products and keeps coverage near the authored source path',
          'outside solid render metadata distinguishes masked-source-stroke visible render from exact-boolean coverage oracle'
        ]
      },
      {
        id: 'solid-mask-model-full-unit-contracts',
        command:
          'yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-solid-stroke-packets.test.ts --reporter=verbose && yarn workspace @asyra/preset exec vitest run src/__tests__/vector-constrained-solid-stroke.test.ts --reporter=verbose && yarn workspace @asyra/preset exec vitest run src/__tests__/stroke-candidate-arrangement.test.ts --reporter=verbose',
        currentResult:
          'passes after Step 24/25 solid metadata hardening: constrained solid 18 tests, vector constrained solid 24 tests, stroke candidate arrangement 26 tests',
        evidence: [
          'reported vector-6 self-intersecting inside/outside solid now expects exact-constrained solidMaskModel records instead of local-side candidates',
          'solid sourceSpanIds use authored source segments and source vertices, not sampled topology vertices',
          'solid exact-union and render-projection records omit figmaLikeSplitRangeTerminals when no dashed terminals exist',
          'solid mask-model visible render carries masked-source-stroke metadata while exact-boolean coverage remains available as an oracle for hit/export/diagnostics',
          'outside solid visible render avoids painting exact-boolean bridge/cut seam polygons for the encoded self-check slice'
        ]
      },
      {
        id: 'solid-mask-model-self-check-e2e-contract',
        command:
          'yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts -g "self-intersecting inside solid uses solidMaskModel|self-intersecting outside solid uses solidMaskModel|self-intersecting solid join matrix" --workers=1',
        currentResult:
          'passes after Step 17/20 solidMaskModel visible-render slice for metadata, side leakage, dark-overdraw, join matrix, and outside tp-13/tp-16 crack probes',
        evidence: [
          'solid render/export packet metadata uses :solid-mask geometry ids',
          'solid render/export packet metadata includes no figmaLikeTerminalRole',
          'solid render/export packet metadata includes no figmaLikeSplitRangeTerminals',
          'solid join matrix asserts no illegal side leakage and no same-paint dark-overdraw component above the anti-aliasing threshold',
          'outside solid local zoom crops for tp-13 and tp-16 are paired with deterministic black-crack assertions'
        ]
      },
      {
        id: 'solid-mask-model-vector-6-e2e-contracts',
        command:
          'focused vector-6 solid visual gates in solid-constrained-stroke-visual.spec.ts, reported-vector-6-solid-visual.spec.ts, and reported-vector-6-solid-outside-switch.spec.ts',
        currentResult:
          'passes after Step 24/25 solid metadata hardening: 27 focused solid visual tests, 3 reported-vector-6 visual tests, and 1 outside-switch test',
        evidence: [
          'vector-6 probes now assert solidMaskModel mask/provenance and no dashed terminal fields instead of local-side candidate provenance',
          'inside solid global/local probes preserve every authored segment and accept reviewed mask coverage thresholds',
          'outside solid switch remains bounded by the current polygon/point budget and does not freeze'
        ]
      },
      {
        id: 'solid-mask-model-reload-contract',
        command:
          'yarn workspace @asyra/asyra-design test:e2e e2e/vector-stroke-refresh.spec.ts -g "self-intersecting inside solid star fast after refresh" --workers=1',
        currentResult: 'passes after Step 17/20 solidMaskModel slice',
        evidence: [
          'single pen-drawn self-intersecting inside solid star reloads under the existing 2-second contract',
          'normal solid reload path no longer emits boundary-domain solid packet generation'
        ]
      },
      {
        id: 'dashed-regression-after-solid-slice',
        command:
          'yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts -g "self-intersecting inside dashed|self-intersecting outside dashed|self-intersecting inside solid|self-intersecting outside solid|self-intersecting solid join matrix" --workers=1 && yarn workspace @asyra/asyra-design test:e2e e2e/stroke-rule-driven-dashed-visual.spec.ts --workers=1',
        currentResult:
          'passes after current solid slice: self-check star 10 tests and rule-driven dashed visual 4 tests',
        evidence: [
          'self-check star keeps solid and dashed product models separate in the same fixture family',
          'rule-driven dashed visual probes still preserve terminal half-dashes, redistributed gaps, cap behavior, and projection provenance after solid metadata hardening'
        ]
      },
      {
        id: 'solid-build-contract',
        command: 'yarn workspace @asyra/preset build:preset',
        currentResult: 'passes after current solidMaskModel slice',
        evidence: [
          'preset build accepts the Step 17/20/24/25 solid metadata and provenance changes'
        ]
      },
      {
        id: 'dashed-baseline-status',
        command:
          'yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-dashed-stroke-packets.test.ts --reporter=verbose --maxWorkers=1 --minWorkers=1',
        currentResult:
          'passes after splitting the long split-range stress oracle into 18 named parameterized cases: 121 tests in roughly 26 seconds',
        evidence: [
          'previous no-output runtime was caused by redundant test-side point sampling over high-point-count residue polygons',
          'dash packet generation for the stress path remains bounded; the expensive oracle now uses backend residue area measurement for that stress gate',
          'ordinary outside source-path dash corner/seam join coverage is guarded without changing self-intersecting boundary-domain terminal/cap allocation'
        ],
        remainingRisks: [
          'dash allocation changes while fixing solid',
          'terminal half-dash or cap additive metadata changes while fixing solid',
          'future full-suite runtime regressions must be split or bisected by named parameterized cases, not skipped'
        ]
      }
    ],
    blockedDownstreamStepIds: ['visible-final-result']
  }

  const figmaLikeRulesByStep = {
    'input-event': [
      'Figma-like stroke behavior starts at the feature boundary: a stroke-affecting user action must become an explicit vector edit or stroke-style edit intent.',
      'Input code must not infer stroke geometry, dash placement, side selection, legal domains, or render repair.'
    ],
    'vector-api-mutation': [
      'The authored source path remains the user-authored topology: points, segments, networks, handles, and closed state.',
      'Mutations may split or edit topology, but they must not synthesize fill-boundary contours, dash product paths, or renderer-specific fallback geometry.'
    ],
    'validate-topology': [
      'Runtime validation rejects malformed topology before commit: broken references, impossible network ordering, or invalid segment endpoints never enter the stroke flow.',
      'Product support decisions such as self-intersecting support, dashed support, or inside/outside legality are classified later; they are not write-time topology validation.'
    ],
    'transaction-write': [
      'One intended vector edit or stroke-style edit maps to one intended undo transaction.',
      'Transient drag previews may update visual state, but final Figma-like stroke truth must come from the committed transaction state.'
    ],
    'data-channel-delta': [
      'Committed vector/stroke data changes publish computed-data key deltas that preserve source topology and stroke spec revisions.',
      'The data channel must not drop keys that make source path, stroke spec, topology, stroke domain, interval, candidate, legality, paint, hit/export, or final visual stages dirty.'
    ],
    'render-cache-patch': [
      'The render cache patches committed deltas into a complete render snapshot before stroke stages run.',
      'Cache reuse is valid only when the snapshot still represents the exact source path, stroke spec, fillRule, and legal-domain inputs required by Figma-like geometry.'
    ],
    'dirty-revision-graph': [
      'Dirty decisions are stage-specific and must classify source path, stroke spec, topology, shared geometry, support, stroke domains, intervals, source spans, candidates, arrangement, ownership, legality, regions, paint, final faces, render/hit/export, diagnostics, and final visual evidence.',
      'Paint-only edits must reuse geometry stages; source/topology/position/dash edits must rerun every affected upstream stage before render output reuse.'
    ],
    'render-strategy-entry': [
      'The vector render strategy is orchestration only. It passes normalized data into the ordered stroke flow and must not decide topology family, side, legality, ownership, or paint semantics.',
      'Any visual failure must be traced backward to the owning stage rather than patched at render entry.'
    ],
    'normalize-render-data': [
      'Render data normalization stabilizes authored topology and style inputs for deterministic geometry work.',
      'Normalization must not repair invalid topology into product geometry or create legacy anchor/fill-boundary fallback stroke paths.'
    ],
    'normalize-stroke-spec': [
      'NormalizeStrokeSpec is the canonical boundary for stroke width, position, cap, join, miter, dash pattern, dash offset, opacity, and paint normalization.',
      'Invalid or invisible strokes emit rejection diagnostics here; downstream geometry stages consume normalized specs only.'
    ],
    'build-path-topology': [
      'BuildPathTopologyModel creates the canonical source-path topology model: Figma winding-rule basis, source revision, topology family, contours, total length, legal-domain descriptors, and source metadata.',
      'Figma supports NONZERO and EVENODD winding rules; missing or unspecified data must not silently become even-odd when Figma default behavior should be nonzero.',
      'This step may describe self-intersections and legal domains, but it must not allocate dash intervals or create product stroke polygons.'
    ],
    'shared-geometry-model': [
      'The shared resolved geometry model is the canonical region/loop/winding-rule/face/boundary evidence for self-intersecting paths.',
      'For self-intersecting inside/outside, this model must output filled faces, real unfilled holes, filled-filled internal adjacency, global exterior boundaries, open path boundaries, and boundary-domain split segments with adjacent face occupancy, selected inside/outside eligibility, region ids, face ids, and winding-rule evidence.',
      'A central self-intersecting face must not be called a hole from contour orientation, signed area, or even-odd helper naming. It is a filled face when region/winding-rule evaluation says it is filled.',
      'Fill, stroke, diagnostics, export, and future shadow consume this sharedDomainEvidence; downstream stroke stages must not re-resolve self-intersecting side from source orientation, visible fill paint, packet order, selectedSide-only metadata, or rendered pixels.'
    ],
    'resolve-source-families': [
      'ResolveSourceFamilies returns one auditable support result for topology family, stroke family, support state, blocked reason, and legal-domain hints.',
      'Support classification must distinguish open center-equivalent, simple closed, compound, self-intersecting, center, inside, outside, solid, dashed, and unsupported combinations without spreading decisions through later helpers.'
    ],
    'resolve-stroke-domains': [
      'ResolveStrokeDomains converts topology, source-family support, normalized stroke spec, and sharedDomainEvidence into concrete mask/domain evidence for later model-specific consumption.',
      'For self-intersecting inside strokes, the domain evidence includes every filled face, including the central filled face in the Figma star. For outside strokes, the domain evidence includes only filled-to-exterior boundaries and excludes filled-filled internal adjacency. This step must not allocate dash intervals or emit product polygons.'
    ],
    'allocate-intervals': [
      'AllocateIntervals consumes the resolved stroke domain plan rather than deriving domains privately.',
      'Center and simple dashed families may allocate intervals on the canonical source/topology length domain.',
      'Only dashIntervalModel allocates intervals. Self-intersecting constrained inside/outside dashed families must allocate intervals per selected boundary split segment: dashed terminal half-dash at both ends, normal-range reference gap rhythm for middle dash count, and no dash continuity across true self-intersection split boundaries. Smooth/tangent-continuous authored source vertices on the same outside legal coverage must be coalesced into one dashed continuity interval before candidate generation when dash phase produces continuous visible coverage on both adjacent source segments. solidMaskModel bypasses this step.'
    ],
    'build-source-span-graph': [
      'SourceSpanGraph maps every interval and candidate back to resolved boundary-domain split segments, authored source spans, vertices, dash boundaries, and intersection-derived split points.',
      'Provenance must stay explicit so downstream packets can prove which boundary domain, face, source span, and intersection split point produced each visible dash or solid mask candidate. Boundary-domain evidence does not become solid product geometry.'
    ],
    'build-one-sided-candidates': [
      'BuildOneSidedCandidates turns normalized stroke specs and intervals into candidate geometry only.',
      'For self-intersecting constrained inside/outside solid strokes, solidMaskModel candidates must be authored source center-stroke geometry at doubled width with source-vertex join/miter semantics before masking. Step 14 domain evidence is mask/provenance input, not the solid product path.',
      'For self-intersecting constrained inside/outside dashed strokes, dashIntervalModel candidates are built from selected boundary-domain intervals. Outside dashed candidates must preserve butt/square/round cap and acute-angle geometry only on global exterior boundary domains.',
      'Orientation fallback, global normal choice, visible-fill dependency, high-curvature cross-segment repair, selected-side-only product geometry, boundary-domain solid product ribbons, and source-path-only dashed substitutes are invalid for this family.',
      'Smooth/tangent-continuous high-curvature anchors are not dashed join candidates. Candidate generation must consume a single pre-candidate dashed smooth-continuity interval when adjacent terminal coverage forms one visible outside coverage unit across a smooth source vertex; it must not synthesize miter/bevel/round differences, boundary-terminal-join geometry, or post-packet union replacement for those anchors. If legality clips same-interval dashed coverage into fragments, only same-interval fragments may be stitched before FinalFace.'
    ],
    'partition-arrangement-faces': [
      'Arrangement partitions candidate geometry into exact faces only for supported/gated families.',
      'Arrangement may resolve overlap and face ownership, but backend availability must not promote unsupported local-side/high-curvature behavior or fill-boundary paths into Figma product truth.'
    ],
    'resolve-ownership': [
      'Ownership is resolved from typed candidate/arrangement metadata into ownerSet and provenance records.',
      'No ownership decision may be recovered from geometryId strings, packet order, visual overlap color, or renderer output.'
    ],
    'apply-legality': [
      'Legality clips or filters existing candidate geometry against the correct legal domain for the stroke family.',
      'For self-intersecting solid inside/outside, legality applies the fill/exterior mask to the doubled center-stroke candidate even when fill paint is hidden or absent. Inside uses the filled-face mask; outside uses the exterior mask.',
      'For self-intersecting dashed inside/outside, legality enforces the selected boundary domain’s filled-face/exterior side and eligibility: inside keeps interval geometry for selected filled-face boundaries, while outside keeps only filled-to-exterior interval geometry.',
      'Legality must preserve terminal provenance for dashed output and mask/domain provenance for solid output, must not construct replacement geometry, and must not allow filled-filled internal adjacency to render as outside stroke.'
    ],
    'build-resolved-stroke-regions': [
      'Resolved stroke regions are paint-free semantic geometry packets carrying geometry, support, provenance, owner, legal-domain, interval, side-resolution, and revision metadata.',
      'Region packets must preserve enough information for FinalFace, diagnostics, hit/export, and final visual review to prove Figma-like side and interval behavior.'
    ],
    'attach-paint-payload': [
      'Paint attaches after semantic geometry is final.',
      'Paint-only changes may rerun paint and render/hit/export projection, but must not rerun or mutate topology, intervals, candidates, arrangement, ownership, legality, or region geometry.'
    ],
    'fill-region-consumer': [
      'Fill consumes shared fillRegions from the resolved geometry model and must not recompute competing self-intersection truth.',
      'Fill visibility is separate from stroke side-resolution: hidden or absent fill paint does not remove the implicit region/face/winding-rule evidence required by inside/outside stroke.'
    ],
    'build-final-faces': [
      'FinalFace[] is the canonical final geometry source after ownership, legality, regions, and paint payload attachment.',
      'FinalFace records must preserve model provenance for solidMaskModel, dashIntervalModel, and sharedDomainEvidence. Solid records expose mask/domain evidence without dashed terminal metadata; dashed records preserve boundaryDomainId, boundaryRole, interval/source-span/legal-domain/owner/side/runtime/paint metadata and collapse duplicate visual faces only without losing provenance.'
    ],
    'emit-render-hit-export-packets': [
      'Render, hit-test, and export packets are projections from FinalFace[] only.',
      'They must not restroke authored input, reconstruct center bands, group by sourceContourIds as correctness proof, create outside stroke for filled-filled internal adjacency, or use selected-side metadata as a substitute for boundary-domain eligibility evidence. Solid projections must not carry dashed terminal/cap metadata.'
    ],
    'render-entries': [
      'Render entries are renderer-ready projections of FinalFace geometry and paint payloads.',
      'Native center stroke paths are allowed only for center-equivalent semantics; constrained inside/outside entries must come from upstream one-sided/legal FinalFace geometry.'
    ],
    'mesh-render': [
      'Renderer draw code faithfully draws upstream entries.',
      'It must not repair geometry, collapse fragments, decide inside/outside side, infer legal domains, hide overlap errors, or apply Figma-like semantics.'
    ],
    'hit-export': [
      'Hit-test and export projection must match FinalFace-derived render geometry in the final non-drag state.',
      'Drag visual-only freshness may defer hit/export only when documented and tested; after commit, hit/export must prove the same Figma-like geometry as render.'
    ],
    'runtime-diagnostics': [
      'Diagnostics identify the exact product/debug/legacy branch, support state, blocked reason, owner/legal-domain provenance, side-resolution evidence, overlap state, dirty-stage trace, and final projection path.',
      'Diagnostics are evidence only; they must not create or repair product geometry.'
    ],
    'visible-final-result': [
      'The visible product result is accepted only after upstream gates pass and deterministic visual/E2E probes confirm the Figma-like rules.',
      'Final visual review must validate rule-driven screenshots and reload gates: solid miter/join parity, solid mask boundaries, no split-end cap artifacts in solid, no uncollapsed product overlap, no solid stripe seams or high-curvature cracks, boundary-domain dash placement, central filled-face inside stroke exists, outside is exterior-only, no renderer-side repair, and no expensive reload-time ownership arrangement diagnostics for accepted self-intersecting solid mask-model packets. Reference screenshots are evidence for deriving rules, not the test oracle.',
      'Outside dashed final review must cover butt, square, and round caps, including top-left acute-angle first dash shape, global-exterior-only outside behavior, terminal half-dash/gap preservation, smooth high-curvature same-coverage-unit continuity at lower-left/lower-right anchors, and no outside product packets or pixels on filled-filled internal adjacency.'
    ]
  }

  const alignmentLabels = {
    aligned: 'Aligned',
    partial: 'Partial',
    mismatch: 'Mismatch',
    blocker: 'Blocker',
    future: 'Future',
    'out-of-scope': 'Out of scope'
  }

  const steps = [
    {
      id: 'input-event',
      group: 'Interaction',
      lane: 0,
      row: 0,
      title: 'Input / feature event',
      summary:
        'A user action enters through input-system and feature-system before any vector data changes.',
      helpers: ['input.drag', 'pen', 'selectVectorPoint', 'FeatureNames.*'],
      inputs: [
        'pointer / keyboard event',
        'current tool',
        'feature session state'
      ],
      outputs: ['intended vector edit command'],
      decisions: [
        'Feature-system owns execution, session, and cancel decisions.',
        'Feature files call app common APIs instead of render or package internals.'
      ],
      next: ['vector-api-mutation'],
      risks: [
        'Bypassing feature/common APIs creates hidden state ownership and breaks transaction expectations.'
      ],
      tags: ['entry', 'feature']
    },
    {
      id: 'vector-api-mutation',
      group: 'Interaction',
      lane: 0,
      row: 1,
      title: 'Vector topology mutation intent',
      summary:
        'elementApis and vectorGeometry produce the next points / segments / networks topology.',
      helpers: [
        'elementApis.updateVectorAnchorPointPosition',
        'elementApis.updateVectorAnchorPointHandlePosition',
        'elementApis.splitVectorSegmentAtWorkspacePos',
        'elementApis.setVectorClosed',
        'vectorGeometry.movePoint',
        'vectorGeometry.updateHandle',
        'vectorGeometry.splitSegment'
      ],
      inputs: [
        'current vector topology',
        'point / segment id',
        'workspace position',
        'mutation options'
      ],
      outputs: ['next topology patch or next topology object'],
      decisions: [
        'The canonical vector model is topology-native: points, segments, and networks.',
        'There is no runtime conversion from legacy anchorPoints shapes.'
      ],
      next: ['validate-topology'],
      risks: [
        'A patch that updates points without dependent segments or networks can create cache drift downstream.'
      ],
      tags: ['vector', 'data']
    },
    {
      id: 'validate-topology',
      group: 'State Commit',
      lane: 1,
      row: 1,
      title: 'Validate vector topology',
      summary: 'Validate the topology before committing it to runtime state.',
      helpers: ['vectorGeometry.validate', 'vectorGeometry.buildPatch'],
      inputs: ['candidate points', 'candidate segments', 'candidate networks'],
      outputs: ['valid topology patch or rejected mutation'],
      decisions: [
        'Runtime writes follow valid -> write and invalid -> reject semantics.',
        'Load fallback is separate from runtime mutation validation.'
      ],
      next: ['transaction-write'],
      risks: [
        'Letting malformed topology reach render makes every later geometry stage debug the wrong problem.'
      ],
      tags: ['validation', 'state']
    },
    {
      id: 'transaction-write',
      group: 'State Commit',
      lane: 1,
      row: 2,
      title: 'Transaction-bounded write',
      summary:
        'Commit vector computed-data changes through the app/framework mutation path.',
      helpers: [
        'transactionApis.startTransaction',
        'transactionApis.updateTransaction',
        'transactionApis.endTransaction',
        'elementApis.changeComputedData',
        'controllers.sceneTree.changeElementComputedData'
      ],
      inputs: ['element id', 'validated topology patch', 'undoable option'],
      outputs: ['committed computed-data change'],
      decisions: [
        'One intended user action maps to one intended undo commit.',
        'Drag updates may be non-undoable previews; drag end commits the final intended action.'
      ],
      next: ['data-channel-delta'],
      risks: [
        'Missing transaction boundaries cause undo fragmentation or non-deterministic replay.'
      ],
      tags: ['transaction', 'state']
    },
    {
      id: 'data-channel-delta',
      group: 'State Commit',
      lane: 1,
      row: 3,
      title: 'Data-channel delta',
      summary:
        'The committed computed-data update becomes a data-channel delta for render consumers.',
      helpers: ['props-manager data channel', 'render scene-tree subscription'],
      inputs: ['before / after computed-data keys', 'element id'],
      outputs: ['changed keys delta'],
      decisions: [
        'Data channel schemas are not changed by the render pipeline.',
        'Render receives committed state; it does not invent missing vector data.'
      ],
      next: ['render-cache-patch'],
      risks: [
        'Dropping dependent keys from the delta can leave cached render snapshots stale.'
      ],
      tags: ['delta', 'state']
    },
    {
      id: 'render-cache-patch',
      group: 'Render Cache',
      lane: 2,
      row: 3,
      title: 'Render cache patch',
      summary:
        'Patch the cached render element snapshot with the committed delta.',
      helpers: ['RenderElementData cache', 'cached[key] = after'],
      inputs: ['previous cached snapshot', 'data-channel delta'],
      outputs: ['complete updated render snapshot', 'changed key set'],
      decisions: [
        'The render strategy receives a complete cached snapshot updated by deltas.',
        'Dense vector edits should avoid full computed-data rehydrate on every frame.'
      ],
      next: ['dirty-revision-graph'],
      risks: [
        'Cache drift here can make the stroke pipeline correct for the wrong source revision.'
      ],
      tags: ['cache', 'delta']
    },
    {
      id: 'dirty-revision-graph',
      group: 'Render Cache',
      lane: 2,
      row: 4,
      title: 'Dirty graph / revision set',
      summary:
        'Compute which stroke layers are dirty from the changed keys and stage revision inputs.',
      helpers: [
        'buildStrokeRuntimeRevisionSet',
        'computeStrokeDirtyKeys',
        'pathModelCache',
        'stroke render cache'
      ],
      inputs: [
        'changed keys',
        'source path revision',
        'stroke spec revision',
        'topology classification revision',
        'shared geometry revision',
        'source family revision',
        'stroke domain revision',
        'interval allocation revision',
        'ownership revision',
        'legality revision',
        'candidate revision',
        'arrangement revision',
        'resolved region revision',
        'paint revision',
        'render output revision',
        'preview/exact mode revision'
      ],
      outputs: ['dirty layers', 'stage revision map', 'cache reuse decisions'],
      decisions: [
        'For vector source-data changes, source path, topology, shared geometry, source family, stroke domain, interval, candidate, arrangement, ownership, legality, resolved region, paint, and output layers rerun.',
        'For paint-only changes, geometry layers must be reused.',
        'For open center -> inside/outside changes, geometry remains center-equivalent unless width, dash, cap, join, or source data also changed.'
      ],
      next: ['render-strategy-entry'],
      risks: [
        'If source/topology revisions are derived from geometryId or polygon signatures, cache invalidation becomes non-deterministic.'
      ],
      tags: ['dirty', 'cache']
    },
    {
      id: 'render-strategy-entry',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 0,
      title: 'Vector render strategy entry',
      summary:
        'The vector render strategy receives the updated snapshot and begins deterministic stroke/fill output work.',
      helpers: ['vectorRenderStrategy', 'renderVectorGraphic'],
      inputs: [
        'graphic',
        'updated VectorComputedData snapshot',
        'dirty metadata'
      ],
      outputs: ['normalized vector render execution'],
      decisions: [
        'Render strategy is an output bridge, not a data authority.',
        'All product render, hit-test, export, and diagnostics must consume shared stage outputs.'
      ],
      next: ['normalize-render-data'],
      risks: [
        'Render-only geometry shortcuts can diverge from hit-test/export output.'
      ],
      tags: ['render', 'entry']
    },
    {
      id: 'normalize-render-data',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 1,
      title: 'Normalize render data',
      summary:
        'Normalize the committed vector render data into a stable render input shape.',
      helpers: [
        'normalizeVectorRenderData',
        'normalizeVectorPointNodeMap',
        'normalizeVectorSegmentMap',
        'normalizeVectorNetworkMap'
      ],
      inputs: [
        'points',
        'segments',
        'networks',
        'fills',
        'strokes',
        'fillRule',
        'debug options'
      ],
      outputs: ['normalized vector render data'],
      decisions: [
        'This step adapts committed data for render consumption; it is not a substitute for runtime write validation.'
      ],
      next: ['normalize-stroke-spec'],
      risks: [
        'Fallback behavior in render must not hide invalid runtime mutation paths.'
      ],
      tags: ['normalize']
    },
    {
      id: 'normalize-stroke-spec',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 2,
      title: '1. NormalizeStrokeSpec',
      summary:
        'Validate and normalize authored stroke entries before any stroke geometry is built.',
      helpers: ['normalizeStrokeSpec'],
      inputs: ['authored stroke list', 'default stroke policy'],
      outputs: ['normalized stroke specs', 'rejection diagnostics'],
      decisions: [
        'Width, paint payload, dashPattern, dashOffset, join, cap, position, and miter limit normalize here.',
        'Invalid stroke entries are rejected or normalized before downstream geometry work.'
      ],
      next: ['build-path-topology'],
      risks: [
        'If dash or miter semantics are normalized later, interval and candidate caches can disagree.'
      ],
      tags: ['canonical', 'stroke-spec']
    },
    {
      id: 'build-path-topology',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 3,
      title: '2. BuildPathTopologyModel',
      summary:
        'Build one canonical path-topology object per vector network revision.',
      helpers: [
        'buildVectorSourceRevision',
        'buildVectorGeometryModelPath',
        'buildPathTopologyModel'
      ],
      inputs: [
        'ordered networks',
        'points',
        'segments',
        'fillRule',
        'preview/exact policy'
      ],
      outputs: ['PathTopologyModel per network', 'networkPaths'],
      decisions: [
        'Flattening, length basis, intersection discovery, legal-domain descriptors, and topology family metadata are fixed here.',
        'Each network revision builds this once and shares it with center stroke, constrained stroke, fill, hit-test, export, diagnostics, and future shadow.'
      ],
      next: ['shared-geometry-model', 'resolve-source-families'],
      risks: [
        'Repeating topology builds per packet family violates the performance and correctness contract.'
      ],
      tags: ['canonical', 'topology', 'cache']
    },
    {
      id: 'shared-geometry-model',
      group: 'Shared Geometry',
      lane: 4,
      row: 3,
      title: 'Shared resolved vector geometry model',
      summary:
        'Build the shared resolved geometry model used by fill, stroke, diagnostics, export, and future shadow consumers.',
      helpers: [
        'buildResolvedVectorGeometryModel',
        'buildSelfIntersectingGeometry',
        'buildSelfIntersectingEvenOddResolvedGeometry (legacy helper name; must not imply all Figma fill rules are even-odd)'
      ],
      inputs: ['PathTopologyModel per network', 'fillRule'],
      outputs: [
        'ResolvedVectorGeometryModel',
        'fillRegions',
        'legalFaceBoundaries',
        'sourceSplitRanges with legalSide / filledSide / unfilledSide per range',
        'boundaryRole per source split range',
        'fill/legal-region evidence',
        'source provenance'
      ],
      decisions: [
        'Fill consumes fillRegions.',
        'Self-intersecting inside/outside stroke consumes sourceSplitRanges, legalSide, filledSide, unfilledSide, and boundaryRole from this shared model; downstream stroke stages must not re-resolve side from orientation, packet order, or rendered pixels.',
        'Shared NONZERO/EVENODD region and face evaluation is canonical side-resolution and legality evidence but must not become product dash domains.',
        'Classifying an internal filled face with a hole role is invalid. Side and eligibility must come from adjacent face occupancy and region/winding-rule evidence before legality/projection.',
        'Outside stroke is not a separate side-resolution system: the shared split-range selected side must be the only side authority for later candidate, legality, projection, and diagnostics stages.',
        'Future shadow must consume this model rather than rebuilding contours.'
      ],
      next: ['fill-region-consumer', 'resolve-source-families'],
      risks: [
        'Independent fill/stroke contour builders reintroduce multiple geometry truths.',
        'Downstream orientation fallback for self-intersecting inside/outside can invert Figma-like side selection if it ignores implicit region/face legal domains.',
        'An inside-only or visible-fill-only consumer can make outside dashed appear correct in metadata while producing the wrong acute-angle and cap geometry.'
      ],
      tags: ['truth', 'shared']
    },
    {
      id: 'resolve-source-families',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 4,
      title: 'ResolveSourceFamilies',
      summary:
        'Classify source family, topology family, and support hints from the topology model.',
      helpers: [
        'classifyPathTopologyModel',
        'classifyCompoundClosedLegalDomains'
      ],
      inputs: [
        'PathTopologyModel',
        'normalized stroke spec',
        'legal-domain descriptors'
      ],
      outputs: ['source family', 'topology family', 'support-family hints'],
      decisions: [
        'Shape origin and topology family are separate.',
        'Open, simple closed, compound, self-intersecting, high-curvature, and multi-network support decisions come from typed topology metadata.',
        'Unsupported or research-gated families must remain explicit.'
      ],
      next: ['resolve-stroke-domains'],
      risks: [
        'A support claim based only on vector/rectangle/oval name can route unsupported geometry as exact.'
      ],
      tags: ['canonical', 'support']
    },
    {
      id: 'resolve-stroke-domains',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 5,
      title: 'ResolveStrokeDomains',
      summary:
        'Resolve the concrete stroke domains and side authority that interval and candidate stages may consume.',
      helpers: [
        'resolveStrokeDomains',
        'buildFigmaLikeSplitRangeDashDomains',
        'buildLegalBoundaryDomains',
        'resolveSourcePathStrokeSide'
      ],
      inputs: [
        'PathTopologyModel',
        'ResolvedSourceFamily',
        'normalized stroke spec',
        'ResolvedVectorGeometryModel',
        'implicit region/face legal domains'
      ],
      outputs: [
        'StrokeDomainPlan',
        'FigmaLikeSplitRange[]',
        'StrokeLegalBoundaryDomain[]',
        'side-resolution authority',
        'legal-domain references'
      ],
      decisions: [
        'Open inside/outside domains resolve to center-equivalent domains.',
        'Simple closed domains stay source-path one-sided domains.',
        'Compound closed inside/outside domains use normalized legal boundary spans with explicit shell/real-hole metadata before interval allocation.',
        'Self-intersecting inside/outside domains are split by topology plus implicit region/face legal evidence before interval allocation.',
        'Filled-face and real-hole boundaries are legal and side evidence only; this step must not produce product stroke polygons.'
      ],
      next: ['allocate-intervals'],
      risks: [
        'If split-range and side-authority resolution stays hidden inside interval or candidate helpers, old cumulative or orientation fallback behavior can reappear without a visible flow gate.'
      ],
      tags: ['canonical', 'domain', 'truth']
    },
    {
      id: 'allocate-intervals',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 6,
      title: 'AllocateIntervals',
      summary:
        'Allocate solid or dashed visible intervals on the resolved stroke domain.',
      helpers: [
        'allocateDashedIntervalsForTopology',
        'allocateFigmaLikeSplitRangeDashedIntervals',
        'allocateStrokeIntervals'
      ],
      inputs: [
        'normalized stroke spec',
        'StrokeDomainPlan',
        'FigmaLikeSplitRange[]',
        'PathTopologyModel.totalLength',
        'PathTopologyModel.closed'
      ],
      outputs: ['StrokeIntervalRecord[]', 'solid full-coverage interval'],
      decisions: [
        'Dash semantics are interval geometry, not paint or shader repair.',
        'The same exact topology revision yields the same committed interval schedule.',
        'Self-intersecting dashed intervals allocate per intersection-split source range, not on one whole-source-path cumulative schedule and not on implicit side-change slices. Source segments only identify provenance. Each split range owns its own half-dash endpoints and chooses middle dash count from the normal-range reference gap rhythm.'
      ],
      next: ['build-source-span-graph'],
      risks: [
        'Private path-length calculators in packet helpers create dash placement drift.'
      ],
      tags: ['canonical', 'intervals']
    },
    {
      id: 'build-source-span-graph',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 7,
      title: 'SourceSpanGraph',
      summary:
        'Split source topology into source spans before candidate and ownership processing.',
      helpers: ['buildSourceSpanGraph', 'getSourceSpanIdsForInterval'],
      inputs: [
        'PathTopologyModel',
        'StrokeDomainPlan',
        'StrokeIntervalRecord[]'
      ],
      outputs: ['SourceSpanGraph', 'sourceSpanIds per interval'],
      decisions: [
        'Cuts come from topology vertices, dash interval boundaries, and discovered self-intersections.',
        'Seam-wrapping intervals collect spans on both sides of the seam.'
      ],
      next: ['build-one-sided-candidates'],
      risks: [
        'Using only intervalId as provenance loses authored source-span ownership.'
      ],
      tags: ['span', 'metadata']
    },
    {
      id: 'build-one-sided-candidates',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 8,
      title: 'BuildOneSidedCandidates',
      summary:
        'Build selected-side candidate stroke faces from topology, intervals, and normalized stroke spec.',
      helpers: [
        'buildOneSidedSegmentFaces',
        'buildOneSidedJoinFaces',
        'buildOneSidedCapFaces',
        'buildConstrainedSolidStrokeResolvedPackets',
        'buildConstrainedDashedStrokeResolvedPackets',
        'buildSourcePathDashedOneSidedCandidates'
      ],
      inputs: [
        'PathTopologyModel',
        'StrokeDomainPlan',
        'interval records',
        'sourceSpanIds',
        'normalized stroke spec',
        'source path geometry',
        'shared sourceSplitRanges with legalSide',
        'fill rule / implicit fill-domain legality evidence'
      ],
      outputs: [
        'StrokeCandidateFace[]',
        'candidate packets',
        'candidate runtime metadata'
      ],
      decisions: [
        'Inside builds inward geometry only; outside builds outward geometry only; center builds symmetric center geometry only.',
        'Closed constrained inside/outside stroke must not use doubled-width center-band clipping as product geometry.',
        'Open authored inside/outside vector strokes resolve to center-equivalent geometry before constrained candidate construction.',
        'Self-intersecting inside/outside side selection is already resolved by the shared geometry model per source range, independent of whether fill paint is visible. This step consumes selectedSide from the stroke domain plan and must not call orientation or fill-probe side fallback for that family.',
        'Self-intersecting inside/outside dashed product geometry is built from selected filled-face boundary dash intervals and local one-sided offset/ribbon candidates. Real unfilled holes and winding-rule fill boundaries are side/legality evidence only; they must not replace filled-face classification.',
        'Outside dashed candidates are validated separately for butt, square, and round caps. The top-left acute-angle first dash remains a required oracle because inside/center gates alone do not prove outside cap shape or selected-side geometry.'
      ],
      next: ['partition-arrangement-faces'],
      risks: [
        'Wrong-side or ghost-band output usually originates here, not in paint or render.',
        'A self-intersecting path can flip apparent winding across ranges; using a fixed normal for inside/outside can invert the final stroke even when interval allocation is correct.',
        'No-fill self-intersecting vectors still need deterministic inside/outside side selection from implicit region/face legal domains; source-path orientation is not a Figma-like DoD for the star case.',
        'If Step 17 ignores shared face/region/occupancy metadata, central filled-face inside stroke can disappear and outside internal-adjacent product geometry can survive on the wrong face.',
        'Future outside fixes must stay in candidate construction and shared selectedSide consumption; renderer, fill-boundary restroking, or visible-fill fallback cannot be used as repair.'
      ],
      tags: ['canonical', 'candidate']
    },
    {
      id: 'partition-arrangement-faces',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 9,
      title: 'PartitionArrangementAndFaces',
      summary:
        'Partition overlapping candidate faces when self-overlap, self-intersection, or multi-owner regions require face-level truth.',
      helpers: [
        'GeometryBackendRegistry',
        'GeometryBackend.buildArrangement',
        'buildArrangedStrokeFinalFacesFromResolvedPackets',
        'promoteConstrainedDashedPacketsToExactArrangement',
        'promoteConstrainedSolidPacketsToExactArrangement'
      ],
      inputs: [
        'candidate faces',
        'topology/intersection metadata',
        'geometry backend'
      ],
      outputs: [
        'PartitionedFaceRegion[]',
        'arrangement metadata',
        'promoted exact faces when supported'
      ],
      decisions: [
        'The exact backend is accessed only through GeometryBackendRegistry.',
        'Arrangement is bypassed only for simple non-overlapping supported topologies.',
        'Local-side approximation remains marked as approximation until exact promotion is proven.'
      ],
      next: ['resolve-ownership'],
      risks: [
        'Treating backend permissive arrangement output as final support can delete valid visible dash regions.'
      ],
      tags: ['canonical', 'arrangement']
    },
    {
      id: 'resolve-ownership',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 10,
      title: 'ResolveOwnership',
      summary: 'Attach typed owner truth to partitioned face regions.',
      helpers: [
        'resolveStrokeOwnership',
        'stroke-candidate-arrangement owner claims'
      ],
      inputs: [
        'partitioned faces',
        'typed owner metadata',
        'networkId',
        'strokeId',
        'intervalId',
        'sourceSpanIds'
      ],
      outputs: ['ownership-classified face regions', 'ownerSet metadata'],
      decisions: [
        'Owner identity is typed and stable.',
        'Exact same-visual duplicate faces may later collapse visually while preserving ownerSet.'
      ],
      next: ['apply-legality'],
      risks: [
        'Parsing owner identity from geometryId, packet order, or strokeId string structure is forbidden.'
      ],
      tags: ['canonical', 'ownership']
    },
    {
      id: 'apply-legality',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 11,
      title: 'ApplyLegality',
      summary:
        'Filter or clip ownership-classified candidate faces against legal-domain and support policies.',
      helpers: [
        'buildConstrainedSolidLegalityClippingResult',
        'clipSourcePathPolygonsToEvenOddLegalDomain (legacy helper name; must consume explicit Figma fillRule basis)',
        'buildCompoundLegalDomainNormalization'
      ],
      inputs: [
        'ownership-classified faces',
        'legal domains',
        'legality policy',
        'support state'
      ],
      outputs: [
        'legal visible face regions',
        'legality diagnostics',
        'blocked diagnostics'
      ],
      decisions: [
        'Legality acts on candidate one-sided faces only.',
        'Legality may remove or clip invalid area, but it cannot repair a wrong geometry model.',
        'Compound paths evaluate legal domains from explicit shell/hole metadata or backend-normalized regions.',
        'Self-intersecting constrained inside/outside candidates must be filtered or clipped against the selected region-boundary domain eligibility, not against an authored-source-path-only or selectedSide-only fallback.',
        'Inside legality preserves geometry for selected filled-face boundary domains. Outside legality preserves only filled-to-exterior boundary-domain geometry and must reject filled-filled internal adjacency.',
        'Legality preserves interval, boundaryDomainId, boundaryRole, owner, adjacent face, filled/exterior side, and legal-domain provenance needed by FinalFace/export/visual probes.'
      ],
      next: ['build-resolved-stroke-regions'],
      risks: [
        'If legality invents replacement geometry, render/hit/export parity no longer traces to canonical candidates.',
        'If legality only consults legal domains when renderable fill paint exists, no-fill self-intersecting inside/outside strokes can still render on the wrong Figma side.',
        'If legality falls back to preserving upstream selected-side candidate geometry when exact clipping degenerates, outside filled-filled internal adjacency strokes can leak into the final output.'
      ],
      tags: ['canonical', 'legality']
    },
    {
      id: 'build-resolved-stroke-regions',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 12,
      title: 'BuildResolvedStrokeRegions',
      summary:
        'Build semantic stroke packets from legal visible face regions before paint is attached.',
      helpers: ['StrokeRegionPacket builders', 'attachStrokePacketDebugMeta'],
      inputs: [
        'legal visible face regions',
        'topology/support metadata',
        'revision set'
      ],
      outputs: ['StrokeRegionPacket[] without final paint projection'],
      definitionOfDone: [
        'StrokeRegionPacket is paint-free: no color, alpha, gradient, paintKey, or paintRevision may leak into the region contract.',
        'Region packets preserve legal visible geometry, bounds, sourceGeometryIds, ownerSet, intervalIds, sourceSpanIds, sourceContourIds, legalDomainIds, support/runtime metadata, side-resolution metadata, split-range terminal metadata, arrangement metadata, and non-paint revision keys.',
        'The bridge consumes resolved packets or FinalFace records only; it must not parse geometry ids, packet order, rendered pixels, or paint payloads to recover semantics.',
        'Targeted region-packet tests plus recurring build/lint gates pass before Step 22 is unblocked.'
      ],
      acceptanceTests: [
        'yarn workspace @asyra/preset test:local src/__tests__/stroke-region-packet.test.ts',
        'yarn workspace @asyra/preset test:local src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/stroke-candidate-arrangement.test.ts src/__tests__/solid-center-stroke-packets.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts'
      ],
      knownLimits: [
        'This step does not attach or normalize paint; Step 22 owns paint payloads.',
        'This step does not decide legality, ownership, or arrangement; it preserves those upstream records.'
      ],
      failureSignals: [
        'A region packet contains paint/color/alpha/gradient/paintKey or paintRevision.',
        'Terminal half-dash, side-resolution, owner, source-span, contour, or legal-domain provenance disappears at the region boundary.',
        'A region packet rebuilds semantics from ids, order, pixels, or paint instead of typed upstream metadata.'
      ],
      decisions: [
        'Render/hit/export parity starts here.',
        'Packets carry geometryFamily, resolutionStatus, runtimeStatus, ownerKey, networkId, contourId, intervalId, legalDomainId, sourceSpanIds, and revisionKeys.'
      ],
      next: ['attach-paint-payload'],
      risks: [
        'Semantic truth lost here cannot be recovered by batching or diagnostics later.'
      ],
      tags: ['canonical', 'packet']
    },
    {
      id: 'attach-paint-payload',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 13,
      title: 'AttachPaintPayload',
      summary: 'Attach normalized stroke paint to resolved stroke regions.',
      helpers: ['attachStrokePaintPayload', 'paint payload normalization'],
      inputs: [
        'StrokeRegionPacket[]',
        'normalized paint payload',
        'region bounds',
        'paint space / transform'
      ],
      outputs: ['paint-attached stroke region packets'],
      definitionOfDone: [
        'Paint attachment consumes paint-free StrokeRegionPacket[] plus normalized paint payload and emits PaintAttachedStrokeRegion[] only.',
        'Paint attachment adds paintKey, paint payload, paint bounds, and optional paint transform without changing polygons, bounds, sourceGeometryIds, ownerSet, interval/source-span/contour/legal-domain metadata, side-resolution metadata, terminal metadata, arrangement metadata, or non-paint revision keys.',
        'Paint-only dirty-key changes rerun paint-payload/render-hit-export stages only; they must not rerun topology, domain, interval, candidate, arrangement, ownership, legality, or region geometry stages.',
        'Targeted paint payload, dirty-key, renderable-stroke, render, and constrained dashed gates pass before Step 23 is unblocked.'
      ],
      acceptanceTests: [
        'yarn workspace @asyra/preset test:local src/__tests__/stroke-paint-payload.test.ts src/__tests__/stroke-region-packet.test.ts src/__tests__/stroke-dirty-keys.test.ts src/__tests__/stroke-render-renderable-stroke.test.ts src/__tests__/solid-center-stroke-render.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts',
        'yarn workspace @asyra/asyra-design test:e2e -- e2e/constrained-dashed-stroke-visual.spec.ts e2e/solid-constrained-stroke-visual.spec.ts'
      ],
      knownLimits: [
        'This step attaches paint only; it must not construct or repair stroke geometry.',
        'Visual paint regressions belong to paint attachment or projection unless upstream geometry provenance changes.'
      ],
      failureSignals: [
        'A paint-only change mutates region polygons, bounds, provenance, or non-paint revision keys.',
        'A paint-only dirty key reruns topology/domain/interval/candidate/arrangement/ownership/legality/region stages.',
        'Paint attachment is used to hide a geometry or legality error.'
      ],
      decisions: [
        'Paint uses region bounds or declared paint space.',
        'Paint never changes region geometry.'
      ],
      next: ['fill-region-consumer'],
      risks: [
        'A color or opacity mismatch is a paint/emission bug, not a topology or legality bug.'
      ],
      tags: ['canonical', 'paint']
    },
    {
      id: 'fill-region-consumer',
      group: 'Fill',
      lane: 5,
      row: 3,
      title: 'Fill consumes shared geometry',
      summary:
        'Fill selects shared fill regions or the documented fallback for non-shared families.',
      helpers: [
        'resolvedGeometry.selfIntersecting.fillRegions',
        'buildFillFaces',
        'drawFillFaces'
      ],
      inputs: ['ResolvedVectorGeometryModel', 'fills', 'fillRule'],
      outputs: ['fill faces drawn on graphic'],
      definitionOfDone: [
        'Fill consumes ResolvedVectorGeometryModel fillRegions when shared self-intersecting fill geometry is available.',
        'Hidden or absent fill paint must not remove implicit region/face legal-domain evidence required by stroke side-resolution and legality.',
        'Fallback fill construction may run only when shared fill regions are unavailable or unsupported; it must not become a competing self-intersection authority.',
        'Fill drawing must not mutate stroke topology, domain plans, intervals, candidates, legality, region packets, FinalFace records, or render/hit/export stroke projections.'
      ],
      acceptanceTests: [
        'yarn workspace @asyra/preset test:local src/__tests__/vector-preview-fill.test.ts src/__tests__/resolved-vector-geometry-model.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts',
        'yarn workspace @asyra/asyra-design test:e2e -- e2e/stroke-self-check-star-render.spec.ts --workers=1'
      ],
      knownLimits: [
        'This step owns fill consumption only; stroke side-resolution and legality consume shared legal evidence upstream.',
        'No-fill stroke parity is still expected to receive implicit region/face legal evidence even when no fill face is drawn.'
      ],
      failureSignals: [
        'Self-intersecting fill cache faces differ from shared resolved fillRegions when those regions exist.',
        'A no-fill or hidden-fill vector loses implicit legal-domain side evidence for stroke.',
        'Fallback fill code recomputes a second self-intersection truth while shared fillRegions are available.'
      ],
      decisions: [
        'Fill is a consumer of shared geometry, not a competing contour authority.',
        'Fill is useful visual evidence for legal-region interpretation.'
      ],
      next: ['build-final-faces'],
      risks: [
        'If fill and stroke disagree on self-intersection regions, inspect the shared model first.'
      ],
      tags: ['fill', 'shared']
    },
    {
      id: 'build-final-faces',
      group: 'Final Faces',
      lane: 6,
      row: 13,
      title: 'BuildFinalFaces',
      summary:
        'Convert paint-attached semantic regions and promoted exact arrangement faces into canonical FinalFace records.',
      helpers: [
        'buildSolidCenterStrokeFinalFaces',
        'stroke-final-face',
        'collapseExactDuplicateFinalFaces',
        'buildArrangedStrokeFinalFacesFromResolvedPackets'
      ],
      inputs: [
        'paint-attached region packets',
        'promoted exact arrangement faces',
        'visual context'
      ],
      outputs: ['raw FinalFace[]', 'strokeFinalFaces after allowed collapse'],
      decisions: [
        'FinalFace[] is the canonical source for render, hit-test, and export projection.',
        'Duplicate regions collapse only when exact face ownership is proven and geometry plus visualPacketKey match.',
        'Same-visual collapse must preserve ownerSet, intervalIds, sourceSpanIds, sourceContourIds, and legalDomainIds.'
      ],
      next: ['emit-render-hit-export-packets'],
      risks: [
        'Renderer-only collapse that discards hit/export ownership violates final-face parity.'
      ],
      tags: ['canonical', 'final']
    },
    {
      id: 'emit-render-hit-export-packets',
      group: 'Final Faces',
      lane: 6,
      row: 14,
      title: 'EmitRenderHitExportPackets',
      summary:
        'Project render, hit-test, export, and diagnostics payloads from the same FinalFace[] source.',
      helpers: [
        'toSolidCenterStrokeRenderEntriesFromFinalFaces',
        'createSolidCenterStrokeHitAreaFromFinalFaces',
        'applySolidCenterStrokeExportPacketsFromFinalFaces'
      ],
      inputs: ['strokeFinalFaces', 'fill faces', 'render/debug mode'],
      outputs: [
        'render packets',
        'hit packets',
        'export packets',
        'diagnostic payloads'
      ],
      decisions: [
        'Specialization is payload-level, not geometry-level.',
        'Hit-test and export must not restroke authored input.',
        'Blocked constrained requests keep typed diagnostics and do not pretend geometry exists.',
        'Inside/outside constrained projection must preserve boundary-domain eligibility provenance strongly enough for tests to prove final geometry came from FinalFace region-boundary domains rather than from renderer repair, authored-source restroking, or selectedSide-only metadata.',
        'Self-intersecting outside solid render projection must keep the seam-free masked-source-stroke visible-render descriptor separate from exact-boolean coverage used for hit/export/diagnostics.'
      ],
      next: ['render-entries', 'hit-export'],
      risks: [
        'If any output path consumes a different geometry source, render/hit/export parity is broken.',
        'FinalFace/render/hit/export metadata must preserve enough boundary-domain eligibility provenance to prove central filled-face inside presence and outside filled-filled internal adjacency absence; sourceContourIds or selectedSide alone are not Figma parity proof.'
      ],
      tags: ['canonical', 'emit']
    },
    {
      id: 'render-entries',
      group: 'Render',
      lane: 7,
      row: 14,
      title: 'Render entries',
      summary:
        'Convert final-face render packets into renderer-specific draw entries.',
      helpers: [
        'toSolidCenterStrokeRenderEntriesFromFinalFaces',
        'drawNativeCenterSolidStrokePath',
        'renderable-stroke'
      ],
      inputs: ['render packets', 'strokeFinalFaces', 'fill faces'],
      outputs: [
        'renderer-specific stroke entries',
        'native center-stroke draw commands'
      ],
      decisions: [
        'Native center solid may use renderer stroke where it preserves product semantics.',
        'Constrained and final-face product geometry must draw from final-face projections.',
        'Outside dashed render entries are not allowed to reinterpret selectedSide, cap shape, or acute-angle geometry; they must expose the upstream FinalFace/export provenance used by Step 30 probes.',
        'Constrained solid render entries may carry an upstream masked-source-stroke descriptor for visible render. They must not paint exact-boolean bridge/cut seam polygons as outside solid visible geometry.'
      ],
      next: ['mesh-render'],
      risks: [
        'Render entries must not reinterpret inside/outside, ownership, legality, or support state.',
        'Renderer entries can only project upstream FinalFace geometry or upstream solid visible-render descriptors; they must not use auxiliary contour grouping or sourceContourIds as the proof that self-intersecting side selection matched Figma.',
        'If exact-boolean coverage polygons are used directly for outside solid visible render, bridge/cut seam edges can become black cracks.'
      ],
      tags: ['render']
    },
    {
      id: 'mesh-render',
      group: 'Render',
      lane: 7,
      row: 15,
      title: 'Renderer draw',
      summary: 'Draw final fill and stroke entries to the graphics engine.',
      helpers: ['renderSolidCenterStrokeEntries', 'Pixi render loop'],
      inputs: ['graphic', 'fill faces', 'stroke render entries'],
      outputs: ['visible product stroke/fill result'],
      decisions: [
        'Geometry correctness decisions are complete before this step.',
        'The renderer faithfully draws final product geometry and upstream visible-render descriptors and may expose debug raw fragments only under explicit debug mode.',
        'The renderer must not invent solid mask semantics, but it may consume a precomputed masked-source-stroke descriptor.'
      ],
      next: ['visible-final-result'],
      risks: [
        'If the screenshot is wrong, trace backward through render entries, final faces, regions, legality, ownership, arrangement, candidates, intervals, and topology.',
        'If outside solid shows a high-curvature black crack, verify whether a flattened exact-boolean bridge/cut seam was painted instead of a masked-source-stroke descriptor.'
      ],
      tags: ['render', 'visible']
    },
    {
      id: 'hit-export',
      group: 'Diagnostics',
      lane: 8,
      row: 14,
      title: 'Hit-test / export projection',
      summary:
        'Update hit-test and export data from the same FinalFace[] source used by render.',
      helpers: [
        'applyVectorHoverHitArea',
        'createSolidCenterStrokeHitAreaFromFinalFaces',
        'applySolidCenterStrokeExportPacketsFromFinalFaces'
      ],
      inputs: [
        'strokeFinalFaces',
        'fill faces',
        'points / segments / networks'
      ],
      outputs: ['graphic.hitArea', 'export packets'],
      decisions: [
        'Drag visual mode may defer hit/export updates, but product visual output must still be current.',
        'Hit/export packets preserve primaryOwner, ownerSet, intervalIds, sourceSpanIds, sourceContourIds, and legalDomainIds.'
      ],
      next: ['runtime-diagnostics'],
      risks: [
        'Stale hit/export projection can make a correct render interact incorrectly.'
      ],
      tags: ['hit', 'export']
    },
    {
      id: 'runtime-diagnostics',
      group: 'Diagnostics',
      lane: 8,
      row: 15,
      title: 'Runtime diagnostics',
      summary:
        'Publish typed accepted, blocked, legality, ownership, dirty, and performance diagnostics.',
      helpers: [
        'setConstrainedDashedRuntimeDiagnostics',
        'setConstrainedSolidRuntimeDiagnostics',
        'setConstrainedSolidLegalityDiagnostics',
        'setConstrainedSolidOwnershipDiagnostics',
        'applyCenterDashedOverlapDiagnostics'
      ],
      inputs: [
        'stage diagnostics',
        'runtime status',
        'owner metadata',
        'dirty keys',
        'performance counters'
      ],
      outputs: ['debug render layers', 'diagnostics state', 'test evidence'],
      decisions: [
        'Diagnostics are evidence, not product geometry.',
        'An empty render output is not the only proof of blocked state.',
        'Debug raw fragments must stay separate from product visual truth.'
      ],
      next: ['visible-final-result'],
      risks: [
        'Diagnostics from a legacy branch can mislead analysis unless they identify the exact product branch being rendered.'
      ],
      tags: ['diagnostics']
    },
    {
      id: 'visible-final-result',
      group: 'Render',
      lane: 7,
      row: 16,
      title: 'Visible final result',
      summary:
        'The user sees the final render result produced from committed vector data and canonical stroke geometry.',
      helpers: ['Pixi render loop', 'browser visual checks'],
      inputs: ['filled graphic', 'stroke render entries', 'renderer frame'],
      outputs: ['final product visual'],
      decisions: [
        'Supported families must show render / hit-test / export parity.',
        'Unsupported or gated families must remain explicit through typed diagnostics.',
        'Self-intersecting inside/outside visual gates must compare against Figma split-range dash allocation, implicit region/face side behavior, overlap ownership, visible central filled-face inside stroke, exterior-only outside behavior, and cap-specific outside shape.',
        'Outside dashed butt/square/round is covered by deterministic probes and AI review for the current product-exposed stroke matrix gate.'
      ],
      next: [],
      risks: [
        'Screenshot-visible failures should be localized by changed parameter family and dirty-stage trace, not by guessing.',
        'A final visual gate that accepts source-path cumulative dash intervals can pass while still disagreeing with Figma split-range dash allocation, overlap behavior, and filled-face inside stroke behavior.',
        'New Figma-observed behavior can still invalidate the current outside gate; final visual status must be reopened whenever a newly discovered family or cap/position combination changes the generic rule set.'
      ],
      tags: ['final', 'truth']
    }
  ]

  const edges = [
    ['input-event', 'vector-api-mutation'],
    ['vector-api-mutation', 'validate-topology'],
    ['validate-topology', 'transaction-write'],
    ['transaction-write', 'data-channel-delta'],
    ['data-channel-delta', 'render-cache-patch'],
    ['render-cache-patch', 'dirty-revision-graph'],
    ['dirty-revision-graph', 'render-strategy-entry'],
    ['render-strategy-entry', 'normalize-render-data'],
    ['normalize-render-data', 'normalize-stroke-spec'],
    ['normalize-stroke-spec', 'build-path-topology'],
    ['build-path-topology', 'shared-geometry-model'],
    ['build-path-topology', 'resolve-source-families'],
    ['shared-geometry-model', 'fill-region-consumer'],
    ['shared-geometry-model', 'resolve-source-families'],
    ['shared-geometry-model', 'resolve-stroke-domains'],
    ['resolve-source-families', 'resolve-stroke-domains'],
    ['resolve-stroke-domains', 'allocate-intervals'],
    ['allocate-intervals', 'build-source-span-graph'],
    ['build-source-span-graph', 'build-one-sided-candidates'],
    ['build-one-sided-candidates', 'partition-arrangement-faces'],
    ['partition-arrangement-faces', 'resolve-ownership'],
    ['resolve-ownership', 'apply-legality'],
    ['apply-legality', 'build-resolved-stroke-regions'],
    ['build-resolved-stroke-regions', 'attach-paint-payload'],
    ['attach-paint-payload', 'build-final-faces'],
    ['build-final-faces', 'emit-render-hit-export-packets'],
    ['emit-render-hit-export-packets', 'render-entries'],
    ['emit-render-hit-export-packets', 'hit-export'],
    ['fill-region-consumer', 'render-entries'],
    ['render-entries', 'mesh-render'],
    ['mesh-render', 'visible-final-result'],
    ['hit-export', 'runtime-diagnostics'],
    ['runtime-diagnostics', 'visible-final-result']
  ]

  const sharedCommands = [
    'yarn workspace @asyra/preset test:local src/__tests__/stroke-dirty-keys.test.ts',
    'yarn workspace @asyra/preset test:local src/__tests__/path-topology-model.test.ts src/__tests__/source-span-graph.test.ts',
    'yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts',
    'yarn workspace @asyra/preset test:local src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts',
    'yarn workspace @asyra/preset test:local src/__tests__/stroke-performance-contract.test.ts',
    'yarn workspace @asyra/preset build:preset',
    'yarn lint:ci'
  ]

  const defaultEvidenceByGroup = {
    Interaction: {
      relatedFiles: [
        'apps/asyra-design/src/features/pen-tool/index.ts',
        'apps/asyra-design/src/common-apis/element/vector-apis.ts',
        'apps/asyra-design/src/common-apis/element/vector-consistency.ts',
        'apps/asyra-design/src/common-apis/element/index.ts'
      ],
      relatedTests: [],
      debugCommands: [],
      evidenceToInspect: [
        'Confirm feature code writes vector data through elementApis and vectorGeometry helpers.',
        'Confirm point/handle/segment mutations produce topology-native points, segments, and networks.'
      ]
    },
    'State Commit': {
      relatedFiles: [
        'apps/asyra-design/src/common-apis/transaction.ts',
        'apps/asyra-design/src/controllers/scene-tree.ts',
        'apps/asyra-design/src/common-apis/element/vector-apis.ts'
      ],
      relatedTests: [],
      debugCommands: [],
      evidenceToInspect: [
        'Confirm runtime invalid topology is rejected before commit.',
        'Confirm drag update/end semantics produce the intended undo boundary.'
      ]
    },
    'Render Cache': {
      relatedFiles: [
        'docs/ai/framework/plans/render-delta-update-plan.md',
        'packages/preset/src/components/stroke-render/stroke-dirty-keys.ts',
        'packages/preset/src/components/vector.ts'
      ],
      relatedTests: [
        'packages/preset/src/__tests__/stroke-dirty-keys.test.ts',
        'packages/preset/src/__tests__/stroke-api-performance-profile.test.ts',
        'packages/preset/src/__tests__/stroke-performance-contract.test.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/preset test:local src/__tests__/stroke-dirty-keys.test.ts',
        'yarn workspace @asyra/preset test:local src/__tests__/stroke-performance-contract.test.ts'
      ],
      evidenceToInspect: [
        'Inspect changed keys, dirty layers, and previous/next revision sets.',
        'Confirm vector topology model build counters equal network count, not stroke packet family count.'
      ]
    },
    'Stroke Pipeline': {
      relatedFiles: [
        'packages/preset/src/components/vector.ts',
        'packages/preset/src/components/stroke-render/path-topology-model.ts',
        'packages/preset/src/components/stroke-render/source-span-graph.ts',
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/geometry-backend.ts',
        'packages/preset/src/components/stroke-render/clipper2-geometry-backend.ts'
      ],
      relatedTests: [
        'packages/preset/src/__tests__/path-topology-model.test.ts',
        'packages/preset/src/__tests__/source-span-graph.test.ts',
        'packages/preset/src/__tests__/constrained-dashed-stroke-packets.test.ts',
        'packages/preset/src/__tests__/constrained-solid-stroke-packets.test.ts',
        'packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts',
        'packages/preset/src/__tests__/vector-constrained-solid-stroke.test.ts'
      ],
      debugCommands: sharedCommands,
      evidenceToInspect: [
        'Trace the canonical 12 stages in order; no stage should repair a skipped earlier stage.',
        'Confirm changed parameter family explains the rerun stages.',
        'Confirm typed metadata survives through candidate, legality, packet, and final-face conversion.'
      ]
    },
    'Shared Geometry': {
      relatedFiles: [
        'packages/preset/src/components/stroke-render/resolved-vector-geometry-model.ts',
        'packages/preset/src/components/stroke-render/self-intersecting-legal-domain.ts',
        'packages/preset/src/components/stroke-render/path-topology-model.ts'
      ],
      relatedTests: [
        'packages/preset/src/__tests__/path-topology-model.test.ts',
        'packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/preset test:local src/__tests__/path-topology-model.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts'
      ],
      evidenceToInspect: [
        'Confirm fillRegions and legalFaceBoundaries come from the same source revision.',
        'For self-intersecting dashed inside/outside, confirm region/face boundaries are evidence only and are not used as product dash domains.'
      ]
    },
    Fill: {
      relatedFiles: [
        'packages/preset/src/components/vector.ts',
        'packages/preset/src/components/stroke-render/resolved-vector-geometry-model.ts'
      ],
      relatedTests: [
        'packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts'
      ],
      debugCommands: [],
      evidenceToInspect: [
        'Use fill as a consumer of shared geometry and as visual evidence for legal regions.',
        'Do not let fill rebuild a competing self-intersection truth.'
      ]
    },
    'Final Faces': {
      relatedFiles: [
        'packages/preset/src/components/stroke-render/stroke-final-face.ts',
        'packages/preset/src/components/stroke-render/stroke-candidate-arrangement.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-render.ts'
      ],
      relatedTests: [
        'packages/preset/src/__tests__/solid-center-stroke-render.test.ts',
        'packages/preset/src/__tests__/constrained-dashed-stroke-packets.test.ts',
        'packages/preset/src/__tests__/stroke-performance-contract.test.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/preset test:local src/__tests__/solid-center-stroke-render.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts'
      ],
      evidenceToInspect: [
        'Inspect raw FinalFace[] versus collapsed FinalFace[] counts.',
        'Confirm collapsed faces preserve ownerSet, intervalIds, sourceSpanIds, sourceContourIds, and legalDomainIds.'
      ]
    },
    Render: {
      relatedFiles: [
        'packages/preset/src/components/vector.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-render.ts',
        'packages/preset/src/components/stroke-render/renderable-stroke.ts'
      ],
      relatedTests: [
        'packages/preset/src/__tests__/stroke-render-renderable-stroke.test.ts',
        'packages/preset/src/__tests__/solid-center-stroke-render.test.ts',
        'apps/asyra-design/e2e/stroke-drag-render-performance.spec.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/preset test:local src/__tests__/stroke-render-renderable-stroke.test.ts src/__tests__/solid-center-stroke-render.test.ts',
        'yarn workspace @asyra/asyra-design test:e2e -- stroke-drag-render-performance.spec.ts'
      ],
      evidenceToInspect: [
        'Confirm render entries consume FinalFace[] projections.',
        'Use screenshots only after upstream final faces and packets are known correct.'
      ]
    },
    Diagnostics: {
      relatedFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-runtime-diagnostics.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-runtime-diagnostics.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-legality-diagnostics.ts',
        'packages/preset/src/components/stroke-render/stroke-dirty-keys.ts'
      ],
      relatedTests: [
        'packages/preset/src/__tests__/constrained-dashed-runtime-diagnostics.test.ts',
        'packages/preset/src/__tests__/stroke-dirty-keys.test.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-runtime-diagnostics.test.ts src/__tests__/stroke-dirty-keys.test.ts'
      ],
      evidenceToInspect: [
        'Confirm diagnostics identify accepted, blocked, local-side approximation, exact constrained, and not-applicable states through typed metadata.',
        'Confirm diagnostics correspond to the same branch used by product render.'
      ]
    }
  }

  const stepEvidenceOverrides = {
    'input-event': {
      relatedTests: [
        'apps/asyra-design/e2e/stroke-drag-render-performance.spec.ts',
        'apps/asyra-design/e2e/vector-stroke-refresh.spec.ts',
        'packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/asyra-design test:e2e -- stroke-drag-render-performance.spec.ts vector-stroke-refresh.spec.ts',
        'yarn workspace @asyra/preset test:local src/__tests__/vector-path-editing-render-layer.test.ts'
      ],
      evidenceToInspect: [
        'Confirm the E2E flow begins from user input/tool interaction rather than synthetic render-only state.',
        'Confirm path-editing render layer evidence still enters through feature/session ownership.'
      ]
    },
    'vector-api-mutation': {
      relatedTests: [
        'packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts',
        'packages/preset/src/__tests__/vector-component.test.ts',
        'apps/asyra-design/e2e/vector-stroke-refresh.spec.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/preset test:local src/__tests__/vector-path-editing-render-layer.test.ts src/__tests__/vector-component.test.ts',
        'yarn workspace @asyra/asyra-design test:e2e -- vector-stroke-refresh.spec.ts'
      ],
      evidenceToInspect: [
        'Confirm vector API changes update topology-native points, segments, and networks together.',
        'Confirm refresh E2E scenarios do not depend on legacy anchorPoints conversion.'
      ]
    },
    'validate-topology': {
      relatedTests: [
        'packages/preset/src/__tests__/vector-component.test.ts',
        'packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/preset test:local src/__tests__/vector-component.test.ts src/__tests__/vector-path-editing-render-layer.test.ts'
      ],
      evidenceToInspect: [
        'Confirm invalid topology is rejected before scene-tree commit.',
        'Confirm render tests never need to repair malformed points/segments/networks.'
      ]
    },
    'transaction-write': {
      relatedTests: [
        'packages/reactive-events/src/__tests__/transaction-boundary.test.ts',
        'packages/scene-tree/src/__tests__/transaction-options.test.ts',
        'apps/asyra-design/e2e/stroke-drag-render-performance.spec.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/reactive-events test:local src/__tests__/transaction-boundary.test.ts',
        'yarn workspace @asyra/scene-tree test:local src/__tests__/transaction-options.test.ts',
        'yarn workspace @asyra/asyra-design test:e2e -- stroke-drag-render-performance.spec.ts'
      ],
      evidenceToInspect: [
        'Confirm vector drag writes do not split one intended user action into multiple undo commits.',
        'Confirm transaction option behavior still matches scene-tree publish semantics.'
      ]
    },
    'data-channel-delta': {
      relatedTests: [
        'packages/scene-tree/src/__tests__/sceneTree.test.ts',
        'packages/render/src/__tests__/scene-tree-store.test.ts',
        'apps/asyra-design/e2e/vector-stroke-refresh.spec.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/scene-tree test:local src/__tests__/sceneTree.test.ts',
        'yarn workspace @asyra/render test:local src/__tests__/scene-tree-store.test.ts',
        'yarn workspace @asyra/asyra-design test:e2e -- vector-stroke-refresh.spec.ts'
      ],
      evidenceToInspect: [
        'Confirm computed-data batch changes publish the same key delta consumed by render cache patching.',
        'Confirm refresh E2E failures can be traced to missing scene-tree delta rather than stroke geometry.'
      ]
    },
    'dirty-revision-graph': {
      evidenceToInspect: [
        'For vector source data changes, expect BuildPathTopologyModel through EmitRenderHitExportPackets to rerun.',
        'For paint-only changes, expect AttachPaintPayload and EmitRenderHitExportPackets only.',
        'For dash offset/pattern changes, expect interval allocation and downstream geometry to rerun while topology is reused.'
      ]
    },
    'build-path-topology': {
      evidenceToInspect: [
        'Confirm one PathTopologyModel per network revision in one render pass.',
        'Confirm fillRule and legal-domain descriptors survive into topology metadata.',
        'Confirm open/self-intersecting/simple/compound classification is typed.'
      ]
    },
    'build-one-sided-candidates': {
      evidenceToInspect: [
        'Confirm open authored inside/outside paths emit center-equivalent geometry.',
        'Confirm closed constrained inside/outside paths do not emit doubled center-band substitute geometry.',
        'Confirm self-intersecting inside/outside solid paths consume Step 14 boundary domains as continuous full coverage, and dashed paths consume Step 15 split-range dash intervals directly from those domains.',
        'Confirm self-intersecting inside/outside side selection uses implicit region/face legal domains per range even when fill paint is absent.'
      ]
    },
    'build-final-faces': {
      evidenceToInspect: [
        'Confirm FinalFace[] carries visualPacketKey, paintKey, strokeSpecKey, ownerSet, intervalIds, sourceSpanIds, sourceContourIds, legalDomainIds, geometryFamily, resolutionStatus, runtimeStatus, and sourceTopology.',
        'Confirm local-side approximation packets do not collapse as exact duplicate faces.'
      ]
    },
    'emit-render-hit-export-packets': {
      evidenceToInspect: [
        'Confirm render, hit-test, and export are projections from the same strokeFinalFaces source.',
        'Confirm no exporter or hit-test path restrokes from authored vector input.'
      ]
    },
    'fill-region-consumer': {
      debugCommands: [
        'yarn workspace @asyra/preset test:local src/__tests__/vector-preview-fill.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts'
      ],
      evidenceToInspect: [
        'Confirm fill consumes shared fillRegions when self-intersecting resolved geometry exists.',
        'Confirm legacy fill fallback is not used as a competing self-intersection authority.'
      ]
    }
  }

  const defaultAlignmentByGroup = Object.fromEntries(
    groups
      .filter((group) => group !== 'All')
      .map((group) => [
        group,
        {
          status: 'partial',
          latestRule:
            'Each step is checked against the current implementation and the latest canonical stroke flow.',
          currentImplementation:
            'Use step-specific status overrides for the current implementation assessment.',
          requiredAdjustment:
            'Keep this default only for newly added steps until they receive a step-specific review.'
        }
      ])
  )

  const stepRiskOverrides = {
    'input-event': [
      'Implemented through feature-system sessions, FeatureNames, InputSystemEvents, app feature files, and common elementApis vector entry points.',
      'Step 1 DoD locked: drag-end input state now clears mouseDragging so completed feature sessions do not leave vector render in visual-only drag mode.',
      'Residual risk: future vector-editing features can still bypass FeatureNames/common APIs unless they are covered by the same boundary guard.'
    ],
    'vector-api-mutation': [
      'Implemented through elementApis vector APIs and vectorGeometry topology helpers.',
      'Step 2 DoD locked: vector mutation API tests now assert topology-native helper routing and forbid legacy anchorPoints computed patches.',
      'Step 2 DoD corrected: topology mutation owns authored points/segments/networks only; it must not synthesize fallback geometry for dashed stroke product output.',
      'Residual risk: any remaining fallback contour production must stay fill/diagnostic evidence only until removed from the dashed product path.'
    ],
    'validate-topology': [
      'Implemented through assertVectorTopologyConsistency and buildVectorComputedPatch validation.',
      'Step 3 DoD locked: focused validation tests prove missing networks, dangling segment anchors, and network segment-order mismatches are rejected before patch creation.',
      'Step 3 boundary locked: structurally valid self-intersecting topology is accepted at write-time validation so product support classification remains a later render/stroke-pipeline concern.',
      'Residual risk: validation remains structural and must not grow product support policy before ResolveSourceFamilies.'
    ],
    'transaction-write': [
      'Implemented through changeComputedData start/end transaction wrapping and vector drag commit options.',
      'Step 4 DoD locked: vector drag contract test asserts preview writes are undoable:false and drag-end writes the final position as the only default undoable commit.',
      'Step 4 package gates confirm outermost transaction publishing and scene-tree undoable option propagation.',
      'Residual risk: future drag features can still fragment undo history unless they follow the same transient-preview/final-commit pattern.'
    ],
    'data-channel-delta': [
      'Implemented through scene-tree computed-data batch events and preset render data-channel observers.',
      'Step 5 DoD locked: sceneTree.test now asserts vector points/segments/networks transient computed-data deltas are batched in order and routed through the scene-tree shared channel.',
      'Render mirror gate confirms points/segments/networks batches become one pending render update with a complete computed snapshot.',
      'Residual risk: future change paths can still bypass scene-tree events unless they are covered by the same data-channel delta contract.'
    ],
    'render-cache-patch': [
      'Implemented through RenderSceneTree ComputedDataMirror and batch applyComputedChanges.',
      'Step 6 DoD locked: render scene-tree store tests now prove undoable updates reseed from scene-tree before patching, preventing stale transient mirror drift.',
      'Dirty-key and performance-contract gates confirm downstream stroke cache inputs still classify correctly after mirror patching.',
      'Residual risk: reseed can still hide upstream drift if diagnostics do not expose when fallback or undoable-refresh paths run.'
    ],
    'dirty-revision-graph': [
      'Implemented through explicit stroke runtime revision sets, dirty keys, render cache entries, and performance counters.',
      'Step 7 DoD locked: source path, stroke spec, topology, shared geometry, source family, stroke domain, interval, candidate, arrangement, ownership, legality, resolved region, paint, render output, and preview-mode revisions are now explicit dirty inputs.',
      'Render-entry reuse now keys geometry signatures from upstream stage revisions before output projection reuse.',
      'Residual risk: later stage implementations still own finer algorithm-level avoidance; Step 7 establishes the auditable dirty-stage contract required before render-entry reuse.'
    ],
    'render-strategy-entry': [
      'Implemented in vectorRenderStrategy / renderVectorGraphic.',
      'Step 8 DoD locked: vectorRenderStrategy is a delegation-only wrapper and renderVectorGraphic normalizes data before topology or stroke stage work.',
      'Residual risk: renderVectorGraphic still orchestrates many downstream stages, so later steps must keep moving domain decisions into their typed stage helpers rather than expanding entry logic.'
    ],
    'normalize-render-data': [
      'Implemented through normalizeVectorRenderData and map normalizers.',
      'Step 9 DoD locked: render normalization tolerates malformed snapshots but drops dangling topology references instead of repairing them into renderable geometry.',
      'Legacy anchorPoints input is not converted into topology during render normalization.',
      'Residual risk: normalization is still a render adapter; runtime mutation validity must continue to be enforced by Step 3 validation.'
    ],
    'normalize-stroke-spec': [
      'Implemented through the canonical normalizeStrokeSpec helper in renderable-stroke.',
      'Step 10 DoD locked: normalized stroke specs and rejection diagnostics cover invalid entries, non-positive width, invisible stroke, invisible paint, invalid paint, and invalid gradient paint.',
      'Dash pattern parity, negative dash offset normalization, cap/join/miter defaults, and paint normalization handoff are covered by focused tests.',
      'Residual risk: downstream stages still consume the legacy getRenderableStrokes compatibility wrapper until later stage refactors switch to the richer diagnostics result.'
    ],
    'build-path-topology': [
      'Implemented: vector render builds and caches one PathTopologyModel per network revision.',
      'Step 11 DoD locked: PathTopologyModel now exposes fillRule, sourceRevision, topologyFamily, contours, totalLength, legalDomainDescriptors, legalDomains, and metadata counts.',
      'Source revision from vector computed topology is now passed into the topology model when vector render builds network paths.',
      'Residual risk: deep exact legal-domain and intersection geometry are still supplemented by later shared-geometry and source-family stages.'
    ],
    'shared-geometry-model': [
      'Reopened on 2026-05-20: previous Step 12 gates were insufficient because strokeBoundaryDomains could still be derived from side-classified sourceSplitRanges instead of actual region-boundary contour geometry.',
      'Correct Step 12 DoD: the shared model must emit first-class region-boundary stroke domains: outer filled-region boundaries, filled-face internal boundaries, global exterior boundaries, open-path boundaries, and their boundary split segments.',
      'Each boundary split segment must carry adjacent face ids, filled/exterior side evidence, boundaryRole, inside/outside eligibility, and enough provenance for fill, stroke, diagnostics, export, and future shadow to consume without recomputing side.',
      'Required TDD gate: resolved-vector-geometry-model.test.ts must fail before implementation when a filled-face domain lacks actual boundary geometry, boundary length, and contour-local distance fields. Metadata-only face labels are not proof.'
    ],
    'resolve-source-families': [
      'Implemented initial canonical boundary through resolveSourceFamily and public ResolvedSourceFamily types.',
      'Step 13 now exposes runtime support state separately from Figma parity status, so blocked runtime families can no longer be mistaken for completed parity.',
      'Figma stroke-family matrix is now first-class support evidence; remaining parity work must be proven by downstream domain/geometry/projection gates.',
      'Step 13 can classify a family as runtime-supported without marking product parity complete. Self-intersecting solid inside/outside has current solidMaskModel candidate, legality, and projection evidence for the encoded self-check/vector-6 slices, but the family remains active until Step 30 broader visual review passes.'
    ],
    'resolve-stroke-domains': [
      'Reopened on 2026-05-20: resolveStrokeDomains must prove it consumes actual Step 12 boundary-domain geometry, not sourceSplitRanges relabeled as stroke domains.',
      'Required DoD: ResolveStrokeDomains must consume PathTopologyModel, ResolvedSourceFamily, normalized stroke spec, and shared region/face legal evidence, then emit StrokeDomainPlan / FigmaLikeSplitRange[] without allocating dash intervals or building product polygons.',
      'Required TDD gate: stroke-domain-plan.test.ts must prove inside includes true filled-face internal boundary-domain geometry and outside excludes those domains. The plan must expose boundary-domain length and contour-local start/end distances for Step 15.'
    ],
    'allocate-intervals': [
      'Implemented through allocateDashedIntervalsForTopology and topology totalLength/closed inputs.',
      'Validated: tests prove every Figma-like split range emits first visible interval [rangeStart, rangeStart + dash/2] and last visible interval [rangeEnd - dash/2, rangeEnd], clamped only for short ranges.',
      'Validated: interval provenance preserves split range id/start/end and terminal role through VisibleDashedTopologyInterval for candidates, FinalFace, render/export, and E2E probes.',
      'Reopened on 2026-05-20 for filled-face-boundary domains: interval allocation must prove its domain distances come from selected region-boundary geometry, not authored source-path distances.'
    ],
    'build-source-span-graph': [
      'Implemented through buildSourceSpanGraph, sourceSpanIds metadata, and explicit source-span provenance availability classification.',
      'Step 16 DoD locked: visualOnly and omitDiagnosticMetadata now have typed unavailable reasons, while normal diagnostic packets preserve sourceSpanIds.',
      'Residual risk: later packet stages must keep carrying sourceSpanIds through candidate, ownership, final-face, and projection bridges without recovering provenance from geometry ids.'
    ],
    'build-one-sided-candidates': [
      'Reopened on 2026-05-20: previous candidate gates did not prove geometry was built from true filled-face internal boundary domains.',
      'Dashed DoD: each selected boundary split segment is the minimum semantic unit and preserves terminal half-dashes on both ends.',
      'Solid DoD: candidates come from authored source center-stroke geometry at doubled width and preserve source-vertex join/miter semantics before Step 20 mask clipping; selected boundary domains are mask/provenance evidence only.',
      'DoD: inside evidence includes outer and filled-face internal boundary domains; outside evidence includes only global exterior boundary domains. Dashed emits interval candidates from that evidence, while solid uses it only for mask/provenance.',
      'Invalidated prior gate: outside internal-adjacency-range product packets on unfilledSide are now a failure signal, not a passing condition.'
    ],
    'partition-arrangement-faces': [
      'Implemented through GeometryBackendRegistry/Clipper2, buildArrangedStrokeFinalFacesFromResolvedPackets, constrained solid promotion, and constrained dashed exact promotion for supported non-gradient packets.',
      'Revalidated on 2026-05-18: split-range distribution probes and terminal metadata survive visual-overlap collapse in the self-intersecting star gate.',
      'DoD locked: overlap collapse must preserve terminal interval ids, split range id/start/end, terminal roles, and packet references in a way that the star-wide final visual oracle can probe.',
      'Residual risk: backend promotion or union changes must not make metadata look correct while dashed product pixels lose terminal half-dash shape.'
    ],
    'resolve-ownership': [
      'Implemented through resolveStrokeOwnership, typed packet metadata, ownerSet, arrangement claims, and diagnostics.',
      'Step 19 DoD locked: ownerSet is resolved from explicit typed owner metadata or typed owner fields only, and opaque geometryId values are never parsed for ownership.',
      'Residual risk: later legality, region, final-face, hit/export, and diagnostics bridges must preserve ownerSet without reintroducing id or packet-order recovery.'
    ],
    'apply-legality': [
      'Implemented through constrained solid legality clipping, compound legal-domain normalization, and dashed legal-domain handling.',
      'Invalidated on 2026-05-20 for the filled-star inside blocker: prior legality evidence did not prove central filled-face inside stroke from region/winding-rule classification.',
      'Aligned on 2026-05-25 for the current solidMaskModel slice: legality masks doubled center-stroke solid candidates by inside fill or outside exterior domains without rebuilding boundary ribbons. Dashed legality still filters/clips selected boundary-domain interval candidates.',
      'Failure signal: a test passes because central filled-face inside pixels exist while solid provenance still points to boundary-domain product ribbons or dashed terminal metadata instead of solidMaskModel mask provenance.'
    ],
    'build-resolved-stroke-regions': [
      'Implemented through the public paint-free StrokeRegionPacket contract and builders from resolved packets/final faces.',
      'Step 21 DoD locked: region packets preserve geometry, support, owner, interval, source-span, contour, legal-domain, arrangement, and non-paint revision metadata while excluding paint/color/alpha/gradient payloads.',
      'Compatibility note: current runtime packet builders may still carry paint fields before the region bridge, but Step 22 is the canonical paint attachment boundary from the paint-free region contract.'
    ],
    'attach-paint-payload': [
      'Implemented through attachStrokePaintPayload, renderable stroke paint normalization, and packet paint fields.',
      'Step 22 DoD locked: paint attachment occurs after semantic geometry and paint-related edits must not alter topology, interval, candidate, arrangement, ownership, legality, or region geometry decisions.'
    ],
    'fill-region-consumer': [
      'Implemented for current self-intersecting fill consumption, with unsupported/no-shared fallback limited to cases where shared fillRegions are unavailable.',
      'Risk: fallback fill code must not become a second self-intersection authority when shared fillRegions are available.'
    ],
    'build-final-faces': [
      'Implemented through stroke-final-face, buildSolidCenterStrokeFinalFaces, arranged final faces, and visual overlap collapse.',
      'Revalidated on 2026-05-18 for inside/center: FinalFace-derived packets and render entries support star-wide terminal/gap probes after collapse.',
      'DoD locked: FinalFace output must preserve figmaLikeSplitRangeTerminals and child packet geometry in a form that supports star-wide terminal/gap probes after collapse.',
      'Residual risk: future FinalFace collapse changes can preserve ids while losing a probeable terminal shape.',
      'Reopened on 2026-05-20 for the filled-face-boundary slice: FinalFace records must prove product geometry came from true boundaryDomain geometry, not only selectedSide/legal-domain metadata and source spans.'
    ],
    'emit-render-hit-export-packets': [
      'Implemented through FinalFace[] projections for render entries, hit area, and export packets.',
      'Revalidated on 2026-05-18 for inside/center: render/export projection preserves terminal interval provenance and probeable terminal geometry in the final star gate.',
      'DoD locked: render/hit/export packets must project from FinalFace[] and preserve terminal interval provenance plus probeable terminal geometry without restroking authored input.',
      'Residual risk: export/render simplification can drop enough geometry detail to make terminal probes meaningless.',
      'Reopened on 2026-05-20 for the filled-face-boundary slice: projection metadata must preserve true boundaryDomain geometry provenance. SourceContourIds, boundaryRole, selectedSide, or red pixels alone are insufficient.'
    ],
    'render-entries': [
      'Implemented through toSolidCenterStrokeRenderEntriesFromFinalFaces and native center solid paths.',
      'Invalidated on 2026-05-20 for the filled-star inside blocker: prior render-entry evidence did not prove central filled-face inside stroke from FinalFace region/face provenance.',
      'DoD locked: render entries must project probeable terminal FinalFace geometry and must not use native center or renderer-side repair for constrained inside/outside semantics.',
      'Residual risk: native center paths remain allowed only for center-equivalent semantics.'
    ],
    'mesh-render': [
      'Implemented through renderSolidCenterStrokeEntries and Pixi drawing.',
      'Risk remains if upstream emits raw overlap/debug fragments as product final faces; renderer will draw them faithfully.'
    ],
    'hit-export': [
      'Implemented through createSolidCenterStrokeHitAreaFromFinalFaces and applySolidCenterStrokeExportPacketsFromFinalFaces.',
      'Risk reduced: drag visual mode deferral is now covered by unit tests and the drag E2E distinguishes visual freshness during drag from FinalFace/export projection after mouseup.'
    ],
    'runtime-diagnostics': [
      'Implemented through a shared stroke-runtime-diagnostics branch contract plus constrained dashed/solid runtime branch outputs.',
      'Risk reduced: product branch id, support state, blocked reason, owner/legal provenance, and dirty-stage trace are now present on the public runtime diagnostic shape.'
    ],
    'visible-final-result': [
      'Reopened on 2026-05-20: current final visual gates do not yet prove region-boundary stroke-domain parity; they can pass when hole is only metadata.',
      'Correct final visual DoD: inside screenshots contain filled-face internal boundary stroke; outside screenshots contain no filled-face internal boundary stroke.',
      'Correct final visual DoD: solid probes prove miter/join shape, mask boundaries, no same-paint overlap darkening, no high-curvature black cracks, no split-end cap artifacts, and no dashed terminal metadata; dashed probes prove boundary-domain provenance, terminal half-dashes, redistributed gaps, cap assembly, overlap collapse, and projection from FinalFace.',
      'Required TDD gate: final visual probes must sample computed hole boundary geometry and prove inside filled-side coverage plus outside absence. Command pass and manual screenshot review without boundary-domain probes cannot mark Step 30 aligned.'
    ]
  }

  const helperConditionsByName = {
    'input.drag':
      'Requires an active pointer drag session, a resolved target/tool context, and feature permission to translate pointer movement into an edit command.',
    pen: 'Runs only when the pen/path authoring feature owns the current session; it should emit vector-edit intent, not write render data directly.',
    selectVectorPoint:
      'Requires an editable vector element, a selected point/handle/segment target, and a feature session allowed to update topology.',
    'FeatureNames.*':
      'Feature identity must be declared through the feature registry so exclusivity, priority, and session lifecycle remain explicit.',
    'elementApis.updateVectorAnchorPointPosition':
      'Requires element id, existing point id, workspace position, and vector computed data that can be patched without breaking segment references.',
    'elementApis.updateVectorAnchorPointHandlePosition':
      'Requires element id, existing point id, handle side, workspace position, and a handle mode that can store the requested handle update.',
    'elementApis.splitVectorSegmentAtWorkspacePos':
      'Requires an existing segment id, a workspace split position that can be projected onto the segment, and topology patching for the new point/segments.',
    'elementApis.setVectorClosed':
      'Requires a target network whose endpoints can be connected/disconnected without orphaning segment references.',
    'vectorGeometry.movePoint':
      'Requires a valid point id and must preserve all segment references that point to the moved point.',
    'vectorGeometry.updateHandle':
      'Requires a valid point id, handle side, and handle mode semantics that keep curve control points coherent.',
    'vectorGeometry.splitSegment':
      'Requires a valid segment id and split parameter/position; it must create replacement segments and maintain network ordering.',
    'vectorGeometry.validate':
      'Runs before runtime commit; requires complete candidate points, segments, and networks and rejects broken references.',
    'vectorGeometry.buildPatch':
      'Requires a candidate topology mutation and must emit computed-data patch keys that preserve topology consistency.',
    'transactionApis.startTransaction':
      'Runs before the first undoable vector write for an intended user action.',
    'transactionApis.updateTransaction':
      'Runs during an active transaction when transient vector drag updates should stay grouped.',
    'transactionApis.endTransaction':
      'Runs after the intended action is complete; it must not split one drag/edit into multiple undo commits.',
    'elementApis.changeComputedData':
      'Requires validated computed-data patch and routes the write through common element APIs.',
    'controllers.sceneTree.changeElementComputedData':
      'Requires element id and computed-data patch; it is the scene-tree write boundary that publishes downstream deltas.',
    'props-manager data channel':
      'Requires committed scene-tree computed-data changes; it emits before/after key deltas instead of full render authority.',
    'render scene-tree subscription':
      'Requires scene-tree update or batch events and routes them to renderSceneTreeStore without mutating source state.',
    'RenderElementData cache':
      'Requires existing or freshly composed render snapshots; it patches cached computed data by changed key.',
    'cached[key] = after':
      'Runs only for changed computed-data keys and must leave untouched keys from the cached snapshot intact.',
    buildStrokeRuntimeRevisionSet:
      'Requires previous and next render inputs and computes revision keys for source, stroke spec, topology, shared geometry, source family, stroke domain, geometry, paint, and output stages.',
    computeStrokeDirtyKeys:
      'Requires changed data keys plus previous/next revision sets; it classifies which stroke stages need rerun or cache reuse.',
    pathModelCache:
      'Requires stable source revision keys; it may reuse PathTopologyModel only when points/segments/networks/fillRule inputs match.',
    'stroke render cache':
      'Requires dirty-key classification and may reuse render entries only when upstream geometry/paint revisions are unchanged.',
    vectorRenderStrategy:
      'Requires a render graphic and vector computed data snapshot; it should orchestrate, not own domain geometry decisions.',
    renderVectorGraphic:
      'Requires normalized or normalizable vector render data and must emit fill/stroke/render/hit/export products from shared stage outputs.',
    normalizeVectorRenderData:
      'Requires raw computed data and returns stable points, segments, networks, fills, strokes, fillRule, and debug options.',
    normalizeVectorPointNodeMap:
      'Requires point-node map-like input and filters/defaults invalid point payloads into render-safe point records.',
    normalizeVectorSegmentMap:
      'Requires segment map-like input and normalizes segment endpoint/control metadata without inventing missing topology.',
    normalizeVectorNetworkMap:
      'Requires network map-like input and preserves authored network ordering/closed state for topology construction.',
    normalizeStrokeSpec:
      'Planned canonical boundary; should require authored stroke list/default policy and return normalized specs plus rejection diagnostics.',
    buildVectorSourceRevision:
      'Requires normalized vector source data and produces a cache key that changes only when source topology/fillRule changes.',
    buildVectorGeometryModelPath:
      'Requires ordered networks, points, and segments and builds path geometry for topology/model consumers.',
    buildPathTopologyModel:
      'Requires one normalized network path and fillRule/legal-domain context; returns topology family, contours, length, and source metadata.',
    buildResolvedVectorGeometryModel:
      'Requires network paths and fillRule; builds shared fill/legal geometry evidence for self-intersecting cases without becoming the dashed stroke path authority. This evidence is still the canonical side-resolution and legality authority for self-intersecting inside/outside.',
    buildSelfIntersectingGeometry:
      'Requires self-intersecting topology and even-odd rules; returns fill/legal regions for fill, diagnostics, and legality evidence.',
    buildSelfIntersectingEvenOddResolvedGeometry:
      'Requires self-intersecting closed geometry and even-odd legal domains; includes outer/hole fill-region evidence but must not define dashed stroke intervals.',
    classifyPathTopologyModel:
      'Requires PathTopologyModel and returns open/simple/compound/self-intersecting topology family without reading geometry ids.',
    classifyCompoundClosedLegalDomains:
      'Requires closed compound topology and legal-domain descriptors; determines inside/outside legal face families.',
    resolveStrokeDomains:
      'Requires PathTopologyModel, ResolvedSourceFamily, normalized stroke spec, optional sourcePath, and shared resolved region/face legal evidence; returns the family-specific StrokeDomainPlan without allocating dash intervals or building product polygons.',
    buildFigmaLikeSplitRangeDashDomains:
      'Requires self-intersecting closed source topology; returns intersection split ranges for Figma-like dashed allocation without using source segments or region/face boundaries as dash product paths. The surrounding StrokeDomainPlan carries source-segment provenance and implicit region/face side authority.',
    allocateDashedIntervalsForTopology:
      'Requires normalized dash pattern/offset plus whole-source-path total length and closed state for center/simple families; self-intersecting constrained dashed must bypass it and use split-range allocation.',
    allocateFigmaLikeSplitRangeDashedIntervals:
      'Requires topology/implicit-fill split source ranges plus normalized dash pattern; emits per-range half-dash endpoint intervals plus interior dash/gap intervals. Normal-length split ranges establish the reference redistributed gap, shorter ranges choose dash count from that reference rhythm without imposing a minimum gap clamp, and no cumulative schedule carries across ranges.',
    allocateStrokeIntervals:
      'Requires normalized stroke spec and topology length; emits dashed intervals or solid full-coverage interval records.',
    buildSourceSpanGraph:
      'Requires PathTopologyModel and stroke intervals; splits provenance spans by authored vertices, dash boundaries, and intersections.',
    getSourceSpanIdsForInterval:
      'Requires SourceSpanGraph and interval id/range; returns typed source span ids for packet/final-face metadata.',
    buildOneSidedSegmentFaces:
      'Requires closed constrained inside/outside support or center-equivalent open support and emits segment-side candidate faces.',
    buildOneSidedJoinFaces:
      'Requires adjacent segment candidates, join style, miter limit, and legal side; emits join candidate faces.',
    buildOneSidedCapFaces:
      'Requires open-center or interval endpoint semantics and cap style; constrained closed inside/outside should not invent caps.',
    buildConstrainedSolidStrokeResolvedPackets:
      'Requires normalized solid stroke spec, topology family, legal domains, and support state for closed constrained strokes.',
    buildConstrainedDashedStrokeResolvedPackets:
      'Requires dashed interval records on the correct family domain: whole-source-path for center/simple families, intersection split ranges for self-intersecting constrained dashed; also requires topology/legal-domain metadata and support state.',
    buildSourcePathDashedOneSidedCandidates:
      'Requires split-range dash intervals, implicit legal-domain inside/outside side selection, and source-span provenance; emits self-intersecting constrained dashed candidates without using source segments or region/face boundaries as dash paths.',
    resolveSourcePathStrokeSide:
      'Requires a closed source-path range, sampled source points, fill rule, stroke width, and authored inside/outside position; samples both local normal sides against the implicit fill/filled-face domain and returns the selected offset side or a blocked reason. It must not guess from a fixed global normal or depend on visible fill paint.',
    resolveSourcePathOrientationStrokeSide:
      'Requires a simple closed source path, sampled source points, stroke width, and authored inside/outside position for explicitly orientation-based families; it is not a Figma-like fallback for closed self-intersecting inside/outside star strokes.',
    GeometryBackendRegistry:
      'Requires selected geometry backend capability; it must not imply exact support for unsupported topology families.',
    'GeometryBackend.buildArrangement':
      'Requires candidate faces and backend support; returns partitioned arrangement regions when exact computation is available.',
    buildArrangedStrokeFinalFacesFromResolvedPackets:
      'Requires arranged/promoted packet geometry and typed metadata; creates final faces without losing ownership/provenance.',
    promoteConstrainedDashedPacketsToExactArrangement:
      'Requires constrained dashed packets and arrangement support; only promotes supported/gated families to exact faces.',
    promoteConstrainedSolidPacketsToExactArrangement:
      'Requires constrained solid packets and arrangement support; local-side/high-curvature approximations must remain explicit.',
    resolveStrokeOwnership:
      'Requires partitioned regions and typed packet ownership; returns ownerSet without parsing ids or relying on packet order.',
    'stroke-candidate-arrangement owner claims':
      'Requires arrangement claimedBy metadata and maps multi-owner overlap regions into typed owner sets.',
    buildConstrainedSolidLegalityClippingResult:
      'Requires constrained solid candidates and legal-domain polygons; clips/filter candidates without constructing substitute geometry.',
    clipSourcePathPolygonsToEvenOddLegalDomain:
      'Requires source-path selected-side polygons and even-odd legal domains; clips/filters inside or outside constrained candidates without constructing replacement geometry.',
    buildCompoundLegalDomainNormalization:
      'Requires compound closed topology and legal descriptors; normalizes legal domains before legality filtering.',
    'StrokeRegionPacket builders':
      'Requires legal visible face regions and stage metadata; emits semantic packets before renderer projection.',
    attachStrokePacketDebugMeta:
      'Requires packet, topology, ownership, support, and revision metadata; attaches diagnostics without changing geometry.',
    attachStrokePaintPayload:
      'Planned boundary; should require geometry-only stroke regions plus normalized paint payload and attach paint without geometry mutation.',
    'paint payload normalization':
      'Requires authored paint, opacity, gradient/solid inputs, bounds, and transform context; outputs renderer-ready paint payload.',
    'resolvedGeometry.selfIntersecting.fillRegions':
      'Requires a shared resolved geometry model; fill may consume these regions but must not recompute competing self-intersection truth.',
    buildFillFaces:
      'Requires resolved fill regions or unsupported/no-shared fallback geometry plus fills/fillRule; outputs fill faces for draw/render evidence.',
    drawFillFaces:
      'Requires fill faces and graphic context; draws fill without changing stroke topology or legality decisions.',
    buildSolidCenterStrokeFinalFaces:
      'Requires center-equivalent packet geometry or native center stroke support and emits FinalFace[] metadata.',
    'stroke-final-face':
      'Requires raw face geometry, paint key, owner metadata, interval/source/legal ids, and runtime/support status.',
    collapseExactDuplicateFinalFaces:
      'Requires comparable exact face geometry and metadata; collapses duplicate visual faces only when ownership/provenance remains preserved.',
    toSolidCenterStrokeRenderEntriesFromFinalFaces:
      'Requires FinalFace[] and paint payloads; projects faces into renderer entries without restroking authored input.',
    createSolidCenterStrokeHitAreaFromFinalFaces:
      'Requires FinalFace[] in the non-drag final path; creates hit regions from final geometry.',
    applySolidCenterStrokeExportPacketsFromFinalFaces:
      'Requires FinalFace[] and export context; emits export packets from final geometry instead of authored source path.',
    drawNativeCenterSolidStrokePath:
      'Requires center stroke semantics only; it must not be used for constrained inside/outside final geometry.',
    'renderable-stroke':
      'Requires normalized stroke style and paint inputs; produces renderer-ready stroke spec/payload metadata.',
    renderSolidCenterStrokeEntries:
      'Requires renderer-specific stroke entries and graphic context; draws exactly what upstream final faces provide.',
    'Pixi render loop':
      'Requires graphic display objects and renderer frame; final visual correctness depends on upstream packets/faces.',
    applyVectorHoverHitArea:
      'Requires current final hit/export geometry or vector hover fallback; should not create product render geometry.',
    setConstrainedDashedRuntimeDiagnostics:
      'Requires dashed runtime branch metadata; records accepted/blocked/local/exact state for diagnostics.',
    setConstrainedSolidRuntimeDiagnostics:
      'Requires solid constrained branch metadata; records support and runtime status for diagnostics.',
    setConstrainedSolidLegalityDiagnostics:
      'Requires legality clipping results; records blocked/legal domains without changing render packets.',
    setConstrainedSolidOwnershipDiagnostics:
      'Requires ownership resolution results; records owner claims and overlap evidence.',
    applyCenterDashedOverlapDiagnostics:
      'Requires center dashed overlap state; applies diagnostics only to the branch actually used by product render/debug.',
    'browser visual checks':
      'Requires a running app/e2e page and deterministic scenario; verifies visible output after upstream stage evidence is known.'
  }

  const defaultContextByGroup = {
    Interaction: {
      planReferences: [
        'stroke-flow-inspector.data.js#input-event',
        'stroke-flow-inspector.data.js#vector-api-mutation'
      ],
      implementationTrace: [
        'Feature/input layer receives the user action.',
        'Feature code calls app common APIs; render packages are not allowed to own the source mutation.'
      ],
      e2eStatus: [
        'Coverage: indirectly exercised by vector editing and refresh E2E scenarios.',
        'Group-level coverage is resolved by the step-specific gates below.'
      ]
    },
    'State Commit': {
      planReferences: [
        'stroke-flow-inspector.data.js#vector-api-mutation',
        'stroke-flow-inspector.data.js#validate-vector-topology',
        'stroke-flow-inspector.data.js#transaction-write'
      ],
      implementationTrace: [
        'Validated computed-data patches enter scene-tree state.',
        'Scene-tree events publish changed computed-data keys to render subscribers.'
      ],
      e2eStatus: [
        'Coverage: indirectly covered by drag, refresh, and reported vector E2E flows.',
        'Group-level coverage is resolved by the step-specific gates below.'
      ]
    },
    'Render Cache': {
      planReferences: [
        'stroke-flow-inspector.data.js#render-cache-patch',
        'stroke-flow-inspector.data.js#dirty-graph'
      ],
      implementationTrace: [
        'Render scene-tree mirror patches cached computed data.',
        'Stroke dirty keys compare previous and next revision inputs before render-entry reuse.'
      ],
      e2eStatus: [
        'Coverage: stroke-drag-render-performance.spec.ts and vector-stroke-refresh.spec.ts target this area.',
        'Group-level coverage is resolved by the step-specific gates below.'
      ]
    },
    'Stroke Pipeline': {
      planReferences: [
        'stroke-flow-inspector.data.js#vector-render-entry',
        'stroke-flow-inspector.data.js#normalize-stroke-spec',
        'stroke-flow-inspector.data.js#build-one-sided-candidates'
      ],
      implementationTrace: [
        'Render normalizes vector/stroke data, builds topology, then constructs interval/candidate/arrangement/legality products.',
        'Partial steps remain where current code distributes a planned single stage across several helper branches.'
      ],
      e2eStatus: [
        'Coverage: solid/dashed constrained visual E2E specs and reported vector regression specs target this area.',
        'Group-level coverage is resolved by the step-specific gates below.'
      ]
    },
    'Shared Geometry': {
      planReferences: [
        'stroke-flow-inspector.data.js#build-path-topology-model',
        'stroke-flow-inspector.data.js#shared-resolved-geometry'
      ],
      implementationTrace: [
        'Resolved geometry model builds shared fill/legal regions from the same topology revision.',
        'Corrected DoD: self-intersecting region/face boundaries are not Figma-like dashed stroke paths; they are side-resolution, legality, fill, and diagnostic evidence only.'
      ],
      e2eStatus: [
        'Coverage: self-check star, constrained dashed, and reported dashed seam specs exercise this area.',
        'Group-level coverage is resolved by the step-specific gates below.'
      ]
    },
    Fill: {
      planReferences: [
        'stroke-flow-inspector.data.js#shared-resolved-geometry',
        'stroke-flow-inspector.data.js#fill-consumes-shared-geometry'
      ],
      implementationTrace: [
        'Fill consumes shared fillRegions when available and otherwise uses the unsupported/no-shared fallback fill path.',
        'Fill must remain a consumer of shared geometry, not a second self-intersection authority.'
      ],
      e2eStatus: [
        'Coverage: vector preview/fill unit tests plus visual stroke specs provide indirect fill evidence.',
        'Group-level coverage is resolved by the step-specific gates below.'
      ]
    },
    'Final Faces': {
      planReferences: [
        'stroke-flow-inspector.data.js#build-final-faces',
        'stroke-flow-inspector.data.js#emit-render-hit-export-packets'
      ],
      implementationTrace: [
        'Packet and arrangement products project into FinalFace[] with owner, interval, source-span, contour, legal-domain, and paint keys.',
        'Exact duplicate collapse is allowed only after metadata preservation is verified.'
      ],
      e2eStatus: [
        'Coverage: solid/dashed visual specs and packet/final-face unit tests target this area.',
        'Group-level coverage is resolved by the step-specific gates below.'
      ]
    },
    Render: {
      planReferences: [
        'stroke-flow-inspector.data.js#render-entries',
        'stroke-flow-inspector.data.js#renderer-draw'
      ],
      implementationTrace: [
        'Renderer entries are projections from fill faces and strokeFinalFaces.',
        'Pixi drawing should not choose stroke semantics; it draws upstream final geometry.'
      ],
      e2eStatus: [
        'Coverage: visual E2E specs cover final render output across center, constrained solid, constrained dashed, and regressions.',
        'Group-level coverage is resolved by the step-specific gates below.'
      ]
    },
    Diagnostics: {
      planReferences: [
        'stroke-flow-inspector.data.js#runtime-diagnostics',
        'stroke-flow-inspector.data.js#visible-final-result'
      ],
      implementationTrace: [
        'Diagnostics consume typed runtime/support/ownership/legality metadata from the branch used by product render.',
        'Debug evidence must not be confused with product visual branches.'
      ],
      e2eStatus: [
        'Coverage: mostly unit-level diagnostics plus indirect E2E visual evidence.',
        'Group-level coverage is resolved by the step-specific gates below.'
      ]
    }
  }

  const stepContextOverrides = {
    'input-event': {
      implementationTrace: [
        'Pointer/keyboard event enters feature-system and resolves active tool/session.',
        'Output is edit intent only; no vector computed-data write occurs in this step.'
      ],
      e2eStatus: [
        'Direct unit coverage: vector-path-editing-render-layer.test.ts locks pen-tool feature entry behind defineFeature, FeatureNames, InputSystemEvents, elementApis, and drag-end state cleanup.',
        'Indirect E2E coverage: vector-stroke-refresh.spec.ts and stroke-drag-render-performance.spec.ts exercise user-driven vector changes through feature/session ownership.',
        'Step 1 gate passed: yarn workspace @asyra/preset test:local src/__tests__/vector-path-editing-render-layer.test.ts.',
        'Step 1 gate passed: yarn workspace @asyra/asyra-design test:e2e -- stroke-drag-render-performance.spec.ts vector-stroke-refresh.spec.ts.',
        'Step 1 revalidation passed on 2026-05-17: feature entry still emits edit intent only; pen/selectVectorPoint code uses FeatureNames, InputSystemEvents, selectionApis/systemContextApis, and elementApis without render/stroke-render imports or geometry decisions.',
        'Step 1 revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/vector-path-editing-render-layer.test.ts.',
        'Step 1 revalidation E2E gate passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/stroke-drag-render-performance.spec.ts e2e/vector-stroke-refresh.spec.ts --workers=1.',
        'Step 1 recurring revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 1 recurring revalidation gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Step 1 recurring gate passed: yarn workspace @asyra/preset build:preset.',
        'Step 1 recurring gate passed: yarn lint:ci.',
        'Step 1 self-review: complete for input/feature boundary; proceed to vector-api-mutation next.'
      ]
    },
    'vector-api-mutation': {
      implementationTrace: [
        'elementApis vector methods delegate topology math to vectorGeometry helpers.',
        'Output must include all affected point/segment/network keys needed for a valid computed-data patch.',
        'buildVectorComputedPatch is locked as the computed-data patch boundary for x/y/width/height, points, segments, networks, and closed.',
        'Invalidated fallback evidence: derived fill-region paths must not be created or consumed to satisfy self-intersecting dashed product output.'
      ],
      e2eStatus: [
        'Direct unit gate passed: yarn workspace @asyra/preset test:local src/__tests__/vector-component.test.ts src/__tests__/vector-path-editing-render-layer.test.ts.',
        'Additional impacted geometry gate passed: yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts.',
        'Direct E2E gate passed: yarn workspace @asyra/asyra-design test:e2e -- vector-stroke-refresh.spec.ts.',
        'Step 2 revalidation passed on 2026-05-17: elementApis vector mutations still delegate to vectorGeometry and commit topology-native points, segments, networks, closed state, and bounds via buildVectorComputedPatch.',
        'Step 2 oracle cleanup on 2026-05-17: vector-component test names now describe FinalFace-derived split-range geometry instead of constrained dashed boundary geometry.',
        'Step 2 revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/vector-component.test.ts src/__tests__/vector-path-editing-render-layer.test.ts.',
        'Step 2 impacted packet gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts.',
        'Step 2 E2E revalidation gate passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/vector-stroke-refresh.spec.ts --workers=1.',
        'Step 2 recurring revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 2 recurring revalidation gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Recurring gate passed: yarn workspace @asyra/preset build:preset.',
        'Recurring gate passed: yarn lint:ci.',
        'Step 2 self-review: complete for topology-native mutation intent and the visible geometry regression found by its gate; proceed to validate-topology next.'
      ]
    },
    'validate-topology': {
      implementationTrace: [
        'assertVectorTopologyConsistency rejects dangling point/segment/network references before commit.',
        'buildVectorComputedPatch calls assertVectorTopologyConsistency before bounds normalization and computed-data patch creation.',
        'Product support decisions are intentionally deferred to render support classification.'
      ],
      e2eStatus: [
        'Direct unit gate passed: yarn workspace @asyra/preset test:local src/__tests__/vector-topology-validation.test.ts src/__tests__/vector-component.test.ts.',
        'Step 3 test oracle strengthened on 2026-05-17: vector-topology-validation.test.ts now asserts write-time validation does not reference stroke, dashed, inside/outside, fill, hole, or legal-domain support semantics.',
        'Step 3 revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/vector-topology-validation.test.ts src/__tests__/vector-component.test.ts.',
        'No visual/E2E gate required for this internal write-time structural validation step.',
        'Step 3 recurring revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 3 recurring revalidation gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Recurring gate passed: yarn workspace @asyra/preset build:preset.',
        'Recurring gate passed: yarn lint:ci.',
        'Step 3 self-review: complete for structural topology validation; proceed to transaction-write next.'
      ]
    },
    'transaction-write': {
      implementationTrace: [
        'changeComputedData opens, updates, and closes the transaction boundary around the state mutation.',
        'Drag updates may be transient, but drag-end must close as one intended undo action.',
        'Pen/vector point drag reverts the transient preview with undoable:false, then applies the final target without undoable:false.'
      ],
      e2eStatus: [
        'Direct package gate passed: yarn workspace @asyra/reactive-events test:local src/__tests__/transaction-boundary.test.ts.',
        'Direct package gate passed: yarn workspace @asyra/scene-tree test:local src/__tests__/transaction-options.test.ts.',
        'Direct vector drag contract gate passed: yarn workspace @asyra/preset test:local src/__tests__/vector-path-editing-render-layer.test.ts.',
        'Relevant drag E2E gate passed: yarn workspace @asyra/asyra-design test:e2e -- stroke-drag-render-performance.spec.ts.',
        'Step 4 revalidation passed on 2026-05-17: changeComputedData wraps computed-data writes with startTransaction/endTransaction, drag previews remain undoable:false, and drag-end restores preview non-undoably before the single final undoable write.',
        'Step 4 direct gates passed on 2026-05-17: yarn workspace @asyra/reactive-events test:local src/__tests__/transaction-boundary.test.ts; yarn workspace @asyra/scene-tree test:local src/__tests__/transaction-options.test.ts; yarn workspace @asyra/preset test:local src/__tests__/vector-path-editing-render-layer.test.ts.',
        'Step 4 focused drag E2E gate passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/stroke-drag-render-performance.spec.ts -g "measures real browser point and handle drag rendering with product visual probes" --workers=1.',
        'Step 4 recurring revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 4 recurring revalidation gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Recurring gate passed: yarn workspace @asyra/preset build:preset.',
        'Recurring gate passed: yarn lint:ci.',
        'Step 4 self-review: complete for transaction-bounded write; proceed to data-channel-delta next.'
      ]
    },
    'data-channel-delta': {
      implementationTrace: [
        'Scene-tree computed-data update events carry before/after changed keys.',
        'Transient vector computed-data updates batch points, segments, and networks key deltas in source order.',
        'Preset subscriptions forward deltas into renderSceneTreeStore.'
      ],
      e2eStatus: [
        'Direct scene-tree gate passed: yarn workspace @asyra/scene-tree test:local src/__tests__/sceneTree.test.ts.',
        'Direct render mirror gate passed: yarn workspace @asyra/render test:local src/__tests__/scene-tree-store.test.ts.',
        'Direct refresh E2E gate passed: yarn workspace @asyra/asyra-design test:e2e -- vector-stroke-refresh.spec.ts.',
        'Step 5 revalidation passed on 2026-05-17: scene-tree batches transient vector computed-data key deltas in points/segments/networks order and renderSceneTreeStore composes them into one pending computed update.',
        'Step 5 direct gates passed on 2026-05-17: yarn workspace @asyra/scene-tree test:local src/__tests__/sceneTree.test.ts; yarn workspace @asyra/render test:local src/__tests__/scene-tree-store.test.ts.',
        'Step 5 refresh E2E gate passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/vector-stroke-refresh.spec.ts --workers=1.',
        'Step 5 recurring revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 5 recurring revalidation gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Recurring gate passed: yarn workspace @asyra/preset build:preset.',
        'Recurring gate passed: yarn lint:ci.',
        'Step 5 self-review: complete for data-channel delta; proceed to render-cache-patch next.'
      ]
    },
    'render-cache-patch': {
      implementationTrace: [
        'ComputedDataMirror applies per-key changes and recomposes complete render snapshots.',
        'Undoable refresh paths reseed from scene-tree before applying the new key, which prevents transient mirror drift from leaking into the next full computed render.',
        'ComputedDataMirror emits seed, staged-change, batch-apply, and commit counters for diagnostics.'
      ],
      e2eStatus: [
        'Direct render mirror gate passed: yarn workspace @asyra/render test:local src/__tests__/scene-tree-store.test.ts.',
        'Dirty graph gate passed: yarn workspace @asyra/preset test:local src/__tests__/stroke-dirty-keys.test.ts src/__tests__/stroke-performance-contract.test.ts.',
        'Step 6 revalidation passed on 2026-05-17: ComputedDataMirror stages per-key deltas, composes complete render snapshots, reseeds before undoable updates, and removes pending mirror data when elements are deleted.',
        'Step 6 direct gates passed on 2026-05-17: yarn workspace @asyra/render test:local src/__tests__/scene-tree-store.test.ts; yarn workspace @asyra/preset test:local src/__tests__/stroke-dirty-keys.test.ts src/__tests__/stroke-performance-contract.test.ts.',
        'Step 6 recurring revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 6 recurring revalidation gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Recurring gate passed: yarn workspace @asyra/preset build:preset.',
        'Recurring gate passed: yarn lint:ci.',
        'Step 6 self-review: complete for render cache patch and reseed drift protection; proceed to dirty-revision-graph next.'
      ]
    },
    'dirty-revision-graph': {
      implementationTrace: [
        'buildStrokeRuntimeRevisionSet records source path, stroke spec, topology classification, shared geometry, source family, stroke domain, interval allocation, candidate, arrangement, ownership, legality, resolved region, paint, render output, and preview-mode revisions.',
        'computeStrokeDirtyKeys classifies stage-level dirty work before render-entry reuse, including candidate-only, arrangement-only, region-only, paint-only, and output-only changes.',
        'Solid center render cache geometry signatures include upstream candidate / arrangement / resolved-region revisions so output reuse cannot mask upstream stage changes.',
        'Step 7 rework on 2026-05-17 added first-class sharedGeometryRevision, sourceFamilyRevision, and strokeDomainRevision keys so the dirty graph matches the inspector inputs instead of jumping directly from topology/stroke spec to intervals.'
      ],
      e2eStatus: [
        'Direct unit gate passed: yarn workspace @asyra/preset test:local src/__tests__/stroke-dirty-keys.test.ts src/__tests__/stroke-parameter-switch-performance.test.ts src/__tests__/stroke-performance-contract.test.ts.',
        'Relevant drag E2E gate passed: yarn workspace @asyra/asyra-design test:e2e -- stroke-drag-render-performance.spec.ts.',
        'Step 7 revalidation unit gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-dirty-keys.test.ts src/__tests__/stroke-parameter-switch-performance.test.ts src/__tests__/stroke-performance-contract.test.ts. Note: stroke-parameter-switch-performance.test.ts remains skipped by its own current test definition, so actual executed coverage comes from dirty-keys and performance-contract.',
        'Step 7 recurring build gate passed on 2026-05-17 before E2E: yarn workspace @asyra/preset build:preset.',
        'Step 7 focused drag E2E gate passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/stroke-drag-render-performance.spec.ts -g "measures real browser point and handle drag rendering with product visual probes" --workers=1.',
        'Step 7 recurring lint gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Recurring gate passed: yarn workspace @asyra/preset build:preset.',
        'Recurring gate passed: yarn lint:ci.',
        'Step 7 self-review: complete for dirty-stage revision classification and render-entry cache invalidation; proceed to render-strategy-entry next.'
      ]
    },
    'render-strategy-entry': {
      implementationTrace: [
        'vectorRenderStrategy passes the graphic and render data into renderVectorGraphic.',
        'Static self-check locks vectorRenderStrategy as a delegation-only wrapper with no topology, ownership, legality, paint, or geometry-id logic.',
        'renderVectorGraphic normalizes the incoming data before graphic clearing, topology model construction, or stroke stage work.'
      ],
      e2eStatus: [
        'Direct self-check gate passed: yarn workspace @asyra/preset test:local src/__tests__/vector-render-strategy-entry.test.ts src/__tests__/vector-component.test.ts src/__tests__/vector-solid-center-stroke.test.ts.',
        'Step 8 revalidation passed on 2026-05-17: vectorRenderStrategy remains delegation-only; no topology, ownership, legality, paint, or geometryId logic is present in the entry boundary.',
        'Step 8 direct gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/vector-render-strategy-entry.test.ts src/__tests__/vector-component.test.ts src/__tests__/vector-solid-center-stroke.test.ts.',
        'Indirect E2E coverage: every vector stroke visual E2E enters through this strategy.',
        'Step 8 recurring revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 8 recurring revalidation gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Step 8 self-review: complete for render strategy entry orchestration boundary; proceed to normalize-render-data next.'
      ]
    },
    'normalize-render-data': {
      implementationTrace: [
        'Map normalizers convert computed-data records into stable render inputs.',
        'Dangling segment/network references are filtered out rather than repaired into an alternate topology.',
        'Fallbacks are render-safe and do not revive legacy anchorPoints data.'
      ],
      e2eStatus: [
        'Direct unit gate passed: yarn workspace @asyra/preset test:local src/__tests__/vector-component.test.ts src/__tests__/vector-render-strategy-entry.test.ts src/__tests__/stroke-render-renderable-stroke.test.ts.',
        'Step 9 revalidation passed on 2026-05-17: normalizeVectorRenderData keeps dangling topology and legacy anchorPoints non-renderable, and remains a render adapter rather than runtime mutation validation.',
        'Step 9 direct gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/vector-component.test.ts src/__tests__/vector-render-strategy-entry.test.ts src/__tests__/stroke-render-renderable-stroke.test.ts.',
        'Boundary tests lock dangling topology and legacy anchorPoints as non-renderable normalization inputs rather than runtime repair paths.',
        'No dedicated E2E required because this step is internal render-snapshot normalization.',
        'Step 9 recurring revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 9 recurring revalidation gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Step 9 self-review: complete for stable render data normalization without substituting for runtime validation; proceed to normalize-stroke-spec next.'
      ]
    },
    'normalize-stroke-spec': {
      implementationTrace: [
        'normalizeStrokeSpec is the canonical exported boundary for authored stroke list normalization.',
        'getRenderableStrokes remains as a compatibility wrapper over normalizeStrokeSpec(...).strokes.',
        'The result carries normalized renderable stroke specs plus per-entry rejection diagnostics with index, reason, and strokeId when available.'
      ],
      e2eStatus: [
        'Direct unit gate passed: yarn workspace @asyra/preset test:local src/__tests__/stroke-render-renderable-stroke.test.ts.',
        'Step 10 revalidation passed on 2026-05-17: normalizeStrokeSpec remains the canonical stroke-spec boundary and contains no product geometry, side-resolution, region/face, legality, or renderer-repair decisions.',
        'Step 10 direct gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-render-renderable-stroke.test.ts.',
        'No dedicated visual/E2E required because this step is internal stroke-spec normalization and downstream render gates consume the compatibility wrapper.',
        'Step 10 recurring revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 10 recurring revalidation gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Step 10 self-review: complete for canonical NormalizeStrokeSpec boundary; proceed to build-path-topology next.'
      ]
    },
    'build-path-topology': {
      implementationTrace: [
        'vector.ts builds one PathTopologyModel per network revision using buildVectorGeometryModelPath/buildPathTopologyModel.',
        'The model carries sourceRevision, topologyFamily, fillRule, contours, totalLength, legalDomainDescriptors, legalDomains, and metadata counts.',
        'The model remains the single topology schema consumed by source spans, intervals, shared geometry, and later support classification.'
      ],
      e2eStatus: [
        'Direct unit gate passed: yarn workspace @asyra/preset test:local src/__tests__/path-topology-model.test.ts src/__tests__/source-span-graph.test.ts.',
        'Step 11 direct gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/path-topology-model.test.ts src/__tests__/source-span-graph.test.ts.',
        'Focused topology build-count gate passed for preserving every reported vector-6 source-topology segment. This is a source-topology preservation gate only, not a dash-domain rule.',
        'Step 11 focused build-count gate passed on 2026-05-17 for preserving every reported vector-6 source-topology segment. This preserves source topology/provenance only; downstream split ranges remain the self-intersecting dashed product domain.',
        'Focused topology performance gate passed: yarn workspace @asyra/preset test:local src/__tests__/stroke-performance-contract.test.ts -t "topology".',
        'Step 11 focused topology performance gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-performance-contract.test.ts -t "topology".',
        'Known downstream gap observed but not patched in Step 11: full vector-constrained-solid-stroke.test.ts currently exposes open-path inside/outside first-render center-equivalent projection failures, which belongs to later candidate/projection steps.',
        'Step 11 self-review note on 2026-05-17: allocateDashedIntervalsForTopology is still listed as the Step 15 interval helper and remains outside the PathTopologyModel output contract until that step is executed.',
        'Step 11 recurring revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 11 recurring revalidation gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Invalidated on 2026-05-20 for the filled-star inside blocker: prior Step 11 self-review did not prove Figma winding-rule basis for central filled-face classification. Step 11 is reopened as mismatch.',
        'Step 11 filled-face correction passed on 2026-05-20: normalizePathTopologyFillRule now defaults unspecified fillRule to nonzero, and the filled-star gate routes that fill-rule basis into shared face classification.'
      ]
    },
    'shared-geometry-model': {
      implementationTrace: [
        'buildResolvedVectorGeometryModel produces selfIntersecting fill/legal-region evidence and first-class region-boundary stroke domains.',
        'resolvedGeometryByNetworkId is the shared vector render map used by self-intersecting fill, diagnostics, stroke domain selection, legality, and future shadow; constrained dashed product geometry must come from selected region-boundary domains.',
        'Current implementation evidence includes selfIntersecting.strokeBoundaryDomains with side/face metadata, boundaryRole, inside/outside eligibility, and adjacent filled/unfilled face ids.',
        'Guard tests assert vector.ts calls buildResolvedVectorGeometryModel once and does not directly call self-intersection legal-domain builders outside the shared model.',
        'Invalidated guard: constrained dashed product construction must consume selected boundary-domain intervals, not only split-range/source-path topology plus legal-domain side/clipping policy inputs.',
        'Downstream self-intersecting inside/outside must consume shared boundary-domain eligibility instead of source-path orientation fallback, packet-local fill probes, or selectedSide-only metadata.'
      ],
      e2eStatus: [
        'Direct unit gate passed: yarn workspace @asyra/preset test:local src/__tests__/resolved-vector-geometry-model.test.ts; this includes the guard that legalBoundaryContours stay out of constrained dashed product construction.',
        'Step 12 direct gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/resolved-vector-geometry-model.test.ts src/__tests__/vector-preview-fill.test.ts src/__tests__/stroke-candidate-flow.test.ts.',
        'Self-intersection dashed and visual gates now prove constrained dashed product geometry through split-range interval output plus Figma-like no-fill implicit filled-face-side selection for the targeted star self-check.',
        'Step 12 recurring revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 12 recurring revalidation gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Step 12 shared-model revalidation passed on 2026-05-18: yarn workspace @asyra/preset test:local src/__tests__/stroke-domain-plan.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts.',
        'Step 12 visual revalidation passed on 2026-05-18: yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts --workers=1.',
        'Step 12 recurring revalidation passed on 2026-05-18: yarn workspace @asyra/preset build:preset and yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Step 12 TDD correction passed on 2026-05-20: resolved-vector-geometry-model.test.ts now samples shared fillRegions on both sides of each sourceSplitRange and asserts filledSide/unfilledSide match actual fill occupancy. buildResolvedVectorGeometryModel now resolves side from fill-region evidence first, then falls back to contour boundaryRole only when sampling cannot vote.',
        'Invalidated on 2026-05-20 for the filled-star inside blocker: the Step 12/14/17 cross-gate did not prove that the central Figma star face is filled and inside-eligible.',
        'Invalidated on 2026-05-20 for the filled-star inside blocker: prior Step 12 self-review accepted shared side-resolution without proving region/winding-rule filled-face boundary domains. Step 12 is reopened as mismatch.',
        'Step 12 filled-face boundary-domain gate passed on 2026-05-20: yarn workspace @asyra/preset test:local src/__tests__/resolved-vector-geometry-model.test.ts src/__tests__/stroke-domain-plan.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/stroke-final-face.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/vector-component.test.ts. Shared planar face edges are merged across ordinary degree-2 sample nodes and split at intersections/source boundaries, producing true filled-face boundary domains instead of holes or per-sample micro-domains.'
      ]
    },
    'resolve-source-families': {
      implementationTrace: [
        'resolveSourceFamily returns one auditable ResolvedSourceFamily object with topology family, support state, blocked reason, and legal-domain hints.',
        'Step 13 refactor on 2026-05-17 added figmaParity to ResolvedSourceFamily, separating current runtime supportState from complete Figma parity status.',
        'Step 13 refactor on 2026-05-17 added getFigmaStrokeFamilyMatrix plus public FigmaStrokeFamilyMatrixEntry / FigmaStrokeFamilyParity / FigmaStrokeFamilyScope / FigmaStrokeParityStatus exports.',
        'Current Step 13 matrix is support classification evidence, not product parity evidence. Downstream solidMaskModel and dashIntervalModel gates decide completion for their own product models.',
        'Step 13 revalidation on 2026-05-17 removed the stale self-intersecting constrained solid support-gap classification. The 2026-05-25 Figma comparison reopened self-intersecting constrained solid product parity, and the current solidMaskModel slice now provides Step 17/20/24/25 evidence for encoded self-check/vector-6 cases. Previous source-path solid evidence alone is still not sufficient full-family evidence.',
        'Step 13 revalidation on 2026-05-17 removed the stale compound constrained dashed implementation-gap classification; vector compound-hole constrained dashed unit coverage and constrained dashed visual gates cover the current normalized compound slice.',
        'Step 13 revalidation on 2026-05-17 removed the open constrained unverified-reference classification based on official Figma strokeAlign support for LineNode/VectorNode plus current solid/dashed open-path gates.',
        'Current downstream usage is intentionally incremental; later stages must replace distributed support checks with this result after Step 13 closes every parity gap.'
      ],
      e2eStatus: [
        'Step 13 partial gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/resolved-source-family.test.ts.',
        'Step 13 constrained solid revalidation passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/resolved-source-family.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/constrained-solid-runtime-diagnostics.test.ts.',
        'Step 13 constrained solid visual gate passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e e2e/solid-constrained-stroke-visual.spec.ts --workers=1.',
        'Step 13 constrained dashed / compound / open revalidation passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/resolved-source-family.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'Step 13 constrained dashed visual gate passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e e2e/constrained-dashed-stroke-visual.spec.ts --workers=1.',
        'Step 13 build gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'No dedicated visual/E2E required for the matrix/classification slice because it introduces typed classification, not visible geometry changes.',
        'Step 13 self-review: aligned for ResolveSourceFamilies. Completion now moves to Step 14, which must prove domain plans for every classified family instead of relying on the source-family matrix alone.'
      ]
    },
    'resolve-stroke-domains': {
      implementationTrace: [
        'New explicit flow boundary for Figma-like recalibration: source-family support, topology, normalized stroke spec, and shared implicit region/face evidence must resolve into a stroke domain plan before intervals.',
        'For self-intersecting constrained dashed strokes, this boundary owns FigmaLikeSplitRange[] and side-authority metadata; it must not allocate intervals or emit candidate polygons.',
        'Implemented: resolveStrokeDomains now returns the explicit StrokeDomainPlan before interval allocation.',
        'Implemented: buildFigmaLikeSplitRangeDashDomains moved out of constrained dashed packet helpers and is now owned by the Step 14 domain boundary.',
        'Implemented: constrained dashed packet interval selection consumes StrokeDomainPlan.splitRangeDomains instead of rebuilding hidden self-intersecting split ranges inside packet helpers.',
        'Updated on 2026-05-18: each FigmaLikeSplitRangeDashDomain is built from shared ResolvedVectorSourceSplitRange records. The domain plan carries sourceSegmentIndex plus shared implicit region/face side-resolution metadata; unresolved shared side selection blocks the domain plan instead of falling back to source-path orientation.',
        'Implemented: public preset index exports resolveStrokeDomains, buildFigmaLikeSplitRangeDashDomains, StrokeDomainPlan, StrokeIntervalDomainKind, and StrokeSideAuthority.',
        'Implemented on 2026-05-17: Step 14 now covers every getFigmaStrokeFamilyMatrix entry with an explicit domain plan classification.',
        'Implemented on 2026-05-17: compound constrained domains expose legal-boundary-span plans with StrokeLegalBoundaryDomain records and filled-face-side inside/outside inversion instead of hidden vector-local behavior.',
        'Implemented on 2026-05-17: self-intersecting constrained solid and dashed domains both require implicit region/face side authority; dashed uses figma-like-split-range interval domains and solid keeps source-path interval domains with split-range side evidence.'
      ],
      e2eStatus: [
        'Focused Step 14 unit gate passed: yarn workspace @asyra/preset test:local src/__tests__/stroke-domain-plan.test.ts.',
        'Step 14 focused unit gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-domain-plan.test.ts.',
        'Step 14/15 regression gate passed: yarn workspace @asyra/preset test:local src/__tests__/stroke-domain-plan.test.ts src/__tests__/dashed-center-stroke-intervals.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts.',
        'Step 14 side-resolution regression gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-domain-plan.test.ts src/__tests__/dashed-center-stroke-intervals.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/stroke-side-resolution.test.ts.',
        'Step 14 recurring revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 14 recurring revalidation gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'No dedicated visual/E2E required for Step 14 because this step exposes domain metadata and does not change renderer projection directly.',
        'Step 14 matrix gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-domain-plan.test.ts proves every Step 13 family matrix entry has an explicit domain plan.',
        'Step 14 targeted integration gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/resolved-source-family.test.ts src/__tests__/stroke-domain-plan.test.ts src/__tests__/legal-domain-normalization.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts.',
        'Step 14 recurring build gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 14 recurring lint gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Step 14 shared-model gate passed on 2026-05-18: yarn workspace @asyra/preset test:local src/__tests__/stroke-domain-plan.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts.',
        'Step 14 visual revalidation passed on 2026-05-18: yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts --workers=1.',
        'Step 14 self-review update: aligned. Domain split ranges, legal-boundary spans, side authority, filled-face-side inversion, and blocked missing-domain states are explicit and now consume shared sourceSplitRanges before Step 15 interval allocation.',
        'Step 14 self-review: aligned. Domain split ranges, legal-boundary spans, side authority, filled-face-side inversion, and blocked missing-domain states are explicit and tested before Step 15 interval allocation.',
        'Step 14 filled-face domain gate passed on 2026-05-20: stroke-domain-plan.test.ts and constrained-dashed-stroke-packets.test.ts prove inside includes central filled-face boundary domains and outside excludes filled-filled internal adjacency domains.'
      ]
    },
    'allocate-intervals': {
      implementationTrace: [
        'allocateDashedIntervalsForTopology uses PathTopologyModel totalLength and closed state.',
        'allocateStrokeIntervals adds the canonical boundary for solid full coverage, center/simple dashed whole-source-path interval allocation, and self-intersecting constrained dashed split-range allocation.',
        'Implemented: allocateFigmaLikeSplitRangeDashedIntervals allocates every self-intersecting constrained dashed split source range independently.',
        'Implemented on 2026-05-17: split-range interval records preserve sourceSegmentIndex and implicit region/face side-resolution metadata from Step 14 domains.',
        'Implemented: getConstrainedDashedVisibleIntervals routes self-intersecting closed sourcePath input through split-range allocation; cumulative topology length allocation remains only for center/simple families.',
        'Implemented on 2026-05-17: allocateStrokeIntervalsForDomainPlan is the public Step 15 boundary for dashed StrokeDomainPlan interval allocation. It routes figma-like-split-range through dashed terminal half-dash allocation, legal-boundary-span through independent shell/hole boundary allocations, and source/topology domains through canonical arc-length allocation.',
        'Implemented on 2026-05-17: constrained dashed packets now consume allocateStrokeIntervalsForDomainPlan for split-range allocation instead of calling the split-range allocator directly.',
        'Corrected on 2026-05-18: allocateFigmaLikeSplitRangeDashedIntervals now solves the chosen dash count and single average gap before emitting interval records, then derives every start/end from the precomputed formula instead of advancing a cursor and calculating the next gap during range traversal.'
      ],
      e2eStatus: [
        'Direct interval gate passed: yarn workspace @asyra/preset test:local src/__tests__/dashed-center-stroke-intervals.test.ts.',
        'Step 15 direct interval gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/dashed-center-stroke-intervals.test.ts.',
        'Split-range packet interval gate passed: yarn workspace @asyra/preset test:local src/__tests__/dashed-center-stroke-intervals.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts.',
        'Terminal half-dash and side-provenance gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/dashed-center-stroke-intervals.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/stroke-final-face.test.ts.',
        'Step 15 recurring revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 15 recurring revalidation gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Step 15 domain-plan allocator gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/dashed-center-stroke-intervals.test.ts src/__tests__/stroke-domain-plan.test.ts.',
        'Step 15 targeted integration gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/dashed-center-stroke-intervals.test.ts src/__tests__/stroke-domain-plan.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/stroke-final-face.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'Step 15 reference-gap allocator gate passed on 2026-05-18: dashed-center-stroke-intervals.test.ts proves normal-length split ranges establish the redistributed reference gap and short split ranges reduce middle dash count instead of compressing gaps into overcrowded output.',
        'Step 15 formula-first allocator gate passed on 2026-05-18: dashed-center-stroke-intervals.test.ts proves split-range dash starts and gaps are derived from one precomputed average gap rather than incremental per-dash gap calculation.',
        'Step 15 recurring build gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 15 recurring lint gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'No dedicated visual/E2E required for Step 15 because this step exposes interval records and does not directly alter renderer projection.',
        'Step 15 revalidation passed on 2026-05-20 as part of the filled-face gate: selected boundary-domain intervals remain half-dash terminal, balanced-gap, and independent per split boundary after degree-2 sampled edge merging.',
        'Step 15 self-review updated after the Figma mask-model correction: dashed interval allocation consumes explicit Step 14 domain plans, preserves split-range terminal half-dash metadata, and does not create region/face boundary dash schedules.'
      ]
    },
    'build-source-span-graph': {
      implementationTrace: [
        'SourceSpanGraph records provenance across authored vertices, dash intervals, and flattened intersections.',
        'resolveSourceSpanProvenanceAvailability makes normal, visualOnly, and omitDiagnosticMetadata provenance availability explicit before packet construction.',
        'Constrained dashed packet construction builds sourceSpanIds only when provenance is available; visual-only and metadata-omitted packets keep geometry without diagnostic source spans.',
        'Implemented direct Step 16 evidence: source-span tests now consume Step 14 StrokeDomainPlan split ranges, Step 15 intervals, and assert source-span cuts cover every split-range boundary without using legal-domain or hole contour ids as provenance.',
        'Implemented on 2026-05-17: getSourceSpanIdsForDomainInterval resolves normal intervals through SourceSpanGraph and legal-boundary-span intervals through typed Step 14 shell/hole sourceSpanIds.',
        'Implemented on 2026-05-17 and corrected after the Figma mask-model review: Step 16 preserves typed legal-domain provenance without turning shell/hole boundaries into dash product domains.'
      ],
      e2eStatus: [
        'Direct source-span gate passed: yarn workspace @asyra/preset test:local src/__tests__/source-span-graph.test.ts.',
        'Step 16 packet/vector metadata gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/source-span-graph.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'Step 16 terminology corrected on 2026-05-20: prior source-path split-range wording is insufficient. Provenance names must move to filled-face boundary-domain split segment wording for inside stroke parity.',
        'No dedicated visual/E2E required because this step changes diagnostic provenance metadata and availability conditions only.',
        'Step 16 recurring revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 16 recurring revalidation gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Step 16 legal-boundary provenance gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/source-span-graph.test.ts src/__tests__/dashed-center-stroke-intervals.test.ts.',
        'Step 16 targeted integration gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/source-span-graph.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/stroke-final-face.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts.',
        'Step 16 recurring build gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 16 recurring lint gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Step 16 self-review updated after the Figma mask-model correction: split-range intervals receive graph sourceSpanIds, typed domain sourceSpanIds remain explicit, visual-only/metadata-omitted paths remain explicit, and provenance is ready for candidate construction without region/face boundary dash products.'
      ]
    },
    'build-one-sided-candidates': {
      implementationTrace: [
        'resolveOneSidedCandidateFlow centralizes Step 17 branch guards for center, open center-equivalent, closed one-sided constrained, and self-intersecting split-range constrained dashed modes.',
        'Constrained solid open authored inside/outside strokes resolve to center-equivalent geometry before constrained candidate construction.',
        'Constrained dashed closed full-loop inside/outside strokes emit one-sided candidate packets instead of product-visual or doubled center-band geometry.',
        'Invalidated on 2026-05-20: constrained dashed self-intersecting inside/outside strokes must not consume authored-source split ranges as the complete product dash domain. Step 17 must consume Step 15 intervals from selected region-boundary split segments.',
        'Implemented DoD: each range has half-dash endpoints and independent middle dash placement. Normal-length split ranges establish the reference redistributed gap, and shorter ranges reduce middle dash count when needed to avoid overcrowding, with no minimum gap clamp.',
        'Corrected on 2026-05-18: removed the old internal split-boundary gap-trimming helper. Dashed split-range terminal half-dashes keep their authored terminal geometry and round-cap semantics; dashed candidate construction must not insert artificial breaks or trim render ranges to make half-dashes visible.',
        'Corrected on 2026-05-18: self-intersecting inside dashed round candidate geometry now builds body+cap as one candidate before legality clipping. Splitting body and cap into separately clipped polygons is invalid because it can create visible breaks inside a single dash.',
        'Corrected on 2026-05-18: self-intersecting inside dashed product-final range polygons are clipped to the implicit even-odd legal fill domain for butt, square, and round caps. Cap type cannot bypass legal-domain clipping or create outside-fill overdraw.',
        'Resolved on 2026-05-20: candidate construction consumes selected boundary-domain interval records; interval.figmaLikeSelectedSide from sourceSplitRanges/legalSide alone is no longer the completion proof.',
        'Invalidated prior no-fill orientation fallback: resolveSourcePathOrientationStrokeSide is not used for closed self-intersecting star side selection.',
        'Vector render orchestration must route self-intersecting constrained dashed output through boundary-domain candidate contracts before PartitionArrangementAndFaces, with domain eligibility, side, and overlap ownership evidence attached to each range.',
        'Implemented: source-boundary clipping is not used as an old high-curvature/cross-segment repair for self-intersecting split-range candidates; legality remains the clipping/filtering authority.',
        'Resolved direct Step 17 guard: product-final candidate geometry consumes StrokeDomainPlan boundary-domain metadata; packet-local topology/orientation/fill-probe side guessing remains forbidden.',
        'Corrected on 2026-05-18: StrokeDomainPlan no longer splits Step 15 dash domains at implicit region/face side changes. Step 15 allocates on intersection split ranges; Step 17 resolves side per visible interval/candidate range so side changes do not distort dash distribution.',
        'Corrected on 2026-05-19: cubic source-path sampling now resolves a degenerate start tangent from the first non-degenerate tangent instead of defaulting to horizontal. This fixes the outside dashed top-left/fourth-segment first dash shape for butt, square, and round caps without renderer-side repair.',
        'Corrected on 2026-05-19: outside product-final source-vertex candidates now add selected-side source-vertex join geometry for terminal starts at closed source segment boundaries. The join consumes the resolved interval side instead of old path-orientation logic, so the fourth segment first dash shares the same Figma-like outside miter corner across butt, square, and round caps.',
        'Resolved on 2026-05-20: filled-face internal boundaries are product-eligible inside domains and product-ineligible outside domains before candidates are built.',
        'Implemented on 2026-05-17: constrained dashed packet tests now use the same implicit region/face side authority for rule-driven coverage probes and include failure signals for selected side, covered side, splitRangeId, terminalRole, and packet geometry presence.',
        'Implemented on 2026-05-17: resolveOneSidedCandidateFlow now exposes candidate domainKind so Step 17 can distinguish native center, center-equivalent, source-path, split-range, and legal-boundary-span candidate domains before packet helpers run.'
      ],
      e2eStatus: [
        'Step 17 boundary-domain gate passed on 2026-05-20: constrained-dashed-stroke-packets.test.ts proves candidate construction consumes selected region-boundary interval domains.',
        'Prior sourceSplitRange/selectedSide-only packet and visual assertions remain invalid completion proof; the new gate must require central filled-face inside product candidates and outside filled-filled internal adjacency product absence.',
        'Correct Step 17 gate must fail whenever outside emits filled-filled internal adjacency candidates and must require central filled-face inside candidates with boundaryDomainId, region id, face id, interval, terminal, and adjacent-face provenance.',
        'Step 17 filled-face candidate gate passed on 2026-05-20: the combined preset gate and stroke-self-check-star-render.spec.ts prove candidates consume merged boundary-domain intervals, central filled-face inside candidates exist, outside internal-adjacency candidates are absent, and sampled micro-edges are not product dash domains.'
      ]
    },
    'partition-arrangement-faces': {
      implementationTrace: [
        'GeometryBackend/Clipper2 arrangement promotes supported constrained solid packets and supported constrained dashed non-gradient packets into exact partitioned faces.',
        'promoteConstrainedDashedPacketsToExactArrangement now filters promotable exact/accepted packets from local packets and preserves local packets in the packet stream.',
        'Self-intersecting constrained dashed product-final packets enter visual-overlap collapse only when collapse preserves terminal identity. Outside self-intersecting constrained dashed product overlap is scoped to visible dash coverage units; exact arrangement may partition same-interval fragments, while independent interval faces must not be promoted into cross-interval arranged faces and boundary-terminal-join geometry must never be a promotable product unit.',
        'Corrected visual oracle: constrained-dashed visual E2E now probes rendered coverage from upstream export packet polygons for the reported star event-probe case, instead of using old cumulative dash-distance guesses.',
        'Implemented on 2026-05-17: removed the stale self-intersecting contour-dashed grouping path that used sourceContourIds as a dashed correctness key. Arrangement now groups self-intersecting constrained dashed product-final faces by upstream visualPacketKey and preserves terminal/source metadata through collectMergedFaceMetadata.',
        'Implemented on 2026-05-17: exact arrangement merge now writes collected figmaLikeSplitRangeTerminals back to debugMeta so terminal identity survives promoted exact faces.',
        'Corrected on 2026-05-19: collapseStrokeFinalFaceVisualOverlaps now allows Figma-like split-range terminal face groups to exact-union collapse when terminal metadata/sourceSegmentIndex provenance is preserved and every input polygon is normalized as positive coverage before nonzero union. This removes double-opacity overlap without reintroducing dash breaks or cumulative cross-boundary dash behavior.',
        'Invalidated on 2026-05-24: the prior coverage-unit correction still treated explicit boundary-terminal-join faces as auxiliary units in the product packet stream. Active-plan semantics now forbid visible boundary-terminal-join product geometry entirely; Step 17 must delete that old branch before Step 18 overlap arrangement can be considered aligned.'
      ],
      e2eStatus: [
        'Targeted unit/integration gate passed: yarn workspace @asyra/preset test:local src/__tests__/stroke-candidate-arrangement.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/geometry-backend.test.ts src/__tests__/clipper2-geometry-backend.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts.',
        'Step 18 targeted gate passed on 2026-05-17 after removing sourceContourIds grouping: yarn workspace @asyra/preset test:local src/__tests__/stroke-candidate-arrangement.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/stroke-final-face.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'Visual gate passed: yarn workspace @asyra/asyra-design test:e2e -- e2e/constrained-dashed-stroke-visual.spec.ts e2e/solid-constrained-stroke-visual.spec.ts.',
        'Terminal overlap/collapse gate passed on 2026-05-17: constrained dashed packet tests plus stroke-rule-driven visual E2E prove terminal ids and adjacent gaps survive product overlap collapse.',
        'Step 18 focused visual gate passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/stroke-rule-driven-dashed-visual.spec.ts --workers=1.',
        'Recurring gate passed: yarn workspace @asyra/preset build:preset.',
        'Recurring gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Recurring gate passed: yarn lint:ci. Existing console warnings remain, with 0 lint errors.',
        'Recurring gate passed on 2026-05-17: yarn lint:ci. Existing console warnings remain, with 0 lint errors.',
        'Step 18 exact terminal metadata gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-candidate-arrangement.test.ts.',
        'Step 18 targeted integration gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-candidate-arrangement.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/geometry-backend.test.ts src/__tests__/clipper2-geometry-backend.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/stroke-final-face.test.ts.',
        'Step 18 focused visual gate passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/stroke-rule-driven-dashed-visual.spec.ts --workers=1.',
        'Step 18 broader visual gate passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/constrained-dashed-stroke-visual.spec.ts e2e/solid-constrained-stroke-visual.spec.ts --workers=1.',
        'Step 18 recurring build gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 18 recurring lint gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Step 18 terminal-domain regression gate updated on 2026-05-18: constrained-dashed packet tests assert adjacent split-boundary terminal intervals remain separate product domains through packets, FinalFace, and export packets. Visible coverage at the shared split boundary is allowed; correctness is provenance/domain independence, not a forced visible gap.',
        'Step 18 overlap regression gate passed on 2026-05-19: yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/stroke-candidate-arrangement.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts. The gate covers terminal provenance through exact visual-overlap collapse.',
        'Step 18 self-review: aligned for PartitionArrangementAndFaces. sourceContourIds is not a dashed grouping/correctness path, exact visual-overlap collapse removes same-stroke overdraw only after terminal/source metadata remains projectable, and no boundary-contour product loop is restored. Proceed to resolve-ownership next.',
        'Step 18 overlap regrouping gate passed on 2026-05-24: yarn vitest run src/__tests__/stroke-candidate-arrangement.test.ts passed 26/26 after replacing whole-visual-packet constrained dashed grouping with active-plan coverage-unit grouping.',
        'Invalidated on 2026-05-24: the outside coverage-unit gate that tolerated terminal-join auxiliary faces in the product stream is no longer valid completion proof. Replacement gates must assert no visible boundary-terminal-join product packets, no sourceBoundaryJoinCount product provenance, and no bridge between independent boundary split terminals.'
      ]
    },
    'resolve-ownership': {
      implementationTrace: [
        'Owner metadata travels through packet debug metadata, resolveStrokeOwnership, arrangement claimedBy groups, ownerSet, and FinalFace records.',
        'stroke-final-face and stroke-candidate-arrangement now share typed ownership merge helpers instead of local owner recovery logic.',
        'No helper parses geometryId or relies on packet order for ownership.',
        'Revalidated on 2026-05-17 after Step 18 grouping cleanup: ownership still flows from explicit ownerSet or typed owner fields only. sourceContourIds remains legal/diagnostic provenance and is not used to recover ownership.'
      ],
      e2eStatus: [
        'Targeted unit/diagnostic gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-ownership.test.ts src/__tests__/solid-center-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/stroke-candidate-arrangement.test.ts src/__tests__/constrained-solid-ownership-diagnostics.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts.',
        'Step 19 targeted gate passed again on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-ownership.test.ts src/__tests__/solid-center-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/stroke-candidate-arrangement.test.ts src/__tests__/constrained-solid-ownership-diagnostics.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts.',
        'Direct E2E coverage: not required for this metadata-only step; visual geometry was unchanged.',
        'Recurring gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Recurring gate rerun and passed on 2026-05-17: yarn lint:ci. Existing console warnings remain, with 0 lint errors.',
        'Step 19 revalidation gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-ownership.test.ts src/__tests__/stroke-final-face.test.ts src/__tests__/stroke-candidate-arrangement.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts.',
        'Step 19 recurring build gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Step 19 recurring lint gate passed on 2026-05-17: yarn lint:ci produced 0 errors with existing no-console warnings.',
        'Step 19 self-review: aligned for ResolveOwnership; typed ownerSet propagation remains centralized, no reviewed helper parses geometryId/packet order/sourceContourIds for ownership, and Step 18 grouping changes did not alter ownership contracts. Proceed to apply-legality next.'
      ]
    },
    'apply-legality': {
      implementationTrace: [
        'Legal-domain clipping/filtering is implemented per supported family.',
        'buildConstrainedSolidLegalityClippingResult clips existing packet polygons and preserves packet identity, debug metadata, owner metadata, and paint payload.',
        'Corrected DoD: self-intersecting inside dashed legality receives split-range one-sided candidate geometry only.',
        'Corrected DoD: legality may filter/clip split-range one-sided candidate geometry only; it must not use fill masks to prove Figma parity or construct replacement geometry.',
        'Implemented DoD: self-intersecting inside dashed split-range candidates are filtered/clipped against the implicit region/face legal domain for constrained inside/outside semantics, regardless of visible fill paint. Legality must clip the assembled candidate geometry, not separately clip body/cap fragments in a way that breaks one dash.',
        'Revalidated on 2026-05-17 after interval-level side-resolution and arrangement grouping cleanup: legality still clips Step 17 source-path terminal candidate geometry only and does not construct replacement center bands, source-contour loops, or boundary-contour dashed products.',
        'Strengthened on 2026-05-17: stroke-legality.test.ts now asserts clipping preserves typed ownerSet, sourceSpanIds, legalDomainIds, split-range terminal metadata, side-resolution metadata, packet identity, and paint payload.',
        'Corrected on 2026-05-19: self-intersecting inside/outside dashed candidates with implicit region/face side authority are clipped to the implicit legal fill domain even when the family is self-intersecting. This prevents terminal/cap geometry from leaking outside legal stroke regions without creating replacement boundary-stroke geometry.',
        'Corrected on 2026-05-19: outside exact clipping no longer restores an empty clip result to the original subject polygon. When an outside candidate falls entirely on the filled side, the empty mask result is preserved so internal-adjacent outside geometry can disappear instead of leaking through the fallback.',
        'Corrected on 2026-05-20: self-intersecting outside dashed legality now uses the Figma mask model on the assembled double-width dash and normalizes the clipped result before product output. Same-interval high-curvature clip residue is pruned/stitched upstream only on the outside fragment-normalization path, and the cleaned result is re-clipped through the same legal mask so cleanup cannot push product geometry across the legal domain.'
      ],
      e2eStatus: [
        'Targeted unit gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-legality.test.ts src/__tests__/legal-domain-normalization.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'Step 20 targeted unit gate passed again on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-legality.test.ts src/__tests__/legal-domain-normalization.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'Step 20 strengthened gate passed on 2026-05-17 after metadata preservation oracle was added: yarn workspace @asyra/preset test:local src/__tests__/stroke-legality.test.ts src/__tests__/legal-domain-normalization.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'Split-range legality oracle gate passed: constrained dashed tests assert self-intersecting product packets use interval:* provenance and preserve legal-domain side selection.',
        'Implicit no-fill legality gate passed: yarn workspace @asyra/preset test:local src/__tests__/stroke-legality.test.ts src/__tests__/legal-domain-normalization.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'Terminal legality gate passed on 2026-05-17: no-fill self-intersecting inside dashed tests prove implicit region/face legal-domain clipping and focused E2E proves split-boundary terminal coverage remains visible.',
        'Step 20 visual gate passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/stroke-rule-driven-dashed-visual.spec.ts e2e/stroke-self-check-star-render.spec.ts --workers=1.',
        'Fill-mask-only and source-orientation-only E2E oracles remain invalidated for Step 30, but Step 20 unit/integration coverage now proves implicit legal-domain clipping without replacement geometry.',
        'Step 20 overlap/leak regression gate passed on 2026-05-19: yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts --workers=1. Butt and square filled-star artifacts report outsideRedPixelCount=0, maxOutsideComponentArea=0, darkOverdrawPixelCount=0, and maxDarkOverdrawComponentArea=0; round reports outsideRedPixelCount=0 and maxDarkOverdrawComponentArea=1.',
        'Recurring gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Recurring gate rerun and passed on 2026-05-17: yarn lint:ci. Existing console warnings remain, with 0 lint errors.',
        'Step 20 outside legality gate passed on 2026-05-19: yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts and yarn workspace @asyra/asyra-design test:e2e e2e/stroke-rule-driven-dashed-visual.spec.ts --grep "focused split segment" --workers=1. clipSourcePathPolygonsToEvenOddLegalDomain now normalizes implicit legal regions, preserves per-candidate subject identity, and keeps upstream selected-side candidate geometry when exact clipping degenerates instead of deleting the product range.',
        'Invalidated on 2026-05-20 for the filled-star inside blocker: preserving or removing internal-adjacency ranges by selectedSide alone is not enough. Step 20 must consume corrected filled-face domains from Step 12/14/17.',
        'TDD red evidence resolved on 2026-05-20: stroke-self-check-star-render.spec.ts now passes because outside dashed metadata no longer includes figmaLikeBoundaryRole="hole" product packets.',
        'Step 20 filled-face legality gate passed on 2026-05-20: central filled-face inside geometry is preserved, outside filled-filled internal adjacency remains product-ineligible, and legality filters/clips candidate geometry without replacement boundary-loop geometry.',
        'Step 20 outside high-curvature sliver gate passed on 2026-05-20: yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/vector-component.test.ts and yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts --workers=1. The gate asserts clipped outside product polygons and final boundary-domain metadata have no high-complexity near-zero-edge residue; polygonCount=1 is treated as insufficient proof by itself.'
      ]
    },
    'build-resolved-stroke-regions': {
      implementationTrace: [
        'StrokeRegionPacket is exported as the paint-free semantic geometry contract.',
        'buildStrokeRegionPacketsFromResolvedPackets and buildStrokeRegionPacketsFromFinalFaces bridge current packets/faces into geometry-only region packets.',
        'Region packets carry geometryFamily, resolution/runtime/support metadata, ownerSet, interval/source-span/contour/legal-domain metadata, arrangement metadata, and non-paint revision keys only.',
        'Implemented on 2026-05-17: StrokeRegionPacket now carries figmaLikeSplitRangeId/start/end/terminalRole/sourceSegmentIndex, figmaLikeSideAuthority/selectedSide/resolutionStatus/reason, and figmaLikeSplitRangeTerminals. Paint-free region contracts can now prove dashed terminal half-dash and implicit side provenance without reading paint payloads.'
      ],
      e2eStatus: [
        'Targeted packet parity gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-region-packet.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/stroke-candidate-arrangement.test.ts src/__tests__/solid-center-stroke-packets.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'Step 21 targeted packet parity gate passed again on 2026-05-17 after terminal/side region metadata was added: yarn workspace @asyra/preset test:local src/__tests__/stroke-region-packet.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/stroke-candidate-arrangement.test.ts src/__tests__/solid-center-stroke-packets.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'Focused post-format gate passed: yarn workspace @asyra/preset test:local src/__tests__/stroke-region-packet.test.ts.',
        'Focused region metadata gate passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-region-packet.test.ts.',
        'Step 21 acceptance gate passed on 2026-05-17 after explicit DoD was added to the inspector: yarn workspace @asyra/preset test:local src/__tests__/stroke-region-packet.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/stroke-candidate-arrangement.test.ts src/__tests__/solid-center-stroke-packets.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'Direct visual E2E not required for this paint-free metadata contract; Step 22 owns paint attachment visuals.',
        'Recurring gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Recurring gate rerun and passed on 2026-05-17: yarn lint:ci. Existing console warnings remain, with 0 lint errors.',
        'Step 21 self-review: complete for BuildResolvedStrokeRegions; paint-free region packets preserve geometry/support/provenance/revision metadata plus terminal/implicit-side metadata and proceed to paint attachment next.'
      ]
    },
    'attach-paint-payload': {
      implementationTrace: [
        'Dedicated attachStrokePaintPayload boundary now converts paint-free StrokeRegionPacket[] into PaintAttachedStrokeRegion[].',
        'PaintAttachedStrokeRegion attaches color, alpha, gradientStyle, paintKey, paintBounds, and optional paintTransform after semantic geometry is resolved.',
        'Paint attachment uses declared paintBounds when provided, otherwise a copy of the region bounds; it never mutates region polygons, bounds, owner, interval, source-span, legal-domain, arrangement, or revision metadata.',
        'Paint-only dirty-key tests prove paint changes rerun paint-payload/render-hit-export only, not topology/candidate/arrangement/ownership/legality/region stages.'
      ],
      e2eStatus: [
        'Direct unit/integration gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-paint-payload.test.ts src/__tests__/stroke-region-packet.test.ts src/__tests__/stroke-dirty-keys.test.ts src/__tests__/stroke-render-renderable-stroke.test.ts src/__tests__/solid-center-stroke-render.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts.',
        'Step 22 acceptance gate passed on 2026-05-17 after explicit DoD was added to the inspector: yarn workspace @asyra/preset test:local src/__tests__/stroke-paint-payload.test.ts src/__tests__/stroke-region-packet.test.ts src/__tests__/stroke-dirty-keys.test.ts src/__tests__/stroke-render-renderable-stroke.test.ts src/__tests__/solid-center-stroke-render.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts.',
        'Visual paint regression gate rerun and passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/constrained-dashed-stroke-visual.spec.ts e2e/solid-constrained-stroke-visual.spec.ts.',
        'Step 22 visual paint regression gate passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/constrained-dashed-stroke-visual.spec.ts e2e/solid-constrained-stroke-visual.spec.ts --workers=1.',
        'Recurring gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Recurring gate rerun and passed on 2026-05-17: yarn lint:ci. Existing console warnings remain, with 0 lint errors.',
        'Step 22 self-review: complete for AttachPaintPayload; paint attachment preserves region geometry/provenance and paint-only changes remain isolated. Proceed to fill-region-consumer next.'
      ]
    },
    'fill-region-consumer': {
      implementationTrace: [
        'Fill consumes shared fillRegions for self-intersecting geometry when present.',
        'Legacy fill fallback remains only for unsupported/no-shared-model cases.',
        'vector-preview-fill.test.ts directly asserts rendered self-intersecting fill cache faces equal the shared resolved geometry model fillRegions.'
      ],
      e2eStatus: [
        'Direct unit gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/vector-preview-fill.test.ts src/__tests__/resolved-vector-geometry-model.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'Step 23 acceptance gate passed on 2026-05-17 after explicit DoD was added to the inspector: yarn workspace @asyra/preset test:local src/__tests__/vector-preview-fill.test.ts src/__tests__/resolved-vector-geometry-model.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'Visual shared-geometry evidence rerun and passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/stroke-self-check-star-render.spec.ts.',
        'Step 23 visual shared-geometry/no-fill evidence gate passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/stroke-self-check-star-render.spec.ts --workers=1.',
        'Recurring gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Recurring gate rerun and passed on 2026-05-17: yarn lint:ci. Existing console warnings remain, with 0 lint errors.',
        'Step 23 self-review: complete for FillRegionConsumer; fill consumes shared self-intersecting geometry evidence and does not compete with stroke side/legal authorities. Proceed to build-final-faces next.'
      ]
    },
    'build-final-faces': {
      implementationTrace: [
        'stroke-final-face converts raw/arranged packets into FinalFace[] records.',
        'buildStrokeFinalFacesFromPaintAttachedRegions converts PaintAttachedStrokeRegion[] into FinalFace[] records without returning to authored input or pre-region packet paint fields.',
        'FinalFace[] preserves ownerSet, intervalIds, sourceSpanIds, sourceContourIds, legalDomainIds, runtime status/reason, arrangement metadata, revision metadata, paintKey, and paint payload.',
        'FinalFace[] is the canonical product source for render, hit-test, and export projection.'
      ],
      e2eStatus: [
        'Direct unit/packet bridge gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/stroke-final-face.test.ts src/__tests__/stroke-region-packet.test.ts src/__tests__/stroke-paint-payload.test.ts src/__tests__/solid-center-stroke-packets.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts.',
        'Step 24 strengthened gate passed on 2026-05-17 after FinalFace collapse was fixed to merge debugMeta figmaLikeSplitRangeTerminals: yarn workspace @asyra/preset test:local src/__tests__/stroke-final-face.test.ts src/__tests__/stroke-region-packet.test.ts src/__tests__/stroke-paint-payload.test.ts src/__tests__/solid-center-stroke-packets.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts.',
        'Terminal FinalFace gate passed on 2026-05-17: constrained dashed packet tests prove figmaLikeSplitRangeTerminals survive packet, FinalFace, and render-entry conversion.',
        'Recurring gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Recurring gate rerun and passed on 2026-05-17: yarn lint:ci. Existing console warnings remain, with 0 lint errors.',
        'Invalidated on 2026-05-20 for the filled-star inside blocker: prior Step 24 self-review did not prove central filled-face boundary provenance reaches FinalFace[].',
        'Step 24 outside provenance gate passed on 2026-05-19: yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts. FinalFace-derived packet assertions preserve splitRangeId, intervalId, selectedSide, and legal-domain evidence for outside dashed coverage.',
        'Invalidated on 2026-05-20 for the filled-star inside blocker: FinalFace/StrokeRegionPacket metadata preserving figmaLikeFilledSide/UnfilledSide/BoundaryRole is insufficient unless it proves central filled-face boundary provenance from region/winding-rule classification.',
        'Step 24 filled-face FinalFace gate passed on 2026-05-20: constrained dashed packet/FinalFace tests preserve boundaryDomainId, region id, face id, interval id, terminal role, boundaryRole=filled-face, selected side, and owner/legal provenance through FinalFace construction.'
      ]
    },
    'emit-render-hit-export-packets': {
      implementationTrace: [
        'Render entries, hit area, and export packets are projected from strokeFinalFaces.',
        'Corrected DoD: self-intersecting constrained dashed product projections must preserve source-path interval/source-span provenance through render, hit, and export packets; auxiliary contour metadata is not Figma-parity proof.',
        'Added risk: projection metadata must preserve enough side-resolution provenance to verify implicit region/face legal-domain side selection.',
        'Drag visual mode may skip/defer hit/export freshness while preserving visual responsiveness.',
        'solid-center-stroke-packets.test.ts directly asserts toSolidCenterStrokeRenderEntriesFromFinalFaces, buildSolidCenterStrokeHitTestPacketsFromFinalFaces, buildSolidCenterStrokeExportPacketsFromFinalFaces, and applySolidCenterStrokeExportPacketsFromFinalFaces consume the same FinalFace[] geometry and metadata references.'
      ],
      e2eStatus: [
        'Direct unit/packet parity gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/solid-center-stroke-packets.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/stroke-final-face.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/vector-component.test.ts.',
        'Step 25 strengthened projection gate passed on 2026-05-17 after solid-center-stroke-packets.test.ts added explicit render/hit/export projection assertions for figmaLikeSplitRangeTerminals: yarn workspace @asyra/preset test:local src/__tests__/solid-center-stroke-packets.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/stroke-final-face.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/vector-component.test.ts.',
        'Source-path projection gate rerun and passed on 2026-05-17: self-intersecting source-path interval FinalFace/export packets preserve provenance for no-fill implicit region/face side validation.',
        'Terminal projection gate passed on 2026-05-17: export/render packet summaries expose figmaLikeSplitRangeTerminals for deterministic screenshot probes without restroking authored input.',
        'Superseded projection correction on 2026-05-24: export/hit packets remain direct FinalFace projections with terminal geometry, while outside constrained dashed render entries use render-projection-arrangement for paint-only alpha-overdraw prevention; terminal interval ids remain in render debug metadata.',
        'Step 25/26 projection parity correction on 2026-05-24: outside same-stroke paint projection now partitions bbox-connected FinalFace polygons as coverage so split terminal/cap fragments cannot be interpreted as cutout holes or alpha-stacked fragments. This preserves reference-dashed-stroke-completeness export-packet raster recall without restroking authored input.',
        'Direct E2E coverage remains owned by Step 26/27/30 because Step 25 is projection metadata parity.',
        'Recurring gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Recurring gate rerun and passed on 2026-05-17: yarn lint:ci. Existing console warnings remain, with 0 lint errors.',
        'Step 25 outside projection gate passed on 2026-05-19: yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts and yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts --workers=1. Render/export packet summaries expose splitRangeId, intervalId, selectedSide, and legal-domain provenance for outside dashed deterministic probes without restroking authored input.',
        'Invalidated on 2026-05-20 for the filled-star inside blocker: prior Step 25 filled-face-side projection evidence exposed side metadata but did not prove product pixels came from central filled-face boundary-domain geometry.',
        'Step 25 filled-face projection gate passed on 2026-05-20: render/export packet summaries now preserve central filled-face boundary-domain provenance for inside strokes and preserve outside absence evidence for filled-filled internal adjacency without restroking authored input.',
        'Step 25 high-curvature projection gate passed on 2026-05-20: outside butt/square/round export packet summaries preserve boundary-domain provenance after legality normalization. Outside constrained-dashed product-final render projection no longer performs one global same-stroke union, because that projection step can turn valid FinalFace dash products back into high-complexity fan polygons. Projection remains FinalFace-derived and does not restroke authored input.',
        'Revalidated on 2026-05-24: constrained dashed hit/export projection maps FinalFace records directly instead of building constrained-dashed-product-union projection packets; outside butt/square/round E2E packet-quality oracle passed after rebuilt preset, outside export packets contain no cross-interval exact-arrangement products, and render-only paint arrangement remains outside the hit/export projection contract.'
      ]
    },
    'render-entries': {
      implementationTrace: [
        'FinalFace[] converts to renderer-specific entries through toSolidCenterStrokeRenderEntriesFromFinalFaces.',
        'Native center solid draw remains a separate allowed path for center-equivalent semantics only.',
        'Corrected DoD: self-intersecting constrained dashed render entries must project source-path interval FinalFace geometry; auxiliary contour metadata is not a correctness criterion.',
        'Corrected DoD: render entries must be projections of source-path interval FinalFace geometry for self-intersecting constrained dashed strokes.',
        'Added risk: render entries must carry upstream implicit legal-domain side decisions and must not reinterpret sourceContourIds or contour grouping as Figma-side proof.',
        'Round-cap source-path dashed center ribbons now use backend offset when available, preventing native center visual fallback from emitting fail-open/simple-outline geometry for the high-curvature self-crossing case.',
        'Step 26 correction: allow round-cap backend offset only for source-path ribbon render-entry construction, while preserving sampled simple round-cap arc output for direct ribbon geometry.',
        'Render projection builds self-intersecting constrained dashed product paint from coverage-unit-scoped FinalFaces. The render path may use render-projection-arrangement to partition bbox-connected paint polygons inside one render entry, but it must not build render-stage union geometry, clipPolygons masks, paint-composite masking, constrained-dashed-product-union projection packets, or cross-interval FinalFace arrangement.'
      ],
      e2eStatus: [
        'Direct unit gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/dashed-center-stroke-packets.test.ts src/__tests__/stroke-render-renderable-stroke.test.ts src/__tests__/solid-center-stroke-render.test.ts src/__tests__/solid-center-stroke-packets.test.ts src/__tests__/vector-solid-center-stroke.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts.',
        'Render entries now project source-path interval FinalFace geometry; self-intersecting product-final constrained dashed entries may be grouped only as render-projection-arrangement paint output so the same stroke paints once instead of alpha-stacking fragments.',
        'Focused regression gate rerun and passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/dashed-center-stroke-visual.spec.ts -g "open self-crossing high-curvature center dashed keeps end intervals visible without cross-interval collapse".',
        'Full visual gate rerun and passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/solid-center-stroke-visual.spec.ts e2e/dashed-center-stroke-visual.spec.ts e2e/solid-constrained-stroke-visual.spec.ts e2e/constrained-dashed-stroke-visual.spec.ts.',
        'Current source-path repair gate passed: yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/vector-component.test.ts.',
        'Invalidated on 2026-05-20 for the filled-star inside blocker: source-path interval render-entry evidence is not sufficient for filled-face boundary-domain inside parity.',
        'Terminal render-entry gate passed on 2026-05-17: stroke-rule-driven-dashed-visual.spec.ts proves render entries expose upstream terminal geometry; renderer draw performs no half-dash repair.',
        'Step 26 overdraw gate passed on 2026-05-18: stroke-self-check-star-render.spec.ts asserts darkOverdrawPixelCount and maxDarkOverdrawComponentArea so split-range fragments cannot double-paint the 50% red stroke into dark blobs.',
        'Step 26 visible-break regression gate passed on 2026-05-18: reference-dashed-stroke-completeness.spec.ts verifies every FinalFace-derived export packet has corresponding raster coverage after render-projection coverage-winding normalization.',
        'Recurring gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Recurring gate rerun and passed on 2026-05-17: yarn lint:ci. Existing console warnings remain, with 0 lint errors.',
        'Invalidated on 2026-05-20 for the filled-star inside blocker: prior Step 26 self-review did not prove render entries project central filled-face inside FinalFace geometry. Step 26 is blocked as a downstream consumer.',
        'Step 26 filled-face render-entry gate passed on 2026-05-20: stroke-self-check-star-render.spec.ts reports terminalFailures=0, darkOverdrawPixelCount=0 for the reviewed inside/outside artifacts, filledFaceTerminals present for inside, and filledFaceTerminals absent for outside.',
        'Step 26 high-curvature render-entry gate passed on 2026-05-20: constrained-dashed packet tests assert FinalFace-derived render entries contain no high-complexity near-zero-edge residue for outside dashed output, and the outside butt/square/round screenshots show no fan of disconnected high-curvature dash slivers. Renderer draw remains projection-only; Step 25 owns projection normalization and Step 20 owns legality cleanup.',
        'Invalidated on 2026-05-24: prior render-entry revalidation focused on dashed overlap/cap matrices while visible boundary-terminal-join product geometry still existed. Step 26 is blocked until Step 17 removes boundary-terminal-join product output and replacement render-entry tests prove dashed paint projection is FinalFace-derived terminal/cap geometry only.'
      ]
    },
    'mesh-render': {
      implementationTrace: [
        'Pixi draw/cache paths render the entries exactly as upstream geometry requested.',
        'Renderer should not collapse, clip, or restroke geometry to repair earlier stages.',
        'renderSolidCenterStrokeEntries remains the renderer entry consumer; dashed center round-cap geometry is fixed upstream before renderer draw rather than repaired in renderer code.'
      ],
      e2eStatus: [
        'Direct renderer unit gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset test:local src/__tests__/solid-center-stroke-render.test.ts src/__tests__/solid-center-stroke-packets.test.ts src/__tests__/dashed-center-stroke-packets.test.ts.',
        'Full visual evidence from the same post-fix state passed on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e -- e2e/solid-center-stroke-visual.spec.ts e2e/dashed-center-stroke-visual.spec.ts e2e/solid-constrained-stroke-visual.spec.ts e2e/constrained-dashed-stroke-visual.spec.ts.',
        'Recurring gate rerun and passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Recurring gate rerun and passed on 2026-05-17: yarn lint:ci. Existing console warnings remain, with 0 lint errors.',
        'Step 27 self-review: complete for MeshRender; renderer draws upstream entries faithfully and the high-curvature dashed center fix remains upstream, not renderer repair. Proceed to hit-export next.'
      ]
    },
    'hit-export': {
      implementationTrace: [
        'Hit area and export packet generation use strokeFinalFaces in the non-drag path.',
        'Hover hit area is a consumer of final geometry or an explicit fallback.',
        'Drag visual-only mode intentionally defers hit/export projection while keeping product visual output current; after mouseup, E2E probes sample export-packet polygons instead of authored dash/source assumptions.',
        'Implemented on 2026-05-17: visual-overlap collapse now partitions faces by bounds-connected components before exact arrangement/union. Disconnected networks no longer force one large arrangement, while overlapping faces in the same component still collapse together and preserve terminal/owner/source/legal metadata.'
      ],
      e2eStatus: [
        'Direct unit/integration gate passed: yarn workspace @asyra/preset test:local src/__tests__/stroke-drag-performance.test.ts src/__tests__/stroke-drag-pipeline-performance.test.ts src/__tests__/solid-center-stroke-packets.test.ts src/__tests__/vector-component.test.ts src/__tests__/vector-solid-center-stroke.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'Current Step 28 unit/integration gate passed on 2026-05-17 after bounds-connected visual-overlap partitioning: yarn workspace @asyra/preset test:local src/__tests__/stroke-drag-performance.test.ts src/__tests__/stroke-drag-pipeline-performance.test.ts src/__tests__/stroke-candidate-arrangement.test.ts src/__tests__/solid-center-stroke-packets.test.ts src/__tests__/vector-component.test.ts src/__tests__/vector-solid-center-stroke.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'Direct E2E gate passed: yarn workspace @asyra/asyra-design test:e2e e2e/vector-stroke-refresh.spec.ts e2e/stroke-drag-render-performance.spec.ts --workers=1.',
        'Step 28 regression fixed and passed on 2026-05-17: the 12-network self-intersecting inside dashed refresh case keeps reloadElapsedMs under 5 seconds without lowering the reload contract.',
        'Visual regression gate passed after overlap partitioning on 2026-05-17: yarn workspace @asyra/asyra-design test:e2e e2e/constrained-dashed-stroke-visual.spec.ts e2e/solid-constrained-stroke-visual.spec.ts --workers=1.',
        'Focused regression gate passed: yarn workspace @asyra/asyra-design test:e2e -- e2e/stroke-drag-render-performance.spec.ts -g "measures real browser point and handle drag rendering with product visual probes".',
        'Recurring gate passed on 2026-05-17: yarn workspace @asyra/preset build:preset.',
        'Recurring gate passed on 2026-05-17: yarn lint:ci. Existing console warnings remain, with 0 lint errors.',
        'Step 28 self-review: complete for Hit-test / export projection; proceed to runtime-diagnostics next.'
      ]
    },
    'runtime-diagnostics': {
      implementationTrace: [
        'Diagnostics are set by constrained dashed, constrained solid, legality, ownership, overlap, and dirty-key helpers.',
        'stroke-runtime-diagnostics defines the public branch shape with branchId, supportState, blockedReason, ownerProvenance, legalDomainProvenance, dirtyStageTrace, and typed evidence.',
        'Constrained dashed and constrained solid runtime diagnostics now publish product branch records so product/debug/legacy evidence cannot be confused.'
      ],
      e2eStatus: [
        'Direct diagnostics gate passed: yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-runtime-diagnostics.test.ts src/__tests__/constrained-solid-runtime-diagnostics.test.ts src/__tests__/stroke-dirty-keys.test.ts src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts.',
        'No dedicated diagnostics E2E added because diagnostics are not currently UI-visible.',
        'Recurring gate passed: yarn workspace @asyra/preset build:preset.',
        'Recurring gate passed: yarn lint:ci.',
        'Step 29 self-review: complete for Runtime diagnostics; proceed to visible-final-result next.'
      ]
    },
    'visible-final-result': {
      implementationTrace: [
        'Browser/Pixi output is the last consumer of fill faces and stroke render entries.',
        'Visual failures are now traced against Figma/source-path parity first, then backward through FinalFace/export packet projections, packet, legality, arrangement, candidate, interval, topology, and state stages.',
        'Current DoD: reference dashed visual tests must assert Figma-like split-range interval recall for self-intersecting constrained strokes.',
        'Current DoD: reported sharp-corner visual tests keep authored-source hard assertions when the family requires Figma/source-path parity.',
        'Implemented corrected DoD: stroke-self-check-star-render.spec.ts now creates fill-baseline, filled-stroke, and no-fill-stroke variants; the no-fill variant asserts split-range interval packet provenance, Figma implicit region/face side probes, terminal-preserving non-union projection metadata, and no independent filled-face-boundary dash schedule.',
        'Corrected Step 30 E2E oracle keeps split-range dash interval coverage and redistributed gap metadata as necessary checks while using implicit region/face side probes as the Figma-like inside/outside authority.',
        'Corrected rule-driven visual oracle: stroke-rule-driven-dashed-visual.spec.ts now validates split-range product FinalFace/export packets and visible packet polygon coverage instead of obsolete whole-path gap probes.',
        'Focused terminal visual gate passed on 2026-05-17: stroke-rule-driven-dashed-visual.spec.ts validates a segment split into three ranges, terminal half-dash coverage on both internal split boundaries, redistributed middle/gap placement, and independent split-range terminal provenance.',
        'Corrected final screenshot oracle on 2026-05-17: Step 30 no longer requires exportPacketCount === 1. Fragmented FinalFace-derived packets are valid only when each packet is product-final, carries source interval provenance, has no boundary/contour/filled-face geometry id, and deterministic probes still prove split-range coverage/gaps.',
        'Corrected square-cap general fixture oracle on 2026-05-17: broad dashed visual tests require clean gap evidence without treating cap extension or another legal crossing split range as a false failure. The focused dashed split-segment test remains the strict terminal half-dash and adjacent-gap authority.',
        'Revalidated on 2026-05-18: stroke-rule-driven-dashed-visual.spec.ts now includes a focused fixture where one source-topology segment is split into three intersection split ranges by crossing geometry; the screenshot oracle proves both ends of each split range have terminal half-dash coverage and adjacent gaps, while export-packet metadata proves adjacent terminal half-dashes remain independent product domains instead of one cumulative dash.',
        'Revalidated on 2026-05-18: the broader self-intersecting star rule-driven tests keep deterministic terminal coverage, redistributed gap metadata, and product packet provenance checks.',
        'Corrected on 2026-05-18: stroke-self-check-star-render.spec.ts now detects double-opacity red overdraw components on the filled star screenshot, so semi-transparent product-final fragments cannot stack into dark blobs at split boundaries.',
        'Invalidated by the 2026-05-20 filled-star rule correction: previous fill-mask/sourceSplitRange final visual oracles accepted selectedSide metadata and did not require central filled-face boundaries as first-class inside stroke domains.',
        'Corrected DoD: stroke-self-check-star-render.spec.ts must render inside and outside dashed star fixtures and assert generic region-boundary rules: inside includes filled-face internal boundary product stroke; outside excludes filled-face internal boundary product stroke.',
        'Corrected DoD: butt remains the base dash geometry; square/round caps are additive endpoint geometry evaluated after interval allocation and before overlap/legal/projection. Ordinary gap midpoint pixel probes are not valid cap correctness evidence.',
        'Corrected DoD: automated visual tests may use Figma screenshots only as rule-discovery evidence. Pass/fail must come from generic boundary-domain, terminal, gap, overlap, and projection probes.'
      ],
      e2eStatus: [
        'Superseded status on 2026-05-20 before the filled-face fix: Step 30 was reopened because prior visual and metadata gates accepted sourceSplitRange/selectedSide-only filled-face behavior. The active gate now requires region-boundary domain proof.',
        'Correct E2E DoD: inside dashed final screenshots must show product stroke on eligible outer and filled-face internal boundary domains; outside dashed final screenshots must show product stroke only on global exterior boundary domains and no product stroke on filled-face internal boundary domains.',
        'Correct dashed E2E DoD: deterministic probes must verify boundary-domain provenance, terminal half-dash allocation on each selected boundary split segment, redistributed gaps, butt-base geometry plus additive square/round caps, overlap collapse without opacity stacking, and no renderer-side repair.',
        'Superseded evidence on 2026-05-20: the older stroke-self-check-star-render.spec.ts 7/7 pass did not prove product pixels came from actual central filled-face boundary-domain geometry; the active E2E now includes that generic region-boundary proof.',
        'Reference screenshots from Figma are rule-discovery evidence only. Automated visual gates must encode generic region-boundary rules, not pixel-similarity comparisons to those reference images.',
        'Step 30 filled-face final visual gate passed on 2026-05-20 for the encoded dashed slice: yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts --workers=1 passed 7/7 with generic region-boundary probes; AI self-review checked inside butt/round and outside round artifacts for central filled-face inside stroke, outside internal-adjacency absence, dashed terminal half-dash/gap behavior, no dark overdraw, and no renderer repair evidence.',
        'Step 30 outside high-curvature dashed final visual gate passed on 2026-05-20: the same E2E passed 7/7 after adding a generic polygon-quality oracle for outside dashed boundary-domain interval packets and using eroded deep-fill probes for outside fill-side absence. AI self-review inspected outside butt, square, and round screenshots and found no disconnected high-curvature sliver fan at the reported corner.',
        'Invalidated on 2026-05-24: focused dashed packet/FinalFace/render-entry tests that accepted outside high-curvature endpoint join variants are no longer valid because dashed boundary split endpoints are terminal/cap boundaries, not join boundaries.',
        'Invalidated on 2026-05-24: rebuilt-preset E2E and Cmd+1/app-zoom screenshot review are no longer completion proof for outside dashed star until packet/FinalFace/render-entry tests first prove no visible boundary-terminal-join product packets, no sourceBoundaryJoinCount product provenance, and no bridges between independent split-segment terminals.'
      ]
    }
  }

  const defaultStepContract = (step) => ({
    definitionOfDone: [
      'The step consumes only its documented inputs and produces only its documented outputs.',
      'All helper conditions for this step are satisfied or the step emits typed blocked/unsupported diagnostics.',
      'No forbidden fallback is introduced: no authored-source-path-only product substitute for constrained inside/outside filled-face behavior, no cumulative schedule for boundary split-segment dashed semantics, no renderer repair, no even-odd-only face classification when Figma winding rules require nonzero, and no downstream patch to hide an upstream failure.',
      'Targeted tests and evidence listed for this step pass before any downstream status is updated.'
    ],
    acceptanceTests: [
      'Run the step-specific related tests and debug commands shown in this inspector.',
      'When the step affects visible geometry, hit/export, drag, or refresh behavior, run the relevant visual or E2E gate before marking the step aligned.',
      'Before final alignment, run yarn workspace @asyra/preset build:preset and yarn lint:ci.'
    ],
    knownLimits: [
      'This default contract is insufficient for dashed terminal half-dash product semantics; dashed terminal-specific steps must use their stronger DoD.',
      `Step ${step.stepNumber ?? '?'} (${step.id}) remains bounded by the current inputs/outputs and may not fix downstream symptoms outside its ownership.`
    ],
    failureSignals: [
      'A helper reads undocumented state, parses geometry ids, packet order, or rendered pixels to recover semantics.',
      'A downstream visual change is required to hide an upstream contract failure.',
      'Tests pass without proving the documented output or provenance for this step.'
    ]
  })

  const stepContractOverrides = {
    'shared-geometry-model': {
      definitionOfDone: [
        'Shared geometry emits first-class stroke boundary domains for self-intersecting filled vectors: filled faces, region loops, real unfilled holes, filled-filled internal adjacency, global exterior boundaries, and open path boundaries.',
        'Each boundary domain is split at intersections and carries boundaryDomainId, adjacent face ids, filled/unfilled/exterior occupancy, region ids, windingRule basis, insideEligible, outsideEligible, sourceSpanIds, and topology provenance.',
        'The central Figma star pentagon must be classified as a filled face, not as a hole, when the active region/winding-rule evaluation fills it.',
        'Inside/outside consumers must be able to decide eligibility from this shared model without using source orientation, contour signed area alone, visible fill paint, packet order, selectedSide-only metadata, or rendered pixels.'
      ],
      acceptanceTests: [
        'Shared-geometry tests must prove the star fixture central pentagon is a filled face under the active Figma winding-rule/region model.',
        'Shared-geometry tests must prove inside-eligible boundary domains exist for every filled face, including the central filled face.',
        'Shared-geometry tests must prove filled-to-exterior boundary domains remain outside-eligible and filled-filled internal adjacency is outside-ineligible.'
      ],
      knownLimits: [
        'This step does not allocate dash intervals or build stroke polygons.',
        'Boundary domains are shared geometry truth; downstream helpers may filter/select them but must not recreate them privately.'
      ],
      failureSignals: [
        'A filled internal face is labeled as hole because of contour orientation, signed area, or even-odd helper naming.',
        'Outside eligibility cannot distinguish filled-to-exterior boundaries from filled-filled internal adjacency.',
        'Downstream code must use source orientation, selectedSide-only metadata, or rendered pixels to decide inside/outside for self-intersecting faces.'
      ]
    },
    'resolve-stroke-domains': {
      definitionOfDone: [
        'StrokeDomainPlan consumes Step 12 boundary domains directly.',
        'For inside self-intersecting constrained strokes, it includes every filled-face boundary domain, including the central filled face in the Figma star.',
        'For outside self-intersecting constrained strokes, it includes only outside-eligible filled-to-exterior boundary domains and excludes filled-filled internal adjacency.',
        'The output records boundaryDomainId, region id, face id, selected side, sourceSpanIds, legal face ids, and stroke position before interval allocation.'
      ],
      acceptanceTests: [
        'Domain-plan tests must prove inside star domains include central filled-face boundary domains.',
        'Domain-plan tests must prove outside star domains exclude filled-filled internal adjacency and include filled-to-exterior domains.'
      ],
      knownLimits: [
        'This step selects domains only; it must not allocate intervals or build candidate polygons.'
      ],
      failureSignals: [
        'Central filled-face inside stroke can only be inferred later from source split ranges.',
        'Outside domain plan contains filled-filled internal adjacency domains.',
        'Domain ids cannot be traced into Step 15 intervals.'
      ]
    },
    'allocate-intervals': {
      definitionOfDone: [
        'Every self-intersecting inside/outside dashed Figma-like boundary split segment is allocated independently. solidMaskModel uses the same Step 14 domain evidence only as mask/provenance input and bypasses interval allocation.',
        'For each selected boundary split segment, the first visible interval is [rangeStart, rangeStart + dash/2] and the last visible interval is [rangeEnd - dash/2, rangeEnd], clamped only when the whole range is shorter than one dash.',
        'Interior middle dash count is chosen from the normal-range redistributed reference gap for the current stroke; short ranges reduce dash count when the reference rhythm would otherwise be overcrowded. After the count is selected, the final average gap is solved once and every visible interval start/end is derived from that formula before any interval is emitted. No minimum gap clamp is allowed and no visible interval crosses the boundary split-segment boundary. The same boundary segment must not cover the gap immediately after its start terminal or immediately before its end terminal.',
        'VisibleDashedTopologyInterval preserves boundaryDomainId, boundaryRole, rangeStart, rangeEnd, terminal role, and interval id for downstream audit.'
      ],
      acceptanceTests: [
        'yarn workspace @asyra/preset test:local src/__tests__/dashed-center-stroke-intervals.test.ts',
        'yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts'
      ],
      knownLimits: [
        'This step allocates interval semantics only; it must not build candidate polygons, legality clips, FinalFace records, or render entries.',
        'This step allocates on the boundary domains selected by Step 14; it must not fall back to authored-source-path-only ranges for self-intersecting inside/outside filled-face behavior.'
      ],
      failureSignals: [
        'A boundary split segment uses one cumulative authored-source-path schedule.',
        'A terminal interval is missing, full-length when it should be half-dash, crosses into the adjacent boundary split segment, covers its own terminal-adjacent gap, or a middle interval choice creates uneven same-range gaps, ignores the normal-range reference gap rhythm, or computes gap placement incrementally while walking the range.',
        'Downstream code cannot tell which boundary domain produced a visible interval.'
      ]
    },
    'build-one-sided-candidates': {
      definitionOfDone: [
        'solidMaskModel candidates consume authored source geometry at doubled center-stroke width plus Step 14 mask/provenance evidence. dashIntervalModel candidates consume Step 15 dashed terminal intervals as the minimum semantic unit.',
        'Each dashed boundary split keeps independent terminal candidates on adjacent boundary segments; no dashed candidate construction may bridge the boundary as one continuous dash.',
        'Butt is the base source-path dash geometry. Square and round caps are additive endpoint geometry attached only after the base terminal intervals are allocated; cap/overlap auxiliary geometry cannot replace terminal interval provenance or alter the dash schedule.',
        'For dashIntervalModel only, self-intersection boundary split endpoints are dashed terminal/cap boundaries, not line-join boundaries. Authored sharp source vertices remain line-join boundaries: join type may affect dashed source-vertex-join coverage only when adjacent visible terminal half-dashes from neighboring source segments meet on the same legal outside boundary. Solid candidates must not create boundary-terminal-join product packets, sourceBoundaryJoinCount product provenance, dashed terminal metadata, or visible bridge geometry between arbitrary split-segment terminals.',
        'For self-intersecting constrained inside/outside, Step 17 splits by product model: solid emits doubled center-stroke candidates that preserve source-vertex joins/miter before masking, and dashed emits boundary-domain interval candidates. Central filled-face evidence is mask/provenance input for solid and interval-domain eligibility for dashed; filled-filled internal adjacency must not be emitted as outside product candidates.',
        'Step 17 must not resolve self-intersecting side from source orientation, visible fill paint, packet-local probes, or rendered pixels.',
        'Outside dashed candidates pass only when the butt-base geometry plus additive square/round cap geometry is emitted on global exterior boundary domains, including the top-left acute-angle first dash shape, without relying on renderer repair.',
        'Cubic segment starts whose first control point equals the anchor must use the first non-degenerate tangent from shared path sampling before offset/cap geometry is built; a default horizontal tangent is invalid candidate input.'
      ],
      acceptanceTests: [
        'yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts',
        'yarn workspace @asyra/preset test:local src/__tests__/vector-constrained-dashed-stroke.test.ts',
        'Outside self-intersecting packet tests must cover butt, square, and round cap selectedSide geometry, acute-angle first dash shape, and degenerate cubic-start tangent fallback before Step 17 can remain aligned.'
      ],
      knownLimits: [
        'This step builds candidate geometry only; legality clipping and overlap collapse remain downstream.',
        'High-curvature or overlap diagnostics may record evidence only; product candidate geometry must already be correct and must not include boundary-terminal-join coverage.'
      ],
      failureSignals: [
        'A rendered/candidate range extends across a boundary split and erases terminal interval identity.',
        'A visible product packet, FinalFace, render packet, hit packet, or export packet contains boundary-terminal-join geometry or sourceBoundaryJoinCount provenance.',
        'A central filled-face inside stroke disappears because filled-face boundary domains were not selected for inside.',
        'An outside candidate is emitted for filled-filled internal adjacency.',
        'Outside first dash at an acute angle folds, points inward, or clips like an inside dash for the same cap type.',
        'A final screenshot can pass by selected-side metadata while pixels violate the region-boundary domain rule.'
      ]
    },
    'partition-arrangement-faces': {
      definitionOfDone: [
        'Arrangement partitions only existing candidate geometry and may collapse visual overlap only when terminal interval identity remains traceable.',
        'Overlap collapse preserves terminal interval ids, boundaryDomainId, boundary split start/end, sourceSpanIds, ownerSet, and side/legal provenance.',
        'No backend promotion may turn outside-ineligible filled-filled internal adjacency into outside product geometry.'
      ],
      acceptanceTests: [
        'yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts',
        'yarn workspace @asyra/preset test:local src/__tests__/stroke-final-face.test.ts'
      ],
      knownLimits: [
        'Visual overlap may be unioned for render paint-layer output, but FinalFace/export metadata must still let tests probe each terminal and adjacent gap.',
        'Unsupported local-side/high-curvature families remain unsupported unless their own explicit DoD and tests are added.'
      ],
      failureSignals: [
        'Collapsed geometry removes adjacent gap evidence.',
        'Terminal interval ids are absent after arrangement.',
        'Arrangement output proves correctness only by rendered appearance.'
      ]
    },
    'apply-legality': {
      definitionOfDone: [
        'Legality clips or filters Step 17/18 candidate geometry only.',
        'Terminal half-dash geometry keeps interval id, terminal role, boundaryDomainId, boundary split start/end, owner, side-resolution, and legal-domain provenance after clipping.',
        'Self-intersecting inside/outside legality follows filled-face boundary eligibility: inside keeps selected filled-face boundary geometry, including central filled faces; outside keeps only filled-to-exterior boundary-domain geometry.',
        'For solidMaskModel, exact boolean coverage may be retained as solidMaskModelCoverageOracle for hit/export/diagnostics, but Step 20 must emit or preserve a seam-free solidMaskModelVisibleRender descriptor for outside solid masked-source-stroke drawing.',
        'Legality is implemented as filtering/clipping of selected boundary-domain candidates, not an inside-only clip helper, selected-side-only fallback, or visible-fill-paint branch.',
        'Legality never creates replacement center bands, authored source contour loops, or outside products for filled-filled internal adjacency.'
      ],
      acceptanceTests: [
        'yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts',
        'yarn workspace @asyra/preset test:local src/__tests__/vector-constrained-dashed-stroke.test.ts'
      ],
      knownLimits: [
        'Legality may reduce terminal geometry by clipping, but may not change the interval schedule.',
        'Shared region/loop/winding-rule/face evidence is authority for boundary-domain eligibility and side filtering, not downstream replacement geometry generation.'
      ],
      failureSignals: [
        'Terminal geometry is replaced rather than clipped.',
        'Central filled-face inside pixels are missing or outside pixels appear on filled-filled internal adjacency.',
        'A packet gains geometry from legal-boundary restroking.',
        'Self-intersecting outside solid visible render uses flattened exact-boolean annulus polygons with bridge/cut seams instead of a masked-source-stroke descriptor.',
        'Outside dashed output is accepted by selectedSide metadata while final pixels violate the fill/inverse-fill mask rule, or acute endpoint/cap geometry is distorted by an inside-only clipping path.'
      ]
    },
    'build-final-faces': {
      definitionOfDone: [
        'FinalFace[] is the only canonical final geometry source.',
        'Every split-boundary terminal interval can be traced from candidate/packet input into FinalFace metadata and sampled geometry.',
        'Collapsed FinalFace records retain child packet or interval references sufficient to test terminal coverage and redistributed gap placement.',
        'Inside/outside constrained FinalFace records preserve boundaryDomainId, region id, face id, inside/outside eligibility, selected side, filled/exterior side, legal-domain ids, and dashed interval ids when present so Step 30 can prove the pixels came from filled-face boundary domains.',
        'Solid FinalFace records distinguish solidMaskModelVisibleRender from solidMaskModelCoverageOracle and preserve solidMaskModelMaskSide when present.'
      ],
      acceptanceTests: [
        'yarn workspace @asyra/preset test:local src/__tests__/stroke-final-face.test.ts',
        'yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts'
      ],
      knownLimits: [
        'FinalFace may collapse visual duplicates only when semantic child references remain available.',
        'FinalFace does not restroke or reallocate intervals.'
      ],
      failureSignals: [
        'FinalFace output looks correct but loses boundary-domain terminal provenance.',
        'Export/render cannot locate terminal intervals from FinalFace metadata.',
        'Inside/outside output cannot be traced back to filled-face boundary eligibility provenance from FinalFace.',
        'Solid FinalFace output conflates exact-boolean coverage polygons with the visible render descriptor.'
      ]
    },
    'emit-render-hit-export-packets': {
      definitionOfDone: [
        'Render, hit-test, and export packets are projections from FinalFace[] only.',
        'Projection preserves terminal interval ids, terminal roles, boundaryDomainId, boundary split start/end, ownerSet, sourceSpanIds, side-resolution, and legal-domain provenance.',
        'No projection path restrokes authored input or rebuilds dash schedules.',
        'Render projection may arrange same-stroke product-final paint polygons into a single render entry only to prevent opacity overdraw; export and hit projection must retain direct FinalFace terminal geometry.',
        'Inside/outside constrained projection must expose enough boundary-domain eligibility provenance for deterministic rule probes; selectedSide alone is insufficient.',
        'Self-intersecting outside solid render projection must expose solidMaskModelVisibleRender: masked-source-stroke separately from solidMaskModelCoverageOracle: exact-boolean when exact coverage is retained for hit/export/diagnostics.'
      ],
      acceptanceTests: [
        'yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts',
        'yarn workspace @asyra/preset test:local src/__tests__/stroke-final-face.test.ts'
      ],
      knownLimits: [
        'Drag visual-only deferral is handled in Step 28; this step owns final non-drag projection.',
        'Projection may simplify paint payloads, but not geometry/provenance semantics.',
        'Render-projection arrangement is not proof of dash correctness; correctness remains proven by FinalFace/export terminal provenance and Step 30 pixels.'
      ],
      failureSignals: [
        'Export packets cannot identify split-boundary terminal intervals.',
        'Hit/export geometry differs from FinalFace geometry for final non-drag state.',
        'Projection only proves dash presence or selectedSide metadata but cannot prove region-boundary eligibility parity.',
        'Render projection paints exact-boolean bridge/cut seam polygons as the outside solid visible result.'
      ]
    },
    'render-entries': {
      definitionOfDone: [
        'Render entries project FinalFace geometry and paint without deciding stroke semantics.',
        'Terminal half-dash geometry remains probeable from upstream FinalFace/export metadata; render entries may carry grouped terminal metadata when they arrange same-stroke paint polygons into one render entry.',
        'Semi-transparent fragments from the same stroke must not be painted as separate layers that create double-opacity dark blobs.',
        'Native center stroke paths are used only for center-equivalent semantics, not constrained inside/outside terminal repair.',
        'Constrained solid render entries may consume upstream solidMaskModelVisibleRender descriptors for masked-source-stroke drawing; they must not synthesize the descriptor in render code.'
      ],
      acceptanceTests: [
        'yarn workspace @asyra/preset test:local src/__tests__/solid-center-stroke-render.test.ts src/__tests__/stroke-render-renderable-stroke.test.ts',
        'yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts'
      ],
      knownLimits: [
        'Renderer draw code is not allowed to fix missing dashed terminal half-dashes.',
        'Render entries may carry auxiliary metadata for debugging, but product geometry must already be correct.',
        'Flattened exact-boolean annulus polygons with bridge/cut seams are not a valid outside solid visible-render source.'
      ],
      failureSignals: [
        'Terminal appearance exists only because renderer expands or repairs geometry.',
        'Render entries drop terminal interval provenance.',
        'The final screenshot shows dark overdraw components where same-stroke fragments overlap.',
        'The final screenshot shows a black crack along an exact-boolean bridge/cut seam in outside solid render.'
      ]
    },
    'visible-final-result': {
      definitionOfDone: [
        'Final screenshots are evaluated only after Step 15, 17, 18, 20, 24, 25, and 26 gates pass.',
        'Deterministic probes verify solid miter/join parity, solid mask boundaries, no split-end cap artifacts in solid, no high-curvature solid cracks, no exact-boolean bridge/cut seam painted in outside solid visible render, every tested dashed boundary split has terminal coverage on both adjacent boundary segments, redistributed middle/gap placement, no semantic cross-boundary dash continuity in FinalFace/export, central filled-face inside stroke exists, outside is filled-to-exterior only, and no double-opacity render overdraw.',
        'Inside and outside constrained deterministic probes cover boundary-domain eligibility and projection provenance from FinalFace/export. Dashed probes additionally cover butt, square, and round caps where available: terminal half-dash preservation and acute-angle first dash shape. Cap-specific correctness must use the butt-base plus additive-cap model, not ordinary gap midpoint sampling.',
        'Outside high-curvature dashed probes must reject high-complexity polygons with near-zero-edge residue at packet and render-entry projection boundaries; polygonCount=1 is not sufficient evidence because a single polygon can still encode a visible sliver fan.',
        'Screenshot review compares the final screenshots against the rule-driven region-boundary domain model after deterministic probes pass.',
        'Every visual repair must attach or preserve global screenshots plus local zoom crops for the reported high-curvature/intersection areas, and those crops must be paired with deterministic crack assertions; a passing command without this self-review evidence cannot mark Step 30 aligned.',
        'Every self-intersecting solid repair must run a single-vector reload performance gate proving accepted solidMaskModel packets stay on the lightweight provenance diagnostics path and do not invoke dashed interval/cap handling.'
      ],
      acceptanceTests: [
        'yarn workspace @asyra/asyra-design test:e2e -- e2e/stroke-rule-driven-dashed-visual.spec.ts --workers=1',
        'yarn workspace @asyra/asyra-design test:e2e -- e2e/stroke-self-check-star-render.spec.ts --workers=1',
        'stroke-self-check-star-render.spec.ts, or an equivalent final visual gate, renders outside dashed butt/square/round and validates deterministic probes plus screenshot review against the outside mask model.',
        'stroke-self-check-star-render.spec.ts, or an equivalent final visual gate, renders outside solid high-curvature tp-13/tp-16 local crops and fails on black crack components caused by exact-boolean bridge/cut seams.',
        'yarn workspace @asyra/asyra-design test:e2e -- e2e/constrained-dashed-stroke-visual.spec.ts e2e/reference-dashed-stroke-completeness.spec.ts e2e/reference-dashed-stroke-rendering.spec.ts e2e/reported-dashed-stroke-sharp-corners.spec.ts e2e/reported-vector-6-dashed-inside-seam.spec.ts e2e/stroke-rule-driven-dashed-visual.spec.ts'
      ],
      knownLimits: [
        'AI visual review is a final gate only and cannot replace deterministic probes.',
        'A screenshot failure must be traced backward through FinalFace/export, legality, arrangement, candidates, intervals, topology, and state.'
      ],
      failureSignals: [
        'Terminal half-dash coverage is missing at split boundaries.',
        'Terminal interval identity is lost after overlap/cap assembly, or cap geometry changes dash allocation instead of being added to the butt-base geometry before overlap and legality.',
        'Central filled-face inside stroke is missing, or outside stroke appears on filled-filled internal adjacency.',
        'A product dash comes from an outside-ineligible internal adjacency boundary.',
        'Same-stroke 50% opacity fragments visibly stack into dark red blobs.',
        'A high-curvature outside dash appears as many narrow disconnected-looking slivers, or the metadata contains a high-complexity polygon with near-zero-edge residue.',
        'Inside/outside dashed screenshots pass selected-side metadata checks but fail rule-driven screenshot review.'
      ]
    }
  }

  steps.forEach((step, index) => {
    step.stepNumber = index + 1
    step.figmaLikeStrokeRules = figmaLikeRulesByStep[step.id] ?? [
      'Figma-like stroke rule review required before changing this step.'
    ]
    const baseContract = defaultStepContract(step)
    const stepContract = stepContractOverrides[step.id] ?? baseContract
    step.definitionOfDone =
      stepContract.definitionOfDone ?? baseContract.definitionOfDone
    step.acceptanceTests =
      stepContract.acceptanceTests ?? baseContract.acceptanceTests
    step.knownLimits = stepContract.knownLimits ?? baseContract.knownLimits
    step.failureSignals =
      stepContract.failureSignals ?? baseContract.failureSignals
    const risks = stepRiskOverrides[step.id]
    if (risks) {
      step.risks = risks
    }
    const groupContext = defaultContextByGroup[step.group] ?? {}
    const stepContext = stepContextOverrides[step.id] ?? {}
    step.planReferences = [
      ...(groupContext.planReferences ?? []),
      ...(stepContext.planReferences ?? [])
    ]
    step.implementationTrace = [
      ...(groupContext.implementationTrace ?? []),
      ...(stepContext.implementationTrace ?? [])
    ]
    step.e2eStatus = [
      ...(groupContext.e2eStatus ?? []),
      ...(stepContext.e2eStatus ?? [])
    ]
    step.helperConditions = step.helpers.map((helper) => {
      const condition =
        helperConditionsByName[helper] ??
        'Condition review required before relying on this helper in the flow.'
      return `${helper}: ${condition}`
    })
  })

  const stepAlignmentOverrides = {
    'input-event': {
      status: 'aligned',
      currentImplementation:
        'Pen/path-editing features enter through feature-system definitions and use FeatureNames plus common APIs.',
      requiredAdjustment:
        'Keep future vector-editing behavior behind feature/common API boundaries.'
    },
    'vector-api-mutation': {
      status: 'aligned',
      currentImplementation:
        'elementApis vector methods call vectorGeometry topology helpers for add, move, split, connect, close, handle mode, and handle position updates; buildVectorComputedPatch publishes topology-native points / segments / networks with bounds and closed state.',
      requiredAdjustment:
        'Keep topology-native points / segments / networks as the only runtime vector model; replace the temporary shared-geometry fallback contour bridge when later source-family and candidate stages own typed support decisions.'
    },
    'validate-topology': {
      status: 'aligned',
      currentImplementation:
        'vectorGeometry.validate maps to assertVectorTopologyConsistency, and buildVectorComputedPatch validates topology before producing computed data; focused tests now lock valid-write / invalid-reject behavior.',
      requiredAdjustment:
        'Add product-support validation only as separate support classification, not as write-time structural validation.'
    },
    'transaction-write': {
      status: 'aligned',
      currentImplementation:
        'changeComputedData wraps core.changeComputedData in startTransaction/endTransaction; vector drag options preserve transient undoable:false preview and final undoable commit behavior.',
      requiredAdjustment:
        'Keep drag-end commits as the intended undo boundary, and require new drag features to prove the same preview/final split.'
    },
    'data-channel-delta': {
      status: 'aligned',
      currentImplementation:
        'Scene-tree computed-data update and batch events feed preset data-channel observers, which route points/segments/networks deltas into renderSceneTreeStore.',
      requiredAdjustment:
        'Keep render updates subscribed to committed scene-tree events only.'
    },
    'render-cache-patch': {
      status: 'aligned',
      currentImplementation:
        'RenderSceneTree ComputedDataMirror patches cached computed snapshots with per-key or batch changes, reseeds before undoable updates, and composes complete RenderElementData on flush.',
      requiredAdjustment:
        'Keep undoable reseed behavior explicit and covered by cache-drift tests.'
    },
    'dirty-revision-graph': {
      status: 'aligned',
      currentImplementation:
        'buildStrokeRuntimeRevisionSet and computeStrokeDirtyKeys expose explicit source, stroke spec, topology, shared geometry, source family, stroke domain, interval, candidate, arrangement, ownership, legality, region, paint, output, and preview-mode revision inputs before render-entry cache reuse.',
      requiredAdjustment:
        'Keep later stage refactors wired to these typed revision inputs rather than deriving invalidation from geometry ids, packet order, or rendered output.'
    },
    'render-strategy-entry': {
      status: 'aligned',
      currentImplementation:
        'vectorRenderStrategy delegates into renderVectorGraphic only; renderVectorGraphic normalizes incoming VectorComputedData before topology or stroke stage work begins.',
      requiredAdjustment:
        'Keep entry code as orchestration over shared helpers, and move downstream domain decisions into the documented stage helpers as those steps are completed.'
    },
    'normalize-render-data': {
      status: 'aligned',
      currentImplementation:
        'normalizeVectorRenderData and map normalizers produce stable vector render inputs before geometry construction; dangling topology and legacy anchorPoints do not become renderable geometry.',
      requiredAdjustment:
        'Do not treat render normalization as runtime mutation validation.'
    },
    'normalize-stroke-spec': {
      status: 'aligned',
      currentImplementation:
        'normalizeStrokeSpec normalizes authored strokes, dash patterns, dash offsets, miter limits, caps, joins, opacity, solid paint, and gradient paint while emitting rejection diagnostics.',
      requiredAdjustment:
        'Switch downstream stages from getRenderableStrokes to the richer normalizeStrokeSpec result when diagnostics need to be surfaced beyond this boundary.'
    },
    'build-path-topology': {
      status: 'aligned',
      currentImplementation:
        'vector.ts builds and caches one PathTopologyModel per network revision, including sourceRevision, fillRule, arc-length basis, simple/open/self-intersecting classification, contours, legal-domain descriptors, and topology metadata counts. normalizePathTopologyFillRule now preserves Figma-like nonzero default behavior unless evenodd is explicit.',
      requiredAdjustment:
        'Keep fillRule as an explicit topology contract and add new Figma captures as topology/fill-rule oracles before downstream geometry claims parity.'
    },
    'shared-geometry-model': {
      status: 'aligned',
      currentImplementation:
        'buildResolvedVectorGeometryModel exposes fillRegions, legalFaceBoundaries, legalBoundaryContours, merged boundary-domain split segments, side classification, and first-class strokeBoundaryDomains. Sampled planar edges are merged across ordinary degree-2 sample nodes and split at intersections/source boundaries so the central Figma star face is a filled-face domain, not a hole or per-sample micro-domain.',
      requiredAdjustment:
        'Keep filled-face, real-hole, and exterior classification based on shared face occupancy and winding-rule evidence; do not restore contour-area or per-sampled-edge product domains.'
    },
    'resolve-source-families': {
      status: 'aligned',
      currentImplementation:
        'resolveSourceFamily now exposes runtime support separately from figmaParity and getFigmaStrokeFamilyMatrix lists the full open/simple/compound/self-intersecting, solid/dashed, center/inside/outside matrix. The Step 13 support classification matrix has no unverified-reference entries, but downstream product parity is not complete: self-intersecting solid inside/outside has current Step 17/20/24/25 solidMaskModel evidence for encoded self-check/vector-6 cases and remains active for broader Step 30 visual review.',
      requiredAdjustment:
        'Proceed to Step 14. ResolveStrokeDomains must now prove every Step 13 classified family has an explicit domain plan before downstream intervals/candidates can claim completion.'
    },
    'resolve-stroke-domains': {
      status: 'aligned',
      currentImplementation:
        'resolveStrokeDomains consumes Step 12 strokeBoundaryDomains as sharedDomainEvidence. Inside self-intersecting solid/dashed evidence includes outer and filled-face internal boundary domains, including the central filled star face; outside evidence includes only filled-to-exterior boundaries. This step emits mask/domain/provenance evidence, not solid product geometry.',
      requiredAdjustment:
        'Keep inside/outside domain eligibility tied to shared boundary-domain occupancy, not selectedSide-only metadata, visible fill paint, or source-path orientation.'
    },
    'allocate-intervals': {
      status: 'aligned',
      currentImplementation:
        'allocateStrokeIntervalsForDomainPlan allocates on selected boundary-domain geometry and preserves terminal half-dash metadata, redistributed middle gaps, boundary points, boundary distance fields, selected side, and boundaryRole through VisibleDashedTopologyInterval.',
      requiredAdjustment:
        'Keep every selected boundary split segment independent and never allocate self-intersecting inside/outside dashed intervals on per-sampled micro-edges or one cumulative authored source path.'
    },
    'build-source-span-graph': {
      status: 'aligned',
      currentImplementation:
        'buildSourceSpanGraph covers vertex, dash-boundary, and flattened self-intersection spans, while getSourceSpanIdsForDomainInterval resolves current interval provenance. Boundary-domain provenance now rides interval/debug metadata through packets and projections.',
      requiredAdjustment:
        'Keep source spans as provenance evidence only; do not use sourceContourIds or packet order as dashed correctness proof.'
    },
    'build-one-sided-candidates': {
      status: 'aligned-for-current-solid-mask-model-slice',
      currentImplementation:
        'Candidate flow is aligned for the current self-intersecting constrained solid slice: solidMaskModel candidates use doubled source center-stroke geometry plus mask/provenance evidence, not selected boundary-domain product ribbons. The current implementation also hardens solid source-span provenance to authored source segments and source vertices instead of sampled topology points. The rejected segment-piece/body rewrite must stay out of product code unless a bounded-cost design and failing tests are added. The 2026-05-24 dashed repair remains valid for dashIntervalModel: it removed visible boundary-terminal-join product output, sourceBoundaryJoinCount provenance, the stale outside-butt terminal body-shortening branch, and the invalid post-packet union of adjacent terminal half-dash packets. Source-vertex-join is typed authored-source-vertex dashed coverage only for adjacent visible outside terminal half-dashes on the same legal boundary at a sharp or tangent-discontinuous authored source vertex. Smooth/tangent-continuous high-curvature dashed anchors arrive here as one pre-candidate smooth-source-continuity interval with same outside legal coverage, so dashed candidate generation creates one continuous exterior interval rather than stitching two terminal bodies.',
      requiredAdjustment:
        'Keep solidMaskModel separate from dashIntervalModel: solid must preserve source-vertex joins/miter before mask clipping and must not carry dashed terminal/cap metadata. Keep dashed butt as the base terminal geometry and square/round as additive caps. Join type may affect only typed dashed source-vertex-join coverage at authored sharp or tangent-discontinuous source vertices with adjacent visible outside terminal half-dashes on the same legal boundary. Smooth/tangent-continuous high-curvature dashed anchors are offset-curve continuity, not join geometry, and must be represented before candidate generation as one same-coverage interval. Do not reintroduce post-packet smooth-continuity merging, orientation fallback, visible-fill fallback, selectedSide-only proof, renderer repair, per-sampled-edge domains, terminal body shortening, boundary-terminal-join product packets, or the rejected unbounded segment-piece/body solid rewrite.'
    },
    'partition-arrangement-faces': {
      status: 'aligned-for-encoded-terminal-cap-gates',
      currentImplementation:
        'Arrangement and visual-overlap collapse are revalidated for the encoded dashed terminal/cap gates: independent interval faces are not merged into cross-interval arranged FinalFaces, boundary-terminal-join geometry is not a product input unit, and same-interval coverage can still be arranged when dashed terminal provenance remains probeable.',
      requiredAdjustment:
        'Preserve probeable dashed terminal/cap geometry and metadata without using boundary-terminal-join product packets, sourceContourIds, or cross-interval grouping as dashed correctness proof. Solid arranged faces must preserve solidMaskModel mask provenance and must not gain dashed terminal/cap metadata.'
    },
    'resolve-ownership': {
      status: 'aligned-for-encoded-terminal-cap-gates',
      currentImplementation:
        'resolveStrokeOwnership centralizes typed ownerSet resolution; packets, arrangement claims, and FinalFace records preserve multi-owner information without parsing geometry ids.',
      requiredAdjustment:
        'Proceed to ApplyLegality. Preserve ownerSet through legality clipping/filtering without constructing replacement ownership from ids or packet order.'
    },
    'apply-legality': {
      status: 'aligned-for-encoded-solid-mask-visible-render',
      currentImplementation:
        'Legality is aligned for the current self-intersecting constrained solid packet/provenance and visible-render slice: exact-boolean coverage is retained as the outside solid coverage oracle, while visible render is projected through masked-source-stroke metadata so bridge/cut seam polygons are not painted for the encoded self-check star. Existing dashed gates still prove central filled-face dashed geometry is preserved, outside filled-filled internal adjacency is excluded for dashed intervals, outside high-curvature dashed clipping removes near-zero-edge sliver residue, and original vector-6 tp16 outside dashed clipping preserves collapsed smooth-continuity exterior contour chords from the original dash coverage boundary without replacement geometry, overlap repair, or renderer repair.',
      requiredAdjustment:
        'Keep solid mask clipping bounded and model-tagged without rebuilding boundary ribbons. Preserve exact coverage as solidMaskModelCoverageOracle for hit/export/diagnostics, but emit or preserve solidMaskModelVisibleRender: masked-source-stroke with solidMaskModelMaskSide for visible render. Keep dashed legality as a filter/clip stage over Step 17 interval candidates and preserve boundary-domain provenance through clipping.'
    },
    'build-resolved-stroke-regions': {
      status: 'aligned-for-encoded-terminal-cap-gates',
      currentImplementation:
        'StrokeRegionPacket is the exported paint-free semantic geometry contract. Current gates prove resolved-packet and FinalFace bridges preserve geometry, bounds, sourceGeometryIds, ownerSet, interval/source-span/contour/legal-domain metadata, arrangement metadata, split-range terminal/side-resolution metadata, and non-paint revision keys while excluding paint payload and paintRevision.',
      requiredAdjustment:
        'Proceed to AttachPaintPayload. Paint must attach after this semantic geometry boundary without changing geometry, provenance, or dirty-stage ownership.'
    },
    'attach-paint-payload': {
      status: 'aligned-for-encoded-terminal-cap-gates',
      currentImplementation:
        'attachStrokePaintPayload is the exported paint attachment boundary for paint-free region packets. Current gates prove it adds paintKey, paint payload, declared/default paint bounds, and optional transform without changing polygons, bounds, provenance, arrangement, terminal/side metadata, or non-paint revisions; paint-only dirty keys rerun paint-payload/render-hit-export only.',
      requiredAdjustment:
        'Proceed to FillRegionConsumer. Fill must consume shared geometry while hidden/absent fill paint still leaves implicit region/face legal domains available to stroke side-resolution and legality.'
    },
    'fill-region-consumer': {
      status: 'aligned-for-encoded-terminal-cap-gates',
      currentImplementation:
        'Vector fill uses resolved self-intersecting fillRegions when available, with a direct test proving the render fill cache consumes shared model faces before fallback fill behavior.',
      requiredAdjustment:
        'Keep fallback fill behavior limited to unsupported or missing shared fill region cases.'
    },
    'build-final-faces': {
      status: 'aligned-for-encoded-solid-visible-render-provenance',
      currentImplementation:
        'FinalFace records preserve model-separated provenance for the current solid and dashed slices, including solid visible-render metadata that distinguishes masked-source-stroke render from exact-boolean coverage oracle. Solid records carry solidMaskModel mask/domain/source-span provenance and omit dashed terminal/cap metadata when no dashed terminals exist; dashed records preserve terminal metadata, boundary-domain provenance, selected side, boundaryRole, face/legal-domain ids, and interval ids for the filled-star dashed gates.',
      requiredAdjustment:
        'Preserve region id, face id, boundaryDomainId, interval when present, owner, legal provenance, and explicit solidMaskModel/dashIntervalModel/sharedDomainEvidence model tags for future Figma captures. Add or preserve solidMaskModelVisibleRender, solidMaskModelCoverageOracle, and solidMaskModelMaskSide distinctions when present. Solid records must not carry dashed terminal/cap product metadata; dashed records must not lose terminal metadata during exact-union or arrangement collapse.'
    },
    'emit-render-hit-export-packets': {
      status: 'aligned-for-encoded-solid-visible-render-projection',
      currentImplementation:
        'Render/hit/export emitters project from FinalFace[] and expose model-separated provenance for the current solid and dashed slices. Solid projections expose solidMaskModel mask provenance without dashed terminal/cap metadata, and outside solid render projection is split from exact-boolean hit/export coverage so visible render does not paint bridge/cut seams in the encoded self-check star. Dashed projections still expose terminal metadata plus boundary-domain side/legal-domain provenance for encoded dashed gates.',
      requiredAdjustment:
        'Do not restroke authored input in projection. Keep region/face/boundary metadata available for Step 30 and diagnostics, keep solid/dashed model provenance distinct, and ensure render packets identify masked-source-stroke visible render separately from exact-boolean coverage oracle.'
    },
    'render-entries': {
      status: 'aligned-for-encoded-outside-solid-seam-free-render-entry',
      currentImplementation:
        'Render entries are revalidated for the encoded dashed terminal/cap gates and outside solid seam-free visible-render slice. Constrained dashed product paint uses FinalFace-derived render-projection-arrangement for inside and outside product entries instead of paint-composite/clipPolygons masking, while constrained solid render entries consume upstream masked-source-stroke descriptors and keep exact-boolean coverage out of the visible outside draw path.',
      requiredAdjustment:
        'Keep renderer projection-only and treat future visual mismatches as upstream flow failures. Do not reintroduce render-stage masks or paint-composite masking for constrained dashed product geometry. For solid, consume only upstream masked-source-stroke descriptors for visible render; do not paint exact-boolean bridge/cut seam polygons as the outside solid visual.'
    },
    'mesh-render': {
      status: 'aligned-for-encoded-outside-solid-visible-crack-probes',
      currentImplementation:
        'Renderer draw remains projection-only for current entries and does not decide stroke semantics. Current gates prove renderSolidCenterStrokeEntries consumes upstream masked-source-stroke descriptors for constrained solid without painting exact-boolean bridge/cut seam polygons, and the encoded outside solid tp-13/tp-16 crack probes pass. High-curvature dashed geometry remains fixed upstream of renderer draw.',
      requiredAdjustment:
        'Continue consuming upstream solidMaskModelVisibleRender descriptors for outside solid visible draw. Hit/export must continue to project exact coverage from FinalFace[] and must not infer side/legality from rendered pixels.'
    },
    'hit-export': {
      status: 'aligned-for-encoded-terminal-cap-gates',
      currentImplementation:
        'Hit area and export packets are built from strokeFinalFaces for current slices, with drag visual-only deferral covered. Current gates prove final non-drag hit/export projection preserves FinalFace geometry/provenance, drag/refresh paths keep product visuals fresh, and constrained visual regressions remain stable after overlap partitioning.',
      requiredAdjustment:
        'Proceed to RuntimeDiagnostics. Diagnostics must identify the exact product/debug/blocked branch and remain evidence, not replacement product geometry.'
    },
    'runtime-diagnostics': {
      status: 'aligned-for-encoded-terminal-cap-gates',
      currentImplementation:
        'Runtime diagnostics expose typed branch shape and provenance for current product/debug/blocked paths. Current gates prove constrained dashed and constrained solid diagnostics publish branchId, supportState, blockedReason, owner provenance, legal-domain provenance, and dirty-stage trace without confusing diagnostics with product geometry.',
      requiredAdjustment:
        'Proceed to VisibleFinalResult. Final visual evidence must combine deterministic probes and AI review; diagnostics can localize failures but cannot substitute for visual parity.'
    },
    'visible-final-result': {
      status: 'active-broader-visual-validation',
      currentImplementation:
        'Final visual evidence is active, not complete. Current self-check star and reported vector-6 focused gates are green for the solidMaskModel packet/provenance slice, including inside/outside solid join matrix coverage, no illegal side leakage, no same-paint dark-overdraw above the anti-aliasing threshold, no dashed terminal/cap metadata in solid product output, masked-source-stroke render metadata, and deterministic outside solid high-curvature crack probes at tp-13/tp-16. Existing evidence remains valid for the encoded outside dashed butt/square/round cap, dashed terminal/cap, and dashed high-curvature smoothness slices only. The full constrained dashed packet suite now has deterministic single-worker coverage, including the split long-range stress cases. Step 30 still needs broader global/local visual review before the full stroke engine can be called complete.',
      requiredAdjustment:
        'Keep dashed gates intact while broadening solid-specific global screenshots, local zoom crops, deterministic mask/miter/crack probes, reload performance evidence, and packet/FinalFace/render-entry checks. Any rough high-curvature body, exact-boolean bridge/cut seam, illegal side crossing, overlap sliver, cap/join contradiction, or full-suite dashed regression must reopen the earliest candidate/legality owner and rerun packet, FinalFace, render-entry, rebuilt-preset E2E, and screenshot review before status changes.'
    }
  }

  window.STROKE_FLOW_INSPECTOR_DATA = {
    groups,
    lanes,
    latestRules,
    currentExecutionState,
    figmaLikeRulesByStep,
    alignmentLabels,
    steps,
    edges,
    defaultEvidenceByGroup,
    stepEvidenceOverrides,
    defaultAlignmentByGroup,
    stepAlignmentOverrides,
    helperConditionsByName,
    defaultContextByGroup,
    stepContextOverrides
  }
})()
