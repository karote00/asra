/* global window */
;(() => {
  const groups = [
    'All',
    'Input',
    'Path Model',
    'Shared Geometry',
    'Fill',
    'Dashed Stroke',
    'Solid Stroke',
    'Final Faces',
    'Render',
    'Diagnostics'
  ]

  const lanes = [
    'Input',
    'Path Model',
    'Shared Geometry',
    'Fill',
    'Dashed Stroke',
    'Solid Stroke',
    'Final Faces',
    'Render',
    'Diagnostics'
  ]

  const latestRules = [
    'The shared resolved geometry model is the geometry truth for fill, stroke, and future shadow consumers.',
    'Fill consumes fillRegions from the self-intersecting model; stroke consumes strokeBoundaryContours.',
    'strokeBoundaryContours are split into two layers: contour.edges are low-level graph/provenance pieces, while contour.dashDomains are the Figma-like dash domains.',
    'Inside/outside dashed stroke must include both outer boundaries and hole boundaries.',
    'Center stroke does not use inside/outside side rules or contour legal-side ownership.',
    'For self-intersecting inside/outside dashed stroke, dashDomains break at authored vertices, self-intersections, and source segment boundaries, but never at curve sampling points.',
    'Every dashDomain owns its dash distribution independently; dash state must not continue from the previous domain.',
    'Product visual output must be final and no-overlap; debug overlap is the only mode that may show raw fragments.'
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
      id: 'entry',
      group: 'Input',
      lane: 0,
      row: 0,
      title: 'Render strategy entry',
      summary:
        'The render engine invokes the vector component render strategy.',
      helpers: ['vectorRenderStrategy', 'renderVectorGraphic'],
      inputs: ['graphic', 'unknown render data'],
      outputs: ['normalized vector render execution'],
      decisions: ['All vector fill/stroke rendering enters through this step.'],
      next: ['normalize'],
      risks: ['This layer should not make domain-specific geometry decisions.'],
      tags: ['entry']
    },
    {
      id: 'normalize',
      group: 'Input',
      lane: 0,
      row: 1,
      title: 'Normalize vector render data',
      summary: 'Converts raw computed data into VectorComputedData.',
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
      outputs: ['normalized points / segments / networks / strokes / fillRule'],
      decisions: [
        'Missing or invalid data falls back to a renderable shape here.'
      ],
      next: ['drag-debug', 'path-topology'],
      risks: [
        'If the computed data mirror provides incomplete partial data, every downstream geometry step will use the wrong input.'
      ],
      tags: ['data']
    },
    {
      id: 'drag-debug',
      group: 'Input',
      lane: 0,
      row: 2,
      title: 'Drag / debug render decision',
      summary:
        'Determines drag visual mode and whether debug overlap is disabled.',
      helpers: [
        'isVectorEditingDrag',
        'isSelectToolDrag',
        'core.getSystemProperty',
        'shouldDisableVisualOverlapCollapse',
        'useDragVisualOnly'
      ],
      inputs: [
        'renderData.id',
        'strokeDebugOptions',
        'system strokeDebugDisableVisualOverlapCollapse'
      ],
      outputs: ['useDragVisualOnly', 'shouldDisableVisualOverlapCollapse'],
      decisions: [
        'Drag mode may only skip hit/export/diagnostics; it must not skip final product visual output.',
        'Debug overlap mode may show raw fragments.'
      ],
      next: ['path-topology'],
      risks: [
        'Any raw packet shortcut will cause translucent strokes to overlap during drag.'
      ],
      tags: ['decision', 'risk']
    },
    {
      id: 'path-topology',
      group: 'Path Model',
      lane: 1,
      row: 1,
      title: 'Path / topology model',
      summary:
        'Builds path geometry and topology classification for each network.',
      helpers: [
        'buildVectorSourceRevision',
        'buildVectorGeometryModelPath',
        'buildPathTopologyModel'
      ],
      inputs: [
        'orderedNetworks',
        'points',
        'segments',
        'fillRule',
        'pathModelCache'
      ],
      outputs: ['networkPaths: network + path + topology'],
      decisions: [
        'Reuse the cached model when the source revision key matches.',
        'topologyFamily selects the downstream simple, sampled, or self-intersecting branch.'
      ],
      next: ['shared-model', 'compound-domain', 'center-stroke'],
      risks: [
        'Topology is still classified from sampled normalized points; self-intersection details must be supplied by the shared model.'
      ],
      tags: ['cache', 'topology']
    },
    {
      id: 'shared-model',
      group: 'Shared Geometry',
      lane: 2,
      row: 1,
      title: 'Resolved vector geometry model',
      summary:
        'Builds the shared resolved geometry model for fill, stroke, and future shadow consumers.',
      helpers: [
        'buildResolvedVectorGeometryModel',
        'buildSelfIntersectingGeometry'
      ],
      inputs: ['networkPaths', 'fillRule'],
      outputs: [
        'ResolvedVectorGeometryModel',
        'selfIntersecting.fillRegions',
        'selfIntersecting.strokeBoundaryContours',
        'strokeBoundaryContours.edges',
        'strokeBoundaryContours.dashDomains'
      ],
      decisions: [
        'This is the intended single geometry truth.',
        'The selfIntersecting model may be null for non-self-intersecting networks.',
        'Future fill, stroke, and shadow consumers should read this model instead of recomputing self-intersection geometry.'
      ],
      next: ['planar-graph', 'fill-path', 'dashed-candidates'],
      risks: [
        'If stroke still rebuilds contours by itself, the system returns to multiple truths.',
        'Current visible issue: outer inside dashed stroke is mostly correct, but hole-boundary stroke is still missing from product output.'
      ],
      tags: ['truth', 'shared']
    },
    {
      id: 'planar-graph',
      group: 'Shared Geometry',
      lane: 2,
      row: 2,
      title: 'Planar graph / even-odd contours',
      summary:
        'Splits a self-intersecting closed path into a planar graph, faces, fill regions, and stroke boundary contours.',
      helpers: [
        'buildSelfIntersectingEvenOddResolvedGeometry',
        'splitSegmentsByIntersections',
        'buildPlanarGraph',
        'buildBoundaryContoursFromGraph'
      ],
      inputs: ['traced source path segments'],
      outputs: [
        'fillRegions',
        'legalFaceBoundaries',
        'strokeBoundaryContours',
        'strokeBoundaryContours.edges',
        'strokeBoundaryContours.dashDomains'
      ],
      decisions: [
        'fillRegions are consumed by fill.',
        'strokeBoundaryContours are consumed by inside/outside stroke and must include hole boundaries.',
        'Each contour edge carries legalFaceId, oppositeFaceId, and source provenance.',
        'curve sampling pieces may remain as contour.edges, but they must be merged into dashDomains before dash distribution.'
      ],
      next: ['fill-path', 'self-dashed'],
      risks: [
        'If the hole boundary is not present here, stroke cannot render it later.',
        'If hole contours exist here but disappear later, inspect contour-domain construction and legal clipping.'
      ],
      tags: ['truth', 'critical']
    },
    {
      id: 'compound-domain',
      group: 'Shared Geometry',
      lane: 2,
      row: 3,
      title: 'Compound legal domain normalization',
      summary:
        'Builds a compound shell/hole legal domain for multiple closed networks.',
      helpers: [
        'buildCompoundLegalDomainNormalization',
        'invertConstrainedStrokePositionForHole'
      ],
      inputs: ['closedNetworkPaths', 'geometry backend'],
      outputs: ['compound legalDomain', 'compound role by network id'],
      decisions: [
        'Used only when multiple closed networks exist and the backend supports it.',
        'A hole network inverts the constrained stroke position.'
      ],
      next: ['dashed-candidates', 'solid-candidates'],
      risks: [
        'This is a multi-network hole, not the same as an even-odd hole contour from one self-intersecting path.'
      ],
      tags: ['decision']
    },
    {
      id: 'future-shadow',
      group: 'Shared Geometry',
      lane: 2,
      row: 4,
      title: 'Future shadow consumer',
      summary:
        'Future vector shadows should consume the same resolved geometry model instead of rebuilding contours.',
      helpers: [
        'ResolvedVectorGeometryModel consumers',
        'future shadow projection'
      ],
      inputs: [
        'ResolvedVectorGeometryModel',
        'source provenance',
        'fillRegions',
        'strokeBoundaryContours'
      ],
      outputs: ['future shadow geometry input'],
      decisions: [
        'Shadow is not implemented in this stroke fix.',
        'When added, it should read the shared model just like fill and stroke.'
      ],
      next: [],
      risks: [
        'If future shadow recomputes self-intersection geometry independently, fill/stroke/shadow can disagree.'
      ],
      tags: ['future', 'shared']
    },
    {
      id: 'fill-path',
      group: 'Fill',
      lane: 3,
      row: 1,
      title: 'Fill face selection',
      summary:
        'Selects shared fillRegions or the legacy flattened fallback for fill.',
      helpers: [
        'resolvedGeometry.selfIntersecting.fillRegions',
        'buildFlattenedSegmentsWithCache',
        'buildFillFaces'
      ],
      inputs: ['fillPayload', 'orderedNetworks', 'resolvedGeometryByNetworkId'],
      outputs: ['effectiveFillFaces'],
      decisions: [
        'Self-intersecting fill should prefer shared fillRegions.',
        'Use the buildFillFaces fallback only when shared faces are unavailable.'
      ],
      next: ['draw-fill'],
      risks: [
        'The buildFillFaces fallback still exists; it should not become another self-intersection truth.'
      ],
      tags: ['fill', 'risk']
    },
    {
      id: 'draw-fill',
      group: 'Fill',
      lane: 3,
      row: 2,
      title: 'Draw fill',
      summary:
        'Draws fill faces to the graphic; gradient fill uses a separate even-odd raster style.',
      helpers: [
        'drawFillFaces',
        'applyRenderableFill',
        'core.createEvenOddFillStyle'
      ],
      inputs: ['effectiveFillFaces', 'fillPayload', 'dragSuppressed'],
      outputs: ['fill drawn on graphic'],
      decisions: [
        'Flat fill uses faces.',
        'Gradient fill uses the EvenOddFillStyle cache.'
      ],
      next: ['draw-source-path', 'mesh-render'],
      risks: [
        'The visible fill shape is an important reference for validating stroke contours.'
      ],
      tags: ['fill']
    },
    {
      id: 'dashed-candidates',
      group: 'Dashed Stroke',
      lane: 4,
      row: 1,
      title: 'Constrained dashed candidates',
      summary: 'Builds candidate packets for closed constrained dashed stroke.',
      helpers: [
        'buildConstrainedDashedStrokeResolvedPackets',
        'buildNormalizedCompoundConstrainedDashedPackets'
      ],
      inputs: [
        'topology',
        'sourcePath',
        'strokesForNetwork',
        'selfIntersectingBoundaryContours',
        'selfIntersectingFillRegions'
      ],
      outputs: ['constrainedDashedCandidatePackets'],
      decisions: [
        'Self-intersecting strokes with position !== center should use the contour branch.',
        'Non-self-intersecting cubic paths may pass sourcePath; simple line paths may use topology points.'
      ],
      next: ['self-dashed', 'legacy-dashed', 'acceptance'],
      risks: [
        'This step combines the new contour branch with many legacy sourcePath fallbacks, so it is the most important point to inspect visually.'
      ],
      tags: ['dashed', 'critical']
    },
    {
      id: 'self-dashed',
      group: 'Dashed Stroke',
      lane: 4,
      row: 2,
      title: 'Self-intersecting even-odd dashed branch',
      summary:
        'Self-intersecting inside/outside dashed stroke should generate product geometry along strokeBoundaryContours.',
      helpers: ['buildSelfIntersectingEvenOddFaceBoundaryDashedPackets'],
      inputs: ['sourcePath', 'stroke', 'boundaryContours', 'fillRegions'],
      outputs: ['one constrained-dashed resolved packet with contour polygons'],
      decisions: [
        'Exclude stroke.position === center.',
        'No stroke is produced when boundaryContours is empty.',
        'Product stroke should consume boundaryContours.dashDomains, not authored sourcePath distance intervals.',
        'Inside stroke is currently still clipped to shared legalRegions.'
      ],
      next: ['contour-domains', 'normalize-clip'],
      risks: [
        'Current visible blocker: hole-boundary stroke is missing, even though outer inside dashed stroke is mostly correct.',
        'First inspect whether boundaryContours contains a center hole contour with dashDomains.',
        'If contour polygons are generated and then clipped by fillRegions, hole-boundary stroke may be removed.',
        'If contour direction or legalSide is wrong, inside/outside stroke is drawn on the wrong side.'
      ],
      tags: ['dashed', 'blocker']
    },
    {
      id: 'contour-domains',
      group: 'Dashed Stroke',
      lane: 4,
      row: 3,
      title: 'Contour dashDomains',
      summary:
        'Merges low-level contour edges into Figma-like dashed stroke domains.',
      helpers: [
        'getEvenOddContourDashDomains',
        'buildEndpointAlignedOpenDashIntervals',
        'getEvenOddContourOpenIntervalRenderRanges'
      ],
      inputs: ['EvenOddBoundaryContour', 'dashPattern', 'cap', 'stroke.width'],
      outputs: ['domain intervals and render ranges'],
      decisions: [
        'contour.edges are graph/sample/provenance pieces; they are not dash reset points.',
        'dashDomains merge continuous sampled edges with the same source segment, direction, and legal side.',
        'authored vertex, self-intersection, and source segment boundary break a dashDomain.',
        'curve sampling vertices must not break a dashDomain.',
        'Each dashDomain has a half dash at both ends; the interior is distributed by dash/gap.',
        'Square cap uses the effective interval but stays within the same domain.'
      ],
      next: ['contour-polygons'],
      risks: [
        'If contour.edges are consumed directly, every curve sample point creates fake caps and half-dashes.',
        'If dashDomains are merged into one full contour loop, dash state incorrectly continues through intersections.',
        'If the hole contour has no dashDomains, the internal hole stroke cannot appear.'
      ],
      tags: ['truth', 'dashed']
    },
    {
      id: 'contour-polygons',
      group: 'Dashed Stroke',
      lane: 4,
      row: 4,
      title: 'Contour local-side polygons',
      summary:
        'Slices a polyline from each domain interval and builds open local-side stroke polygons.',
      helpers: [
        'slicePolylineByDistance',
        'getEvenOddContourOpenStrokePosition',
        'buildConstrainedDashedLocalSideStrokePolygons'
      ],
      inputs: [
        'domain.points',
        'renderRange',
        'domain.legalSide',
        'stroke.position'
      ],
      outputs: ['raw contour dash polygons'],
      decisions: [
        'Inside uses the dashDomain legal side.',
        'Outside uses the opposite side.',
        'Round cap is enabled only at true interval terminals.'
      ],
      next: ['normalize-clip'],
      risks: [
        'Current visible blocker may be here if hole-domain polygons are never appended.',
        'This step still reuses a local-side helper; it knows only an open polyline and side, not planar graph faces.'
      ],
      tags: ['dashed', 'risk']
    },
    {
      id: 'normalize-clip',
      group: 'Dashed Stroke',
      lane: 4,
      row: 5,
      title: 'Normalize / legal clipping',
      summary:
        'Merges product polygons and intersects inside stroke with shared legal regions.',
      helpers: [
        'normalizeConstrainedDashedProductVisualPolygons',
        'clipConstrainedDashedPolygonsToSharedLegalRegions'
      ],
      inputs: ['raw contour polygons', 'fillRegions'],
      outputs: ['product constrained dashed polygons'],
      decisions: [
        'Product mode uses union to remove raw overlap.',
        'Inside currently intersects against fillRegions.'
      ],
      next: ['acceptance'],
      risks: [
        'Current visible blocker may be here if valid hole-boundary stroke is generated first and removed by fillRegions clipping.',
        'Inside contour stroke is already generated along legal boundaries; clipping it again with fillRegions may remove hole stroke.',
        'Union/intersection uses nonzero rules, so it must be verified against the even-odd contour intent.'
      ],
      tags: ['blocker', 'risk']
    },
    {
      id: 'legacy-dashed',
      group: 'Dashed Stroke',
      lane: 4,
      row: 6,
      title: 'Legacy sourcePath dashed branches',
      summary:
        'Non-self-intersecting or debug/raw paths use legacy sourcePath/topology interval builders.',
      helpers: [
        'getVisibleConstrainedDashedIntervals',
        'buildSourcePathSlicingContext',
        'splitVisibleIntervalBySourceSegments',
        'buildConstrainedDashedLocalSideStrokePolygons'
      ],
      inputs: ['topology points', 'sourcePath', 'visibleIntervals'],
      outputs: ['candidate packets for non-self-intersecting cases'],
      decisions: [
        'Round true terminals, square effective intervals, and sharp/smooth boundaries are decided inside these helpers.',
        'Debug overlap may keep raw fragments.'
      ],
      next: ['acceptance'],
      risks: [
        'The legacy path still has many branches; it must not override the self-intersecting contour truth.'
      ],
      tags: ['risk', 'dashed']
    },
    {
      id: 'solid-candidates',
      group: 'Solid Stroke',
      lane: 5,
      row: 1,
      title: 'Constrained solid candidates',
      summary:
        'Builds candidate packets for inside/outside solid stroke and applies legality clipping.',
      helpers: [
        'buildConstrainedSolidStrokeResolvedPackets',
        'buildConstrainedSolidLegalityClippingResult',
        'promoteConstrainedSolidPacketsToExactArrangement'
      ],
      inputs: ['topology', 'sourcePath', 'strokes', 'legal domains'],
      outputs: ['constrained solid packets and exact faces'],
      decisions: [
        'Center solid does not use the inside/outside contour side rule.',
        'The self-intersecting constrained solid branch is still separate and not fully unified with dashed contour logic.'
      ],
      next: ['stroke-packets', 'final-faces'],
      risks: [
        'This page focuses on dashed stroke; constrained solid stroke still needs alignment with the shared geometry model.'
      ],
      tags: ['solid', 'risk']
    },
    {
      id: 'center-stroke',
      group: 'Solid Stroke',
      lane: 5,
      row: 2,
      title: 'Center stroke packets',
      summary:
        'Center dashed/solid stroke follows the authored/source path and does not use inside/outside side ownership.',
      helpers: [
        'buildDashedCenterStrokeResolvedPackets',
        'buildSolidCenterStrokeResolvedPackets',
        'drawNativeCenterSolidStrokePath'
      ],
      inputs: ['topology.normalizedPoints', 'sourcePath', 'center strokes'],
      outputs: ['center stroke packets or native center solid visual'],
      decisions: [
        'Center stroke does not need inside/outside legal-side decisions.',
        'Native center solid visual may replay the path stroke directly.'
      ],
      next: ['stroke-packets', 'draw-source-path'],
      risks: [
        'Do not apply the new self-intersecting inside/outside rules to center stroke.'
      ],
      tags: ['truth', 'solid']
    },
    {
      id: 'acceptance',
      group: 'Dashed Stroke',
      lane: 4,
      row: 7,
      title: 'Dashed acceptance / promotion',
      summary:
        'Runtime status decides whether candidate packets enter exact arrangement promotion.',
      helpers: [
        'classifyConstrainedDashedRuntimeStatus',
        'attachStrokePacketDebugMeta',
        'promoteConstrainedDashedPacketsToExactArrangement'
      ],
      inputs: [
        'constrainedDashedCandidatePackets',
        'arrangement legal domains'
      ],
      outputs: ['accepted dashed packets', 'promoted exact faces'],
      decisions: [
        'A self-intersecting contour product packet should become final coverage directly and should not be blocked by fallback logic.',
        'Legal domains should be used only when arrangement is needed.'
      ],
      next: ['stroke-packets', 'final-faces', 'diagnostics'],
      risks: [
        'If the runtime classifier still uses authored sourcePath logic, it will conflict with contour domains.'
      ],
      tags: ['dashed', 'risk']
    },
    {
      id: 'stroke-packets',
      group: 'Final Faces',
      lane: 6,
      row: 1,
      title: 'Collect stroke packets',
      summary:
        'Combines center packets, constrained solid packets, and promoted dashed/solid packets into strokePackets.',
      helpers: [
        'buildSolidCenterStrokeResolvedPackets',
        'buildDashedCenterStrokeResolvedPackets',
        'constrainedSolidPromotion.packets',
        'constrainedDashedPromotion.packets'
      ],
      inputs: ['networkPaths', 'renderData.strokes', 'promotions'],
      outputs: ['strokePackets'],
      decisions: [
        'Promoted constrained dashed packets merge with center/solid packets here.',
        'Drag visual mode must not replace the final flow with raw packets.'
      ],
      next: ['final-faces'],
      risks: [
        'If the same geometry exists as both candidate packets and promoted faces, product overlap can occur.'
      ],
      tags: ['final']
    },
    {
      id: 'final-faces',
      group: 'Final Faces',
      lane: 6,
      row: 2,
      title: 'Final faces',
      summary:
        'Converts packets into final faces and appends promoted exact faces.',
      helpers: [
        'buildSolidCenterStrokeFinalFaces',
        'buildArrangedStrokeFinalFacesFromResolvedPackets'
      ],
      inputs: ['strokePackets', 'promotedExactStrokeFinalFaces'],
      outputs: ['rawStrokeFinalFaces'],
      decisions: [
        'Raw faces may still contain product overlap; the next step collapses it.'
      ],
      next: ['visual-collapse'],
      risks: [
        'The product final/no-overlap rule must be satisfied here or earlier.'
      ],
      tags: ['final']
    },
    {
      id: 'visual-collapse',
      group: 'Final Faces',
      lane: 6,
      row: 3,
      title: 'Visual overlap collapse',
      summary:
        'Product mode uses backend union/collapse to remove same-color translucent overlap.',
      helpers: [
        'collapseStrokeFinalFaceVisualOverlaps',
        'canUseExactSingleNetworkConstrainedSolidFacesDirectly'
      ],
      inputs: [
        'rawStrokeFinalFaces',
        'shouldDisableVisualOverlapCollapse',
        'geometry backend'
      ],
      outputs: ['strokeFinalFaces'],
      decisions: [
        'When debug overlap is on, return raw faces directly.',
        'If the backend does not support union, fail open.'
      ],
      next: ['render-entries', 'hit-export'],
      risks: [
        'If upstream generated wrong-side geometry, collapse can only merge it; it cannot fix direction.'
      ],
      tags: ['final', 'risk']
    },
    {
      id: 'draw-source-path',
      group: 'Render',
      lane: 7,
      row: 1,
      title: 'Draw source path / native stroke',
      summary:
        'Draws fill/source path or native center solid stroke before mesh entries.',
      helpers: ['drawVectorPath', 'drawNativeCenterSolidStrokePath'],
      inputs: [
        'orderedNetworks',
        'points',
        'segments',
        'nativeCenterSolidVisualStrokeGroups'
      ],
      outputs: ['source path / native center solid drawn'],
      decisions: [
        'Native center solid can replace polygon mesh.',
        'Other stroke types still use mesh render entries.'
      ],
      next: ['render-entries'],
      risks: [
        'The blue source-path outline is an overlay/debug reference, not constrained stroke geometry.'
      ],
      tags: ['render']
    },
    {
      id: 'render-entries',
      group: 'Render',
      lane: 7,
      row: 2,
      title: 'Render entries',
      summary: 'Converts final faces into mesh render entries.',
      helpers: ['toSolidCenterStrokeRenderEntriesFromFinalFaces'],
      inputs: ['strokeRenderFaces', 'productStrokeRenderEntries'],
      outputs: ['SolidCenterStrokeRenderEntry[]'],
      decisions: [
        'productStrokeRenderEntries is currently disabled.',
        'The normal path converts final faces into render entries.'
      ],
      next: ['mesh-render'],
      risks: [
        'If the product compiler is re-enabled, it must prove equivalence with the full final flow.'
      ],
      tags: ['render']
    },
    {
      id: 'mesh-render',
      group: 'Render',
      lane: 7,
      row: 3,
      title: 'Mesh render',
      summary:
        'Draws SolidCenterStrokeRenderEntry objects onto the Pixi graphic.',
      helpers: ['renderSolidCenterStrokeEntries'],
      inputs: ['graphic', 'strokeRenderEntries'],
      outputs: ['visible product stroke'],
      decisions: ['Geometry correctness decisions should not happen here.'],
      next: ['done'],
      risks: [
        'If upstream still outputs raw overlap or wrong-side geometry, mesh render will faithfully draw it wrong.'
      ],
      tags: ['render']
    },
    {
      id: 'hit-export',
      group: 'Diagnostics',
      lane: 8,
      row: 1,
      title: 'Hit / export data',
      summary: 'Updates hit area and export packets outside drag visual mode.',
      helpers: [
        'applyVectorHoverHitArea',
        'applySolidCenterStrokeExportPacketsFromFinalFaces'
      ],
      inputs: [
        'strokeFinalFaces',
        'fill faces',
        'points / segments / networks'
      ],
      outputs: ['graphic.hitArea', 'export packets'],
      decisions: [
        'Drag visual mode may keep previous hit/export data, but product visual output must still be current.'
      ],
      next: ['diagnostics'],
      risks: [
        'Hit/export uses strokeFinalFaces, so incorrect final faces also corrupt interaction and export.'
      ],
      tags: ['diagnostics']
    },
    {
      id: 'diagnostics',
      group: 'Diagnostics',
      lane: 8,
      row: 2,
      title: 'Runtime diagnostics',
      summary:
        'Writes dashed/solid legality, ownership, and overlap diagnostics.',
      helpers: [
        'setConstrainedDashedRuntimeDiagnostics',
        'setConstrainedSolidRuntimeDiagnostics',
        'setConstrainedSolidLegalityDiagnostics',
        'setConstrainedSolidOwnershipDiagnostics',
        'applyCenterDashedOverlapDiagnostics'
      ],
      inputs: [
        'candidate packets',
        'runtime diagnostics',
        'ownership diagnostics'
      ],
      outputs: ['debug render layers / diagnostics state'],
      decisions: [
        'Debug layers may show raw, rejected, or overlap data, but must not change product output.'
      ],
      next: ['done'],
      risks: [
        'Debug data can mislead product-branch analysis if it comes from a legacy branch.'
      ],
      tags: ['diagnostics', 'risk']
    },
    {
      id: 'done',
      group: 'Render',
      lane: 7,
      row: 4,
      title: 'Visible final result',
      summary: 'The fill + stroke result visible to the user.',
      helpers: ['Pixi render loop'],
      inputs: ['filled graphic', 'source path/native stroke', 'stroke meshes'],
      outputs: ['final product visual'],
      decisions: [
        'The product result must be final and no-overlap.',
        'Self-intersecting inside dashed stroke must include both outer and hole contour stroke.'
      ],
      next: [],
      risks: [
        'This is where screenshot-visible failures land; the root cause is usually in contour, domain, clipping, or final-flow steps.'
      ],
      tags: ['render', 'truth']
    }
  ]

  const edges = [
    ['entry', 'normalize'],
    ['normalize', 'drag-debug'],
    ['drag-debug', 'path-topology'],
    ['path-topology', 'shared-model'],
    ['path-topology', 'compound-domain'],
    ['path-topology', 'center-stroke'],
    ['shared-model', 'planar-graph'],
    ['shared-model', 'fill-path'],
    ['shared-model', 'dashed-candidates'],
    ['shared-model', 'future-shadow'],
    ['planar-graph', 'fill-path'],
    ['planar-graph', 'self-dashed'],
    ['compound-domain', 'dashed-candidates'],
    ['compound-domain', 'solid-candidates'],
    ['fill-path', 'draw-fill'],
    ['draw-fill', 'draw-source-path'],
    ['dashed-candidates', 'self-dashed'],
    ['dashed-candidates', 'legacy-dashed'],
    ['self-dashed', 'contour-domains'],
    ['contour-domains', 'contour-polygons'],
    ['contour-polygons', 'normalize-clip'],
    ['normalize-clip', 'acceptance'],
    ['legacy-dashed', 'acceptance'],
    ['solid-candidates', 'stroke-packets'],
    ['solid-candidates', 'final-faces'],
    ['center-stroke', 'stroke-packets'],
    ['center-stroke', 'draw-source-path'],
    ['acceptance', 'stroke-packets'],
    ['acceptance', 'final-faces'],
    ['stroke-packets', 'final-faces'],
    ['final-faces', 'visual-collapse'],
    ['visual-collapse', 'render-entries'],
    ['visual-collapse', 'hit-export'],
    ['draw-source-path', 'render-entries'],
    ['render-entries', 'mesh-render'],
    ['mesh-render', 'done'],
    ['hit-export', 'diagnostics'],
    ['diagnostics', 'done']
  ]

  const sharedCommands = [
    'yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts',
    'yarn workspace @asyra/preset test:local src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/stroke-performance-contract.test.ts',
    'yarn workspace @asyra/asyra-design test:e2e -- stroke-rule-driven-dashed-visual.spec.ts constrained-dashed-stroke-visual.spec.ts reported-vector-6-dashed-inside-seam.spec.ts',
    'yarn workspace @asyra/preset build:preset',
    'yarn lint:ci'
  ]

  const defaultEvidenceByGroup = {
    Input: {
      relatedFiles: ['packages/preset/src/components/vector.ts'],
      relatedTests: [
        'packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts',
        'apps/asyra-design/e2e/stroke-drag-render-performance.spec.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/preset test:local src/__tests__/vector-constrained-dashed-stroke.test.ts',
        'yarn workspace @asyra/asyra-design test:e2e -- stroke-drag-render-performance.spec.ts'
      ],
      evidenceToInspect: [
        'Verify normalized points, segments, networks, fillRule, and strokes match the source computed data.',
        'Verify drag mode does not switch product visual rendering to raw packet output.'
      ]
    },
    'Path Model': {
      relatedFiles: [
        'packages/preset/src/components/vector.ts',
        'packages/preset/src/components/stroke-render/path-topology-model.ts',
        'packages/preset/src/components/stroke-render/path-geometry.ts'
      ],
      relatedTests: [
        'packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/preset test:local src/__tests__/vector-constrained-dashed-stroke.test.ts'
      ],
      evidenceToInspect: [
        'Inspect source revision keys and whether the source path was rebuilt from the latest points/controls.',
        'Inspect topologyFamily and sampled path classification before stroke rules are applied.'
      ]
    },
    'Shared Geometry': {
      relatedFiles: [
        'packages/preset/src/components/stroke-render/resolved-vector-geometry-model.ts',
        'packages/preset/src/components/stroke-render/self-intersecting-legal-domain.ts',
        'packages/preset/src/components/stroke-render/source-span-graph.ts'
      ],
      relatedTests: [
        'packages/preset/src/__tests__/constrained-dashed-stroke-packets.test.ts',
        'packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-stroke-packets.test.ts'
      ],
      evidenceToInspect: [
        'Inspect planar graph nodes, split edges, face ids, and contour ids.',
        'Confirm outer and hole boundary contours are both present before fill/stroke consumers run.'
      ]
    },
    Fill: {
      relatedFiles: [
        'packages/preset/src/components/vector.ts',
        'packages/preset/src/components/stroke-render/resolved-vector-geometry-model.ts'
      ],
      relatedTests: [
        'packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts',
        'apps/asyra-design/e2e/stroke-rule-driven-dashed-visual.spec.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/asyra-design test:e2e -- stroke-rule-driven-dashed-visual.spec.ts'
      ],
      evidenceToInspect: [
        'Compare visible fill regions against the shared model fillRegions.',
        'Use fill as a visual reference for legal region and hole boundary interpretation.'
      ]
    },
    'Dashed Stroke': {
      relatedFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-dashed-local-side-geometry.ts',
        'packages/preset/src/components/stroke-render/stroke-interval-frames.ts',
        'packages/preset/src/components/stroke-render/resolved-vector-geometry-model.ts'
      ],
      relatedTests: [
        'packages/preset/src/__tests__/constrained-dashed-stroke-packets.test.ts',
        'packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts',
        'apps/asyra-design/e2e/constrained-dashed-stroke-visual.spec.ts',
        'apps/asyra-design/e2e/stroke-rule-driven-dashed-visual.spec.ts',
        'apps/asyra-design/e2e/reported-vector-6-dashed-inside-seam.spec.ts'
      ],
      debugCommands: sharedCommands,
      evidenceToInspect: [
        'Inspect contour id, dashDomain id, dash interval, cap ownership, and side ownership for each generated polygon.',
        'For self-intersecting inside/outside stroke, verify dash state resets per dashDomain and not per sampled edge.',
        'For product mode, verify no raw overlap fragments are used as final visual output.'
      ]
    },
    'Solid Stroke': {
      relatedFiles: [
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-render.ts'
      ],
      relatedTests: [
        'packages/preset/src/__tests__/vector-constrained-solid-stroke.test.ts',
        'packages/preset/src/__tests__/solid-center-stroke-render.test.ts',
        'apps/asyra-design/e2e/solid-center-stroke-visual.spec.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/preset test:local src/__tests__/vector-constrained-solid-stroke.test.ts src/__tests__/solid-center-stroke-render.test.ts',
        'yarn workspace @asyra/asyra-design test:e2e -- solid-center-stroke-visual.spec.ts'
      ],
      evidenceToInspect: [
        'Verify center stroke remains source-path based and is not affected by inside/outside contour rules.',
        'Verify constrained solid branches do not reintroduce independent self-intersection truth.'
      ]
    },
    'Final Faces': {
      relatedFiles: [
        'packages/preset/src/components/stroke-render/stroke-final-face.ts',
        'packages/preset/src/components/stroke-render/stroke-candidate-arrangement.ts',
        'packages/preset/src/components/stroke-render/geometry-backend.ts',
        'packages/preset/src/components/stroke-render/clipper2-geometry-backend.ts'
      ],
      relatedTests: [
        'packages/preset/src/__tests__/stroke-performance-contract.test.ts',
        'packages/preset/src/__tests__/constrained-dashed-stroke-packets.test.ts',
        'packages/preset/src/__tests__/solid-center-stroke-render.test.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/preset test:local src/__tests__/stroke-performance-contract.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts'
      ],
      evidenceToInspect: [
        'Inspect raw face count versus final face count.',
        'Confirm product visual collapse is not being asked to fix wrong-side geometry.'
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
        'Confirm render entries consume final faces, not candidate/raw packet polygons.',
        'Use screenshots only after confirming the upstream final faces are correct.'
      ]
    },
    Diagnostics: {
      relatedFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-runtime-diagnostics.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-runtime-diagnostics.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-legality-diagnostics.ts'
      ],
      relatedTests: [
        'packages/preset/src/__tests__/constrained-dashed-runtime-diagnostics.test.ts',
        'apps/asyra-design/e2e/stroke-drag-render-performance.spec.ts'
      ],
      debugCommands: [
        'yarn workspace @asyra/preset test:local src/__tests__/constrained-dashed-runtime-diagnostics.test.ts',
        'yarn workspace @asyra/asyra-design test:e2e -- stroke-drag-render-performance.spec.ts'
      ],
      evidenceToInspect: [
        'Confirm diagnostics match the product branch being rendered.',
        'Do not treat debug raw fragments as product visual truth.'
      ]
    }
  }

  const stepEvidenceOverrides = {
    'shared-model': {
      evidenceToInspect: [
        'Confirm the model is built once per source revision and is shared by fill, stroke, and future shadow.',
        'Confirm strokeBoundaryContours include the center hole boundary for self-intersecting closed vectors.',
        'Confirm each contour exposes dashDomains separately from low-level sampled edges.'
      ]
    },
    'planar-graph': {
      evidenceToInspect: [
        'Inspect face parity, exterior face selection, hole face detection, contour direction, and legalFaceId/oppositeFaceId.',
        'Check that intersections, authored vertices, and source segment boundaries split dashDomains before dash distribution is computed.',
        'Check that curve sampling points remain inside the same dashDomain rather than becoming reset points.'
      ]
    },
    'self-dashed': {
      evidenceToInspect: [
        'Confirm self-intersecting inside/outside dashed stroke consumes only strokeBoundaryContours.',
        'Confirm hole-boundary dashDomains are present before polygon construction.',
        'Confirm hole-boundary contour polygons are generated before any clipping/normalization step.'
      ]
    },
    'contour-domains': {
      evidenceToInspect: [
        'For every dashDomain, verify start and end receive the domain-level half dash rule.',
        'Verify dash offset does not continue across intersection/authored-boundary/source-boundary domains.',
        'Verify sampled curve vertices do not create extra dashDomains, caps, or half dashes.'
      ]
    },
    'normalize-clip': {
      evidenceToInspect: [
        'Check whether clipping against fillRegions removes hole-boundary stroke.',
        'Check whether union/intersection winding assumptions conflict with even-odd contour intent.'
      ]
    },
    'legacy-dashed': {
      evidenceToInspect: [
        'Confirm this branch is not used for self-intersecting inside/outside product rendering.',
        'Confirm debug/raw rendering stays isolated from product visual output.'
      ]
    },
    'visual-collapse': {
      evidenceToInspect: [
        'Use this only to remove same-visual overlap; do not rely on it to fix missing contours or wrong side ownership.',
        'If collapse changes shape semantics, inspect the upstream product polygons instead.'
      ]
    },
    done: {
      evidenceToInspect: [
        'Compare product screenshots against the latest Figma-like rules: outer and hole boundaries, independent split-domain dash distribution, and final/no-overlap output.',
        'If the screenshot is wrong, trace backward through render entries, final faces, dashed packets, contour domains, and shared model.'
      ]
    }
  }

  const defaultAlignmentByGroup = {
    Input: {
      status: 'aligned',
      latestRule:
        'Input and drag/debug decisions may decide what to skip for diagnostics, but they must not change product geometry semantics.',
      currentImplementation:
        'Vector render data is normalized before path, fill, and stroke construction.',
      requiredAdjustment: 'None for this stroke-only inspector update.'
    },
    'Path Model': {
      status: 'partial',
      latestRule:
        'Path/topology should feed the shared resolved geometry model before any fill or stroke consumer runs.',
      currentImplementation:
        'Path and topology are built before the shared model, but topology classification and source provenance still need to be inspected when stroke fails.',
      requiredAdjustment:
        'Keep this step as an upstream source; do not add stroke-specific contour rules here.'
    },
    'Shared Geometry': {
      status: 'partial',
      latestRule:
        'This layer is the single geometry truth for fill, inside/outside stroke, and future shadow.',
      currentImplementation:
        'Resolved vector geometry model exists and exposes fillRegions plus strokeBoundaryContours for self-intersecting networks; strokeBoundaryContours now need to be read as edges plus dashDomains.',
      requiredAdjustment:
        'Validate that contour direction, legal side, hole contours, and dashDomains match the latest Figma-like stroke rules.'
    },
    Fill: {
      status: 'out-of-scope',
      latestRule:
        'Fill consumes fillRegions only; fill is not part of the current stroke fix unless it proves the shared model itself is wrong.',
      currentImplementation:
        'Fill can consume shared fillRegions, with a legacy fallback still present.',
      requiredAdjustment:
        'Do not modify fill in this task. Use it only as visual evidence for even-odd regions.'
    },
    'Dashed Stroke': {
      status: 'partial',
      latestRule:
        'Self-intersecting inside/outside dashed stroke consumes strokeBoundaryContours, including hole boundaries; center stroke is excluded.',
      currentImplementation:
        'The dashed path contains a contour branch, dashDomain helpers, and legacy sourcePath branches.',
      requiredAdjustment:
        'Mark and remove any product-path dependency on authored sourcePath, contour.edges as dash reset points, independent contour rebuilding, or post-generation clipping that changes contour-side semantics.'
    },
    'Solid Stroke': {
      status: 'partial',
      latestRule:
        'Center stroke remains source-path based; inside/outside constrained solid should eventually use the same shared geometry source where applicable.',
      currentImplementation:
        'Center stroke is separate; constrained solid has its own packet and legality paths.',
      requiredAdjustment:
        'No solid-stroke change in this task unless it is needed to preserve shared-model flow documentation.'
    },
    'Final Faces': {
      status: 'aligned',
      latestRule:
        'Final faces and visual collapse are cleanup/render preparation layers, not the source of stroke semantics.',
      currentImplementation:
        'Final faces and collapse run after packet/promotion construction.',
      requiredAdjustment:
        'Do not rely on this layer to fix missing hole contours, wrong side ownership, or dash-domain continuation.'
    },
    Render: {
      status: 'aligned',
      latestRule:
        'Render draws final product geometry; debug overlap is the only mode allowed to show raw fragments.',
      currentImplementation:
        'Render entries consume final faces for polygon-based stroke visual output.',
      requiredAdjustment: 'None in this inspector update.'
    },
    Diagnostics: {
      status: 'aligned',
      latestRule:
        'Diagnostics can expose raw/debug data but must not become product truth.',
      currentImplementation:
        'Runtime diagnostics are written after packet/final-face construction.',
      requiredAdjustment:
        'Use diagnostics as evidence only after confirming they match the branch being rendered.'
    }
  }

  const stepAlignmentOverrides = {
    entry: {
      status: 'aligned',
      currentImplementation:
        'The render strategy entry is a pure pipeline entrypoint.'
    },
    normalize: {
      status: 'aligned',
      currentImplementation:
        'Raw computed data is normalized before source geometry is built.'
    },
    'drag-debug': {
      status: 'aligned',
      requiredAdjustment:
        'Keep product visual final/no-overlap even during drag; only diagnostics/hit/export can be skipped.'
    },
    'path-topology': {
      status: 'partial',
      requiredAdjustment:
        'Preserve source provenance needed by the shared model; do not add self-intersection stroke rules here.'
    },
    'shared-model': {
      status: 'partial',
      latestRule:
        'The shared model must sit after path/topology and before fill, stroke, and future shadow consumers, exposing both fillRegions and strokeBoundaryContours.dashDomains.',
      currentImplementation:
        'Built by buildResolvedVectorGeometryModel in vector.ts before fill and stroke consumers run; the remaining issue is whether the hole contour and its dashDomains survive into stroke output.',
      requiredAdjustment:
        'Keep this as the only shared geometry entrypoint; verify hole contour + dashDomains are present before fixing downstream stroke consumers.'
    },
    'planar-graph': {
      status: 'blocker',
      latestRule:
        'Planar graph output must include even-odd faces, fill regions, outer boundary contours, hole boundary contours, low-level contour.edges, merged contour.dashDomains, and source provenance.',
      currentImplementation:
        'Self-intersecting geometry builds fillRegions and strokeBoundaryContours; current product output shows the outer contour but not the hole-boundary stroke, so this is the first place to verify hole contour/domain existence.',
      requiredAdjustment:
        'Verify that the center hole contour exists and has dashDomains. If it is missing here, fix contour construction before changing stroke-side consumers.'
    },
    'future-shadow': {
      status: 'future',
      latestRule:
        'Future shadow should consume the same shared model rather than rebuilding vector geometry.',
      currentImplementation: 'Shadow is not wired in this flow yet.',
      requiredAdjustment:
        'No current implementation work; keep this as an architectural marker.'
    },
    'fill-path': {
      status: 'out-of-scope',
      requiredAdjustment:
        'Do not modify fill for the current stroke correction unless shared-model evidence proves fillRegions are wrong.'
    },
    'draw-fill': {
      status: 'out-of-scope',
      requiredAdjustment:
        'Do not modify fill drawing; use it only to inspect legal-region shape.'
    },
    'dashed-candidates': {
      status: 'partial',
      requiredAdjustment:
        'Ensure self-intersecting product stroke routes only to the contour branch and does not fall back to legacy sourcePath semantics.'
    },
    'self-dashed': {
      status: 'blocker',
      latestRule:
        'Self-intersecting inside/outside dashed stroke should use only strokeBoundaryContours.dashDomains as the dash source.',
      currentImplementation:
        'This branch receives boundaryContours and now has dashDomain helpers, but it also receives sourcePath and fillRegions, and hole-boundary stroke is still missing in product output.',
      requiredAdjustment:
        'Trace whether hole dashDomains reach this branch, then remove product semantics that depend on authored sourcePath or fillRegion clipping.'
    },
    'contour-domains': {
      status: 'partial',
      latestRule:
        'Every dashDomain is split by authored vertices, self-intersections, and source segment boundaries, but not by curve sampling points.',
      currentImplementation:
        'dashDomain helpers exist, but output must be verified against Figma-like split-domain dash distribution and hole-boundary coverage.',
      requiredAdjustment:
        'Assert dash state never continues across dashDomains, and assert sampled curve vertices do not create extra dashDomains.'
    },
    'contour-polygons': {
      status: 'partial',
      currentImplementation:
        'Uses local-side open-polyline polygon helpers on contour domains.',
      requiredAdjustment:
        'Verify side ownership from dashDomain.legalSide is sufficient and does not need later fill-region clipping; confirm hole-domain polygons are appended.'
    },
    'normalize-clip': {
      status: 'blocker',
      latestRule:
        'Self-intersecting contour stroke should already be generated on the correct legal side; product clipping must not remove hole-boundary stroke.',
      currentImplementation:
        'Inside stroke is still intersected with fillRegions after contour polygons are generated; if hole-domain polygons exist before this step, this is the likely place they disappear.',
      requiredAdjustment:
        'For the self-intersecting contour product path, replace this with contour-safe normalization or remove fillRegion clipping if it deletes valid boundary stroke.'
    },
    'legacy-dashed': {
      status: 'mismatch',
      latestRule:
        'Legacy sourcePath dash logic is valid only for non-self-intersecting or debug/raw paths.',
      currentImplementation:
        'Legacy branches remain near the self-intersecting branch and can obscure which branch produced product geometry.',
      requiredAdjustment:
        'Explicitly label and guard legacy branches so self-intersecting inside/outside product stroke cannot use them.'
    },
    'solid-candidates': {
      status: 'partial',
      requiredAdjustment:
        'Leave solid stroke untouched unless shared-model documentation requires an annotation.'
    },
    'center-stroke': {
      status: 'aligned',
      latestRule:
        'Center stroke is source-path based and does not use inside/outside contour side rules.',
      currentImplementation:
        'Center dashed/solid packets are separate from constrained inside/outside stroke.',
      requiredAdjustment:
        'Keep center stroke excluded from even-odd inside/outside contour semantics.'
    },
    acceptance: {
      status: 'partial',
      requiredAdjustment:
        'Do not let runtime acceptance reject a contour product packet because it expects authored sourcePath semantics.'
    },
    'visual-collapse': {
      status: 'aligned',
      requiredAdjustment:
        'Use collapse only for visual overlap cleanup, not for missing contour or side-direction fixes.'
    },
    done: {
      status: 'blocker',
      currentImplementation:
        'Current screenshot shows outer inside dashed stroke mostly correct, but internal hole-boundary stroke is missing.',
      requiredAdjustment:
        'Trace the missing hole stroke backward through render entries, final faces, dashed packets, contour polygons, contour dashDomains, and shared model.'
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
    stepAlignmentOverrides
  }
})()
