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
    'Vector data changes start in feature/input code and must enter state through common APIs, validation, and transaction-bounded mutation.',
    'Render consumes committed state deltas; render code is not the authority for vector data or stroke semantics.',
    'The dirty graph decides which stroke layers rerun: source path, normalized stroke spec, topology, intervals, candidates, arrangement, ownership, legality, resolved regions, paint, and render/hit/export payloads.',
    'Geometry is resolved before paint: fill, stroke, and future shadow attach paint/effects to canonical geometry.',
    'Each vector network revision builds one shared PathTopologyModel and one shared resolved geometry model for fill, stroke, hit-test, export, diagnostics, and future shadow consumers.',
    'Inside/outside closed strokes use direct one-sided geometry or Figma-like boundary-contour geometry; they must not be substituted by widened center stroke clipping.',
    'Open vector paths resolve authored inside/outside stroke positions to center-equivalent product geometry.',
    'Self-intersecting closed inside/outside dashed strokes consume even-odd legal-region boundary contours, including hole boundaries; center stroke stays source-path based.',
    'Typed metadata carries owner, network, contour, legal-domain, interval, source-span, support, blocked, and revision state. No helper may parse geometryId to recover semantics.',
    'FinalFace[] is the canonical source for render, hit-test, and export projection.'
  ]

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
      helpers: [
        'input.drag',
        'pen',
        'selectVectorPoint',
        'FeatureNames.*'
      ],
      inputs: ['pointer / keyboard event', 'current tool', 'feature session state'],
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
      inputs: ['current vector topology', 'point / segment id', 'workspace position', 'mutation options'],
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
      summary:
        'Validate the topology before committing it to runtime state.',
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
        'interval allocation revision',
        'topology classification revision',
        'ownership revision',
        'legality revision',
        'paint revision',
        'preview/exact mode revision'
      ],
      outputs: ['dirty layers', 'stage revision map', 'cache reuse decisions'],
      decisions: [
        'For vector source-data changes, source path, topology, interval, candidate, arrangement, ownership, legality, resolved region, paint, and output layers rerun.',
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
      inputs: ['graphic', 'updated VectorComputedData snapshot', 'dirty metadata'],
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
      inputs: ['points', 'segments', 'networks', 'fills', 'strokes', 'fillRule', 'debug options'],
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
      inputs: ['ordered networks', 'points', 'segments', 'fillRule', 'preview/exact policy'],
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
        'buildSelfIntersectingEvenOddResolvedGeometry'
      ],
      inputs: ['PathTopologyModel per network', 'fillRule'],
      outputs: [
        'ResolvedVectorGeometryModel',
        'fillRegions',
        'strokeBoundaryContours',
        'strokeBoundaryContours.edges',
        'strokeBoundaryContours.dashDomains',
        'source provenance'
      ],
      decisions: [
        'Fill consumes fillRegions.',
        'Self-intersecting inside/outside dashed stroke consumes strokeBoundaryContours and dashDomains.',
        'Future shadow must consume this model rather than rebuilding contours.'
      ],
      next: ['fill-region-consumer', 'resolve-source-families'],
      risks: [
        'Independent fill/stroke contour builders reintroduce multiple geometry truths.'
      ],
      tags: ['truth', 'shared']
    },
    {
      id: 'resolve-source-families',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 4,
      title: '3. ResolveSourceFamilies',
      summary:
        'Classify source family, topology family, and support hints from the topology model.',
      helpers: [
        'classifyPathTopologyModel',
        'classifyCompoundClosedLegalDomains'
      ],
      inputs: ['PathTopologyModel', 'legal-domain descriptors'],
      outputs: ['source family', 'topology family', 'support-family hints'],
      decisions: [
        'Shape origin and topology family are separate.',
        'Open, simple closed, compound, self-intersecting, high-curvature, and multi-network support decisions come from typed topology metadata.',
        'Unsupported or research-gated families must remain explicit.'
      ],
      next: ['allocate-intervals'],
      risks: [
        'A support claim based only on vector/rectangle/oval name can route unsupported geometry as exact.'
      ],
      tags: ['canonical', 'support']
    },
    {
      id: 'allocate-intervals',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 5,
      title: '4. AllocateIntervals',
      summary:
        'Allocate solid or dashed visible intervals on the canonical arc-length topology domain.',
      helpers: [
        'allocateDashedIntervalsForTopology',
        'allocateStrokeIntervals'
      ],
      inputs: ['normalized stroke spec', 'PathTopologyModel.totalLength', 'PathTopologyModel.closed'],
      outputs: ['StrokeIntervalRecord[]', 'solid full-coverage interval'],
      decisions: [
        'Dash semantics are interval geometry, not paint or shader repair.',
        'The same exact topology revision yields the same committed interval schedule.',
        'Self-intersecting boundary-contour dash domains allocate independently where the product branch requires it.'
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
      row: 6,
      title: 'SourceSpanGraph',
      summary:
        'Split source topology into source spans before candidate and ownership processing.',
      helpers: ['buildSourceSpanGraph', 'getSourceSpanIdsForInterval'],
      inputs: ['PathTopologyModel', 'StrokeIntervalRecord[]'],
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
      row: 7,
      title: '5. BuildOneSidedCandidates',
      summary:
        'Build selected-side candidate stroke faces from topology, intervals, and normalized stroke spec.',
      helpers: [
        'buildOneSidedSegmentFaces',
        'buildOneSidedJoinFaces',
        'buildOneSidedCapFaces',
        'buildConstrainedSolidStrokeResolvedPackets',
        'buildConstrainedDashedStrokeResolvedPackets',
        'buildSelfIntersectingEvenOddFaceBoundaryDashedPackets'
      ],
      inputs: ['PathTopologyModel', 'interval records', 'sourceSpanIds', 'normalized stroke spec', 'shared boundary contours'],
      outputs: ['StrokeCandidateFace[]', 'candidate packets', 'candidate runtime metadata'],
      decisions: [
        'Inside builds inward geometry only; outside builds outward geometry only; center builds symmetric center geometry only.',
        'Closed constrained inside/outside stroke must not use doubled-width center-band clipping as product geometry.',
        'Open authored inside/outside vector strokes resolve to center-equivalent geometry before constrained candidate construction.',
        'Self-intersecting inside/outside dashed product geometry is built from even-odd legal-region boundary contours, including hole boundaries.'
      ],
      next: ['partition-arrangement-faces'],
      risks: [
        'Wrong-side or ghost-band output usually originates here, not in paint or render.'
      ],
      tags: ['canonical', 'candidate']
    },
    {
      id: 'partition-arrangement-faces',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 8,
      title: '6. PartitionArrangementAndFaces',
      summary:
        'Partition overlapping candidate faces when self-overlap, self-intersection, or multi-owner regions require face-level truth.',
      helpers: [
        'GeometryBackendRegistry',
        'GeometryBackend.buildArrangement',
        'buildArrangedStrokeFinalFacesFromResolvedPackets',
        'promoteConstrainedDashedPacketsToExactArrangement',
        'promoteConstrainedSolidPacketsToExactArrangement'
      ],
      inputs: ['candidate faces', 'topology/intersection metadata', 'geometry backend'],
      outputs: ['PartitionedFaceRegion[]', 'arrangement metadata', 'promoted exact faces when supported'],
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
      row: 9,
      title: '7. ResolveOwnership',
      summary:
        'Attach typed owner truth to partitioned face regions.',
      helpers: ['resolveStrokeOwnership', 'stroke-candidate-arrangement owner claims'],
      inputs: ['partitioned faces', 'typed owner metadata', 'networkId', 'strokeId', 'intervalId', 'sourceSpanIds'],
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
      row: 10,
      title: '8. ApplyLegality',
      summary:
        'Filter or clip ownership-classified candidate faces against legal-domain and support policies.',
      helpers: [
        'buildConstrainedSolidLegalityClippingResult',
        'clipInsideSourcePathPolygonsToEvenOddLegalDomain',
        'buildCompoundLegalDomainNormalization'
      ],
      inputs: ['ownership-classified faces', 'legal domains', 'legality policy', 'support state'],
      outputs: ['legal visible face regions', 'legality diagnostics', 'blocked diagnostics'],
      decisions: [
        'Legality acts on candidate one-sided faces only.',
        'Legality may remove or clip invalid area, but it cannot repair a wrong geometry model.',
        'Compound paths evaluate legal domains from explicit shell/hole metadata or backend-normalized regions.'
      ],
      next: ['build-resolved-stroke-regions'],
      risks: [
        'If legality invents replacement geometry, render/hit/export parity no longer traces to canonical candidates.'
      ],
      tags: ['canonical', 'legality']
    },
    {
      id: 'build-resolved-stroke-regions',
      group: 'Stroke Pipeline',
      lane: 3,
      row: 11,
      title: '9. BuildResolvedStrokeRegions',
      summary:
        'Build semantic stroke packets from legal visible face regions before paint is attached.',
      helpers: [
        'StrokeRegionPacket builders',
        'attachStrokePacketDebugMeta'
      ],
      inputs: ['legal visible face regions', 'topology/support metadata', 'revision set'],
      outputs: ['StrokeRegionPacket[] without final paint projection'],
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
      row: 12,
      title: '10. AttachPaintPayload',
      summary:
        'Attach normalized stroke paint to resolved stroke regions.',
      helpers: ['attachStrokePaintPayload', 'paint payload normalization'],
      inputs: ['StrokeRegionPacket[]', 'normalized paint payload', 'region bounds', 'paint space / transform'],
      outputs: ['paint-attached stroke region packets'],
      decisions: [
        'Paint uses region bounds or declared paint space.',
        'Paint never changes region geometry.'
      ],
      next: ['build-final-faces'],
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
      decisions: [
        'Fill is a consumer of shared geometry, not a competing contour authority.',
        'Fill is useful visual evidence for legal-region interpretation.'
      ],
      next: ['render-entries'],
      risks: [
        'If fill and stroke disagree on self-intersection regions, inspect the shared model first.'
      ],
      tags: ['fill', 'shared']
    },
    {
      id: 'build-final-faces',
      group: 'Final Faces',
      lane: 6,
      row: 12,
      title: '11. BuildFinalFaces',
      summary:
        'Convert paint-attached semantic regions and promoted exact arrangement faces into canonical FinalFace records.',
      helpers: [
        'buildSolidCenterStrokeFinalFaces',
        'stroke-final-face',
        'collapseExactDuplicateFinalFaces',
        'buildArrangedStrokeFinalFacesFromResolvedPackets'
      ],
      inputs: ['paint-attached region packets', 'promoted exact arrangement faces', 'visual context'],
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
      row: 13,
      title: '12. EmitRenderHitExportPackets',
      summary:
        'Project render, hit-test, export, and diagnostics payloads from the same FinalFace[] source.',
      helpers: [
        'toSolidCenterStrokeRenderEntriesFromFinalFaces',
        'createSolidCenterStrokeHitAreaFromFinalFaces',
        'applySolidCenterStrokeExportPacketsFromFinalFaces'
      ],
      inputs: ['strokeFinalFaces', 'fill faces', 'render/debug mode'],
      outputs: ['render packets', 'hit packets', 'export packets', 'diagnostic payloads'],
      decisions: [
        'Specialization is payload-level, not geometry-level.',
        'Hit-test and export must not restroke authored input.',
        'Blocked constrained requests keep typed diagnostics and do not pretend geometry exists.'
      ],
      next: ['render-entries', 'hit-export'],
      risks: [
        'If any output path consumes a different geometry source, render/hit/export parity is broken.'
      ],
      tags: ['canonical', 'emit']
    },
    {
      id: 'render-entries',
      group: 'Render',
      lane: 7,
      row: 13,
      title: 'Render entries',
      summary:
        'Convert final-face render packets into renderer-specific draw entries.',
      helpers: [
        'toSolidCenterStrokeRenderEntriesFromFinalFaces',
        'drawNativeCenterSolidStrokePath',
        'renderable-stroke'
      ],
      inputs: ['render packets', 'strokeFinalFaces', 'fill faces'],
      outputs: ['renderer-specific stroke entries', 'native center-stroke draw commands'],
      decisions: [
        'Native center solid may use renderer stroke where it preserves product semantics.',
        'Constrained and final-face product geometry must draw from final-face projections.'
      ],
      next: ['mesh-render'],
      risks: [
        'Render entries must not reinterpret inside/outside, ownership, legality, or support state.'
      ],
      tags: ['render']
    },
    {
      id: 'mesh-render',
      group: 'Render',
      lane: 7,
      row: 14,
      title: 'Renderer draw',
      summary:
        'Draw final fill and stroke entries to the graphics engine.',
      helpers: ['renderSolidCenterStrokeEntries', 'Pixi render loop'],
      inputs: ['graphic', 'fill faces', 'stroke render entries'],
      outputs: ['visible product stroke/fill result'],
      decisions: [
        'Geometry correctness decisions are complete before this step.',
        'The renderer faithfully draws final product geometry and may expose debug raw fragments only under explicit debug mode.'
      ],
      next: ['visible-final-result'],
      risks: [
        'If the screenshot is wrong, trace backward through render entries, final faces, regions, legality, ownership, arrangement, candidates, intervals, and topology.'
      ],
      tags: ['render', 'visible']
    },
    {
      id: 'hit-export',
      group: 'Diagnostics',
      lane: 8,
      row: 13,
      title: 'Hit-test / export projection',
      summary:
        'Update hit-test and export data from the same FinalFace[] source used by render.',
      helpers: [
        'applyVectorHoverHitArea',
        'createSolidCenterStrokeHitAreaFromFinalFaces',
        'applySolidCenterStrokeExportPacketsFromFinalFaces'
      ],
      inputs: ['strokeFinalFaces', 'fill faces', 'points / segments / networks'],
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
      row: 14,
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
      inputs: ['stage diagnostics', 'runtime status', 'owner metadata', 'dirty keys', 'performance counters'],
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
      row: 15,
      title: 'Visible final result',
      summary:
        'The user sees the final render result produced from committed vector data and canonical stroke geometry.',
      helpers: ['Pixi render loop', 'browser visual checks'],
      inputs: ['filled graphic', 'stroke render entries', 'renderer frame'],
      outputs: ['final product visual'],
      decisions: [
        'Supported families must show render / hit-test / export parity.',
        'Unsupported or gated families must remain explicit through typed diagnostics.'
      ],
      next: [],
      risks: [
        'Screenshot-visible failures should be localized by changed parameter family and dirty-stage trace, not by guessing.'
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
    ['resolve-source-families', 'allocate-intervals'],
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
        'Confirm fillRegions and strokeBoundaryContours come from the same source revision.',
        'For self-intersecting dashed inside/outside, confirm outer and hole boundary contours both exist.'
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
        'Confirm self-intersecting inside/outside dashed paths use strokeBoundaryContours.dashDomains.'
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
      'Implemented through feature-system sessions and app feature files.',
      'Risk remains if future vector-editing features bypass FeatureNames/common APIs and write state directly.'
    ],
    'vector-api-mutation': [
      'Implemented through elementApis vector APIs and vectorGeometry topology helpers.',
      'Risk remains around partial topology patches: points, segments, networks, closed, and bounds must stay coherent.'
    ],
    'validate-topology': [
      'Implemented through assertVectorTopologyConsistency and buildVectorComputedPatch validation.',
      'Risk remains because validation is mostly structural; product-level topology support is still decided later.'
    ],
    'transaction-write': [
      'Implemented through changeComputedData start/end transaction wrapping and vector drag commit options.',
      'Risk remains around nested or repeated drag commits accidentally fragmenting undo history.'
    ],
    'data-channel-delta': [
      'Implemented through scene-tree computed-data batch events and preset render data-channel observers.',
      'Risk remains if a change path publishes incomplete batch changes or bypasses scene-tree events.'
    ],
    'render-cache-patch': [
      'Implemented through RenderSceneTree ComputedDataMirror and batch applyComputedChanges.',
      'Risk remains on undoable refresh paths, which intentionally reseed from scene-tree and can hide drift bugs.'
    ],
    'dirty-revision-graph': [
      'Partially implemented through stroke runtime revision sets, dirty keys, render cache entries, and performance counters.',
      'Risk: this is not yet a single upstream scheduler for the full 12-stage pipeline; vector render still rebuilds broad sections before render-entry cache reuse can fast-path them.'
    ],
    'render-strategy-entry': [
      'Implemented in vectorRenderStrategy / renderVectorGraphic.',
      'Risk remains if render strategy gains domain decisions that should belong to topology, legality, or ownership stages.'
    ],
    'normalize-render-data': [
      'Implemented through normalizeVectorRenderData and map normalizers.',
      'Risk remains if render fallback behavior masks invalid runtime writes instead of surfacing validation failures.'
    ],
    'normalize-stroke-spec': [
      'Partially implemented through getRenderableStrokes / renderable-stroke normalization.',
      'Risk: there is no dedicated normalizeStrokeSpec helper with explicit rejection diagnostics for the whole authored stroke list.'
    ],
    'build-path-topology': [
      'Partially implemented: vector render builds and caches one PathTopologyModel per network revision.',
      'Risk: the current schema is still simpler than the final contract; deep legal-domain, contour, and intersection metadata are supplemented by later shared-geometry helpers.'
    ],
    'shared-geometry-model': [
      'Implemented for current vector self-intersection needs through buildResolvedVectorGeometryModel.',
      'Risk remains if future fill, stroke, or shadow code rebuilds its own contour truth instead of consuming this model.'
    ],
    'resolve-source-families': [
      'Partially implemented through classifyPathTopologyModel and distributed support classifiers.',
      'Risk: support-family decisions are still spread across vector.ts and packet helpers rather than one canonical ResolveSourceFamilies output.'
    ],
    'allocate-intervals': [
      'Implemented through allocateDashedIntervalsForTopology and topology totalLength/closed inputs.',
      'Risk remains in specialized contour-domain branches, where domain-specific dash rules must stay consistent with the documented Figma-like semantics.'
    ],
    'build-source-span-graph': [
      'Partially implemented through buildSourceSpanGraph and sourceSpanIds metadata.',
      'Risk: it is skipped in visualOnly / omitDiagnosticMetadata paths, so provenance coverage is not universal across every render path.'
    ],
    'build-one-sided-candidates': [
      'Partially implemented across constrained solid, constrained dashed, local-side, and self-intersecting contour helpers.',
      'Risk: because candidate construction is split across many helper branches, future changes can accidentally reintroduce center-band substitutes or legacy sourcePath semantics.'
    ],
    'partition-arrangement-faces': [
      'Partially implemented through GeometryBackend, Clipper2 adapter, and stroke-candidate-arrangement promotion.',
      'Risk: exact promotion is deliberately gated for some local-side/high-curvature families; treating backend availability alone as exact support is unsafe.'
    ],
    'resolve-ownership': [
      'Partially implemented through typed packet metadata, ownerSet, arrangement claims, and diagnostics.',
      'Risk: ownership is not yet a single isolated stage, so packet builders must continue preserving ownerKey/networkId/interval/source-span metadata consistently.'
    ],
    'apply-legality': [
      'Partially implemented through constrained solid legality clipping, compound legal-domain normalization, and dashed legal-domain handling.',
      'Risk: legality is still family-specific; it must filter/clip candidates without inventing replacement geometry.'
    ],
    'build-resolved-stroke-regions': [
      'Partially implemented through SolidCenterStrokeResolvedPacket-style semantic packets and typed debugMeta.',
      'Risk: packets are not a pure paint-free StrokeRegionPacket layer yet; some geometry, paint, and metadata concerns are still coupled in packet builders.'
    ],
    'attach-paint-payload': [
      'Partially implemented through renderable stroke paint normalization and packet paint fields.',
      'Risk: there is no separate AttachPaintPayload boundary yet, so paint-related edits must be audited to ensure they never alter geometry decisions.'
    ],
    'fill-region-consumer': [
      'Implemented for current self-intersecting fill consumption, with legacy fallback still present.',
      'Risk: fallback fill code must not become a second self-intersection authority when shared fillRegions are available.'
    ],
    'build-final-faces': [
      'Implemented through stroke-final-face, buildSolidCenterStrokeFinalFaces, arranged final faces, and visual overlap collapse.',
      'Risk remains around compatibility packet bridges: owner/interval/source metadata must survive every packet-to-FinalFace conversion.'
    ],
    'emit-render-hit-export-packets': [
      'Implemented through FinalFace[] projections for render entries, hit area, and export packets.',
      'Risk remains in legacy/non-vector compatibility paths that may still project through resolved packets before returning to FinalFace-compatible output.'
    ],
    'render-entries': [
      'Implemented through toSolidCenterStrokeRenderEntriesFromFinalFaces and native center solid paths.',
      'Risk: native center rendering is allowed only for center-equivalent semantics and must not be reused for constrained inside/outside geometry.'
    ],
    'mesh-render': [
      'Implemented through renderSolidCenterStrokeEntries and Pixi drawing.',
      'Risk remains if upstream emits raw overlap/debug fragments as product final faces; renderer will draw them faithfully.'
    ],
    'hit-export': [
      'Implemented through createSolidCenterStrokeHitAreaFromFinalFaces and applySolidCenterStrokeExportPacketsFromFinalFaces.',
      'Risk: drag visual mode may defer hit/export, so tests must distinguish visual freshness from interaction/export freshness.'
    ],
    'runtime-diagnostics': [
      'Partially implemented through constrained dashed/solid runtime, legality, ownership, overlap, and dirty-key diagnostics.',
      'Risk: diagnostics are spread across several branches and can mislead if a debug branch is inspected instead of the product branch.'
    ],
    'visible-final-result': [
      'Implemented as the rendered product output.',
      'Risk: screenshot failures should be traced through dirty-stage evidence instead of patched at render time.'
    ]
  }

  const helperConditionsByName = {
    'input.drag':
      'Requires an active pointer drag session, a resolved target/tool context, and feature permission to translate pointer movement into an edit command.',
    pen:
      'Runs only when the pen/path authoring feature owns the current session; it should emit vector-edit intent, not write render data directly.',
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
      'Requires previous and next render inputs and computes revision keys for source, stroke spec, topology, geometry, paint, and output stages.',
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
      'Requires network paths and fillRule; builds the shared fill/stroke legal geometry model for self-intersecting cases.',
    buildSelfIntersectingGeometry:
      'Requires self-intersecting topology and even-odd rules; returns fill regions and stroke boundary contours.',
    buildSelfIntersectingEvenOddResolvedGeometry:
      'Requires self-intersecting closed geometry and even-odd legal domains; includes outer and hole boundary contours.',
    classifyPathTopologyModel:
      'Requires PathTopologyModel and returns open/simple/compound/self-intersecting topology family without reading geometry ids.',
    classifyCompoundClosedLegalDomains:
      'Requires closed compound topology and legal-domain descriptors; determines inside/outside legal face families.',
    allocateDashedIntervalsForTopology:
      'Requires normalized dash pattern/offset plus topology total length and closed state; emits independent interval domains.',
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
      'Requires dashed interval records, topology/legal-domain metadata, and support state for constrained dashed strokes.',
    buildSelfIntersectingEvenOddFaceBoundaryDashedPackets:
      'Requires self-intersecting boundary contours and per-domain dash intervals, including hole boundaries when legal.',
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
    clipInsideSourcePathPolygonsToEvenOddLegalDomain:
      'Requires inside source-path polygons and even-odd legal domains; clips to legal fill/stroke visibility.',
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
      'Requires resolved fill regions or legacy fallback geometry plus fills/fillRule; outputs fill faces for draw/render evidence.',
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
        'source-of-truth.md#canonical-flow',
        'function-contracts.md#vector-data-change-entry'
      ],
      implementationTrace: [
        'Feature/input layer receives the user action.',
        'Feature code calls app common APIs; render packages are not allowed to own the source mutation.'
      ],
      e2eStatus: [
        'Coverage: indirectly exercised by vector editing and refresh E2E scenarios.',
        'Run status: not executed during this inspector data update.'
      ]
    },
    'State Commit': {
      planReferences: [
        'runtime-data-representation.md#topology-native-vector-data',
        'function-contracts.md#runtime-write-validation',
        'performance-and-dirty-graph.md#data-change-boundary'
      ],
      implementationTrace: [
        'Validated computed-data patches enter scene-tree state.',
        'Scene-tree events publish changed computed-data keys to render subscribers.'
      ],
      e2eStatus: [
        'Coverage: indirectly covered by drag, refresh, and reported vector E2E flows.',
        'Run status: not executed during this inspector data update.'
      ]
    },
    'Render Cache': {
      planReferences: [
        'performance-and-dirty-graph.md#dirty-stage-contract',
        'target-architecture.md#render-cache-boundary'
      ],
      implementationTrace: [
        'Render scene-tree mirror patches cached computed data.',
        'Stroke dirty keys compare previous and next revision inputs before render-entry reuse.'
      ],
      e2eStatus: [
        'Coverage: stroke-drag-render-performance.spec.ts and vector-stroke-refresh.spec.ts target this area.',
        'Run status: not executed during this inspector data update.'
      ]
    },
    'Stroke Pipeline': {
      planReferences: [
        'geometry-pipeline.md#canonical-stroke-pipeline',
        'function-contracts.md#stroke-stage-contracts',
        'parameter-impact-matrix.md#stroke-parameter-impact'
      ],
      implementationTrace: [
        'Render normalizes vector/stroke data, builds topology, then constructs interval/candidate/arrangement/legality products.',
        'Partial steps remain where current code distributes a planned single stage across several helper branches.'
      ],
      e2eStatus: [
        'Coverage: solid/dashed constrained visual E2E specs and reported vector regression specs target this area.',
        'Run status: not executed during this inspector data update.'
      ]
    },
    'Shared Geometry': {
      planReferences: [
        'target-architecture.md#shared-geometry-model',
        'geometry-pipeline.md#resolved-vector-geometry-model'
      ],
      implementationTrace: [
        'Resolved geometry model builds shared fill regions and stroke boundary contours from the same topology revision.',
        'Self-intersecting boundary contours are the planned Figma-like source for inside/outside dashed stroke.'
      ],
      e2eStatus: [
        'Coverage: self-check star, constrained dashed, and reported dashed seam specs exercise this area.',
        'Run status: not executed during this inspector data update.'
      ]
    },
    Fill: {
      planReferences: [
        'geometry-pipeline.md#fill-as-shared-geometry-consumer',
        'source-of-truth.md#fill-stroke-shared-truth'
      ],
      implementationTrace: [
        'Fill consumes shared fillRegions when available and otherwise falls back to legacy fill faces.',
        'Fill must remain a consumer of shared geometry, not a second self-intersection authority.'
      ],
      e2eStatus: [
        'Coverage: vector preview/fill unit tests plus visual stroke specs provide indirect fill evidence.',
        'Run status: not executed during this inspector data update.'
      ]
    },
    'Final Faces': {
      planReferences: [
        'target-architecture.md#final-face-contract',
        'runtime-data-representation.md#final-face-metadata'
      ],
      implementationTrace: [
        'Packet and arrangement products project into FinalFace[] with owner, interval, source-span, contour, legal-domain, and paint keys.',
        'Exact duplicate collapse is allowed only after metadata preservation is verified.'
      ],
      e2eStatus: [
        'Coverage: solid/dashed visual specs and packet/final-face unit tests target this area.',
        'Run status: not executed during this inspector data update.'
      ]
    },
    Render: {
      planReferences: [
        'target-architecture.md#render-hit-export-projection',
        'source-of-truth.md#final-render-source'
      ],
      implementationTrace: [
        'Renderer entries are projections from fill faces and strokeFinalFaces.',
        'Pixi drawing should not choose stroke semantics; it draws upstream final geometry.'
      ],
      e2eStatus: [
        'Coverage: visual E2E specs cover final render output across center, constrained solid, constrained dashed, and regressions.',
        'Run status: not executed during this inspector data update.'
      ]
    },
    Diagnostics: {
      planReferences: [
        'active-support-scope.md#diagnostics',
        'performance-and-dirty-graph.md#runtime-diagnostics'
      ],
      implementationTrace: [
        'Diagnostics consume typed runtime/support/ownership/legality metadata from the branch used by product render.',
        'Debug evidence must not be confused with product visual branches.'
      ],
      e2eStatus: [
        'Coverage: mostly unit-level diagnostics plus indirect E2E visual evidence.',
        'Run status: not executed during this inspector data update.'
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
        'Direct E2E coverage: none dedicated to feature dispatch for this flow.',
        'Indirect E2E coverage: vector-stroke-refresh.spec.ts and stroke-drag-render-performance.spec.ts exercise user-driven vector changes.'
      ]
    },
    'vector-api-mutation': {
      implementationTrace: [
        'elementApis vector methods delegate topology math to vectorGeometry helpers.',
        'Output must include all affected point/segment/network keys needed for a valid computed-data patch.'
      ],
      e2eStatus: [
        'Direct E2E coverage: none dedicated to API mutation contracts.',
        'Unit coverage should be treated as the primary gate for topology patch shape.'
      ]
    },
    'validate-topology': {
      implementationTrace: [
        'assertVectorTopologyConsistency rejects dangling point/segment/network references before commit.',
        'Product support decisions are intentionally deferred to render support classification.'
      ],
      e2eStatus: [
        'Direct E2E coverage: none dedicated to invalid runtime writes.',
        'Expected gate: common-api unit tests or focused topology validation tests.'
      ]
    },
    'transaction-write': {
      implementationTrace: [
        'changeComputedData opens, updates, and closes the transaction boundary around the state mutation.',
        'Drag updates may be transient, but drag-end must close as one intended undo action.'
      ],
      e2eStatus: [
        'Direct E2E coverage: not identified in current stroke E2E list.',
        'Indirect E2E coverage: drag performance scenarios exercise repeated writes, not undo semantics.'
      ]
    },
    'data-channel-delta': {
      implementationTrace: [
        'Scene-tree computed-data update events carry before/after changed keys.',
        'Preset subscriptions forward deltas into renderSceneTreeStore.'
      ],
      e2eStatus: [
        'Direct E2E coverage: vector-stroke-refresh.spec.ts is the closest refresh/delta scenario.',
        'Run status: not executed during this inspector data update.'
      ]
    },
    'render-cache-patch': {
      implementationTrace: [
        'ComputedDataMirror applies per-key changes and recomposes complete render snapshots.',
        'Undoable refresh paths can reseed from scene-tree, which is useful but can mask cache drift.'
      ],
      e2eStatus: [
        'Direct E2E coverage: vector-stroke-refresh.spec.ts.',
        'Performance coverage: stroke-drag-render-performance.spec.ts.'
      ]
    },
    'dirty-revision-graph': {
      implementationTrace: [
        'buildStrokeRuntimeRevisionSet records source/style/topology/paint/output revision inputs.',
        'computeStrokeDirtyKeys classifies dirty work, but full upstream stage skipping is still partial.'
      ],
      e2eStatus: [
        'Direct E2E coverage: stroke-drag-render-performance.spec.ts.',
        'Unit coverage: stroke-dirty-keys.test.ts, stroke-performance-contract.test.ts, stroke-parameter-switch-performance.test.ts.'
      ]
    },
    'render-strategy-entry': {
      implementationTrace: [
        'vectorRenderStrategy passes the graphic and render data into renderVectorGraphic.',
        'It is an orchestration entry and must stay free of topology legality decisions.'
      ],
      e2eStatus: [
        'Indirect E2E coverage: every vector stroke visual E2E enters through this strategy.',
        'Run status: not executed during this inspector data update.'
      ]
    },
    'normalize-render-data': {
      implementationTrace: [
        'Map normalizers convert computed-data records into stable render inputs.',
        'Fallbacks should be render-safe but must not hide invalid runtime mutation bugs.'
      ],
      e2eStatus: [
        'Indirect E2E coverage: all vector stroke visual specs depend on normalized render data.',
        'Unit coverage: vector-component.test.ts and stroke-render-renderable-stroke.test.ts cover related normalization surfaces.'
      ]
    },
    'normalize-stroke-spec': {
      implementationTrace: [
        'Current code normalizes stroke spec through getRenderableStrokes/renderable-stroke.',
        'The planned normalizeStrokeSpec boundary is not a dedicated exported stage yet.'
      ],
      e2eStatus: [
        'Indirect E2E coverage: solid-center, dashed-center, constrained solid, constrained dashed, and reference dashed specs.',
        'Unit coverage: stroke-render-renderable-stroke.test.ts.'
      ]
    },
    'build-path-topology': {
      implementationTrace: [
        'vector.ts builds one PathTopologyModel per network revision using buildVectorGeometryModelPath/buildPathTopologyModel.',
        'The model currently carries core topology facts while deeper legal-domain/intersection facts are supplemented later.'
      ],
      e2eStatus: [
        'Indirect E2E coverage: all constrained visual specs depend on topology classification.',
        'Unit coverage: path-topology-model.test.ts.'
      ]
    },
    'shared-geometry-model': {
      implementationTrace: [
        'buildResolvedVectorGeometryModel produces selfIntersecting fillRegions and strokeBoundaryContours.',
        'This is the shared geometry truth for fill, stroke, and future shadow consumers.'
      ],
      e2eStatus: [
        'Direct visual coverage: stroke-self-check-star-render.spec.ts and reported-vector-6-dashed-inside-seam.spec.ts.',
        'Unit coverage: vector-constrained-dashed-stroke.test.ts.'
      ]
    },
    'resolve-source-families': {
      implementationTrace: [
        'Path topology classification exists, but final support/source-family branching is distributed across render helpers.',
        'Future refactor should produce one auditable family/support decision object.'
      ],
      e2eStatus: [
        'Indirect E2E coverage: solid-constrained-stroke-visual.spec.ts, constrained-dashed-stroke-visual.spec.ts, reported vector specs.',
        'Run status: not executed during this inspector data update.'
      ]
    },
    'allocate-intervals': {
      implementationTrace: [
        'Dashed intervals use topology totalLength/closed state and normalized dash spec.',
        'Self-intersecting contour domains must own dash distribution independently.'
      ],
      e2eStatus: [
        'Direct visual coverage: dashed-center-stroke-visual.spec.ts, constrained-dashed-stroke-visual.spec.ts, reference-dashed-stroke-rendering.spec.ts.',
        'Unit coverage: dashed-center-stroke-intervals.test.ts and stroke-interval-frames.test.ts.'
      ]
    },
    'build-source-span-graph': {
      implementationTrace: [
        'SourceSpanGraph records provenance across authored vertices, dash intervals, and flattened intersections.',
        'Provenance can be omitted in visualOnly/omitDiagnosticMetadata paths, so coverage is partial.'
      ],
      e2eStatus: [
        'Direct E2E coverage: none for source-span metadata.',
        'Unit coverage: source-span-graph.test.ts and packet tests that assert sourceSpanIds.'
      ]
    },
    'build-one-sided-candidates': {
      implementationTrace: [
        'Closed constrained inside/outside branches build one-sided candidate geometry.',
        'Open authored inside/outside branches resolve to center-equivalent product geometry.',
        'Self-intersecting dashed branches consume boundary contour domains.'
      ],
      e2eStatus: [
        'Direct visual coverage: solid-constrained-stroke-visual.spec.ts, constrained-dashed-stroke-visual.spec.ts, reported-vector-6-solid-visual.spec.ts, reported-vector-6-dashed-inside-seam.spec.ts.',
        'Run status: not executed during this inspector data update.'
      ]
    },
    'partition-arrangement-faces': {
      implementationTrace: [
        'GeometryBackend/Clipper2 arrangement promotes supported packets into exact partitioned faces.',
        'Unsupported local-side/high-curvature cases must remain approximate/diagnostic rather than silently exact.'
      ],
      e2eStatus: [
        'Visual coverage: constrained dashed/solid visual specs exercise arrangement output.',
        'Unit coverage: stroke-candidate-arrangement.test.ts and constrained packet tests.'
      ]
    },
    'resolve-ownership': {
      implementationTrace: [
        'Owner metadata travels through packet debug metadata, arrangement claimedBy groups, ownerSet, and FinalFace records.',
        'No helper should parse geometryId or rely on packet order for ownership.'
      ],
      e2eStatus: [
        'Direct E2E coverage: none dedicated to ownership metadata.',
        'Unit/diagnostic coverage should be the primary gate for ownerSet preservation.'
      ]
    },
    'apply-legality': {
      implementationTrace: [
        'Legal-domain clipping/filtering is implemented per supported family.',
        'Legality must remove or clip candidate geometry, not invent replacement center-band geometry.'
      ],
      e2eStatus: [
        'Visual coverage: solid-constrained-stroke-visual.spec.ts and constrained-dashed-stroke-visual.spec.ts.',
        'Unit coverage: constrained-solid-stroke-geometry.test.ts and constrained packet tests.'
      ]
    },
    'build-resolved-stroke-regions': {
      implementationTrace: [
        'Current resolved packets are semantic geometry carriers with typed debug metadata.',
        'The strict paint-free StrokeRegionPacket layer is still partial because packet builders also carry paint payloads.'
      ],
      e2eStatus: [
        'Visual coverage: constrained solid/dashed visual specs.',
        'Unit coverage: constrained-solid-stroke-packets.test.ts and constrained-dashed-stroke-packets.test.ts.'
      ]
    },
    'attach-paint-payload': {
      implementationTrace: [
        'Paint is currently normalized before/inside packet construction via renderable-stroke and packet paint fields.',
        'The planned dedicated paint attachment boundary is not separate yet.'
      ],
      e2eStatus: [
        'Indirect E2E coverage: visual specs cover paint-visible output.',
        'Gap: no dedicated E2E proving paint-only edits skip geometry stages.'
      ]
    },
    'fill-region-consumer': {
      implementationTrace: [
        'Fill consumes shared fillRegions for self-intersecting geometry when present.',
        'Legacy fill fallback remains only for unsupported/no-shared-model cases.'
      ],
      e2eStatus: [
        'Indirect E2E coverage: stroke-self-check-star-render.spec.ts and visual stroke specs.',
        'Unit coverage: vector-preview-fill.test.ts.'
      ]
    },
    'build-final-faces': {
      implementationTrace: [
        'stroke-final-face converts raw/arranged packets into FinalFace[] records.',
        'FinalFace[] is the canonical product source for render, hit-test, and export projection.'
      ],
      e2eStatus: [
        'Visual coverage: solid-center, constrained solid, constrained dashed, and reported vector E2E specs.',
        'Unit coverage: solid-center-stroke-render.test.ts and constrained packet tests.'
      ]
    },
    'emit-render-hit-export-packets': {
      implementationTrace: [
        'Render entries, hit area, and export packets are projected from strokeFinalFaces.',
        'Drag visual mode may skip/defer hit/export freshness while preserving visual responsiveness.'
      ],
      e2eStatus: [
        'Visual coverage: visual E2E specs cover render output; hit/export coverage is mostly indirect.',
        'Gap: no dedicated E2E asserting export parity from FinalFace[].'
      ]
    },
    'render-entries': {
      implementationTrace: [
        'FinalFace[] converts to renderer-specific entries through toSolidCenterStrokeRenderEntriesFromFinalFaces.',
        'Native center solid draw remains a separate allowed path for center-equivalent semantics only.'
      ],
      e2eStatus: [
        'Visual coverage: solid-center-stroke-visual.spec.ts, dashed-center-stroke-visual.spec.ts, solid-constrained-stroke-visual.spec.ts, constrained-dashed-stroke-visual.spec.ts.',
        'Run status: not executed during this inspector data update.'
      ]
    },
    'mesh-render': {
      implementationTrace: [
        'Pixi draw/cache paths render the entries exactly as upstream geometry requested.',
        'Renderer should not collapse, clip, or restroke geometry to repair earlier stages.'
      ],
      e2eStatus: [
        'Direct visual coverage: all stroke visual E2E specs.',
        'Run status: not executed during this inspector data update.'
      ]
    },
    'hit-export': {
      implementationTrace: [
        'Hit area and export packet generation use strokeFinalFaces in the non-drag path.',
        'Hover hit area is a consumer of final geometry or an explicit fallback.'
      ],
      e2eStatus: [
        'Direct E2E coverage: not identified for export parity.',
        'Indirect coverage: visual and refresh specs exercise hit/render path freshness only partially.'
      ]
    },
    'runtime-diagnostics': {
      implementationTrace: [
        'Diagnostics are set by constrained dashed, constrained solid, legality, ownership, overlap, and dirty-key helpers.',
        'Because diagnostics are distributed, branch identity must be inspected before trusting evidence.'
      ],
      e2eStatus: [
        'Direct E2E coverage: none dedicated to diagnostics panels/state.',
        'Unit coverage: constrained runtime diagnostics and dirty-key tests.'
      ]
    },
    'visible-final-result': {
      implementationTrace: [
        'Browser/Pixi output is the last consumer of fill faces and stroke render entries.',
        'Visual failures should be traced backward through FinalFace, packet, legality, arrangement, candidate, interval, topology, and state stages.'
      ],
      e2eStatus: [
        'Direct visual coverage: solid-center-stroke-visual.spec.ts, dashed-center-stroke-visual.spec.ts, solid-constrained-stroke-visual.spec.ts, constrained-dashed-stroke-visual.spec.ts, reference dashed specs, reported vector specs.',
        'Run status: not executed during this inspector data update.'
      ]
    }
  }

  steps.forEach((step) => {
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
      const condition = helperConditionsByName[helper] ?? 'Condition review required before relying on this helper in the flow.'
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
        'elementApis vector methods call vectorGeometry topology helpers for add, move, split, connect, close, handle mode, and handle position updates.',
      requiredAdjustment:
        'Keep topology-native points / segments / networks as the only runtime vector model.'
    },
    'validate-topology': {
      status: 'aligned',
      currentImplementation:
        'vectorGeometry.validate maps to assertVectorTopologyConsistency, and buildVectorComputedPatch validates topology before producing computed data.',
      requiredAdjustment:
        'Add product-support validation only as separate support classification, not as write-time structural validation.'
    },
    'transaction-write': {
      status: 'aligned',
      currentImplementation:
        'changeComputedData wraps core.changeComputedData in startTransaction/endTransaction; vector drag options preserve transient and final commit behavior.',
      requiredAdjustment:
        'Keep drag-end commits as the intended undo boundary.'
    },
    'data-channel-delta': {
      status: 'aligned',
      currentImplementation:
        'Scene-tree computed-data update and batch events feed preset data-channel observers, which route updates into renderSceneTreeStore.',
      requiredAdjustment:
        'Keep render updates subscribed to committed scene-tree events only.'
    },
    'render-cache-patch': {
      status: 'aligned',
      currentImplementation:
        'RenderSceneTree ComputedDataMirror patches cached computed snapshots with per-key or batch changes and composes complete RenderElementData on flush.',
      requiredAdjustment:
        'Keep undoable reseed behavior explicit and covered by cache-drift tests.'
    },
    'dirty-revision-graph': {
      status: 'partial',
      currentImplementation:
        'buildStrokeRuntimeRevisionSet and computeStrokeDirtyKeys exist and render entries store last dirty keys, but vector rendering still computes many upstream products before cache reuse.',
      requiredAdjustment:
        'Promote dirty-stage decisions earlier if the goal is full stage-level avoidance rather than render-entry cache reuse.'
    },
    'render-strategy-entry': {
      status: 'aligned',
      currentImplementation:
        'vectorRenderStrategy delegates into renderVectorGraphic with normalized component render data.',
      requiredAdjustment:
        'Keep strategy code as orchestration over shared helpers.'
    },
    'normalize-render-data': {
      status: 'aligned',
      currentImplementation:
        'normalizeVectorRenderData and map normalizers produce stable vector render inputs before geometry construction.',
      requiredAdjustment:
        'Do not treat render normalization as runtime mutation validation.'
    },
    'normalize-stroke-spec': {
      status: 'partial',
      currentImplementation:
        'getRenderableStrokes normalizes authored strokes, dash patterns, dash offsets, miter limits, caps, joins, opacity, solid paint, and gradient paint.',
      requiredAdjustment:
        'Extract or document a canonical normalizeStrokeSpec boundary if explicit rejection diagnostics are required.'
    },
    'build-path-topology': {
      status: 'partial',
      currentImplementation:
        'vector.ts builds and caches one PathTopologyModel per network revision, including fillRule, arc-length basis, simple/open/self-intersecting classification, contours, and legal domain stubs.',
      requiredAdjustment:
        'Continue expanding PathTopologyModel toward the full final schema rather than relying on later helpers for missing topology facts.'
    },
    'shared-geometry-model': {
      status: 'aligned',
      currentImplementation:
        'buildResolvedVectorGeometryModel builds self-intersecting fillRegions, legalFaceBoundaries, and strokeBoundaryContours from the shared path/topology input.',
      requiredAdjustment:
        'Keep fill, stroke, and future shadow consumers reading this model.'
    },
    'resolve-source-families': {
      status: 'partial',
      currentImplementation:
        'Topology classification exists, but support-family decisions are distributed across vector.ts, constrained solid/dashed helpers, runtime classifiers, and active support gates.',
      requiredAdjustment:
        'Consolidate source/topology/support classification if future work needs one auditable ResolveSourceFamilies stage.'
    },
    'allocate-intervals': {
      status: 'aligned',
      currentImplementation:
        'Constrained and center dashed paths allocate intervals from topology totalLength/closed through allocateDashedIntervalsForTopology.',
      requiredAdjustment:
        'Keep sourcePath-specific interval behavior limited to documented contour/domain exceptions.'
    },
    'build-source-span-graph': {
      status: 'partial',
      currentImplementation:
        'buildSourceSpanGraph splits spans by vertices, dash boundaries, and flattened self-intersections, and packet metadata carries sourceSpanIds where diagnostics are not omitted.',
      requiredAdjustment:
        'Make provenance availability explicit for visualOnly and omitDiagnosticMetadata paths.'
    },
    'build-one-sided-candidates': {
      status: 'partial',
      currentImplementation:
        'Constrained solid, constrained dashed, source-path interval-local, local-side, and self-intersecting boundary-contour helpers build the current candidate geometry families.',
      requiredAdjustment:
        'Keep branch guards strict so open paths map to center, closed constrained paths stay one-sided, and self-intersecting dashed paths use boundary contours.'
    },
    'partition-arrangement-faces': {
      status: 'partial',
      currentImplementation:
        'GeometryBackendRegistry, Clipper2 backend, buildArrangement, exact promotion, and visual overlap collapse are implemented for supported/gated slices.',
      requiredAdjustment:
        'Do not promote local-side/high-curvature families to exact merely because a backend is selected.'
    },
    'resolve-ownership': {
      status: 'partial',
      currentImplementation:
        'Owner metadata is typed on packets and FinalFace records; arrangement claimedBy groups and ownerSet preserve multi-owner information.',
      requiredAdjustment:
        'Keep removing any remaining owner recovery from ids or packet ordering.'
    },
    'apply-legality': {
      status: 'partial',
      currentImplementation:
        'Legality clipping and legal-domain normalization exist for constrained solid, compound, and dashed support slices, but remain family-specific.',
      requiredAdjustment:
        'Keep legality clipping as filtering of candidate geometry, not as replacement geometry construction.'
    },
    'build-resolved-stroke-regions': {
      status: 'partial',
      currentImplementation:
        'Resolved packet builders emit semantic geometry with typed debug metadata, but packet objects still combine geometry and paint payloads.',
      requiredAdjustment:
        'Separate semantic geometry packets from paint payload more clearly if the plan requires a strict paint-free region layer.'
    },
    'attach-paint-payload': {
      status: 'partial',
      currentImplementation:
        'Paint is normalized in renderable-stroke and attached through packet paint fields rather than through a dedicated AttachPaintPayload stage.',
      requiredAdjustment:
        'Introduce a dedicated paint attachment boundary or keep tests proving paint-only edits do not rerun geometry decisions.'
    },
    'fill-region-consumer': {
      status: 'aligned',
      currentImplementation:
        'Vector fill uses resolved self-intersecting fillRegions when available and falls back to legacy fill faces otherwise.',
      requiredAdjustment:
        'Prevent legacy fill fallback from overriding shared self-intersection geometry.'
    },
    'build-final-faces': {
      status: 'aligned',
      currentImplementation:
        'stroke-final-face builds FinalFace records with visualPacketKey, paintKey, strokeSpecKey, ownerSet, interval/source/legal metadata, and exact duplicate collapse support.',
      requiredAdjustment:
        'Keep compatibility packet bridges lossless for metadata.'
    },
    'emit-render-hit-export-packets': {
      status: 'aligned',
      currentImplementation:
        'Vector runtime builds strokeFinalFaces and uses them for render entries, hit area creation, and export packet application.',
      requiredAdjustment:
        'Keep all new render/hit/export emitters projecting from FinalFace[] rather than authored input.'
    },
    'render-entries': {
      status: 'aligned',
      currentImplementation:
        'toSolidCenterStrokeRenderEntriesFromFinalFaces converts final faces to render entries; native center solid rendering remains separate for allowed center cases.',
      requiredAdjustment:
        'Keep native center paths excluded from constrained inside/outside product geometry.'
    },
    'mesh-render': {
      status: 'aligned',
      currentImplementation:
        'renderSolidCenterStrokeEntries draws the renderer-specific entries, including mesh/solid/gradient/masked-solid cache paths.',
      requiredAdjustment:
        'Keep geometry decisions upstream of renderer drawing.'
    },
    'hit-export': {
      status: 'aligned',
      currentImplementation:
        'Hit area and export packets are built from strokeFinalFaces in the non-drag visual path.',
      requiredAdjustment:
        'Keep drag-mode freshness expectations explicit in tests.'
    },
    'runtime-diagnostics': {
      status: 'partial',
      currentImplementation:
        'Runtime diagnostics exist for constrained dashed, constrained solid, legality, ownership, center dashed overlap, dirty keys, and performance counters.',
      requiredAdjustment:
        'Unify diagnostic branch identity so product/debug/legacy evidence cannot be confused.'
    },
    'visible-final-result': {
      status: 'aligned',
      currentImplementation:
        'The visible result is produced by Pixi from the fill and stroke render entries after the final-face projection path.',
      requiredAdjustment:
        'Use screenshot failures as entry points for backward stage tracing, not as render-only fixes.'
    }
  }

  window.STROKE_FLOW_INSPECTOR_DATA = {
    groups,
    lanes,
    latestRules,
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
