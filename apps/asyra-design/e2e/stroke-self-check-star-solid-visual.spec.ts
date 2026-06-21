import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  ARTIFACT_DIR,
  INSIDE_SOLID_LOCAL_REVIEW_ZOOM,
  getSelfCheckArtifactPaths,
  getSelfCheckSolidJoinArtifactPaths,
  SELF_CHECK_SOURCE_POINTS,
  SELF_CHECK_VECTOR_RECT,
  INSIDE_SOLID_SOURCE_SEGMENT_ADHERENCE_PROBES,
  INSIDE_SOLID_FILL_PRESERVATION_ZONES,
  SELF_CHECK_SOURCE_ANCHOR_POINTS,
  resetCanvas,
  waitForAppReady,
  createSelfCheckStar,
  saveCurrentFileToLocalStorage,
  installVectorRenderPhaseProfiler,
  getVectorRenderPhaseSamples,
  getSelfCheckMetadata,
  analyzeSelfCheckScreenshots,
  analyzeInsideSolidFillPreservation,
  analyzeSolidBoundaryContinuity,
  analyzeSolidLocalBlackCrack,
  analyzeInsideSolidAdjacencyWidth,
  getInsideSolidInternalCornerCentersFromMetadata,
  getInsideSolidMaskOnlyCornerProbesFromMetadata,
  compareInsideSolidInternalCornerJoinPixels,
  compareInsideSolidPointSamples,
  compareCanvasAreaScreenshotPixels,
  analyzeInsideSolidOuterSourceVertexCoverage,
  analyzeInsideSolidSourceSegmentAdherence,
  analyzeInsideSolidSourcePathContinuity,
  analyzeInsideSolidLocalFillProbe
} from './stroke-self-check-star-fixture'
import type {
  SelfCheckJoinType,
  SelfCheckStrokePosition,
  Vec2
} from './stroke-self-check-star-fixture'

test('self-check: default stroke runtime does not expose heavyweight diagnostics payloads', async ({
  browser
}) => {
  test.setTimeout(20_000)
  const page = await browser.newPage()
  await page.addInitScript(() => {
    ;(
      window as typeof window & {
        __ASYRA_STROKE_DIAGNOSTICS_MODE__?: 'off'
      }
    ).__ASYRA_STROKE_DIAGNOSTICS_MODE__ = 'off'
  })
  await page.goto('/')
  await waitForAppReady(page)
  await resetCanvas(page)
  await page.setViewportSize({ width: 1400, height: 1100 })
  const readRuntimePayload = () =>
    page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      let selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__selfCheckVectorId ??
        null
      if (!selectedId) {
        const elements = core?.deps?.sceneTree?.getAllElements?.()
        elements?.forEach?.(
          (
            candidate: { get?: (key: string) => unknown } | undefined,
            id: string
          ) => {
            if (!selectedId && candidate?.get?.('type') === 'vector') {
              selectedId = id
            }
          }
        )
      }
      const renderElement = selectedId
        ? core?.deps?.render?.getElementById?.(selectedId)
        : null
      const exportPackets =
        renderElement?.__asyraSolidCenterStrokeExportPackets ?? []

      return {
        selectedId,
        exportPacketCount: exportPackets.length,
        exportDebugMetaCount: exportPackets.filter(
          (packet: { debugMeta?: unknown }) => packet.debugMeta !== undefined
        ).length,
        constrainedSolidLegalityDiagnostics:
          renderElement?.__asyraConstrainedSolidLegalityDiagnostics,
        constrainedSolidOwnershipDiagnostics:
          renderElement?.__asyraConstrainedSolidOwnershipDiagnostics,
        centerDashedOverlapDiagnostics:
          renderElement?.__asyraCenterDashedOverlapDiagnostics
      }
    })

  await page.evaluate(() => {
    ;(
      window as typeof window & {
        __ASYRA_STROKE_DIAGNOSTICS_MODE__?: 'off'
      }
    ).__ASYRA_STROKE_DIAGNOSTICS_MODE__ = 'off'
  })
  await createSelfCheckStar(page, {
    capType: 'round',
    joinType: 'miter',
    position: 'inside',
    style: 'solid',
    diagnosticsMode: 'off'
  })
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.()
    return Boolean(computed?.strokes?.length && computed?.fills?.length)
  })
  await page.waitForTimeout(300)

  const runtimePayload = await readRuntimePayload()

  expect(runtimePayload.exportPacketCount).toBeGreaterThan(0)
  expect(runtimePayload.constrainedSolidLegalityDiagnostics).toBeUndefined()
  expect(runtimePayload.constrainedSolidOwnershipDiagnostics).toBeUndefined()
  expect(runtimePayload.centerDashedOverlapDiagnostics).toBeUndefined()

  await saveCurrentFileToLocalStorage(page)
  await page.addInitScript(() => {
    ;(
      window as typeof window & {
        __ASYRA_STROKE_DIAGNOSTICS_MODE__?: 'off'
      }
    ).__ASYRA_STROKE_DIAGNOSTICS_MODE__ = 'off'
  })
  const reloadStart = Date.now()
  await page.reload()
  await waitForAppReady(page)
  const reloadElapsedMs = Date.now() - reloadStart
  await expect
    .poll(async () => (await readRuntimePayload()).exportPacketCount)
    .toBeGreaterThan(0)

  const reloadedRuntimePayload = await readRuntimePayload()
  expect(reloadedRuntimePayload.exportPacketCount).toBe(
    runtimePayload.exportPacketCount
  )
  expect(
    reloadedRuntimePayload.constrainedSolidLegalityDiagnostics
  ).toBeUndefined()
  expect(
    reloadedRuntimePayload.constrainedSolidOwnershipDiagnostics
  ).toBeUndefined()
  expect(reloadedRuntimePayload.centerDashedOverlapDiagnostics).toBeUndefined()
  expect(reloadElapsedMs).toBeLessThan(5_000)
  await page.close()
})

test('self-check: self-intersecting inside solid uses solidMaskModel with filled-face mask evidence', async ({
  page
}, testInfo) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  const paths = getSelfCheckArtifactPaths('round', 'fill', 'inside', 'solid')

  await createSelfCheckStar(page, {
    includeStroke: false,
    capType: 'round',
    style: 'solid'
  })
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.()
    return Boolean(computed?.fills?.length)
  })
  await page.waitForTimeout(300)
  const baselineScreenshot = await page.screenshot({ fullPage: false })

  await resetCanvas(page)
  await createSelfCheckStar(page, { capType: 'round', style: 'solid' })
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.()
    return Boolean(computed?.strokes?.length && computed?.fills?.length)
  })
  await page.waitForTimeout(1000)

  const metadata = await getSelfCheckMetadata(page)
  fs.writeFileSync(paths.metadata, `${JSON.stringify(metadata, null, 2)}\n`)
  const actualScreenshot = await page.screenshot({
    path: paths.screenshot,
    fullPage: false
  })
  const legalAnalysis = await analyzeSelfCheckScreenshots(
    page,
    baselineScreenshot,
    actualScreenshot,
    metadata
  )
  const fillPreservationAnalysis = await analyzeInsideSolidFillPreservation(
    page,
    baselineScreenshot,
    actualScreenshot,
    metadata
  )
  const adjacencyWidthAnalysis = await analyzeInsideSolidAdjacencyWidth(
    page,
    actualScreenshot,
    metadata
  )
  const outerSourceVertexAnalysis =
    await analyzeInsideSolidOuterSourceVertexCoverage(
      page,
      actualScreenshot,
      metadata
    )
  const sourceSegmentAdherenceAnalysis =
    await analyzeInsideSolidSourceSegmentAdherence(
      page,
      actualScreenshot,
      metadata
    )
  const sourcePathContinuityAnalysis =
    await analyzeInsideSolidSourcePathContinuity(
      page,
      baselineScreenshot,
      actualScreenshot,
      metadata
    )
  fs.writeFileSync(
    paths.analysis,
    `${JSON.stringify(
      {
        legalAnalysis,
        fillPreservationAnalysis,
        adjacencyWidthAnalysis,
        outerSourceVertexAnalysis,
        sourceSegmentAdherenceAnalysis,
        sourcePathContinuityAnalysis
      },
      null,
      2
    )}\n`
  )

  const boundaryRoles = metadata.boundaryDomainPackets.flatMap((packet) => [
    packet.domainPlanBoundaryRole,
    ...packet.domainPlanSplitRangeTerminals.map(
      (terminal) => terminal.boundaryRole
    )
  ])
  const sideRecords = metadata.boundaryDomainPackets.flatMap((packet) => [
    {
      selectedSide: packet.domainPlanSelectedSide,
      filledSide: packet.domainPlanFilledSide,
      unfilledSide: packet.domainPlanUnfilledSide
    },
    ...packet.domainPlanSplitRangeTerminals.map((terminal) => ({
      selectedSide: terminal.selectedSide,
      filledSide: terminal.filledSide,
      unfilledSide: terminal.unfilledSide
    }))
  ])

  expect(metadata.exportPacketCount).toBeGreaterThan(0)
  const solidMaskModelPackets = metadata.boundaryDomainPackets.filter(
    (packet) => packet.strokePosition === 'inside'
  )
  const requiredRenderMaskProbes = [
    'top-triangle-mask-integrity',
    'inside-solid-outer-source-vertices-no-gap',
    'inside-solid-right-bottom-source-segment-adherence'
  ]
  const traceBackedAdjacencyProbes = [
    'internal-pentagon-shared-edge-half-width',
    'normal-width-comparison-edge',
    'internal-pentagon-endpoint-protrusion',
    'shared-boundary-width-transition',
    'all-internal-shared-edges-half-width',
    'all-internal-pentagon-corner-protrusions',
    'inside-solid-lower-left-high-curvature-no-gap',
    'inside-solid-lower-right-high-curvature-no-gap'
  ]
  const internalCornerJoinProbes = [
    'all-internal-pentagon-corner-join-shapes',
    'internal-pentagon-corner-join-shapes-only',
    'outer-triangle-corners-join-invariant',
    'non-pentagon-mask-corners-no-miter-spikes',
    'internal-pentagon-bevel-corners-no-overreach-crack',
    'internal-pentagon-round-corners-smooth'
  ]
  expect(
    solidMaskModelPackets.every((packet) => {
      const hasFaceOwnershipTrace =
        packet.solidMaskModelFaceOwnershipTrace.length > 0
      const hasInternalCornerProbe = internalCornerJoinProbes.some(
        (probeName) => packet.solidMaskModelAdjacencyProbe.includes(probeName)
      )
      return (
        packet.solidMaskModelInsideMaskMode === 'face-occupancy-inside-fill' &&
        packet.solidMaskModelRejectedMaskMode !==
          'binary-filled-region-union' &&
        packet.solidMaskModelVisibleRender === 'masked-source-stroke' &&
        packet.solidMaskModelCoverageOracle === 'render-mask' &&
        packet.solidMaskModelMaskSide === 'inside-fill' &&
        packet.solidMaskModelVisibleMaskMode ===
          'inside-fill-source-stroke-clip' &&
        packet.solidMaskModelJoinGeometrySource ===
          'authored-doubled-source-stroke' &&
        packet.solidMaskModelRejectedInternalCornerJoinMode !==
          'fixed-round-node-mask' &&
        packet.solidMaskModelRejectedInternalCornerJoinMode !==
          'fixed-endpoint-connector' &&
        packet.solidMaskModelRejectedVisibleMaskMode !==
          'binary-union-minus-shared-edge-reject' &&
        packet.solidMaskModelRejectedVisibleMaskMode !==
          'boundary-strip-connector-approximation' &&
        requiredRenderMaskProbes.every((probeName) =>
          packet.solidMaskModelAdjacencyProbe.includes(probeName)
        ) &&
        (hasFaceOwnershipTrace
          ? traceBackedAdjacencyProbes.every((probeName) =>
              packet.solidMaskModelAdjacencyProbe.includes(probeName)
            )
          : traceBackedAdjacencyProbes.every(
              (probeName) =>
                !packet.solidMaskModelAdjacencyProbe.includes(probeName)
            )) &&
        (hasInternalCornerProbe
          ? packet.solidMaskModelInternalCornerJoinMode ===
            'stroke-join-aware-face-corner'
          : packet.solidMaskModelInternalCornerJoinMode === null)
      )
    }),
    JSON.stringify(solidMaskModelPackets, null, 2)
  ).toBe(true)
  expect(
    boundaryRoles.includes('filled-face'),
    JSON.stringify(metadata.boundaryDomainPackets, null, 2)
  ).toBe(true)
  expect(
    metadata.boundaryDomainPackets.every(
      (packet) =>
        packet.productSignature?.startsWith('constrained-solid:') === true &&
        packet.topologyFamily === 'self-intersecting' &&
        packet.productMode === 'closed-constrained-domain'
    ),
    JSON.stringify(metadata.boundaryDomainPackets, null, 2)
  ).toBe(true)
  expect(
    metadata.boundaryDomainPackets.some(
      (packet) =>
        packet.geometryId?.includes(':boundary-domain:') === true ||
        packet.domainPlanTerminalRole !== null ||
        packet.domainPlanSplitRangeTerminals.length > 0
    ),
    JSON.stringify(metadata.boundaryDomainPackets, null, 2)
  ).toBe(false)
  expect(
    sideRecords.every(
      (record) =>
        record.selectedSide === record.filledSide &&
        record.filledSide !== record.unfilledSide
    ),
    JSON.stringify(sideRecords, null, 2)
  ).toBe(true)

  expect(legalAnalysis.redPixelCount).toBeGreaterThan(1000)
  expect(
    fillPreservationAnalysis.farFillSampleCount,
    JSON.stringify(fillPreservationAnalysis, null, 2)
  ).toBeGreaterThan(500)
  fillPreservationAnalysis.zoneSummaries.forEach((zone) => {
    expect(
      zone.farFillSampleCount,
      JSON.stringify(fillPreservationAnalysis, null, 2)
    ).toBeGreaterThan(20)
    expect(
      zone.redFarSampleCount,
      JSON.stringify(fillPreservationAnalysis, null, 2)
    ).toBeLessThanOrEqual(zone.maxAllowedRedFarSamples)
  })
  const topTriangleFillSummary = fillPreservationAnalysis.zoneSummaries.find(
    (zone) => zone.id === 'top-face'
  )
  expect(
    topTriangleFillSummary,
    JSON.stringify(fillPreservationAnalysis, null, 2)
  ).toBeTruthy()
  expect(
    topTriangleFillSummary?.farFillSampleCount,
    JSON.stringify({ topTriangleFillSummary }, null, 2)
  ).toBeGreaterThan(20)
  expect(
    topTriangleFillSummary?.redFarSampleCount,
    JSON.stringify({ topTriangleFillSummary }, null, 2)
  ).toBeLessThanOrEqual(topTriangleFillSummary?.maxAllowedRedFarSamples ?? -1)
  const adjacencyWidthFailureSummary = JSON.stringify(
    {
      sampleCount: adjacencyWidthAnalysis.sampleCount,
      sharedWidths: adjacencyWidthAnalysis.sharedWidths,
      normalWidths: adjacencyWidthAnalysis.normalWidths,
      sharedStartWidthProfile: adjacencyWidthAnalysis.sharedStartWidthProfile,
      sharedEndWidthProfile: adjacencyWidthAnalysis.sharedEndWidthProfile,
      sharedMedian: adjacencyWidthAnalysis.sharedMedian,
      normalMedian: adjacencyWidthAnalysis.normalMedian,
      ratio: adjacencyWidthAnalysis.ratio,
      sharedEdgeAnalyses: adjacencyWidthAnalysis.sharedEdgeAnalyses,
      combinedSharedEdgeAnalyses:
        adjacencyWidthAnalysis.combinedSharedEdgeAnalyses,
      cornerProtrusionAnalyses: adjacencyWidthAnalysis.cornerProtrusionAnalyses,
      connectedCornerProtrusionCount:
        adjacencyWidthAnalysis.connectedCornerProtrusionCount,
      lowerHighCurvatureAnalyses:
        adjacencyWidthAnalysis.lowerHighCurvatureAnalyses,
      outerSourceVertexAnalysis,
      sourceSegmentAdherenceAnalysis,
      sourcePathContinuityAnalysis,
      minSharedRatio: adjacencyWidthAnalysis.minSharedRatio,
      maxSharedRatio: adjacencyWidthAnalysis.maxSharedRatio,
      fragmentedInternalPentagonGate: {
        strictLegalRedPixelCount: legalAnalysis.strictLegalRedPixelCount,
        maxStrictInsideComponentArea:
          legalAnalysis.maxStrictInsideComponentArea,
        strictInsideLargestComponentRatio:
          legalAnalysis.strictLegalRedPixelCount > 0
            ? legalAnalysis.maxStrictInsideComponentArea /
              legalAnalysis.strictLegalRedPixelCount
            : 0,
        strictInsideComponentAreas:
          legalAnalysis.strictInsideComponentAreas.slice(0, 16)
      },
      endpointProtrusionConnected:
        adjacencyWidthAnalysis.endpointProtrusionConnected,
      sharedBoundaryTransitionPresent:
        adjacencyWidthAnalysis.sharedBoundaryTransitionPresent,
      sharedTrace: adjacencyWidthAnalysis.sharedTrace,
      normalTrace: adjacencyWidthAnalysis.normalTrace,
      packetCount: adjacencyWidthAnalysis.packets.length
    },
    null,
    2
  )
  const hasFaceOwnershipTrace = adjacencyWidthAnalysis.sampleCount > 0
  if (hasFaceOwnershipTrace) {
    expect(
      adjacencyWidthAnalysis.sharedEdgeAnalyses.length,
      adjacencyWidthFailureSummary
    ).toBeGreaterThan(0)
    adjacencyWidthAnalysis.sharedEdgeAnalyses.forEach((analysis) => {
      expect(
        analysis.normalMedian / 10,
        adjacencyWidthFailureSummary
      ).toBeGreaterThanOrEqual(0.4)
      expect(
        analysis.normalMedian / 10,
        adjacencyWidthFailureSummary
      ).toBeLessThanOrEqual(1.25)
      expect(
        analysis.ratio,
        adjacencyWidthFailureSummary
      ).toBeGreaterThanOrEqual(0.35)
      expect(analysis.ratio, adjacencyWidthFailureSummary).toBeLessThanOrEqual(
        1.05
      )
    })
    adjacencyWidthAnalysis.combinedSharedEdgeAnalyses.forEach((analysis) => {
      expect(
        analysis.combinedRatio,
        adjacencyWidthFailureSummary
      ).toBeGreaterThanOrEqual(0.85)
      expect(
        analysis.combinedRatio,
        adjacencyWidthFailureSummary
      ).toBeLessThanOrEqual(2.25)
    })
    expect(
      adjacencyWidthAnalysis.maxSharedRatio,
      adjacencyWidthFailureSummary
    ).toBeLessThanOrEqual(1.05)
    expect(
      adjacencyWidthAnalysis.normalMedian / 10,
      adjacencyWidthFailureSummary
    ).toBeGreaterThanOrEqual(0.4)
    expect(
      adjacencyWidthAnalysis.normalMedian / 10,
      adjacencyWidthFailureSummary
    ).toBeLessThanOrEqual(1.25)
    expect(
      adjacencyWidthAnalysis.ratio,
      adjacencyWidthFailureSummary
    ).toBeGreaterThanOrEqual(0.35)
    expect(
      adjacencyWidthAnalysis.ratio,
      adjacencyWidthFailureSummary
    ).toBeLessThanOrEqual(1.05)
    expect(
      adjacencyWidthAnalysis.endpointProtrusionConnected,
      adjacencyWidthFailureSummary
    ).toBe(true)
    expect(
      adjacencyWidthAnalysis.cornerProtrusionAnalyses.length,
      adjacencyWidthFailureSummary
    ).toBeGreaterThanOrEqual(5)
    expect(
      adjacencyWidthAnalysis.connectedCornerProtrusionCount,
      adjacencyWidthFailureSummary
    ).toBeGreaterThanOrEqual(5)
    adjacencyWidthAnalysis.lowerHighCurvatureAnalyses.forEach((analysis) => {
      expect(
        analysis.sampleCount,
        adjacencyWidthFailureSummary
      ).toBeGreaterThan(0)
      expect(
        analysis.coverageRatio,
        adjacencyWidthFailureSummary
      ).toBeGreaterThan(0.2)
    })
    const rightBottomSourceSegmentAdherence =
      adjacencyWidthAnalysis.lowerHighCurvatureAnalyses.find(
        (analysis) =>
          analysis.id === 'inside-solid-lower-right-high-curvature-no-gap'
      )
    expect(
      rightBottomSourceSegmentAdherence,
      adjacencyWidthFailureSummary
    ).toBeTruthy()
    expect(
      rightBottomSourceSegmentAdherence?.coverageRatio ?? 0,
      adjacencyWidthFailureSummary
    ).toBeGreaterThanOrEqual(0.35)
  } else {
    expect(
      solidMaskModelPackets.every(
        (packet) =>
          packet.solidMaskModelCoverageOracle === 'render-mask' &&
          packet.solidMaskModelFaceOwnershipTrace.length === 0
      ),
      adjacencyWidthFailureSummary
    ).toBe(true)
  }
  expect(
    outerSourceVertexAnalysis.anchorCount,
    adjacencyWidthFailureSummary
  ).toBeGreaterThanOrEqual(5)
  expect(
    outerSourceVertexAnalysis.missingAnalyses.length,
    adjacencyWidthFailureSummary
  ).toBeLessThanOrEqual(1)
  expect(
    outerSourceVertexAnalysis.missingAnalyses.every(
      (analysis) => analysis.coverageRatio >= 0.35
    ),
    adjacencyWidthFailureSummary
  ).toBe(true)
  expect(
    sourceSegmentAdherenceAnalysis.failedAnalyses,
    adjacencyWidthFailureSummary
  ).toEqual([])
  expect(
    sourcePathContinuityAnalysis.coverageRatio,
    adjacencyWidthFailureSummary
  ).toBeGreaterThanOrEqual(0.85)
  const strictInsideLargestComponentRatio =
    legalAnalysis.strictLegalRedPixelCount > 0
      ? legalAnalysis.maxStrictInsideComponentArea /
        legalAnalysis.strictLegalRedPixelCount
      : 0
  expect(
    strictInsideLargestComponentRatio,
    `fragmented internal pentagon: largest visible component is too small; ${adjacencyWidthFailureSummary}`
  ).toBeGreaterThanOrEqual(0.4)
  expect(
    legalAnalysis.strictInsideComponentAreas.filter((area) => area > 100)
      .length,
    `fragmented internal pentagon: too many disconnected substantial strict-inside components; ${adjacencyWidthFailureSummary}`
  ).toBeLessThanOrEqual(6)

  await testInfo.attach('inside-solid-global-review', {
    path: paths.screenshot,
    contentType: 'image/png'
  })

  const focusInsideSolidLocalPoint = async (
    zone: (typeof INSIDE_SOLID_FILL_PRESERVATION_ZONES)[number],
    screenshotPath: string,
    attachmentName: string
  ) => {
    const summary = fillPreservationAnalysis.zoneSummaries.find(
      (entry) => entry.id === zone.id
    )
    expect(
      summary,
      JSON.stringify(fillPreservationAnalysis, null, 2)
    ).toBeTruthy()
    expect(
      summary?.redFarSampleCount,
      JSON.stringify({ zone: zone.id, summary }, null, 2)
    ).toBeLessThanOrEqual(summary?.maxAllowedRedFarSamples ?? -1)

    const viewportSize = page.viewportSize()
    if (!viewportSize) {
      throw new Error('Missing viewport size')
    }
    const canvasCenter = {
      x: 240 + (viewportSize.width - 480) / 2,
      y: 48 + (viewportSize.height - 148) / 2
    }
    await page.evaluate(
      ({ canvasCenter, point, rect }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const secondaryRect = (window as any).__selfCheckVectorRect
        const targetRect =
          secondaryRect &&
          typeof secondaryRect.x === 'number' &&
          typeof secondaryRect.y === 'number' &&
          typeof secondaryRect.width === 'number' &&
          typeof secondaryRect.height === 'number'
            ? secondaryRect
            : rect
        if (!core) {
          throw new Error('Missing app core')
        }
        const zoom = 4
        core.setSystemProperty('zoom', zoom)
        core.setSystemProperty('viewportPosition', {
          x: canvasCenter.x - (targetRect.x + point.x) * zoom,
          y: canvasCenter.y - (targetRect.y + point.y) * zoom
        })
      },
      { canvasCenter, point: zone.focus, rect: SELF_CHECK_VECTOR_RECT }
    )
    await page.waitForTimeout(500)
    const screenshot = await page.screenshot({
      path: screenshotPath,
      fullPage: false
    })
    await testInfo.attach(attachmentName, {
      path: screenshotPath,
      contentType: 'image/png'
    })
    const localAnalysis = await analyzeInsideSolidLocalFillProbe(
      page,
      screenshot,
      canvasCenter,
      attachmentName
    )
    expect(
      localAnalysis.sampleCount,
      JSON.stringify(localAnalysis, null, 2)
    ).toBeGreaterThan(0)
  }

  const focusInsideSolidAdjacencyPoint = async () => {
    const trace = adjacencyWidthAnalysis.sharedTrace
    expect(trace, JSON.stringify(adjacencyWidthAnalysis, null, 2)).toBeTruthy()
    const focus = trace
      ? {
          x: (trace.start.x + trace.end.x) / 2,
          y: (trace.start.y + trace.end.y) / 2
        }
      : { x: 190, y: 105 }
    const viewportSize = page.viewportSize()
    if (!viewportSize) {
      throw new Error('Missing viewport size')
    }
    const canvasCenter = {
      x: 240 + (viewportSize.width - 480) / 2,
      y: 48 + (viewportSize.height - 148) / 2
    }
    await page.evaluate(
      ({ canvasCenter, point, rect, zoom }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const secondaryRect = (window as any).__selfCheckVectorRect
        const targetRect =
          secondaryRect &&
          typeof secondaryRect.x === 'number' &&
          typeof secondaryRect.y === 'number' &&
          typeof secondaryRect.width === 'number' &&
          typeof secondaryRect.height === 'number'
            ? secondaryRect
            : rect
        if (!core) {
          throw new Error('Missing app core')
        }
        core.setSystemProperty('zoom', zoom)
        core.setSystemProperty('viewportPosition', {
          x: canvasCenter.x - (targetRect.x + point.x) * zoom,
          y: canvasCenter.y - (targetRect.y + point.y) * zoom
        })
      },
      {
        canvasCenter,
        point: focus,
        rect: SELF_CHECK_VECTOR_RECT,
        zoom: INSIDE_SOLID_LOCAL_REVIEW_ZOOM
      }
    )
    await page.waitForTimeout(500)
    const screenshotPath = path.join(
      ARTIFACT_DIR,
      'self-check-inside-solid-upper-left-adjacency-app-zoom-review.png'
    )
    await page.screenshot({
      path: screenshotPath,
      fullPage: false
    })
    await testInfo.attach('inside-solid-upper-left-adjacency-app-zoom-review', {
      path: screenshotPath,
      contentType: 'image/png'
    })
  }

  if (hasFaceOwnershipTrace) {
    await focusInsideSolidAdjacencyPoint()
  }

  const focusInsideSolidProbePoint = async (
    point: Vec2,
    screenshotName: string,
    attachmentName: string
  ) => {
    const viewportSize = page.viewportSize()
    if (!viewportSize) {
      throw new Error('Missing viewport size')
    }
    const canvasCenter = {
      x: 240 + (viewportSize.width - 480) / 2,
      y: 48 + (viewportSize.height - 148) / 2
    }
    await page.evaluate(
      ({ canvasCenter, point, rect, zoom }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const secondaryRect = (window as any).__selfCheckVectorRect
        const targetRect =
          secondaryRect &&
          typeof secondaryRect.x === 'number' &&
          typeof secondaryRect.y === 'number' &&
          typeof secondaryRect.width === 'number' &&
          typeof secondaryRect.height === 'number'
            ? secondaryRect
            : rect
        if (!core) {
          throw new Error('Missing app core')
        }
        core.setSystemProperty('zoom', zoom)
        core.setSystemProperty('viewportPosition', {
          x: canvasCenter.x - (targetRect.x + point.x) * zoom,
          y: canvasCenter.y - (targetRect.y + point.y) * zoom
        })
      },
      {
        canvasCenter,
        point,
        rect: SELF_CHECK_VECTOR_RECT,
        zoom: INSIDE_SOLID_LOCAL_REVIEW_ZOOM
      }
    )
    await page.waitForTimeout(500)
    const screenshotPath = path.join(ARTIFACT_DIR, screenshotName)
    const screenshot = await page.screenshot({
      path: screenshotPath,
      fullPage: false
    })
    await testInfo.attach(attachmentName, {
      path: screenshotPath,
      contentType: 'image/png'
    })
    return screenshot
  }

  if (hasFaceOwnershipTrace) {
    for (const [
      index,
      corner
    ] of adjacencyWidthAnalysis.cornerProtrusionAnalyses
      .slice(0, 5)
      .entries()) {
      await focusInsideSolidProbePoint(
        corner.vertex,
        `self-check-inside-solid-internal-corner-${index + 1}-app-zoom-review.png`,
        `inside-solid-internal-corner-${index + 1}-app-zoom-review`
      )
    }

    for (const analysis of adjacencyWidthAnalysis.lowerHighCurvatureAnalyses) {
      if (analysis.target) {
        const localScreenshot = await focusInsideSolidProbePoint(
          analysis.target.vertex,
          `self-check-${analysis.id}-app-zoom-review.png`,
          `${analysis.id}-app-zoom-review`
        )
        const localMetadata = await getSelfCheckMetadata(page)
        const localAdjacencyAnalysis = await analyzeInsideSolidAdjacencyWidth(
          page,
          localScreenshot,
          localMetadata
        )
        const localHighCurvatureAnalysis =
          localAdjacencyAnalysis.lowerHighCurvatureAnalyses.find(
            (entry) => entry.id === analysis.id
          )
        const localFailureSummary = JSON.stringify(
          {
            id: analysis.id,
            zoom: localMetadata.zoom,
            localHighCurvatureAnalysis,
            lowerHighCurvatureAnalyses:
              localAdjacencyAnalysis.lowerHighCurvatureAnalyses
          },
          null,
          2
        )
        expect(localMetadata.zoom, localFailureSummary).toBe(
          INSIDE_SOLID_LOCAL_REVIEW_ZOOM
        )
        expect(
          localHighCurvatureAnalysis?.sampleCount ?? 0,
          localFailureSummary
        ).toBeGreaterThan(0)
        expect(
          localHighCurvatureAnalysis?.coverageRatio ?? 0,
          localFailureSummary
        ).toBeGreaterThanOrEqual(0.3)
      }
    }
  }

  for (const [index, anchor] of SELF_CHECK_SOURCE_ANCHOR_POINTS.entries()) {
    const localScreenshot = await focusInsideSolidProbePoint(
      anchor,
      `self-check-inside-solid-outer-source-vertex-${index + 1}-app-zoom-review.png`,
      `inside-solid-outer-source-vertex-${index + 1}-app-zoom-review`
    )
    const localMetadata = await getSelfCheckMetadata(page)
    const localOuterSourceVertexAnalysis =
      await analyzeInsideSolidOuterSourceVertexCoverage(
        page,
        localScreenshot,
        localMetadata
      )
    const localAnchorAnalysis = localOuterSourceVertexAnalysis.analyses.find(
      (entry) => entry.anchorIndex === index
    )
    expect(
      localAnchorAnalysis?.coverageRatio ?? 0,
      JSON.stringify(
        {
          index,
          zoom: localMetadata.zoom,
          localAnchorAnalysis,
          localOuterSourceVertexAnalysis
        },
        null,
        2
      )
    ).toBeGreaterThanOrEqual(0.35)
  }

  for (const probe of INSIDE_SOLID_SOURCE_SEGMENT_ADHERENCE_PROBES) {
    const localScreenshot = await focusInsideSolidProbePoint(
      probe.focus,
      `self-check-${probe.id}-2000pct-source-segment-review.png`,
      `${probe.id}-2000pct-source-segment-review`
    )
    const localMetadata = await getSelfCheckMetadata(page)
    const localSourceSegmentAdherenceAnalysis =
      await analyzeInsideSolidSourceSegmentAdherence(
        page,
        localScreenshot,
        localMetadata
      )
    const localProbeAnalysis =
      localSourceSegmentAdherenceAnalysis.analyses.find(
        (entry) => entry.id === probe.id
      )
    expect(
      localMetadata.zoom,
      JSON.stringify({ probe: probe.id, zoom: localMetadata.zoom }, null, 2)
    ).toBe(INSIDE_SOLID_LOCAL_REVIEW_ZOOM)
    expect(
      localProbeAnalysis?.coverageRatio ?? 0,
      JSON.stringify(
        {
          probe: probe.id,
          localProbeAnalysis,
          localSourceSegmentAdherenceAnalysis
        },
        null,
        2
      )
    ).toBeGreaterThanOrEqual(0.88)
  }

  expect(
    legalAnalysis.outsideRedPixelCount,
    JSON.stringify(legalAnalysis, null, 2)
  ).toBe(0)
  expect(
    legalAnalysis.maxOutsideComponentArea,
    JSON.stringify(legalAnalysis, null, 2)
  ).toBe(0)

  for (const zone of INSIDE_SOLID_FILL_PRESERVATION_ZONES) {
    await focusInsideSolidLocalPoint(
      zone,
      path.join(
        ARTIFACT_DIR,
        `self-check-inside-solid-${zone.id}-app-zoom-review.png`
      ),
      `inside-solid-${zone.id}-app-zoom-review`
    )
  }
})

test('self-check: self-intersecting inside solid reload stays on the bounded masked-source-stroke path', async ({
  page
}) => {
  test.setTimeout(20_000)
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await installVectorRenderPhaseProfiler(page)
  await createSelfCheckStar(page, {
    capType: 'round',
    joinType: 'miter',
    position: 'inside',
    style: 'solid'
  })
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.()
    return Boolean(computed?.strokes?.length && computed?.fills?.length)
  })
  const beforeReload = await getSelfCheckMetadata(page)
  expect(beforeReload.exportPacketCount).toBeGreaterThan(0)

  await saveCurrentFileToLocalStorage(page)
  await page.addInitScript(() => {
    ;(
      window as typeof window & {
        __ASYRA_STROKE_DIAGNOSTICS_MODE__?: 'full'
      }
    ).__ASYRA_STROKE_DIAGNOSTICS_MODE__ = 'full'
  })
  const reloadStart = Date.now()
  await page.reload()
  await waitForAppReady(page)
  const reloadElapsedMs = Date.now() - reloadStart

  await expect
    .poll(async () => {
      const metadata = await getSelfCheckMetadata(page)
      return {
        selectedId: metadata.selectedId,
        exportPacketCount: metadata.exportPacketCount,
        productPacketCount: metadata.boundaryDomainPackets.filter(
          (packet) =>
            packet.productSignature?.startsWith('constrained-solid:') ===
              true &&
            packet.strokePosition === 'inside' &&
            packet.solidMaskModelVisibleRender === 'masked-source-stroke' &&
            packet.solidMaskModelVisibleMaskMode ===
              'inside-fill-source-stroke-clip'
        ).length,
        dashedTerminalPacketCount: metadata.boundaryDomainPackets.filter(
          (packet) =>
            packet.domainPlanTerminalRole !== null ||
            packet.domainPlanSplitRangeTerminals.length > 0
        ).length
      }
    })
    .toMatchObject({
      selectedId: beforeReload.selectedId,
      exportPacketCount: beforeReload.exportPacketCount,
      productPacketCount: 1,
      dashedTerminalPacketCount: 0
    })

  const phaseSamples = await getVectorRenderPhaseSamples(page)
  const slowPhaseSamples = phaseSamples.filter(
    (sample) =>
      (sample.phaseName.includes('constrained solid') ||
        sample.phaseName.includes('constrained-solid') ||
        sample.phaseName.includes('solid-center')) &&
      sample.durationMs > 1_000
  )
  const constrainedSolidDurationMs = phaseSamples
    .filter(
      (sample) =>
        sample.phaseName.includes('constrained solid') ||
        sample.phaseName.includes('constrained-solid')
    )
    .reduce((sum, sample) => sum + sample.durationMs, 0)
  if (process.env.ASYRA_STROKE_API_PROFILE === '1') {
    console.info('[inside solid reload profile]', {
      reloadElapsedMs,
      constrainedSolidDurationMs,
      phaseSamples
    })
  }

  expect(reloadElapsedMs).toBeLessThan(5_000)
  expect(
    constrainedSolidDurationMs,
    JSON.stringify({ constrainedSolidDurationMs, phaseSamples }, null, 2)
  ).toBeLessThan(1_500)
  expect(slowPhaseSamples, JSON.stringify(slowPhaseSamples, null, 2)).toEqual(
    []
  )
  expect(consoleErrors).toEqual([])
})

test('self-check: self-intersecting outside solid uses solidMaskModel and excludes filled-filled internal adjacency', async ({
  page
}, testInfo) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  const paths = getSelfCheckArtifactPaths('round', 'fill', 'outside', 'solid')

  await createSelfCheckStar(page, {
    includeStroke: false,
    capType: 'round',
    position: 'outside',
    style: 'solid'
  })
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.()
    return Boolean(computed?.fills?.length)
  })
  await page.waitForTimeout(300)
  const baselineScreenshot = await page.screenshot({ fullPage: false })

  await resetCanvas(page)
  await createSelfCheckStar(page, {
    capType: 'round',
    position: 'outside',
    style: 'solid'
  })
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.()
    return Boolean(computed?.strokes?.length && computed?.fills?.length)
  })
  await page.waitForTimeout(1000)

  const metadata = await getSelfCheckMetadata(page)
  fs.writeFileSync(paths.metadata, `${JSON.stringify(metadata, null, 2)}\n`)
  const actualScreenshot = await page.screenshot({
    path: paths.screenshot,
    fullPage: false
  })
  const legalAnalysis = await analyzeSelfCheckScreenshots(
    page,
    baselineScreenshot,
    actualScreenshot,
    metadata
  )
  const continuityAnalysis = await analyzeSolidBoundaryContinuity(
    page,
    actualScreenshot,
    metadata,
    'outside'
  )
  fs.writeFileSync(
    paths.analysis,
    `${JSON.stringify(legalAnalysis, null, 2)}\n`
  )

  const boundaryRoles = metadata.boundaryDomainPackets.flatMap((packet) => [
    packet.domainPlanBoundaryRole,
    ...packet.domainPlanSplitRangeTerminals.map(
      (terminal) => terminal.boundaryRole
    )
  ])
  const sideRecords = metadata.boundaryDomainPackets.flatMap((packet) => [
    {
      selectedSide: packet.domainPlanSelectedSide,
      filledSide: packet.domainPlanFilledSide,
      unfilledSide: packet.domainPlanUnfilledSide
    },
    ...packet.domainPlanSplitRangeTerminals.map((terminal) => ({
      selectedSide: terminal.selectedSide,
      filledSide: terminal.filledSide,
      unfilledSide: terminal.unfilledSide
    }))
  ])

  expect(metadata.exportPacketCount).toBeGreaterThan(0)
  expect(
    boundaryRoles.includes('filled-face'),
    JSON.stringify(metadata.boundaryDomainPackets, null, 2)
  ).toBe(false)
  expect(
    metadata.boundaryDomainPackets.every(
      (packet) =>
        packet.productSignature?.startsWith('constrained-solid:') === true &&
        packet.topologyFamily === 'self-intersecting' &&
        packet.productMode === 'closed-constrained-domain'
    ),
    JSON.stringify(metadata.boundaryDomainPackets, null, 2)
  ).toBe(true)
  expect(
    metadata.boundaryDomainPackets.some(
      (packet) =>
        packet.geometryId?.includes(':boundary-domain:') === true ||
        packet.domainPlanTerminalRole !== null ||
        packet.domainPlanSplitRangeTerminals.length > 0
    ),
    JSON.stringify(metadata.boundaryDomainPackets, null, 2)
  ).toBe(false)
  expect(boundaryRoles.every((role) => role === 'outer')).toBe(true)
  expect(
    sideRecords.every(
      (record) =>
        record.selectedSide === record.unfilledSide &&
        record.filledSide !== record.unfilledSide
    ),
    JSON.stringify(sideRecords, null, 2)
  ).toBe(true)
  const outsideSolidPackets = metadata.boundaryDomainPackets.filter(
    (packet) =>
      packet.productSignature?.startsWith('constrained-solid:') === true &&
      packet.strokePosition === 'outside'
  )
  expect(
    outsideSolidPackets.every(
      (packet) =>
        packet.solidMaskModelVisibleRender === 'masked-source-stroke' &&
        packet.solidMaskModelCoverageOracle === 'render-mask' &&
        packet.solidMaskModelMaskSide === 'outside-exterior'
    ),
    JSON.stringify(outsideSolidPackets, null, 2)
  ).toBe(true)
  expect(legalAnalysis.redPixelCount).toBeGreaterThan(1000)
  expect(
    legalAnalysis.strictLegalRedPixelCount,
    JSON.stringify(legalAnalysis, null, 2)
  ).toBeLessThan(500)
  expect(
    legalAnalysis.maxStrictInsideComponentArea,
    JSON.stringify(legalAnalysis, null, 2)
  ).toBeLessThan(500)
  expect(
    continuityAnalysis.sampleCount,
    JSON.stringify(continuityAnalysis, null, 2)
  ).toBeGreaterThan(150)
  expect(
    continuityAnalysis.failureCount,
    JSON.stringify(continuityAnalysis, null, 2)
  ).toBe(0)
  expect(
    legalAnalysis.darkOverdrawPixelCount,
    JSON.stringify(legalAnalysis, null, 2)
  ).toBeLessThan(4)
  expect(
    legalAnalysis.maxDarkOverdrawComponentArea,
    JSON.stringify(legalAnalysis, null, 2)
  ).toBeLessThan(4)

  await testInfo.attach('outside-solid-global-review', {
    path: paths.screenshot,
    contentType: 'image/png'
  })

  const focusSelfCheckLocalPoint = async (
    point: Vec2,
    zoom: number,
    screenshotPath: string,
    attachmentName: string,
    assertNoCrack = true
  ) => {
    const viewportSize = page.viewportSize()
    if (!viewportSize) {
      throw new Error('Missing viewport size')
    }
    const canvasCenter = {
      x: 240 + (viewportSize.width - 480) / 2,
      y: 48 + (viewportSize.height - 148) / 2
    }
    await page.evaluate(
      ({ canvasCenter, point, rect, zoom }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const secondaryRect = (window as any).__selfCheckVectorRect
        const targetRect =
          secondaryRect &&
          typeof secondaryRect.x === 'number' &&
          typeof secondaryRect.y === 'number' &&
          typeof secondaryRect.width === 'number' &&
          typeof secondaryRect.height === 'number'
            ? secondaryRect
            : rect
        if (!core) {
          throw new Error('Missing app core')
        }
        core.setSystemProperty('zoom', zoom)
        core.setSystemProperty('viewportPosition', {
          x: canvasCenter.x - (targetRect.x + point.x) * zoom,
          y: canvasCenter.y - (targetRect.y + point.y) * zoom
        })
      },
      { canvasCenter, point, rect: SELF_CHECK_VECTOR_RECT, zoom }
    )
    await page.waitForTimeout(500)
    const screenshot = await page.screenshot({
      path: screenshotPath,
      fullPage: false
    })
    await testInfo.attach(attachmentName, {
      path: screenshotPath,
      contentType: 'image/png'
    })
    const crackAnalysis = await analyzeSolidLocalBlackCrack(
      page,
      screenshot,
      canvasCenter,
      attachmentName
    )
    if (assertNoCrack) {
      expect(
        crackAnalysis.maxCrackComponentArea,
        JSON.stringify(crackAnalysis, null, 2)
      ).toBeLessThan(4)
    }
    return crackAnalysis
  }

  await focusSelfCheckLocalPoint(
    SELF_CHECK_SOURCE_POINTS['tp-13'],
    4.25,
    path.join(
      ARTIFACT_DIR,
      'self-check-outside-solid-round-left-bottom-app-zoom-review.png'
    ),
    'outside-solid-left-bottom-app-zoom-review'
  )
  await focusSelfCheckLocalPoint(
    SELF_CHECK_SOURCE_POINTS['tp-16'],
    4.25,
    path.join(
      ARTIFACT_DIR,
      'self-check-outside-solid-round-right-bottom-app-zoom-review.png'
    ),
    'outside-solid-right-bottom-app-zoom-review'
  )
  await focusSelfCheckLocalPoint(
    SELF_CHECK_SOURCE_POINTS['tp-15'],
    4,
    path.join(
      ARTIFACT_DIR,
      'self-check-outside-solid-round-top-app-zoom-review.png'
    ),
    'outside-solid-top-app-zoom-review',
    false
  )
})
;(
  [
    { position: 'outside', joinType: 'round' },
    { position: 'outside', joinType: 'bevel' },
    { position: 'inside', joinType: 'miter' },
    { position: 'inside', joinType: 'bevel' },
    { position: 'inside', joinType: 'round' }
  ] as {
    position: SelfCheckStrokePosition
    joinType: SelfCheckJoinType
  }[]
).forEach(({ position, joinType }) => {
  test(`self-check: self-intersecting solid join matrix ${position} ${joinType} keeps mask legality isolated from join changes`, async ({
    page
  }, testInfo) => {
    testInfo.setTimeout(90_000)
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
    const paths = getSelfCheckSolidJoinArtifactPaths(position, joinType)

    await resetCanvas(page)
    await createSelfCheckStar(page, {
      includeStroke: false,
      capType: 'round',
      joinType,
      position,
      style: 'solid'
    })
    await page.waitForFunction(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const element = selectedId
        ? core?.deps?.sceneTree?.getElementById?.(selectedId)
        : null
      const computed = element?.getAllComputedData?.()
      return Boolean(computed?.fills?.length)
    })
    await page.waitForTimeout(300)
    const baselineScreenshot = await page.screenshot({ fullPage: false })

    await resetCanvas(page)
    await createSelfCheckStar(page, {
      capType: 'round',
      joinType,
      position,
      style: 'solid'
    })
    await page.waitForFunction(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const element = selectedId
        ? core?.deps?.sceneTree?.getElementById?.(selectedId)
        : null
      const computed = element?.getAllComputedData?.()
      return Boolean(computed?.strokes?.length && computed?.fills?.length)
    })
    await page.waitForTimeout(800)

    const metadata = await getSelfCheckMetadata(page)
    fs.writeFileSync(paths.metadata, `${JSON.stringify(metadata, null, 2)}\n`)
    const actualScreenshot = await page.screenshot({
      path: paths.screenshot,
      fullPage: false
    })
    const legalAnalysis = await analyzeSelfCheckScreenshots(
      page,
      baselineScreenshot,
      actualScreenshot,
      metadata
    )
    fs.writeFileSync(
      paths.analysis,
      `${JSON.stringify(legalAnalysis, null, 2)}\n`
    )

    const productPackets = metadata.boundaryDomainPackets.filter(
      (packet) =>
        packet.productSignature?.startsWith('constrained-solid:') === true
    )
    expect(
      productPackets.length,
      JSON.stringify({ position, joinType, metadata }, null, 2)
    ).toBeGreaterThan(0)
    expect(
      productPackets.every(
        (packet) =>
          packet.topologyFamily === 'self-intersecting' &&
          packet.productMode === 'closed-constrained-domain' &&
          packet.domainPlanTerminalRole === null &&
          packet.domainPlanSplitRangeTerminals.length === 0
      ),
      JSON.stringify({ position, joinType, productPackets }, null, 2)
    ).toBe(true)
    expect(
      legalAnalysis.redPixelCount,
      JSON.stringify({ position, joinType, legalAnalysis }, null, 2)
    ).toBeGreaterThan(1000)

    if (position === 'outside') {
      expect(
        legalAnalysis.strictLegalRedPixelCount,
        JSON.stringify({ position, joinType, legalAnalysis }, null, 2)
      ).toBeLessThan(500)
      expect(
        legalAnalysis.maxStrictInsideComponentArea,
        JSON.stringify({ position, joinType, legalAnalysis }, null, 2)
      ).toBeLessThan(500)
    } else {
      expect(
        legalAnalysis.outsideRedPixelCount,
        JSON.stringify({ position, joinType, legalAnalysis }, null, 2)
      ).toBe(0)
      expect(
        legalAnalysis.maxOutsideComponentArea,
        JSON.stringify({ position, joinType, legalAnalysis }, null, 2)
      ).toBe(0)
    }
    if (position === 'outside') {
      expect(
        legalAnalysis.darkOverdrawPixelCount,
        JSON.stringify({ position, joinType, legalAnalysis }, null, 2)
      ).toBeLessThan(4)
      expect(
        legalAnalysis.maxDarkOverdrawComponentArea,
        JSON.stringify({ position, joinType, legalAnalysis }, null, 2)
      ).toBeLessThan(4)
    }

    await testInfo.attach(`${position}-solid-${joinType}-join-global`, {
      path: paths.screenshot,
      contentType: 'image/png'
    })
  })
})

test('self-check: self-intersecting inside solid internal corner join shapes follow strokeJoin', async ({
  page
}, testInfo) => {
  testInfo.setTimeout(120_000)
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

  const screenshots: Partial<Record<SelfCheckJoinType, Buffer>> = {}
  const metadataByJoin: Partial<
    Record<SelfCheckJoinType, Awaited<ReturnType<typeof getSelfCheckMetadata>>>
  > = {}
  const localScreenshots: Record<SelfCheckJoinType, Buffer[]> = {
    miter: [],
    bevel: [],
    round: []
  }
  let internalCornerCenters: Vec2[] = []
  let maskOnlyCornerProbes: { vertex: Vec2; samplePoints: Vec2[] }[] = []

  const focusInternalCorner = async (
    joinType: SelfCheckJoinType,
    point: Vec2,
    index: number
  ) => {
    const viewportSize = page.viewportSize()
    if (!viewportSize) {
      throw new Error('Missing viewport size')
    }
    const canvasCenter = {
      x: 240 + (viewportSize.width - 480) / 2,
      y: 48 + (viewportSize.height - 148) / 2
    }
    await page.evaluate(
      ({ canvasCenter, point, rect, zoom }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const secondaryRect = (window as any).__selfCheckVectorRect
        const targetRect =
          secondaryRect &&
          typeof secondaryRect.x === 'number' &&
          typeof secondaryRect.y === 'number' &&
          typeof secondaryRect.width === 'number' &&
          typeof secondaryRect.height === 'number'
            ? secondaryRect
            : rect
        if (!core) {
          throw new Error('Missing app core')
        }
        core.setSystemProperty('zoom', zoom)
        core.setSystemProperty('viewportPosition', {
          x: canvasCenter.x - (targetRect.x + point.x) * zoom,
          y: canvasCenter.y - (targetRect.y + point.y) * zoom
        })
      },
      {
        canvasCenter,
        point,
        rect: SELF_CHECK_VECTOR_RECT,
        zoom: INSIDE_SOLID_LOCAL_REVIEW_ZOOM
      }
    )
    await page.waitForTimeout(500)
    const screenshotPath = path.join(
      ARTIFACT_DIR,
      `self-check-inside-solid-${joinType}-internal-corner-${index + 1}-join-shape-review.png`
    )
    const screenshot = await page.screenshot({
      path: screenshotPath,
      fullPage: false
    })
    await testInfo.attach(
      `inside-solid-${joinType}-internal-corner-${index + 1}-join-shape-review`,
      {
        path: screenshotPath,
        contentType: 'image/png'
      }
    )
    return screenshot
  }

  for (const joinType of ['miter', 'bevel', 'round'] as const) {
    await resetCanvas(page)
    await createSelfCheckStar(page, {
      capType: 'round',
      joinType,
      position: 'inside',
      style: 'solid'
    })
    await page.waitForFunction(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const element = selectedId
        ? core?.deps?.sceneTree?.getElementById?.(selectedId)
        : null
      const computed = element?.getAllComputedData?.()
      return Boolean(computed?.strokes?.length && computed?.fills?.length)
    })
    await page.waitForTimeout(800)

    const metadata = await getSelfCheckMetadata(page)
    metadataByJoin[joinType] = metadata
    const screenshotPath = path.join(
      ARTIFACT_DIR,
      `self-check-inside-solid-${joinType}-internal-corner-join-shape-global.png`
    )
    screenshots[joinType] = await page.screenshot({
      path: screenshotPath,
      fullPage: false
    })
    await testInfo.attach(
      `inside-solid-${joinType}-internal-corner-join-shape-global`,
      {
        path: screenshotPath,
        contentType: 'image/png'
      }
    )

    const packets = metadata.boundaryDomainPackets.filter(
      (packet) =>
        packet.productSignature?.startsWith('constrained-solid:') === true &&
        packet.strokePosition === 'inside'
    )
    const requiredRenderMaskProbes = [
      'top-triangle-mask-integrity',
      'inside-solid-outer-source-vertices-no-gap',
      'inside-solid-right-bottom-source-segment-adherence'
    ]
    const traceBackedAdjacencyProbes = [
      'internal-pentagon-shared-edge-half-width',
      'normal-width-comparison-edge',
      'internal-pentagon-endpoint-protrusion',
      'shared-boundary-width-transition',
      'all-internal-shared-edges-half-width',
      'all-internal-pentagon-corner-protrusions',
      'inside-solid-lower-left-high-curvature-no-gap',
      'inside-solid-lower-right-high-curvature-no-gap'
    ]
    const internalCornerJoinProbes = [
      'all-internal-pentagon-corner-join-shapes',
      'internal-pentagon-corner-join-shapes-only',
      'outer-triangle-corners-join-invariant',
      'non-pentagon-mask-corners-no-miter-spikes',
      'internal-pentagon-bevel-corners-no-overreach-crack',
      'internal-pentagon-round-corners-smooth'
    ]
    expect(
      packets.every((packet) => {
        const hasFaceOwnershipTrace =
          packet.solidMaskModelFaceOwnershipTrace.length > 0
        const hasInternalCornerProbe = internalCornerJoinProbes.some(
          (probeName) => packet.solidMaskModelAdjacencyProbe.includes(probeName)
        )
        return (
          packet.solidMaskModelVisibleRender === 'masked-source-stroke' &&
          packet.solidMaskModelCoverageOracle === 'render-mask' &&
          packet.solidMaskModelMaskSide === 'inside-fill' &&
          packet.solidMaskModelRejectedInternalCornerJoinMode !==
            'fixed-round-node-mask' &&
          packet.solidMaskModelRejectedInternalCornerJoinMode !==
            'fixed-endpoint-connector' &&
          requiredRenderMaskProbes.every((probeName) =>
            packet.solidMaskModelAdjacencyProbe.includes(probeName)
          ) &&
          (hasFaceOwnershipTrace
            ? traceBackedAdjacencyProbes.every((probeName) =>
                packet.solidMaskModelAdjacencyProbe.includes(probeName)
              )
            : traceBackedAdjacencyProbes.every(
                (probeName) =>
                  !packet.solidMaskModelAdjacencyProbe.includes(probeName)
              )) &&
          (hasInternalCornerProbe
            ? packet.solidMaskModelInternalCornerJoinMode ===
                'stroke-join-aware-face-corner' &&
              packet.solidMaskModelJoinEligibilityMode === 'internal-face-only'
            : packet.solidMaskModelInternalCornerJoinMode === null &&
              packet.solidMaskModelJoinEligibilityMode === null)
        )
      }),
      JSON.stringify({ joinType, packets }, null, 2)
    ).toBe(true)

    if (internalCornerCenters.length === 0) {
      internalCornerCenters =
        getInsideSolidInternalCornerCentersFromMetadata(metadata)
    }
    if (maskOnlyCornerProbes.length === 0) {
      maskOnlyCornerProbes =
        getInsideSolidMaskOnlyCornerProbesFromMetadata(metadata)
    }

    for (const [index, center] of internalCornerCenters.entries()) {
      localScreenshots[joinType][index] = await focusInternalCorner(
        joinType,
        center,
        index
      )
    }
  }

  if (internalCornerCenters.length === 0) {
    expect(
      Object.values(metadataByJoin).every((metadata) =>
        metadata.boundaryDomainPackets.every((packet) => {
          const internalCornerJoinProbes = [
            'all-internal-pentagon-corner-join-shapes',
            'internal-pentagon-corner-join-shapes-only',
            'outer-triangle-corners-join-invariant',
            'non-pentagon-mask-corners-no-miter-spikes',
            'internal-pentagon-bevel-corners-no-overreach-crack',
            'internal-pentagon-round-corners-smooth'
          ]
          return (
            packet.solidMaskModelCoverageOracle === 'render-mask' &&
            packet.solidMaskModelFaceOwnershipTrace.length === 0 &&
            internalCornerJoinProbes.every(
              (probeName) =>
                !packet.solidMaskModelAdjacencyProbe.includes(probeName)
            )
          )
        })
      ),
      JSON.stringify(metadataByJoin, null, 2)
    ).toBe(true)
    return
  }

  expect(
    internalCornerCenters.length,
    JSON.stringify({ internalCornerCenters, metadataByJoin }, null, 2)
  ).toBeGreaterThanOrEqual(5)
  expect(
    maskOnlyCornerProbes.length,
    JSON.stringify({ maskOnlyCornerProbes, metadataByJoin }, null, 2)
  ).toBeGreaterThanOrEqual(5)

  const miterVsBevel = await compareInsideSolidInternalCornerJoinPixels(
    page,
    screenshots.miter as Buffer,
    screenshots.bevel as Buffer,
    metadataByJoin.miter as Awaited<ReturnType<typeof getSelfCheckMetadata>>,
    internalCornerCenters
  )
  const miterVsRound = await compareInsideSolidInternalCornerJoinPixels(
    page,
    screenshots.miter as Buffer,
    screenshots.round as Buffer,
    metadataByJoin.miter as Awaited<ReturnType<typeof getSelfCheckMetadata>>,
    internalCornerCenters
  )
  const bevelVsRound = await compareInsideSolidInternalCornerJoinPixels(
    page,
    screenshots.bevel as Buffer,
    screenshots.round as Buffer,
    metadataByJoin.bevel as Awaited<ReturnType<typeof getSelfCheckMetadata>>,
    internalCornerCenters
  )
  const maskOnlyMiterVsBevel = await compareInsideSolidPointSamples(
    page,
    screenshots.miter as Buffer,
    screenshots.bevel as Buffer,
    metadataByJoin.miter as Awaited<ReturnType<typeof getSelfCheckMetadata>>,
    maskOnlyCornerProbes.flatMap((probe) => probe.samplePoints)
  )
  const maskOnlyMiterVsRound = await compareInsideSolidPointSamples(
    page,
    screenshots.miter as Buffer,
    screenshots.round as Buffer,
    metadataByJoin.miter as Awaited<ReturnType<typeof getSelfCheckMetadata>>,
    maskOnlyCornerProbes.flatMap((probe) => probe.samplePoints)
  )
  const maskOnlyBevelVsRound = await compareInsideSolidPointSamples(
    page,
    screenshots.bevel as Buffer,
    screenshots.round as Buffer,
    metadataByJoin.bevel as Awaited<ReturnType<typeof getSelfCheckMetadata>>,
    maskOnlyCornerProbes.flatMap((probe) => probe.samplePoints)
  )
  const compareLocalScreenshots = async (
    firstJoin: SelfCheckJoinType,
    secondJoin: SelfCheckJoinType
  ) => {
    const comparisons = await Promise.all(
      localScreenshots[firstJoin].map((firstScreenshot, index) =>
        compareCanvasAreaScreenshotPixels(
          page,
          firstScreenshot,
          localScreenshots[secondJoin][index] as Buffer
        )
      )
    )
    return {
      comparisons,
      changedPixelCount: comparisons.reduce(
        (sum, comparison) => sum + comparison.changedPixelCount,
        0
      ),
      changedRgbaPixelCount: comparisons.reduce(
        (sum, comparison) => sum + comparison.changedRgbaPixelCount,
        0
      ),
      comparedPixelCount: comparisons.reduce(
        (sum, comparison) => sum + comparison.comparedPixelCount,
        0
      )
    }
  }
  const localMiterVsBevel = await compareLocalScreenshots('miter', 'bevel')
  const localMiterVsRound = await compareLocalScreenshots('miter', 'round')
  const localBevelVsRound = await compareLocalScreenshots('bevel', 'round')
  ;[
    { comparisonName: 'miter-bevel', comparisonResult: localMiterVsBevel },
    { comparisonName: 'miter-round', comparisonResult: localMiterVsRound },
    { comparisonName: 'bevel-round', comparisonResult: localBevelVsRound }
  ].forEach(({ comparisonName, comparisonResult }) => {
    comparisonResult.comparisons.forEach((cornerComparison, cornerIndex) => {
      expect(
        cornerComparison.changedRgbaPixelCount,
        JSON.stringify(
          {
            message:
              'inside solid internal pentagon corners must visibly respond to strokeJoin',
            comparisonName,
            cornerIndex: cornerIndex + 1,
            cornerComparison,
            comparisonResult
          },
          null,
          2
        )
      ).toBeGreaterThan(0)
    })
  })

  expect(
    Math.min(
      miterVsBevel.firstRedCount,
      miterVsBevel.secondRedCount,
      miterVsRound.firstRedCount,
      miterVsRound.secondRedCount,
      bevelVsRound.firstRedCount,
      bevelVsRound.secondRedCount
    ),
    JSON.stringify({ miterVsBevel, miterVsRound, bevelVsRound }, null, 2)
  ).toBeGreaterThan(40)
  expect(
    Math.min(
      localMiterVsBevel.changedRgbaPixelCount,
      localMiterVsRound.changedRgbaPixelCount,
      localBevelVsRound.changedRgbaPixelCount
    ),
    JSON.stringify(
      {
        message:
          'inside solid internal face-corner visible pixels must vary by strokeJoin under the masked authored source-stroke rule',
        miterVsBevel,
        miterVsRound,
        bevelVsRound,
        localMiterVsBevel,
        localMiterVsRound,
        localBevelVsRound
      },
      null,
      2
    )
  ).toBeGreaterThan(0)
  const maskOnlyComparisons = [
    maskOnlyMiterVsBevel,
    maskOnlyMiterVsRound,
    maskOnlyBevelVsRound
  ]
  const maxMaskOnlyChangedPixelCount = Math.max(
    ...maskOnlyComparisons.map((comparison) => comparison.changedPixelCount)
  )
  const maxMaskOnlyChangedPixelRatio = Math.max(
    ...maskOnlyComparisons.map(
      (comparison) =>
        comparison.changedPixelCount /
        Math.max(1, comparison.comparedPixelCount)
    )
  )
  expect(
    {
      message:
        'inside solid mask-only triangle/non-pentagon final pixels must stay bounded while clip-only invariance remains covered by packet gates',
      maskOnlyCornerProbes,
      maskOnlyMiterVsBevel,
      maskOnlyMiterVsRound,
      maskOnlyBevelVsRound,
      maxMaskOnlyChangedPixelCount,
      maxMaskOnlyChangedPixelRatio
    },
    JSON.stringify(
      {
        maskOnlyCornerProbes,
        maskOnlyMiterVsBevel,
        maskOnlyMiterVsRound,
        maskOnlyBevelVsRound,
        maxMaskOnlyChangedPixelCount,
        maxMaskOnlyChangedPixelRatio
      },
      null,
      2
    )
  ).toEqual(
    expect.objectContaining({
      maxMaskOnlyChangedPixelCount: expect.any(Number),
      maxMaskOnlyChangedPixelRatio: expect.any(Number)
    })
  )
  expect(
    maxMaskOnlyChangedPixelCount,
    JSON.stringify(
      {
        maskOnlyCornerProbes,
        maskOnlyMiterVsBevel,
        maskOnlyMiterVsRound,
        maskOnlyBevelVsRound,
        maxMaskOnlyChangedPixelCount,
        maxMaskOnlyChangedPixelRatio
      },
      null,
      2
    )
  ).toBeLessThanOrEqual(48)
  expect(
    maxMaskOnlyChangedPixelRatio,
    JSON.stringify(
      {
        maskOnlyCornerProbes,
        maskOnlyMiterVsBevel,
        maskOnlyMiterVsRound,
        maskOnlyBevelVsRound,
        maxMaskOnlyChangedPixelCount,
        maxMaskOnlyChangedPixelRatio
      },
      null,
      2
    )
  ).toBeLessThanOrEqual(0.17)
})
