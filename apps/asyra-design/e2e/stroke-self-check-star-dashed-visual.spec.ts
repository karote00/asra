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
  compareRightBottomHighCurvatureSmoothTerminalPixels
} from './stroke-self-check-star-fixture'
import type { SelfCheckJoinType, Vec2 } from './stroke-self-check-star-fixture'
;(['butt', 'square', 'round'] as const).forEach((capType) => {
  test(`self-check: self-intersecting inside dashed ${capType} final pixels keep split terminals and bounded overdraw`, async ({
    page
  }) => {
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
        (packet) => packet.figmaLikeBoundaryRole === 'filled-face'
      )
    expect(
      insideFilledFaceBoundaryPackets.length,
      JSON.stringify(
        metadata.boundaryDomainPackets.map((packet) => ({
          geometryId: packet.geometryId,
          role: packet.figmaLikeBoundaryRole,
          selectedSide: packet.figmaLikeSelectedSide,
          filledSide: packet.figmaLikeFilledSide,
          unfilledSide: packet.figmaLikeUnfilledSide,
          polygonCount: packet.polygonCount
        })),
        null,
        2
      )
    ).toBeGreaterThan(0)
    expect(
      metadata.boundaryDomainPackets.every((packet) => {
        if (packet.figmaLikeBoundaryRole === 'filled-face') {
          return (
            packet.figmaLikeSelectedSide === packet.figmaLikeFilledSide &&
            packet.figmaLikeSelectedSide !== packet.figmaLikeUnfilledSide
          )
        }
        return (
          packet.figmaLikeBoundaryRole === 'outer' &&
          packet.figmaLikeSelectedSide === packet.figmaLikeFilledSide &&
          packet.figmaLikeSelectedSide !== packet.figmaLikeUnfilledSide
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
        (packet) => packet.figmaLikeBoundaryRole === 'filled-face'
      )
    expect(
      outsideFilledFaceBoundaryPackets,
      JSON.stringify(
        metadata.boundaryDomainPackets.map((packet) => ({
          geometryId: packet.geometryId,
          role: packet.figmaLikeBoundaryRole,
          selectedSide: packet.figmaLikeSelectedSide,
          filledSide: packet.figmaLikeFilledSide,
          unfilledSide: packet.figmaLikeUnfilledSide,
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
          packet.sourceTopology === 'self-intersecting' &&
          packet.finalCoverageBuilderStatus === 'product-final' &&
          packet.debugIntervalId?.startsWith('interval:') === true &&
          packet.intervalIds.every((intervalId) =>
            intervalId.startsWith('interval:')
          ) &&
          packet.figmaLikeSelectedSide === packet.figmaLikeUnfilledSide &&
          packet.figmaLikeSelectedSide !== packet.figmaLikeFilledSide
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
      boundaryDomainAnalysis.splitRangeSideConsistencyFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
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

test('self-check: right-bottom high-curvature outside dashed terminal remains cap-owned across join settings', async ({
  page
}) => {
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
    metadataByJoin[joinType] = await getSelfCheckMetadata(page)
  }

  expect(metadataByJoin.miter).toBeDefined()
  expect(metadataByJoin.bevel).toBeDefined()
  expect(metadataByJoin.round).toBeDefined()
  expect(screenshots.miter).toBeDefined()
  expect(screenshots.bevel).toBeDefined()
  expect(screenshots.round).toBeDefined()

  const boundaryTerminalJoinPackets = Object.entries(metadataByJoin).flatMap(
    ([joinType, joinMetadata]) =>
      (joinMetadata?.boundaryDomainPackets ?? []).flatMap((packet) =>
        packet.geometryId?.includes(':boundary-terminal-join:')
          ? [
              {
                joinType,
                geometryId: packet.geometryId,
                intervalIds: packet.intervalIds,
                terminalRole: packet.figmaLikeTerminalRole
              }
            ]
          : []
      )
  )
  const productTerminalPacketCounts = Object.entries(metadataByJoin).map(
    ([joinType, joinMetadata]) => ({
      joinType,
      count: (joinMetadata?.boundaryDomainPackets ?? []).filter((packet) => {
        const role = packet.figmaLikeTerminalRole
        return (
          packet.strokePosition === 'outside' &&
          packet.finalCoverageBuilderStatus === 'product-final' &&
          (role === 'start' || role === 'end' || role === 'start-end')
        )
      }).length
    })
  )
  const sourceVertexJoinPacketCounts = Object.entries(metadataByJoin).map(
    ([joinType, joinMetadata]) => ({
      joinType,
      count: (joinMetadata?.boundaryDomainPackets ?? []).filter((packet) =>
        packet.geometryId?.includes(':source-vertex-join:')
      ).length
    })
  )
  const localSourceVertexJoinPacketCounts = Object.entries(metadataByJoin).map(
    ([joinType, joinMetadata]) => ({
      joinType,
      tp14: (joinMetadata?.boundaryDomainPackets ?? []).filter(
        (packet) =>
          packet.geometryId?.includes(':source-vertex-join:') &&
          packet.polygons.some((polygon) =>
            polygon.some(
              (point) =>
                Math.hypot(
                  point.x - SELF_CHECK_SOURCE_POINTS['tp-14'].x,
                  point.y - SELF_CHECK_SOURCE_POINTS['tp-14'].y
                ) <= 24
            )
          )
      ).length,
      tp15: (joinMetadata?.boundaryDomainPackets ?? []).filter(
        (packet) =>
          packet.geometryId?.includes(':source-vertex-join:') &&
          packet.polygons.some((polygon) =>
            polygon.some(
              (point) =>
                Math.hypot(
                  point.x - SELF_CHECK_SOURCE_POINTS['tp-15'].x,
                  point.y - SELF_CHECK_SOURCE_POINTS['tp-15'].y
                ) <= 24
            )
          )
      ).length
    })
  )
  const localSourceVertexJoinPolygonSizes = Object.entries(metadataByJoin).map(
    ([joinType, joinMetadata]) => ({
      joinType,
      tp14: (joinMetadata?.boundaryDomainPackets ?? [])
        .filter(
          (packet) =>
            packet.geometryId?.includes(':source-vertex-join:') &&
            packet.polygons.some((polygon) =>
              polygon.some(
                (point) =>
                  Math.hypot(
                    point.x - SELF_CHECK_SOURCE_POINTS['tp-14'].x,
                    point.y - SELF_CHECK_SOURCE_POINTS['tp-14'].y
                  ) <= 24
              )
            )
        )
        .flatMap((packet) => packet.polygons.map((polygon) => polygon.length)),
      tp15: (joinMetadata?.boundaryDomainPackets ?? [])
        .filter(
          (packet) =>
            packet.geometryId?.includes(':source-vertex-join:') &&
            packet.polygons.some((polygon) =>
              polygon.some(
                (point) =>
                  Math.hypot(
                    point.x - SELF_CHECK_SOURCE_POINTS['tp-15'].x,
                    point.y - SELF_CHECK_SOURCE_POINTS['tp-15'].y
                  ) <= 24
              )
            )
        )
        .flatMap((packet) => packet.polygons.map((polygon) => polygon.length))
    })
  )

  expect(
    boundaryTerminalJoinPackets,
    JSON.stringify({ boundaryTerminalJoinPackets }, null, 2)
  ).toEqual([])
  expect(
    productTerminalPacketCounts.every(({ count }) => count > 0),
    JSON.stringify({ productTerminalPacketCounts }, null, 2)
  ).toBe(true)
  expect(
    sourceVertexJoinPacketCounts.every(({ count }) => count > 0),
    JSON.stringify({ sourceVertexJoinPacketCounts }, null, 2)
  ).toBe(true)

  const miterVsBevel =
    await compareRightBottomHighCurvatureSmoothTerminalPixels(
      page,
      screenshots.miter as Buffer,
      screenshots.bevel as Buffer,
      metadataByJoin.miter as Awaited<ReturnType<typeof getSelfCheckMetadata>>
    )
  const miterVsRound =
    await compareRightBottomHighCurvatureSmoothTerminalPixels(
      page,
      screenshots.miter as Buffer,
      screenshots.round as Buffer,
      metadataByJoin.miter as Awaited<ReturnType<typeof getSelfCheckMetadata>>
    )
  const bevelVsRound =
    await compareRightBottomHighCurvatureSmoothTerminalPixels(
      page,
      screenshots.bevel as Buffer,
      screenshots.round as Buffer,
      metadataByJoin.bevel as Awaited<ReturnType<typeof getSelfCheckMetadata>>
    )

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

  expect(
    [
      miterVsBevel.changedPixelCount,
      miterVsRound.changedPixelCount,
      bevelVsRound.changedPixelCount,
      miterVsBevel.changedRgbaPixelCount,
      miterVsRound.changedRgbaPixelCount,
      bevelVsRound.changedRgbaPixelCount
    ],
    JSON.stringify(
      {
        message:
          'right-bottom high-curvature boundary split endpoint is terminal/cap geometry, so local coverage must not depend on joinType',
        miterVsBevel,
        miterVsRound,
        bevelVsRound,
        computedStrokes: metadataByJoin.round?.computedStrokes
      },
      null,
      2
    )
  ).toEqual([0, 0, 0, 0, 0, 0])

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
    Math.min(
      rightTopMiterVsRound.changedRgbaPixelCount,
      rightTopBevelVsRound.changedRgbaPixelCount,
      leftTopMiterVsRound.changedRgbaPixelCount,
      leftTopBevelVsRound.changedRgbaPixelCount
    ),
    JSON.stringify(
      {
        message:
          'the authored left-top and right-top source vertices must respond to round join while boundary split terminals stay cap-owned',
        rightTopMiterVsRound,
        rightTopBevelVsRound,
        leftTopMiterVsRound,
        leftTopBevelVsRound,
        sourceVertexJoinPacketCounts,
        localSourceVertexJoinPacketCounts,
        localSourceVertexJoinPolygonSizes
      },
      null,
      2
    )
  ).toBeGreaterThan(20)
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
        const fallbackRect = (window as any).__selfCheckVectorRect
        const targetRect =
          fallbackRect &&
          typeof fallbackRect.x === 'number' &&
          typeof fallbackRect.y === 'number' &&
          typeof fallbackRect.width === 'number' &&
          typeof fallbackRect.height === 'number'
            ? fallbackRect
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
  const boundaryTerminalJoinPackets = metadata.boundaryDomainPackets.filter(
    (packet) => packet.geometryId?.includes(':boundary-terminal-join:')
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
              splitRangeId: packet.figmaLikeSplitRangeId,
              terminalRole: packet.figmaLikeTerminalRole
            }
          ]
        : []
    }
  )

  expect(
    boundaryTerminalJoinPackets,
    JSON.stringify({ boundaryTerminalJoinPackets }, null, 2)
  ).toEqual([])
  expect(
    crossIntervalArrangedPackets,
    JSON.stringify({ crossIntervalArrangedPackets }, null, 2)
  ).toEqual([])
})

test('self-check: self-intersecting inside dashed round star satisfies rule-driven split ranges', async ({
  page
}, testInfo) => {
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
    status === null || status === 'exact-union'

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
        packet.sourceTopology === 'self-intersecting' &&
        packet.finalCoverageBuilderStatus === 'product-final' &&
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
  const noFillScreenshot = await page.screenshot({
    path: NO_FILL_SCREENSHOT_PATH,
    fullPage: false
  })
  const noFillAnalysis = await analyzeSelfCheckBoundaryDomainOracle(
    page,
    noFillScreenshot,
    noFillMetadata,
    SELF_CHECK_SOURCE_PATH
  )
  fs.writeFileSync(
    NO_FILL_ANALYSIS_PATH,
    `${JSON.stringify(noFillAnalysis, null, 2)}\n`
  )

  expect(noFillMetadata.exportPacketCount).toBeGreaterThan(0)
  expect(
    noFillMetadata.boundaryDomainIntervalIds.length
  ).toBeGreaterThanOrEqual(noFillMetadata.exportPacketCount)
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
