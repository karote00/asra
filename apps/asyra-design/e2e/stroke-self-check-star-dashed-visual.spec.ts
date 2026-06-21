import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  ARTIFACT_DIR,
  SCREENSHOT_PATH,
  METADATA_PATH,
  ANALYSIS_PATH,
  NO_FILL_SCREENSHOT_PATH,
  NO_FILL_METADATA_PATH,
  NO_FILL_ANALYSIS_PATH,
  getSelfCheckArtifactPaths,
  SELF_CHECK_SOURCE_POINTS,
  SELF_CHECK_VECTOR_RECT,
  SELF_CHECK_SOURCE_PATH,
  resetCanvas,
  createSelfCheckStar,
  getSelfCheckMetadata,
  getBoundaryDomainPolygonQualityFailures,
  getBoundaryDomainOversizedProductFailures,
  analyzeSelfCheckScreenshots,
  analyzeSelfCheckBoundaryDomainOracle,
  analyzeInsideSolidSourcePathContinuity,
  compareRightBottomHighCurvatureSmoothTerminalPixels
} from './stroke-self-check-star-fixture'
import type { SelfCheckJoinType, Vec2 } from './stroke-self-check-star-fixture'

interface SelfIntersectionSquareTerminalTangentHit {
  intersectionSplitBoundary?: boolean
  maxRedPixels?: number
  sameSplitRangeCovered?: boolean
  otherSplitRangeCovered?: boolean
}

type SelfCheckMetadata = Awaited<ReturnType<typeof getSelfCheckMetadata>>
interface SplitRangeVisualGapRecord {
  splitRangeId: string
  terminalRole: string
  startDistance: number
  endDistance: number
}

const getSplitRangeVisualGapMetrics = (
  metadata: SelfCheckMetadata,
  capType: 'butt' | 'square' | 'round',
  minimumGapRatio: number
) => {
  const dashGap = 20
  const strokeWidth =
    metadata.boundaryDomainPackets.find(
      (packet) =>
        typeof packet.strokeWidth === 'number' && packet.strokeWidth > 0
    )?.strokeWidth ?? 10
  const capExtension = capType === 'butt' ? 0 : strokeWidth
  const minimumVisualGap = dashGap * minimumGapRatio
  const recordsByKey = new Map<string, SplitRangeVisualGapRecord>()

  metadata.boundaryDomainPackets.forEach((packet) => {
    packet.domainPlanSplitRangeTerminals.forEach((record) => {
      const key = [
        record.splitRangeId,
        record.terminalRole,
        record.startDistance.toFixed(4),
        record.endDistance.toFixed(4)
      ].join(':')
      recordsByKey.set(key, {
        splitRangeId: record.splitRangeId,
        terminalRole: record.terminalRole,
        startDistance: record.startDistance,
        endDistance: record.endDistance
      })
    })
  })

  const recordsBySplitRange = new Map<string, SplitRangeVisualGapRecord[]>()
  for (const record of recordsByKey.values()) {
    recordsBySplitRange.set(record.splitRangeId, [
      ...(recordsBySplitRange.get(record.splitRangeId) ?? []),
      record
    ])
  }

  const visualGaps: number[] = []
  let collapsedStartEndCount = 0
  recordsBySplitRange.forEach((records) => {
    const sorted = records
      .slice()
      .sort((left, right) => left.startDistance - right.startDistance)
    if (sorted.length === 1 && sorted[0]?.terminalRole === 'start-end') {
      collapsedStartEndCount += 1
      return
    }
    sorted.slice(0, -1).forEach((record, index) => {
      const next = sorted[index + 1]
      if (!next) {
        return
      }
      const centerlineGap = next.startDistance - record.endDistance
      if (centerlineGap <= 1e-4) {
        return
      }
      visualGaps.push(centerlineGap - capExtension * 2)
    })
  })

  const overCompressedVisualGaps = visualGaps.filter(
    (visualGap) => visualGap < minimumVisualGap - 1e-4
  )
  const averageVisualGap =
    visualGaps.length > 0
      ? visualGaps.reduce((sum, gap) => sum + gap, 0) / visualGaps.length
      : null

  return {
    capExtension,
    minimumGapRatio,
    minimumVisualGap,
    splitRangeCount: recordsBySplitRange.size,
    gapCount: visualGaps.length,
    collapsedStartEndCount,
    minVisualGap: visualGaps.length > 0 ? Math.min(...visualGaps) : null,
    averageVisualGap,
    maxVisualGap: visualGaps.length > 0 ? Math.max(...visualGaps) : null,
    overCompressedVisualGaps
  }
}

const expectLegalSelfIntersectionSquareTangentDiagnostics = (
  hits: SelfIntersectionSquareTerminalTangentHit[],
  context: unknown
) => {
  expect(
    hits.every(
      (hit) =>
        hit.intersectionSplitBoundary === true &&
        (hit.sameSplitRangeCovered === true ||
          hit.otherSplitRangeCovered === true) &&
        typeof hit.maxRedPixels === 'number' &&
        hit.maxRedPixels > 0
    ),
    JSON.stringify({ context, hits }, null, 2)
  ).toBe(true)
}

const packetHasPolygonNearPoint = (
  packet: Awaited<
    ReturnType<typeof getSelfCheckMetadata>
  >['boundaryDomainPackets'][number],
  point: Vec2,
  radius: number
) =>
  packet.polygons.some((polygon) =>
    polygon.some(
      (polygonPoint) =>
        Math.hypot(polygonPoint.x - point.x, polygonPoint.y - point.y) <= radius
    )
  )

const hasOutsideProductTerminalNearPoint = (
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>,
  point: Vec2,
  radius: number
) =>
  metadata.boundaryDomainPackets.some((packet) => {
    const role = packet.domainPlanTerminalRole
    return (
      packet.strokePosition === 'outside' &&
      (role === 'start' || role === 'end' || role === 'start-end') &&
      packetHasPolygonNearPoint(packet, point, radius)
    )
  })

;(['butt', 'square', 'round'] as const).forEach((capType) => {
  test(`self-check: self-intersecting inside dashed ${capType} final pixels keep split terminals and bounded overdraw`, async ({
    page
  }) => {
    if (capType === 'round') {
      test.setTimeout(60_000)
    }
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
    const paths = getSelfCheckArtifactPaths(capType, 'fill')

    await createSelfCheckStar(page, { includeStroke: false, capType })
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
    await createSelfCheckStar(page, { capType })
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
    const boundaryDomainAnalysis = await analyzeSelfCheckBoundaryDomainOracle(
      page,
      actualScreenshot,
      metadata,
      SELF_CHECK_SOURCE_PATH,
      {
        capType,
        expectedPosition: 'inside',
        strictTerminalAdjacentGap: capType === 'butt'
      }
    )
    fs.writeFileSync(
      paths.analysis,
      `${JSON.stringify({ legalAnalysis, boundaryDomainAnalysis }, null, 2)}\n`
    )

    expect(metadata.exportPacketCount).toBeGreaterThan(0)
    const insideFilledFaceBoundaryPackets =
      metadata.boundaryDomainPackets.filter(
        (packet) => packet.domainPlanBoundaryRole === 'filled-face'
      )
    expect(
      insideFilledFaceBoundaryPackets.length,
      JSON.stringify(
        metadata.boundaryDomainPackets.map((packet) => ({
          geometryId: packet.geometryId,
          role: packet.domainPlanBoundaryRole,
          selectedSide: packet.domainPlanSelectedSide,
          filledSide: packet.domainPlanFilledSide,
          unfilledSide: packet.domainPlanUnfilledSide,
          polygonCount: packet.polygonCount
        })),
        null,
        2
      )
    ).toBeGreaterThan(0)
    expect(
      metadata.boundaryDomainPackets.every((packet) => {
        if (packet.domainPlanBoundaryRole === 'filled-face') {
          return (
            packet.domainPlanSelectedSide === packet.domainPlanFilledSide &&
            packet.domainPlanSelectedSide !== packet.domainPlanUnfilledSide
          )
        }
        return (
          packet.domainPlanBoundaryRole === 'outer' &&
          packet.domainPlanSelectedSide === packet.domainPlanFilledSide &&
          packet.domainPlanSelectedSide !== packet.domainPlanUnfilledSide
        )
      }),
      JSON.stringify(metadata.boundaryDomainPackets, null, 2)
    ).toBe(true)
    expect(legalAnalysis.redPixelCount).toBeGreaterThan(1000)
    expect(
      legalAnalysis.maxOutsideComponentArea,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBeLessThan(32)
    expect(
      legalAnalysis.outsideRedPixelCount,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBeLessThan(Math.max(96, legalAnalysis.redPixelCount * 0.02))
    expect(
      legalAnalysis.darkOverdrawPixelCount,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBeLessThan(48)
    expect(
      legalAnalysis.maxDarkOverdrawComponentArea,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBeLessThan(32)
    expect(
      boundaryDomainAnalysis.distributionFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.terminalProbeFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.filledFaceTerminalProbeResults.length,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toBeGreaterThan(0)
    expect(
      boundaryDomainAnalysis.terminalBoundaryProbeFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.visibleDashProbeFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.dashBodyWidthProbeFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.splitRangeSideConsistencyFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    if (capType === 'butt') {
      expect(
        boundaryDomainAnalysis.rhythmProbeFailures,
        JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
      ).toEqual([])
      expect(
        boundaryDomainAnalysis.terminalAdjacentGapHits,
        JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
      ).toEqual([])
    }
  })
})
;(['butt', 'square', 'round'] as const).forEach((capType) => {
  test(`self-check: self-intersecting outside dashed ${capType} final pixels keep split terminals and outside side`, async ({
    page
  }) => {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
    const paths = getSelfCheckArtifactPaths(capType, 'fill', 'outside')

    await createSelfCheckStar(page, {
      includeStroke: false,
      capType,
      position: 'outside'
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
    await createSelfCheckStar(page, { capType, position: 'outside' })
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
    const boundaryDomainAnalysis = await analyzeSelfCheckBoundaryDomainOracle(
      page,
      actualScreenshot,
      metadata,
      SELF_CHECK_SOURCE_PATH,
      {
        capType,
        strictTerminalAdjacentGap: capType === 'butt',
        expectedPosition: 'outside'
      }
    )
    fs.writeFileSync(
      paths.analysis,
      `${JSON.stringify({ legalAnalysis, boundaryDomainAnalysis }, null, 2)}\n`
    )

    expect(metadata.exportPacketCount).toBeGreaterThan(0)
    const outsideFilledFaceBoundaryPackets =
      metadata.boundaryDomainPackets.filter(
        (packet) => packet.domainPlanBoundaryRole === 'filled-face'
      )
    expect(
      outsideFilledFaceBoundaryPackets,
      JSON.stringify(
        metadata.boundaryDomainPackets.map((packet) => ({
          geometryId: packet.geometryId,
          role: packet.domainPlanBoundaryRole,
          selectedSide: packet.domainPlanSelectedSide,
          filledSide: packet.domainPlanFilledSide,
          unfilledSide: packet.domainPlanUnfilledSide,
          polygonCount: packet.polygonCount
        })),
        null,
        2
      )
    ).toEqual([])
    expect(
      metadata.boundaryDomainPackets.every(
        (packet) =>
          packet.strokePosition === 'outside' &&
          packet.polygonCount > 0 &&
          packet.topologyFamily === 'self-intersecting' &&
          packet.debugIntervalId?.startsWith('interval:') === true &&
          packet.intervalIds.every((intervalId) =>
            intervalId.startsWith('interval:')
          ) &&
          packet.domainPlanSelectedSide === packet.domainPlanUnfilledSide &&
          packet.domainPlanSelectedSide !== packet.domainPlanFilledSide
      ),
      JSON.stringify(metadata.boundaryDomainPackets, null, 2)
    ).toBe(true)
    expect(
      getBoundaryDomainOversizedProductFailures(metadata),
      JSON.stringify(
        getBoundaryDomainOversizedProductFailures(metadata),
        null,
        2
      )
    ).toEqual([])
    expect(
      getBoundaryDomainPolygonQualityFailures(metadata),
      JSON.stringify(
        {
          capType,
          failures: getBoundaryDomainPolygonQualityFailures(metadata)
        },
        null,
        2
      )
    ).toEqual([])
    expect(legalAnalysis.redPixelCount).toBeGreaterThan(1000)
    expect(
      legalAnalysis.maxStrictInsideComponentArea,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBeLessThan(48)
    expect(
      legalAnalysis.strictLegalRedPixelCount,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBeLessThan(Math.max(120, legalAnalysis.redPixelCount * 0.03))
    expect(
      legalAnalysis.darkOverdrawPixelCount,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBe(0)
    expect(
      legalAnalysis.maxDarkOverdrawComponentArea,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBe(0)
    expect(
      boundaryDomainAnalysis.distributionFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.terminalProbeFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.filledFaceTerminalProbeResults.length,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toBe(0)
    expect(
      boundaryDomainAnalysis.terminalBoundaryProbeFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.visibleDashProbeFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.dashBodyWidthProbeFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.splitRangeSideConsistencyFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.oppositeSideProbeHits,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    if (capType === 'square') {
      expectLegalSelfIntersectionSquareTangentDiagnostics(
        boundaryDomainAnalysis.selfIntersectionSquareTerminalTangentOverhangHits,
        { capType }
      )
      expect(
        boundaryDomainAnalysis.selfIntersectionSquareTerminalWrongSideHits,
        JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
      ).toEqual([])
      expect(
        boundaryDomainAnalysis.selfIntersectionSquareTerminalShortBodyCollarHits,
        JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
      ).toEqual([])
    }
    if (capType === 'butt') {
      expect(
        boundaryDomainAnalysis.terminalAdjacentGapHits,
        JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
      ).toEqual([])
      expect(
        boundaryDomainAnalysis.rhythmProbeFailures,
        JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
      ).toEqual([])
    }
  })
})

test('self-check: split-range visual gap floor keeps capped dash groups legible', async ({
  page
}, testInfo) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  const productMinimumGapRatio = 0.6
  const positions = ['inside', 'outside'] as const
  const summaries: {
    position: (typeof positions)[number]
    screenshotPath: string
    metrics: ReturnType<typeof getSplitRangeVisualGapMetrics>
  }[] = []

  for (const position of positions) {
    await resetCanvas(page)
    await createSelfCheckStar(page, {
      capType: 'square',
      position
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
    await page.waitForTimeout(500)

    const metadata = await getSelfCheckMetadata(page)
    const metrics = getSplitRangeVisualGapMetrics(
      metadata,
      'square',
      productMinimumGapRatio
    )
    const screenshotPath = path.join(
      ARTIFACT_DIR,
      `self-check-split-range-gap-floor-${position}.png`
    )
    await page.screenshot({
      path: screenshotPath,
      fullPage: false
    })
    summaries.push({
      position,
      screenshotPath,
      metrics
    })
    await testInfo.attach(`split-range-gap-floor-${position}`, {
      path: screenshotPath,
      contentType: 'image/png'
    })

    expect(
      metrics.splitRangeCount,
      JSON.stringify({ position, metrics }, null, 2)
    ).toBeGreaterThan(0)
    expect(
      metrics.gapCount + metrics.collapsedStartEndCount,
      JSON.stringify({ position, metrics }, null, 2)
    ).toBeGreaterThan(0)
    expect(
      metrics.overCompressedVisualGaps,
      JSON.stringify({ position, metrics }, null, 2)
    ).toEqual([])
  }

  const summaryPath = path.join(
    ARTIFACT_DIR,
    'self-check-split-range-gap-floor.json'
  )
  fs.writeFileSync(summaryPath, `${JSON.stringify(summaries, null, 2)}\n`)
  await testInfo.attach('split-range-gap-floor-summary', {
    path: summaryPath,
    contentType: 'application/json'
  })
})

test('self-check: self-intersecting outside dashed square cap with miter join keeps every split boundary styled correctly', async ({
  page
}) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  const paths = {
    screenshot: path.join(
      ARTIFACT_DIR,
      'self-check-outside-dashed-square-miter-no-fill.png'
    ),
    metadata: path.join(
      ARTIFACT_DIR,
      'self-check-outside-dashed-square-miter-no-fill.json'
    ),
    analysis: path.join(
      ARTIFACT_DIR,
      'self-check-outside-dashed-square-miter-no-fill-analysis.json'
    )
  }

  await resetCanvas(page)
  await createSelfCheckStar(page, {
    capType: 'square',
    joinType: 'miter',
    position: 'outside',
    includeFill: false,
    sourceKind: 'polyline'
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
    return Boolean(computed?.strokes?.length)
  })
  await page.waitForTimeout(1000)

  const metadata = await getSelfCheckMetadata(page)
  fs.writeFileSync(paths.metadata, `${JSON.stringify(metadata, null, 2)}\n`)
  const actualScreenshot = await page.screenshot({
    path: paths.screenshot,
    fullPage: false
  })
  const boundaryDomainAnalysis = await analyzeSelfCheckBoundaryDomainOracle(
    page,
    actualScreenshot,
    metadata,
    SELF_CHECK_SOURCE_PATH,
    {
      capType: 'square',
      expectedPosition: 'outside'
    }
  )
  const missingProductTerminalAnchors = Object.entries(SELF_CHECK_SOURCE_POINTS)
    .filter(([anchorId]) => /^tp-\d+$/.test(anchorId))
    .filter(
      ([, anchor]) => !hasOutsideProductTerminalNearPoint(metadata, anchor, 34)
    )
    .map(([anchorId]) => anchorId)
  const analysis = {
    boundaryDomainAnalysis,
    missingProductTerminalAnchors
  }
  fs.writeFileSync(paths.analysis, `${JSON.stringify(analysis, null, 2)}\n`)

  expect(
    missingProductTerminalAnchors,
    JSON.stringify({ missingProductTerminalAnchors }, null, 2)
  ).toEqual([])
  expect(
    boundaryDomainAnalysis.terminalProbeFailures,
    JSON.stringify(boundaryDomainAnalysis, null, 2)
  ).toEqual([])
  expect(
    boundaryDomainAnalysis.terminalBoundaryProbeFailures,
    JSON.stringify(boundaryDomainAnalysis, null, 2)
  ).toEqual([])
  expect(
    boundaryDomainAnalysis.visibleDashProbeFailures,
    JSON.stringify(boundaryDomainAnalysis, null, 2)
  ).toEqual([])
  expectLegalSelfIntersectionSquareTangentDiagnostics(
    boundaryDomainAnalysis.selfIntersectionSquareTerminalTangentOverhangHits,
    { test: 'outside dashed square miter no-fill' }
  )
  expect(
    boundaryDomainAnalysis.selfIntersectionSquareTerminalWrongSideHits,
    JSON.stringify(boundaryDomainAnalysis, null, 2)
  ).toEqual([])
  expect(
    boundaryDomainAnalysis.selfIntersectionSquareTerminalShortBodyCollarHits,
    JSON.stringify(boundaryDomainAnalysis, null, 2)
  ).toEqual([])
  expect(
    boundaryDomainAnalysis.oppositeSideProbeHits,
    JSON.stringify(boundaryDomainAnalysis, null, 2)
  ).toEqual([])
  expect(
    boundaryDomainAnalysis.selfIntersectionTerminalOppositeSideProbeHits,
    JSON.stringify(boundaryDomainAnalysis, null, 2)
  ).toEqual([])
})

test('self-check: right-bottom high-curvature outside dashed terminal remains cap-owned across join settings', async ({
  page
}, testInfo) => {
  const screenshots: Partial<Record<SelfCheckJoinType, Buffer>> = {}
  const metadataByJoin: Partial<
    Record<SelfCheckJoinType, Awaited<ReturnType<typeof getSelfCheckMetadata>>>
  > = {}

  for (const joinType of ['miter', 'bevel', 'round'] as const) {
    await resetCanvas(page)
    await createSelfCheckStar(page, {
      capType: 'butt',
      joinType,
      position: 'outside'
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

    screenshots[joinType] = await page.screenshot({ fullPage: false })
    const screenshot = screenshots[joinType]
    if (screenshot) {
      const screenshotPath = testInfo.outputPath(
        `outside-dashed-right-bottom-terminal-${joinType}.png`
      )
      fs.writeFileSync(screenshotPath, screenshot)
      await testInfo.attach(
        `outside-dashed-right-bottom-terminal-${joinType}`,
        {
          path: screenshotPath,
          contentType: 'image/png'
        }
      )
    }
    metadataByJoin[joinType] = await getSelfCheckMetadata(page)
  }

  expect(metadataByJoin.miter).toBeDefined()
  expect(metadataByJoin.bevel).toBeDefined()
  expect(metadataByJoin.round).toBeDefined()
  expect(screenshots.miter).toBeDefined()
  expect(screenshots.bevel).toBeDefined()
  expect(screenshots.round).toBeDefined()

  const productTerminalPacketCounts = Object.entries(metadataByJoin).map(
    ([joinType, joinMetadata]) => ({
      joinType,
      count: (joinMetadata?.boundaryDomainPackets ?? []).filter((packet) => {
        const role = packet.domainPlanTerminalRole
        return (
          packet.strokePosition === 'outside' &&
          (role === 'start' || role === 'end' || role === 'start-end')
        )
      }).length
    })
  )
  const localProductTerminalPacketCounts = Object.entries(metadataByJoin).map(
    ([joinType, joinMetadata]) => ({
      joinType,
      tp14:
        joinMetadata &&
        hasOutsideProductTerminalNearPoint(
          joinMetadata,
          SELF_CHECK_SOURCE_POINTS['tp-14'],
          24
        )
          ? 1
          : 0,
      tp15:
        joinMetadata &&
        hasOutsideProductTerminalNearPoint(
          joinMetadata,
          SELF_CHECK_SOURCE_POINTS['tp-15'],
          24
        )
          ? 1
          : 0
    })
  )
  const summarizeLocalPackets = (
    joinMetadata: Awaited<ReturnType<typeof getSelfCheckMetadata>> | undefined,
    sourceAnchor: Vec2,
    radius: number
  ) =>
    (joinMetadata?.boundaryDomainPackets ?? [])
      .filter((packet) =>
        packet.polygons.some((polygon) =>
          polygon.some(
            (point) =>
              Math.hypot(point.x - sourceAnchor.x, point.y - sourceAnchor.y) <=
              radius
          )
        )
      )
      .map((packet) => {
        const points = packet.polygons.flat()
        const bounds =
          points.length > 0
            ? {
                minX: Math.min(...points.map((point) => point.x)),
                minY: Math.min(...points.map((point) => point.y)),
                maxX: Math.max(...points.map((point) => point.x)),
                maxY: Math.max(...points.map((point) => point.y))
              }
            : null
        return {
          geometryId: packet.geometryId,
          intervalIds: packet.intervalIds,
          terminalRole: packet.domainPlanTerminalRole,
          splitRangeId: packet.domainPlanSplitRangeId,
          splitRangeSourceSegmentIndex:
            packet.domainPlanSplitRangeSourceSegmentIndex,
          boundaryRole: packet.domainPlanBoundaryRole,
          selectedSide: packet.domainPlanSelectedSide,
          polygonCount: packet.polygonCount,
          polygonSizes: packet.polygons.map((polygon) => polygon.length),
          bounds
        }
      })
  const localPacketSummaries = Object.entries(metadataByJoin).map(
    ([joinType, joinMetadata]) => ({
      joinType,
      rightBottom: summarizeLocalPackets(
        joinMetadata,
        SELF_CHECK_SOURCE_POINTS['tp-16'],
        72
      ),
      rightTop: summarizeLocalPackets(
        joinMetadata,
        SELF_CHECK_SOURCE_POINTS['tp-14'],
        68
      ),
      leftTop: summarizeLocalPackets(
        joinMetadata,
        SELF_CHECK_SOURCE_POINTS['tp-15'],
        68
      )
    })
  )

  expect(
    productTerminalPacketCounts.every(({ count }) => count > 0),
    JSON.stringify({ productTerminalPacketCounts }, null, 2)
  ).toBe(true)
  expect(
    localProductTerminalPacketCounts.every(
      ({ tp14, tp15 }) => tp14 > 0 && tp15 > 0
    ),
    JSON.stringify({ localProductTerminalPacketCounts }, null, 2)
  ).toBe(true)

  const miterVsBevel =
    await compareRightBottomHighCurvatureSmoothTerminalPixels(
      page,
      screenshots.miter as Buffer,
      screenshots.bevel as Buffer,
      metadataByJoin.miter as Awaited<ReturnType<typeof getSelfCheckMetadata>>,
      { radius: 44 }
    )
  const miterVsRound =
    await compareRightBottomHighCurvatureSmoothTerminalPixels(
      page,
      screenshots.miter as Buffer,
      screenshots.round as Buffer,
      metadataByJoin.miter as Awaited<ReturnType<typeof getSelfCheckMetadata>>,
      { radius: 44 }
    )
  const bevelVsRound =
    await compareRightBottomHighCurvatureSmoothTerminalPixels(
      page,
      screenshots.bevel as Buffer,
      screenshots.round as Buffer,
      metadataByJoin.bevel as Awaited<ReturnType<typeof getSelfCheckMetadata>>,
      { radius: 44 }
    )

  const diagnostics = {
    productTerminalPacketCounts,
    localProductTerminalPacketCounts,
    localPacketSummaries,
    comparisons: {
      miterVsBevel,
      miterVsRound,
      bevelVsRound
    }
  }
  const diagnosticsPath = testInfo.outputPath(
    'outside-dashed-right-bottom-terminal-diagnostics.json'
  )
  fs.writeFileSync(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`)
  await testInfo.attach('outside-dashed-right-bottom-terminal-diagnostics', {
    path: diagnosticsPath,
    contentType: 'application/json'
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
    JSON.stringify(
      {
        miterVsBevel,
        miterVsRound,
        bevelVsRound,
        computedStrokes: metadataByJoin.round?.computedStrokes
      },
      null,
      2
    )
  ).toBeGreaterThan(80)

  const rightTopMiterVsRound =
    await compareRightBottomHighCurvatureSmoothTerminalPixels(
      page,
      screenshots.miter as Buffer,
      screenshots.round as Buffer,
      metadataByJoin.miter as Awaited<ReturnType<typeof getSelfCheckMetadata>>,
      {
        sourceAnchor: SELF_CHECK_SOURCE_POINTS['tp-14'],
        radius: 68
      }
    )
  const rightTopBevelVsRound =
    await compareRightBottomHighCurvatureSmoothTerminalPixels(
      page,
      screenshots.bevel as Buffer,
      screenshots.round as Buffer,
      metadataByJoin.bevel as Awaited<ReturnType<typeof getSelfCheckMetadata>>,
      {
        sourceAnchor: SELF_CHECK_SOURCE_POINTS['tp-14'],
        radius: 68
      }
    )
  const leftTopMiterVsRound =
    await compareRightBottomHighCurvatureSmoothTerminalPixels(
      page,
      screenshots.miter as Buffer,
      screenshots.round as Buffer,
      metadataByJoin.miter as Awaited<ReturnType<typeof getSelfCheckMetadata>>,
      {
        sourceAnchor: SELF_CHECK_SOURCE_POINTS['tp-15'],
        radius: 68
      }
    )
  const leftTopBevelVsRound =
    await compareRightBottomHighCurvatureSmoothTerminalPixels(
      page,
      screenshots.bevel as Buffer,
      screenshots.round as Buffer,
      metadataByJoin.bevel as Awaited<ReturnType<typeof getSelfCheckMetadata>>,
      {
        sourceAnchor: SELF_CHECK_SOURCE_POINTS['tp-15'],
        radius: 68
      }
    )

  expect(
    [
      rightTopMiterVsRound.firstRedCount,
      rightTopMiterVsRound.secondRedCount,
      rightTopBevelVsRound.firstRedCount,
      rightTopBevelVsRound.secondRedCount,
      leftTopMiterVsRound.firstRedCount,
      leftTopMiterVsRound.secondRedCount,
      leftTopBevelVsRound.firstRedCount,
      leftTopBevelVsRound.secondRedCount
    ].every((redCount) => redCount > 80),
    JSON.stringify(
      {
        message:
          'outside dashed contour terminals must keep visible coverage for every join type; terminal endpoint cap ownership must not delete join-owned coverage',
        rightTopMiterVsRound,
        rightTopBevelVsRound,
        leftTopMiterVsRound,
        leftTopBevelVsRound,
        localPacketSummaries
      },
      null,
      2
    )
  ).toBe(true)
})

test('self-check: outside dashed star captures Cmd+1 and app-zoom coverage-unit review', async ({
  page
}, testInfo) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

  await createSelfCheckStar(page, {
    capType: 'square',
    joinType: 'miter',
    position: 'outside'
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

  await page.keyboard.press('Meta+1')
  await page.waitForTimeout(500)
  const globalPath = path.join(
    ARTIFACT_DIR,
    'self-check-outside-dashed-square-cmd1-global-review.png'
  )
  await page.screenshot({ path: globalPath, fullPage: false })
  await testInfo.attach('outside-square-cmd1-global-review', {
    path: globalPath,
    contentType: 'image/png'
  })

  const focusSelfCheckLocalPoint = async (
    point: Vec2,
    zoom: number,
    screenshotPath: string,
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
      { canvasCenter, point, rect: SELF_CHECK_VECTOR_RECT, zoom }
    )
    await page.waitForTimeout(500)
    await page.screenshot({ path: screenshotPath, fullPage: false })
    await testInfo.attach(attachmentName, {
      path: screenshotPath,
      contentType: 'image/png'
    })
  }

  await focusSelfCheckLocalPoint(
    SELF_CHECK_SOURCE_POINTS['tp-12'],
    4.25,
    path.join(
      ARTIFACT_DIR,
      'self-check-outside-dashed-square-top-app-zoom-review.png'
    ),
    'outside-square-top-app-zoom-review'
  )
  await focusSelfCheckLocalPoint(
    SELF_CHECK_SOURCE_POINTS['tp-13'],
    3.35,
    path.join(
      ARTIFACT_DIR,
      'self-check-outside-dashed-square-left-bottom-app-zoom-review.png'
    ),
    'outside-square-left-bottom-app-zoom-review'
  )
  await focusSelfCheckLocalPoint(
    SELF_CHECK_SOURCE_POINTS['tp-16'],
    3.75,
    path.join(
      ARTIFACT_DIR,
      'self-check-outside-dashed-square-right-bottom-app-zoom-review.png'
    ),
    'outside-square-right-bottom-app-zoom-review'
  )

  const metadata = await getSelfCheckMetadata(page)
  const productTerminalPackets = metadata.boundaryDomainPackets.filter(
    (packet) =>
      packet.strokePosition === 'outside' &&
      (packet.domainPlanTerminalRole === 'start' ||
        packet.domainPlanTerminalRole === 'end' ||
        packet.domainPlanTerminalRole === 'start-end')
  )
  const crossIntervalArrangedPackets = metadata.boundaryDomainPackets.flatMap(
    (packet) => {
      if (packet.visualOverlapCollapseStatus !== 'exact-arrangement') {
        return []
      }
      const intervalIds = [
        ...new Set(
          [...packet.intervalIds, packet.debugIntervalId].filter(Boolean)
        )
      ]
      return intervalIds.length > 1
        ? [
            {
              geometryId: packet.geometryId,
              intervalIds,
              splitRangeId: packet.domainPlanSplitRangeId,
              terminalRole: packet.domainPlanTerminalRole
            }
          ]
        : []
    }
  )

  expect(
    productTerminalPackets.length,
    JSON.stringify({ productTerminalPackets }, null, 2)
  ).toBeGreaterThan(0)
  expect(
    crossIntervalArrangedPackets,
    JSON.stringify({ crossIntervalArrangedPackets }, null, 2)
  ).toEqual([])
})
;(['butt', 'square'] as const).forEach((capType) => {
  test(`self-check: outside dashed ${capType} no-fill keeps terminal dash bodies on selected outside side`, async ({
    page
  }, testInfo) => {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

    await createSelfCheckStar(page, {
      capType,
      joinType: 'miter',
      position: 'outside',
      includeFill: false,
      diagnosticsMode: 'off'
    })
    const productScreenshotPath = path.join(
      ARTIFACT_DIR,
      `self-check-outside-dashed-${capType}-no-fill-product.png`
    )
    const productMetadataPath = path.join(
      ARTIFACT_DIR,
      `self-check-outside-dashed-${capType}-no-fill-product.json`
    )
    const productScreenshot = await page.screenshot({
      path: productScreenshotPath,
      fullPage: false
    })
    const productMetadata = await getSelfCheckMetadata(page)
    fs.writeFileSync(
      productMetadataPath,
      `${JSON.stringify(productMetadata, null, 2)}\n`
    )
    await testInfo.attach(`outside-${capType}-no-fill-product`, {
      body: productScreenshot,
      contentType: 'image/png'
    })

    await createSelfCheckStar(page, {
      capType,
      joinType: 'miter',
      position: 'outside',
      includeFill: false,
      diagnosticsMode: 'full'
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
      return Boolean(computed?.strokes?.length && !computed?.fills?.length)
    })
    await page.waitForTimeout(1000)

    const metadata = await getSelfCheckMetadata(page)
    const screenshotPath = path.join(
      ARTIFACT_DIR,
      `self-check-outside-dashed-${capType}-no-fill.png`
    )
    const metadataPath = path.join(
      ARTIFACT_DIR,
      `self-check-outside-dashed-${capType}-no-fill.json`
    )
    const analysisPath = path.join(
      ARTIFACT_DIR,
      `self-check-outside-dashed-${capType}-no-fill-analysis.json`
    )
    fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
    const screenshot = await page.screenshot({
      path: screenshotPath,
      fullPage: false
    })
    const boundaryDomainAnalysis = await analyzeSelfCheckBoundaryDomainOracle(
      page,
      screenshot,
      metadata,
      SELF_CHECK_SOURCE_PATH,
      {
        capType,
        expectedPosition: 'outside'
      }
    )
    fs.writeFileSync(
      analysisPath,
      `${JSON.stringify({ boundaryDomainAnalysis }, null, 2)}\n`
    )

    expect(metadata.exportPacketCount).toBeGreaterThan(0)
    expect(boundaryDomainAnalysis.packetCount).toBe(metadata.exportPacketCount)
    expect(
      boundaryDomainAnalysis.intervalPacketFailureCount,
      JSON.stringify(boundaryDomainAnalysis.intervalPacketFailures, null, 2)
    ).toBe(0)
    expect(
      boundaryDomainAnalysis.coverageProbeFailures,
      JSON.stringify(boundaryDomainAnalysis, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.terminalProbeFailures,
      JSON.stringify(boundaryDomainAnalysis, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.terminalBoundaryProbeFailures,
      JSON.stringify(boundaryDomainAnalysis, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.visibleDashProbeFailures,
      JSON.stringify(boundaryDomainAnalysis, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.dashBodyWidthProbeFailures,
      JSON.stringify(boundaryDomainAnalysis, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.splitRangeSideConsistencyFailures,
      JSON.stringify(boundaryDomainAnalysis, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.intervalContinuityFailures,
      JSON.stringify(boundaryDomainAnalysis, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.distributionFailures,
      JSON.stringify(boundaryDomainAnalysis, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.oppositeSideProbeHits,
      JSON.stringify(boundaryDomainAnalysis, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.selfIntersectionTerminalOppositeSideProbeHits,
      JSON.stringify(boundaryDomainAnalysis, null, 2)
    ).toEqual([])
    expectLegalSelfIntersectionSquareTangentDiagnostics(
      boundaryDomainAnalysis.selfIntersectionSquareTerminalTangentOverhangHits,
      { capType, variant: 'no-fill' }
    )
    expect(
      boundaryDomainAnalysis.selfIntersectionSquareTerminalWrongSideHits,
      JSON.stringify(boundaryDomainAnalysis, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.selfIntersectionSquareTerminalShortBodyCollarHits,
      JSON.stringify(boundaryDomainAnalysis, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.maxSourceFillDomainLeakComponentArea,
      JSON.stringify(boundaryDomainAnalysis, null, 2)
    ).toBeLessThan(4)

    await testInfo.attach(`outside-${capType}-no-fill-screenshot`, {
      path: screenshotPath,
      contentType: 'image/png'
    })
    await testInfo.attach(`outside-${capType}-no-fill-metadata`, {
      path: metadataPath,
      contentType: 'application/json'
    })
    await testInfo.attach(`outside-${capType}-no-fill-analysis`, {
      path: analysisPath,
      contentType: 'application/json'
    })
  })
})

test('self-check: self-intersecting inside dashed round star satisfies rule-driven split ranges', async ({
  page
}, testInfo) => {
  test.setTimeout(60_000)
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

  await createSelfCheckStar(page, { includeStroke: false })
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
  await createSelfCheckStar(page)
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
  fs.writeFileSync(METADATA_PATH, `${JSON.stringify(metadata, null, 2)}\n`)
  const actualScreenshot = await page.screenshot({
    path: SCREENSHOT_PATH,
    fullPage: false
  })
  const analysis = await analyzeSelfCheckScreenshots(
    page,
    baselineScreenshot,
    actualScreenshot,
    metadata
  )
  fs.writeFileSync(ANALYSIS_PATH, `${JSON.stringify(analysis, null, 2)}\n`)

  const hasAllowedVisualOverlapStatus = (status: unknown) =>
    status === null ||
    status === 'exact-union' ||
    status === 'exact-arrangement'

  expect(metadata.exportPacketCount).toBeGreaterThan(0)
  expect(
    metadata.boundaryDomainIntervalIds.length,
    JSON.stringify(metadata, null, 2)
  ).toBeGreaterThan(1)
  expect(
    metadata.boundaryDomainPackets.every((packet) =>
      hasAllowedVisualOverlapStatus(packet.visualOverlapCollapseStatus)
    ),
    JSON.stringify(metadata.boundaryDomainPackets, null, 2)
  ).toBe(true)
  expect(
    metadata.boundaryDomainPackets.every(
      (packet) =>
        packet.polygonCount > 0 &&
        packet.topologyFamily === 'self-intersecting' &&
        hasAllowedVisualOverlapStatus(packet.visualOverlapCollapseStatus) &&
        packet.debugIntervalId?.startsWith('interval:') === true &&
        packet.intervalIds.every((intervalId) =>
          intervalId.startsWith('interval:')
        )
    )
  ).toBe(true)
  expect(analysis.redPixelCount).toBeGreaterThan(1000)
  expect(analysis.darkOverdrawPixelCount).toBeLessThan(48)
  expect(analysis.maxDarkOverdrawComponentArea).toBeLessThan(32)
  expect(analysis.boundaryDomainPacketCount).toBe(metadata.exportPacketCount)

  await resetCanvas(page)
  await createSelfCheckStar(page, { includeFill: false })
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.()
    return Boolean(computed?.strokes?.length && !computed?.fills?.length)
  })
  await page.waitForTimeout(1000)

  const noFillMetadata = await getSelfCheckMetadata(page)
  fs.writeFileSync(
    NO_FILL_METADATA_PATH,
    `${JSON.stringify(noFillMetadata, null, 2)}\n`
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  const noFillScreenshot = await page.screenshot({
    path: NO_FILL_SCREENSHOT_PATH,
    fullPage: false
  })
  const noFillAnalysis = await analyzeSelfCheckBoundaryDomainOracle(
    page,
    noFillScreenshot,
    noFillMetadata,
    SELF_CHECK_SOURCE_PATH,
    { capType: 'round', expectedPosition: 'inside' }
  )
  const noFillSourcePathAnalysis = await analyzeInsideSolidSourcePathContinuity(
    page,
    baselineScreenshot,
    noFillScreenshot,
    noFillMetadata,
    { minCoverageRatio: 0.2, requireFillEligibility: false }
  )
  fs.writeFileSync(
    NO_FILL_ANALYSIS_PATH,
    `${JSON.stringify(
      {
        boundaryDomainAnalysis: noFillAnalysis,
        sourcePathAnalysis: noFillSourcePathAnalysis
      },
      null,
      2
    )}\n`
  )

  expect(noFillMetadata.exportPacketCount).toBeGreaterThan(0)
  expect(
    noFillMetadata.boundaryDomainPackets.every(
      (packet) =>
        packet.intervalIds.length > 0 ||
        packet.debugIntervalId !== null ||
        packet.domainPlanSplitRangeTerminals.length > 0
    ),
    JSON.stringify(noFillMetadata.boundaryDomainPackets, null, 2)
  ).toBe(true)
  expect(
    noFillMetadata.boundaryDomainPackets.every((packet) =>
      hasAllowedVisualOverlapStatus(packet.visualOverlapCollapseStatus)
    ),
    JSON.stringify(noFillMetadata.boundaryDomainPackets, null, 2)
  ).toBe(true)
  expect(noFillAnalysis.packetCount).toBe(noFillMetadata.exportPacketCount)
  expect(
    noFillAnalysis.intervalPacketFailureCount,
    JSON.stringify(noFillAnalysis.intervalPacketFailures, null, 2)
  ).toBe(0)
  expect(
    noFillAnalysis.coverageProbeFailures,
    JSON.stringify(noFillAnalysis, null, 2)
  ).toEqual([])
  expect(
    noFillAnalysis.terminalProbeFailures,
    JSON.stringify(noFillAnalysis, null, 2)
  ).toEqual([])
  expect(
    noFillAnalysis.visibleDashProbeFailures,
    JSON.stringify(noFillAnalysis, null, 2)
  ).toEqual([])
  expect(
    noFillAnalysis.dashBodyWidthProbeFailures,
    JSON.stringify(noFillAnalysis, null, 2)
  ).toEqual([])
  expect(
    noFillAnalysis.splitRangeSideConsistencyFailures,
    JSON.stringify(noFillAnalysis, null, 2)
  ).toEqual([])
  expect(
    noFillAnalysis.intervalContinuityFailures,
    JSON.stringify(noFillAnalysis, null, 2)
  ).toEqual([])
  expect(
    noFillAnalysis.distributionFailures,
    JSON.stringify(noFillAnalysis, null, 2)
  ).toEqual([])
  expect(
    noFillSourcePathAnalysis.failedSegmentSummaries,
    JSON.stringify(noFillSourcePathAnalysis, null, 2)
  ).toEqual([])

  await testInfo.attach('stroke-self-check-screenshot', {
    path: SCREENSHOT_PATH,
    contentType: 'image/png'
  })
  await testInfo.attach('stroke-self-check-no-fill-screenshot', {
    path: NO_FILL_SCREENSHOT_PATH,
    contentType: 'image/png'
  })
  await testInfo.attach('stroke-self-check-metadata', {
    path: METADATA_PATH,
    contentType: 'application/json'
  })
  await testInfo.attach('stroke-self-check-no-fill-metadata', {
    path: NO_FILL_METADATA_PATH,
    contentType: 'application/json'
  })
  await testInfo.attach('stroke-self-check-analysis', {
    path: ANALYSIS_PATH,
    contentType: 'application/json'
  })
  await testInfo.attach('stroke-self-check-no-fill-analysis', {
    path: NO_FILL_ANALYSIS_PATH,
    contentType: 'application/json'
  })
})
