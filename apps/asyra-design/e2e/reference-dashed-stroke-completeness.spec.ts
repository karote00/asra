import { writeFile } from 'node:fs/promises'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import {
  getCanvasPosition,
  getActiveTool,
  getElementCount,
  getZoomLevel,
  getToolbar,
  resetCanvas,
  waitForAppReady
} from './test-utils'

// Definition:
// apps/asyra-design/e2e/definitions/reference-dashed-stroke-completeness.definition.md

interface WorkspacePoint {
  x: number
  y: number
}

interface ReferencePoint {
  x: number
  y: number
  anchorType: 'sharp' | 'smooth'
  inHandle: WorkspacePoint | null
  outHandle: WorkspacePoint | null
}

interface VectorPointSnapshot {
  id: string
  x: number | null
  y: number | null
  anchorType: string | null
  inHandle: WorkspacePoint | null
  outHandle: WorkspacePoint | null
}

interface SelectedVectorSnapshot {
  elementId: string
  rawPosition: {
    x: number | null
    y: number | null
  }
  renderViewport: {
    scale: number | null
    position: WorkspacePoint | null
  }
  dataPosition: {
    x: number | null
    y: number | null
  }
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  zoom: number
  viewport: WorkspacePoint
  closed: boolean
  pointCount: number
  segmentCount: number
  points: VectorPointSnapshot[]
  localPoints: VectorPointSnapshot[]
  stroke: {
    style: string | null
    position: string | null
    width: number | null
    dash: number | null
    gap: number | null
    color: string | null
    opacity: number | null
    joinType: string | null
    miterAngle: number | null
  } | null
}

interface SampledColor {
  r: number
  g: number
  b: number
  a: number
}

interface RasterProbeResult {
  color: SampledColor
  covered: boolean
  redPixelRatio: number
}

interface BenchmarkMetric {
  label: string
  actual: number | string | boolean
  expected: string
  passed: boolean
}

interface LocalMaskComparison {
  intersectionOverUnion: number
  coreIntersectionOverUnion: number
  overlayAdjustedIntersectionOverUnion: number | null
  screenshotStrokePixels: number
  meshStrokePixels: number
  intersectionPixels: number
  symmetricDifferencePixels: number
  sampleStride: number
  screenshotOnlyPixels: number
  meshOnlyPixels: number
  screenshotOnlyBoundaryAdjacentRatio: number
  meshOnlyBoundaryAdjacentRatio: number
  screenshotOnlyAverageColor: SampledColor | null
  meshOnlyAverageColor: SampledColor | null
  screenshotOnlyAverageRedExcess: number | null
  meshOnlyAverageRedExcess: number | null
  meshOnlyOverlayOccludedPixels: number
  meshOnlyOverlayOccludedRatio: number | null
  mismatchBounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
    width: number
    height: number
  } | null
}

interface ReferencePointDelta {
  index: number
  anchorDelta: number
  inHandleDelta: number | null
  outHandleDelta: number | null
}

interface VectorRaster {
  snapshot: SelectedVectorSnapshot
  imageBase64: string
  clip: {
    x: number
    y: number
    width: number
    height: number
  }
}

interface RenderMeshSnapshot {
  childCount: number
  children: RenderMeshNodeSnapshot[]
}

interface RenderMeshNodeSnapshot {
  type: string
  visible: boolean
  renderable: boolean
  childCount: number
  meshVertexCount?: number
  meshIndexCount?: number
  bounds?: {
    x: number
    y: number
    width: number
    height: number
  }
  children?: RenderMeshNodeSnapshot[]
}

interface ArcLengthSample {
  t: number
  point: WorkspacePoint
  distance: number
}

interface PathSegmentRecord {
  index: number
  kind: 'line' | 'cubic'
  start: WorkspacePoint
  end: WorkspacePoint
  outHandle?: WorkspacePoint
  inHandle?: WorkspacePoint
  startDistance: number
  endDistance: number
  length: number
  arcTable?: ArcLengthSample[]
}

interface PathProbeSample {
  distance: number
  segmentIndex: number
  expectedCovered: boolean | null
  sourcePoint: WorkspacePoint
  inwardNormal: WorkspacePoint
  insidePoint: WorkspacePoint
  outsidePoint: WorkspacePoint
}

interface DashBodyLengthMeasurement {
  dashIndex: number
  startDistance: number
  endDistance: number
  bodyStartDistance: number
  bodyEndDistance: number
  bodyLength: number
  sampleCount: number
}

interface ExpectedDashBodyLengthMeasurement extends DashBodyLengthMeasurement {
  expectedBodyStartDistance: number
  expectedBodyEndDistance: number
  expectedBodyLength: number
  coveredRatio: number
}

interface HighCurvatureTurnProbeTarget {
  anchorWorkspacePoint: WorkspacePoint
  sourcePoint: WorkspacePoint
  insidePoint: WorkspacePoint
  segmentIndex: number
  distanceToAnchor: number
}

interface PointDistanceCandidate {
  point: VectorPointSnapshot
  distance: number
}

interface ReferencePointBinding {
  referenceIndex: number
  point: VectorPointSnapshot
}

const isStableDashBodyMeasurement = (measurement: DashBodyLengthMeasurement) =>
  measurement.sampleCount >= 5 && measurement.bodyLength >= 10

const isStableCapExcludedDashBodyMeasurement = (
  measurement: DashBodyLengthMeasurement
) => measurement.sampleCount >= 3 && measurement.bodyLength >= 8

const DRAW_ORIGIN = {
  x: 96,
  y: 32
} as const

const REFERENCE_VECTOR_POSITION = {
  x: 1145.3234899213014,
  y: 1623.7871698383105
} as const

const REFERENCE_POINTS: ReferencePoint[] = [
  {
    x: 373.46333453225066,
    y: 0,
    anchorType: 'sharp',
    inHandle: null,
    outHandle: {
      x: 320.34962003916075,
      y: 193.03235513581444
    }
  },
  {
    x: 130.10980686930043,
    y: 590.3130126477508,
    anchorType: 'smooth',
    inHandle: {
      x: 2.8913290415403026,
      y: 488.1527198466706
    },
    outHandle: {
      x: 289.13290415400047,
      y: 718.013378649101
    }
  },
  {
    x: 667.4151204221512,
    y: 255.40073200270035,
    anchorType: 'sharp',
    inHandle: null,
    outHandle: null
  },
  {
    x: 0,
    y: 132.51924773725023,
    anchorType: 'sharp',
    inHandle: null,
    outHandle: {
      x: 0,
      y: 132.51924773725023
    }
  },
  {
    x: 585.494130911851,
    y: 599.9507761195509,
    anchorType: 'smooth',
    inHandle: {
      x: 575.8563674400509,
      y: 655.3679160824013
    },
    outHandle: {
      x: 595.1318943836511,
      y: 544.5336361567006
    }
  }
]

const DASH_LENGTH = 30
const GAP_LENGTH = 40
const PROBE_STEP = 2
const PROBE_OFFSET = 5
const TRANSITION_MARGIN = 1.5
const CORNER_MARGIN = 6
const CROSS_SECTION_COVERAGE_THRESHOLD = 0.2
const HIGH_CURVATURE_TURN_SELECTED_LOCAL_CLIP_SIZE = 280
const HIGH_CURVATURE_TURN_SELECTED_MASK_SAMPLE_STRIDE = 2
const RUN_SELECTED_STATE_LOCAL_DIAGNOSTICS =
  process.env.ASYRA_REFERENCE_HIGH_CURVATURE_DIAGNOSTICS === '1'

const toWorkspace = (point: WorkspacePoint): WorkspacePoint => ({
  x: DRAW_ORIGIN.x + point.x,
  y: DRAW_ORIGIN.y + point.y
})

const getViewportState = async (page: Page) =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    return {
      zoom: core?.getSystemProperty?.('zoom') ?? 1,
      viewport: core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
    }
  })

const workspaceToClient = async (page: Page, point: WorkspacePoint) => {
  const { zoom, viewport } = await getViewportState(page)

  return {
    x: point.x * zoom + viewport.x,
    y: point.y * zoom + viewport.y
  }
}

const clickWorkspace = async (page: Page, point: WorkspacePoint) => {
  const client = await workspaceToClient(page, point)
  await page.mouse.move(client.x, client.y, { steps: 6 })
  await page.waitForTimeout(40)
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(40)
}

const getPathEditingDiagnostics = async (page: Page) => {
  const snapshot = await getSelectedVectorSnapshot(page)
  const uiActiveTool = await getActiveTool(page)

  return page.evaluate(
    ({ snapshotPointCount, uiActiveToolState }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__

      return {
        uiActiveToolState,
        activeTool: core?.getSystemProperty?.('activeTool') ?? null,
        primaryTool: core?.getSystemProperty?.('primaryTool') ?? null,
        pathEditingVectorId:
          core?.getSystemProperty?.('pathEditingVectorId') ?? null,
        pathEditingContinuation:
          core?.getSystemProperty?.('pathEditingContinuation') ?? null,
        pathEditingStartNewSubpath:
          core?.getSystemProperty?.('pathEditingStartNewSubpath') ?? null,
        selectedVectorPoint:
          core?.getSystemProperty?.('selectedVectorPoint') ?? null,
        selectedElementIds:
          core?.deps?.selection?.getElementSelectionIds?.() ?? [],
        snapshotPointCount
      }
    },
    {
      snapshotPointCount: snapshot?.pointCount ?? null,
      uiActiveToolState: uiActiveTool
    }
  )
}

const clickWorkspaceUntilElementCount = async (
  page: Page,
  point: WorkspacePoint,
  expectedCount: number,
  attempts = 3
) => {
  let lastError: unknown = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await activatePenTool(page)
      await page.waitForTimeout(120)
    }

    await clickWorkspace(page, point)

    try {
      await expect
        .poll(async () => getElementCount(page), {
          timeout: 1200
        })
        .toBe(expectedCount)
      return
    } catch (error) {
      lastError = error
      const toolbar = getToolbar(page)
      await toolbar.click({ position: { x: 8, y: 8 } })
      await page.waitForTimeout(120)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

const _clickWorkspaceUntilPointCount = async (
  page: Page,
  point: WorkspacePoint,
  expectedPointCount: number,
  attempts = 3
) => {
  let lastError: unknown = null
  let lastDiagnostics: unknown = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await resumePathEditingOnSelectedVector(page)
      await page.waitForTimeout(120)
    }

    await clickWorkspace(page, point)

    try {
      await expect
        .poll(
          async () =>
            (await getSelectedVectorSnapshot(page))?.pointCount ?? null,
          {
            timeout: 1200
          }
        )
        .toBe(expectedPointCount)
      return
    } catch (error) {
      lastError = error
      lastDiagnostics = {
        attempt: attempt + 1,
        workspacePoint: point,
        clientPoint: await workspaceToClient(page, point),
        diagnostics: await getPathEditingDiagnostics(page)
      }
      await page.waitForTimeout(120)
    }
  }

  const baseError =
    lastError instanceof Error ? lastError.message : String(lastError)

  throw new Error(
    `${baseError}\nPoint-count diagnostics: ${JSON.stringify(lastDiagnostics)}`
  )
}

const _closeWorkspacePathUntilClosed = async (
  page: Page,
  point: WorkspacePoint,
  expectedPointCount: number,
  expectedSegmentCount: number,
  attempts = 3
) => {
  let lastError: unknown = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await resumePathEditingOnSelectedVector(page)
      await page.waitForTimeout(120)
    }

    await clickWorkspace(page, point)
    await page.waitForTimeout(150)

    try {
      await expect
        .poll(
          async () => {
            const targetSnapshot = await getSelectedVectorSnapshot(page)
            return {
              pointCount: targetSnapshot?.pointCount ?? null,
              segmentCount: targetSnapshot?.segmentCount ?? null,
              closed: targetSnapshot?.closed ?? null
            }
          },
          { timeout: 1200 }
        )
        .toEqual({
          pointCount: expectedPointCount,
          segmentCount: expectedSegmentCount,
          closed: true
        })
      return
    } catch (error) {
      lastError = error
      await page.waitForTimeout(120)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

const activatePenTool = async (page: Page) => {
  const toolbar = getToolbar(page)
  await toolbar.click({ position: { x: 8, y: 8 } })
  await page.keyboard.press('p')

  try {
    await expect.poll(() => getActiveTool(page), { timeout: 1200 }).toBe('pen')
  } catch {
    await page.getByTestId('tool-pen').click()
    await expect.poll(() => getActiveTool(page), { timeout: 1200 }).toBe('pen')
  }
}

const resumePathEditingOnSelectedVector = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null

    if (!selectedId) {
      return
    }

    core?.setSystemProperty?.('pathEditingVectorId', selectedId)
    core?.setSystemProperty?.('selectedVectorPoint', null)
  })

  if ((await getActiveTool(page)) !== 'pen') {
    await activatePenTool(page)
  }
}

const centerVectorInViewport = async (
  page: Page,
  elementId?: string | null
) => {
  await page.evaluate((targetElementId) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      targetElementId ??
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ??
      null
    if (!selectedId) {
      return
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.()
    const viewportAnchor = document.getElementById('viewport-anchor')
    const zoom = core?.getSystemProperty?.('zoom') ?? 1
    if (!computed || !viewportAnchor) {
      return
    }

    const bounds = viewportAnchor.getBoundingClientRect()
    const nextViewport = {
      x:
        bounds.left +
        bounds.width / 2 -
        (computed.x + computed.width / 2) * zoom,
      y:
        bounds.top +
        bounds.height / 2 -
        (computed.y + computed.height / 2) * zoom
    }

    core?.setSystemProperty?.('viewportPosition', nextViewport)
  }, elementId ?? null)

  await page.waitForTimeout(120)
}

const settleRenderFrames = async (page: Page, frames = 2) => {
  await page.evaluate(async (frameCount) => {
    const waitFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    for (let index = 0; index < frameCount; index += 1) {
      await waitFrame()
    }
  }, frames)
}

const zoomOutForReferenceDrawing = async (page: Page, targetPercent = 70) => {
  const canvasCenter = await getCanvasPosition(page, 0.5, 0.5)
  await page.mouse.move(canvasCenter.x, canvasCenter.y)
  await page.keyboard.down('Meta')

  for (let i = 0; i < 20; i += 1) {
    const currentZoom = await getZoomLevel(page)
    if (currentZoom <= targetPercent) {
      break
    }

    await page.mouse.wheel(0, 240)
    await page.waitForTimeout(60)
  }

  await page.keyboard.up('Meta')
}

const movePointerToBlankCanvas = async (page: Page) => {
  const blankCanvasPoint = await getCanvasPosition(page, 0.08, 0.08)
  await page.mouse.move(blankCanvasPoint.x, blankCanvasPoint.y, { steps: 4 })
  await page.waitForTimeout(80)
}

const ensureStrokeControlsVisible = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const targetElementId =
      core?.getSystemProperty?.('pathEditingVectorId') ??
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ??
      null
    core?.setUIProperty?.('vectorPointSelection', new Set())
    core?.setUIProperty?.('vectorSegmentSelection', new Set())
    core?.setSystemProperty?.('selectedVectorPoint', null)
    core?.setSystemProperty?.('hoveredVectorPoint', null)
    core?.setSystemProperty?.('selectedVectorSegment', null)
    core?.setSystemProperty?.('hoveredVectorSegment', null)
    core?.setSystemProperty?.('hoveredVectorSegmentInsertPoint', null)
    core?.deps?.selection?.clearVectorPointSelection?.({ undoable: false })
    core?.deps?.selection?.clearVectorSegmentSelection?.({ undoable: false })
    if (targetElementId) {
      core?.deps?.selection?.selectElements?.([targetElementId], {
        undoable: false
      })
    }
  })

  await expect(page.getByTestId('prop-stroke-width-0')).toBeVisible({
    timeout: 5000
  })
  await expect(page.getByTestId('prop-vector-point-x')).not.toBeVisible()
}

const bindReferencePointsToSnapshot = (
  snapshot: SelectedVectorSnapshot
): ReferencePointBinding[] => {
  const remaining = snapshot.points.filter(
    (point): point is VectorPointSnapshot & { x: number; y: number } =>
      point.x != null && point.y != null
  )
  const bindings: ReferencePointBinding[] = []

  REFERENCE_POINTS.forEach((referencePoint, referenceIndex) => {
    const bestPoint = [...remaining]
      .map(
        (point): PointDistanceCandidate => ({
          point,
          distance: Math.hypot(
            point.x - referencePoint.x,
            point.y - referencePoint.y
          )
        })
      )
      .sort((left, right) => left.distance - right.distance)[0]?.point

    if (!bestPoint) {
      return
    }

    bindings.push({
      referenceIndex,
      point: bestPoint
    })

    const remainingIndex = remaining.findIndex(
      (candidate) => candidate.id === bestPoint.id
    )
    if (remainingIndex >= 0) {
      remaining.splice(remainingIndex, 1)
    }
  })

  return bindings
}

const applyReferenceVectorGeometry = async (
  page: Page,
  vectorId: string,
  bindings: ReferencePointBinding[]
) => {
  await page.evaluate(
    ({ elementId, bindings, referencePoints }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const element = core?.deps?.sceneTree?.getElementById?.(elementId)
      const computed = element?.getAllComputedData?.()
      const primaryNetwork = Object.values(computed?.networks ?? {})[0] as
        | {
            id: string
            pointIds?: string[]
            segmentIds?: string[]
          }
        | undefined

      if (!computed || !primaryNetwork) {
        throw new Error('Missing vector topology for geometry patch')
      }

      let nextPoints = {
        ...(computed.points ?? {})
      } as Record<string, Record<string, unknown>>
      const pointIds = [...(primaryNetwork.pointIds ?? [])]
      const segmentIds = [...(primaryNetwork.segmentIds ?? [])]
      const referenceByPointId = new Map(
        bindings.map((binding) => [
          binding.point.id,
          referencePoints[binding.referenceIndex]
        ])
      )

      pointIds.forEach((pointId) => {
        const referencePoint = referenceByPointId.get(pointId)
        if (!referencePoint) {
          return
        }

        nextPoints[pointId] = {
          ...(nextPoints[pointId] ?? {}),
          id: pointId,
          kind: 'anchor',
          anchorType: referencePoint.anchorType,
          x: referencePoint.x,
          y: referencePoint.y
        }

        const inControlId = `${pointId}:in`
        const outControlId = `${pointId}:out`

        if (referencePoint.inHandle) {
          nextPoints[inControlId] = {
            ...(nextPoints[inControlId] ?? {}),
            id: inControlId,
            kind: 'control',
            controlForId: pointId,
            controlRole: 'in',
            x: referencePoint.inHandle.x,
            y: referencePoint.inHandle.y
          }
        } else {
          const { [inControlId]: _removedControl, ...remainingPoints } =
            nextPoints
          nextPoints = remainingPoints
        }

        if (referencePoint.outHandle) {
          nextPoints[outControlId] = {
            ...(nextPoints[outControlId] ?? {}),
            id: outControlId,
            kind: 'control',
            controlForId: pointId,
            controlRole: 'out',
            x: referencePoint.outHandle.x,
            y: referencePoint.outHandle.y
          }
        } else {
          const { [outControlId]: _removedControl, ...remainingPoints } =
            nextPoints
          nextPoints = remainingPoints
        }
      })

      const existingSegments = {
        ...(computed.segments ?? {})
      } as Record<string, Record<string, unknown>>
      const nextSegments: Record<string, Record<string, unknown>> = {}

      segmentIds.forEach((segmentId, index) => {
        const startId = pointIds[index]
        const endId = pointIds[(index + 1) % pointIds.length]
        const outControlId = `${startId}:out`
        const inControlId = `${endId}:in`

        nextSegments[segmentId] = {
          ...(existingSegments[segmentId] ?? {}),
          id: segmentId,
          startId,
          endId,
          outControlId: nextPoints[outControlId] ? outControlId : null,
          inControlId: nextPoints[inControlId] ? inControlId : null
        }
      })

      core?.changeComputedData?.(
        [elementId],
        {
          points: nextPoints,
          segments: nextSegments,
          networks: {
            ...(computed.networks ?? {}),
            [primaryNetwork.id]: {
              ...primaryNetwork,
              pointIds,
              segmentIds,
              closed: true
            }
          },
          closed: true
        },
        { undoable: false }
      )
    },
    {
      elementId: vectorId,
      bindings,
      referencePoints: REFERENCE_POINTS
    }
  )
}

const clearSelectedVectorPoint = async (page: Page) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.keyboard.press('Escape')
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          return core?.getSystemProperty?.('selectedVectorPoint') ?? null
        })
      })
      .toBeNull()

    try {
      await ensureStrokeControlsVisible(page)
      return
    } catch (error) {
      if (attempt === 2) {
        throw error
      }
    }
  }
}

const configureStrokeFromReference = async (
  page: Page,
  config: {
    dashLength?: number
    gapLength?: number
  } = {}
) => {
  const dashLength = config.dashLength ?? DASH_LENGTH
  const gapLength = config.gapLength ?? GAP_LENGTH
  const propertiesPanel = page.getByTestId('properties-panel')
  const strokeWidthInput = propertiesPanel.getByTestId('prop-stroke-width-0')
  const strokeStyleSelect = propertiesPanel.getByTestId('prop-stroke-style-0')
  const strokePatternInput = propertiesPanel.getByTestId(
    'prop-stroke-pattern-0'
  )
  const strokePositionSelect = propertiesPanel.getByTestId(
    'prop-stroke-position-0'
  )
  const strokeJoinSelect = propertiesPanel.getByTestId('prop-stroke-join-0')
  const strokeMiterInput = propertiesPanel.getByTestId('prop-stroke-miter-0')
  const strokeColorInput = propertiesPanel.getByTestId('prop-stroke-color-0')
  const strokeOpacityInput = propertiesPanel.getByTestId(
    'prop-stroke-opacity-0'
  )

  await strokeStyleSelect.selectOption('dashed')
  await expect(strokePatternInput).toBeVisible()

  await strokeWidthInput.click()
  await strokeWidthInput.fill('10')
  await strokeWidthInput.press('Enter')

  await strokePatternInput.click()
  await strokePatternInput.fill(`${dashLength}, ${gapLength}`)
  await strokePatternInput.press('Enter')

  await strokePositionSelect.selectOption('inside')
  await strokeJoinSelect.selectOption('miter')

  await strokeMiterInput.click()
  await strokeMiterInput.fill('28.96')
  await strokeMiterInput.press('Enter')

  await strokeColorInput.click()
  await strokeColorInput.fill('D90909')
  await strokeColorInput.press('Enter')

  await strokeOpacityInput.click()
  await strokeOpacityInput.fill('50')
  await strokeOpacityInput.press('Enter')

  await expect
    .poll(async () => {
      const snapshot = await getVectorSnapshot(page)
      return snapshot?.stroke
        ? {
            width: snapshot.stroke.width,
            position: snapshot.stroke.position,
            joinType: snapshot.stroke.joinType,
            miterAngle: snapshot.stroke.miterAngle,
            style: snapshot.stroke.style,
            dash: snapshot.stroke.dash,
            gap: snapshot.stroke.gap,
            color: snapshot.stroke.color,
            opacity: snapshot.stroke.opacity
          }
        : null
    })
    .toEqual({
      width: 10,
      position: 'inside',
      joinType: 'miter',
      miterAngle: 28.96,
      style: 'dashed',
      dash: dashLength,
      gap: gapLength,
      color: '#d90909',
      opacity: 0.5
    })

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        const elementId =
          core?.getSystemProperty?.('pathEditingVectorId') ??
          core?.deps?.selection?.getElementSelectionIds?.()?.[0] ??
          null
        if (!elementId) {
          return []
        }

        const renderElement = core?.deps?.render?.getElementById?.(elementId)
        const rawCache = renderElement?.__asyraStrokeMeshCache
        if (!rawCache || typeof rawCache.keys !== 'function') {
          return []
        }

        return Array.from(rawCache.keys()).length
      })
    })
    .toBeGreaterThan(0)
}

const getVectorSnapshot = async (
  page: Page,
  elementId?: string | null
): Promise<SelectedVectorSnapshot | null> =>
  page.evaluate((targetElementId) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      targetElementId ??
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ??
      null
    if (!selectedId) {
      return null
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.() ?? {}
    const pointsPropId = element?.props?.getPropId?.('points') ?? null
    const pointsProp =
      typeof pointsPropId === 'string'
        ? core?.deps?.props?.getPropertyById?.(pointsPropId)
        : null
    const positionPropId = element?.props?.getPropId?.('position') ?? null
    const positionProp =
      typeof positionPropId === 'string'
        ? core?.deps?.props?.getPropertyById?.(positionPropId)
        : null
    const rawPosition =
      (positionProp?.getValue?.() as
        | {
            x?: number
            y?: number
          }
        | null
        | undefined) ?? null
    const localPoints =
      (
        pointsProp?.getValue?.() as
          | {
              points?: Record<
                string,
                {
                  x?: number
                  y?: number
                  kind?: string
                  anchorType?: string
                  type?: string
                }
              >
            }
          | null
          | undefined
      )?.points ?? null
    const primaryNetwork = Object.values(computed.networks ?? {})[0] as
      | {
          pointIds?: string[]
          segmentIds?: string[]
          closed?: boolean
        }
      | undefined

    if (!primaryNetwork) {
      return null
    }

    const orderedPoints = (primaryNetwork.pointIds ?? []).map((pointId) => {
      const anchor = computed.points?.[pointId]
      const inHandle = computed.points?.[`${pointId}:in`]
      const outHandle = computed.points?.[`${pointId}:out`]

      return {
        id: pointId,
        x: anchor?.x ?? null,
        y: anchor?.y ?? null,
        anchorType: anchor?.anchorType ?? anchor?.type ?? null,
        inHandle:
          inHandle && inHandle.kind === 'control'
            ? { x: inHandle.x, y: inHandle.y }
            : null,
        outHandle:
          outHandle && outHandle.kind === 'control'
            ? { x: outHandle.x, y: outHandle.y }
            : null
      }
    })
    const orderedLocalPoints = (primaryNetwork.pointIds ?? []).map(
      (pointId) => {
        const anchor = localPoints?.[pointId]
        const inHandle = localPoints?.[`${pointId}:in`]
        const outHandle = localPoints?.[`${pointId}:out`]

        return {
          id: pointId,
          x: anchor?.x ?? null,
          y: anchor?.y ?? null,
          anchorType: anchor?.anchorType ?? anchor?.type ?? null,
          inHandle:
            inHandle && inHandle.kind === 'control'
              ? {
                  x: inHandle.x ?? 0,
                  y: inHandle.y ?? 0
                }
              : null,
          outHandle:
            outHandle && outHandle.kind === 'control'
              ? {
                  x: outHandle.x ?? 0,
                  y: outHandle.y ?? 0
                }
              : null
        }
      }
    )

    const stroke = computed.strokes?.[0] ?? null
    const renderViewportScale = core?.deps?.render?.getViewportScale?.() ?? null
    const renderViewportPosition =
      core?.deps?.render?.getViewportPosition?.() ?? null

    return {
      elementId: selectedId,
      rawPosition: {
        x: rawPosition?.x ?? null,
        y: rawPosition?.y ?? null
      },
      renderViewport: {
        scale:
          typeof renderViewportScale === 'number' ? renderViewportScale : null,
        position:
          renderViewportPosition &&
          typeof renderViewportPosition.x === 'number' &&
          typeof renderViewportPosition.y === 'number'
            ? {
                x: renderViewportPosition.x,
                y: renderViewportPosition.y
              }
            : null
      },
      dataPosition: {
        x: computed.x ?? null,
        y: computed.y ?? null
      },
      x: computed.x ?? null,
      y: computed.y ?? null,
      width: computed.width ?? null,
      height: computed.height ?? null,
      zoom: core?.getSystemProperty?.('zoom') ?? 1,
      viewport: core?.getSystemProperty?.('viewportPosition') ?? { x: 0, y: 0 },
      closed: computed.closed ?? primaryNetwork.closed ?? false,
      pointCount: orderedPoints.length,
      segmentCount: (primaryNetwork.segmentIds ?? []).length,
      points: orderedPoints,
      localPoints: orderedLocalPoints,
      stroke: stroke
        ? {
            style: stroke.style ?? null,
            position: stroke.position ?? null,
            width: stroke.width ?? null,
            dash: Array.isArray(stroke.dashPattern)
              ? (stroke.dashPattern[0] ?? null)
              : null,
            gap: Array.isArray(stroke.dashPattern)
              ? (stroke.dashPattern[1] ?? null)
              : null,
            color: stroke.color ?? null,
            opacity: stroke.opacity ?? null,
            joinType: stroke.joinType ?? null,
            miterAngle: stroke.miterAngle ?? null
          }
        : null
    }
  }, elementId ?? null)

const getSelectedVectorSnapshot = async (
  page: Page
): Promise<SelectedVectorSnapshot | null> => getVectorSnapshot(page)

const sampleRenderMeshAtWorkspacePoints = async (
  page: Page,
  elementId: string,
  points: WorkspacePoint[],
  radius = 0
): Promise<{ covered: boolean }[]> =>
  page.evaluate(
    ({ targetElementId, workspacePoints, probeRadius }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const renderElement =
        core?.deps?.render?.getElementById?.(targetElementId)
      if (!renderElement?.parent) {
        return workspacePoints.map(() => ({ covered: false }))
      }

      interface LooseMeshNode {
        children?: LooseMeshNode[]
        geometry?: {
          getBuffer?: (name: string) => { data?: ArrayLike<number> } | undefined
          getIndex?: () => { data?: ArrayLike<number> } | undefined
        }
        toLocal?: (
          position: { x: number; y: number },
          from?: unknown
        ) => { x: number; y: number }
      }

      const meshes: LooseMeshNode[] = []
      const collectMeshes = (node: LooseMeshNode) => {
        if (
          typeof node.geometry?.getBuffer === 'function' &&
          typeof node.geometry?.getIndex === 'function'
        ) {
          meshes.push(node)
        }

        if (Array.isArray(node.children)) {
          node.children.forEach((child) => collectMeshes(child))
        }
      }

      const pointInTriangle = (
        point: WorkspacePoint,
        a: WorkspacePoint,
        b: WorkspacePoint,
        c: WorkspacePoint
      ) => {
        const denominator =
          (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
        if (Math.abs(denominator) <= 1e-9) {
          return false
        }

        const w1 =
          ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) /
          denominator
        const w2 =
          ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) /
          denominator
        const w3 = 1 - w1 - w2

        return w1 >= -1e-6 && w2 >= -1e-6 && w3 >= -1e-6
      }

      collectMeshes(renderElement as LooseMeshNode)

      const samplePointCovered = (samplePoint: WorkspacePoint) =>
        meshes.some((mesh) => {
          if (typeof mesh.toLocal !== 'function') {
            return false
          }

          const localPoint = mesh.toLocal(samplePoint, renderElement.parent)
          const positionData = mesh.geometry?.getBuffer?.('aPosition')?.data
          const indexData = mesh.geometry?.getIndex?.()?.data
          if (!positionData || !indexData) {
            return false
          }

          for (let index = 0; index < indexData.length; index += 3) {
            const ia = indexData[index] * 2
            const ib = indexData[index + 1] * 2
            const ic = indexData[index + 2] * 2

            if (
              pointInTriangle(
                localPoint,
                { x: positionData[ia], y: positionData[ia + 1] },
                { x: positionData[ib], y: positionData[ib + 1] },
                { x: positionData[ic], y: positionData[ic + 1] }
              )
            ) {
              return true
            }
          }

          return false
        })

      return workspacePoints.map((point) => {
        for (let offsetY = -probeRadius; offsetY <= probeRadius; offsetY += 1) {
          for (
            let offsetX = -probeRadius;
            offsetX <= probeRadius;
            offsetX += 1
          ) {
            if (offsetX ** 2 + offsetY ** 2 > probeRadius ** 2) {
              continue
            }

            if (
              samplePointCovered({
                x: point.x + offsetX,
                y: point.y + offsetY
              })
            ) {
              return { covered: true }
            }
          }
        }

        return { covered: false }
      })
    },
    {
      targetElementId: elementId,
      workspacePoints: points,
      probeRadius: radius
    }
  )

const sampleRenderMeshCrossSectionRatios = async (
  page: Page,
  elementId: string,
  samples: {
    sourcePoint: WorkspacePoint
    inwardNormal: WorkspacePoint
  }[],
  strokeWidth: number
): Promise<number[]> =>
  page.evaluate(
    ({ targetElementId, crossSectionSamples, sampleWidth }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const renderElement =
        core?.deps?.render?.getElementById?.(targetElementId)
      if (!renderElement?.parent) {
        return crossSectionSamples.map(() => 0)
      }

      interface LooseMeshNode {
        children?: LooseMeshNode[]
        geometry?: {
          getBuffer?: (name: string) => { data?: ArrayLike<number> } | undefined
          getIndex?: () => { data?: ArrayLike<number> } | undefined
        }
        toLocal?: (
          position: { x: number; y: number },
          from?: unknown
        ) => { x: number; y: number }
      }

      const meshes: LooseMeshNode[] = []
      const collectMeshes = (node: LooseMeshNode) => {
        if (
          typeof node.geometry?.getBuffer === 'function' &&
          typeof node.geometry?.getIndex === 'function'
        ) {
          meshes.push(node)
        }

        if (Array.isArray(node.children)) {
          node.children.forEach((child) => collectMeshes(child))
        }
      }

      const pointInTriangle = (
        point: WorkspacePoint,
        a: WorkspacePoint,
        b: WorkspacePoint,
        c: WorkspacePoint
      ) => {
        const denominator =
          (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
        if (Math.abs(denominator) <= 1e-9) {
          return false
        }

        const w1 =
          ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) /
          denominator
        const w2 =
          ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) /
          denominator
        const w3 = 1 - w1 - w2

        return w1 >= -1e-6 && w2 >= -1e-6 && w3 >= -1e-6
      }

      collectMeshes(renderElement as LooseMeshNode)

      return crossSectionSamples.map(({ sourcePoint, inwardNormal }) => {
        const sampleCount = Math.max(2, Math.round(sampleWidth))
        let coveredSteps = 0

        for (let step = 1; step <= sampleCount; step += 1) {
          const distance = (step / sampleCount) * sampleWidth
          const samplePoint = {
            x: sourcePoint.x + inwardNormal.x * distance,
            y: sourcePoint.y + inwardNormal.y * distance
          }

          const covered = meshes.some((mesh) => {
            if (typeof mesh.toLocal !== 'function') {
              return false
            }

            const localPoint = mesh.toLocal(samplePoint, renderElement.parent)
            const positionData = mesh.geometry?.getBuffer?.('aPosition')?.data
            const indexData = mesh.geometry?.getIndex?.()?.data
            if (!positionData || !indexData) {
              return false
            }

            for (let index = 0; index < indexData.length; index += 3) {
              const ia = indexData[index] * 2
              const ib = indexData[index + 1] * 2
              const ic = indexData[index + 2] * 2

              if (
                pointInTriangle(
                  localPoint,
                  { x: positionData[ia], y: positionData[ia + 1] },
                  { x: positionData[ib], y: positionData[ib + 1] },
                  { x: positionData[ic], y: positionData[ic + 1] }
                )
              ) {
                return true
              }
            }

            return false
          })

          if (covered) {
            coveredSteps += 1
          }
        }

        return coveredSteps / sampleCount
      })
    },
    {
      targetElementId: elementId,
      crossSectionSamples: samples,
      sampleWidth: strokeWidth
    }
  )

const compareRasterToRenderMeshLocalMask = async (
  page: Page,
  elementId: string,
  raster: {
    imageBase64: string
    clip: {
      x: number
      y: number
      width: number
      height: number
    }
    zoom: number
    viewport: WorkspacePoint
    sampleStride?: number
  }
): Promise<LocalMaskComparison> =>
  page.evaluate(
    async ({ targetElementId, screenshotRaster }) => {
      interface ColorAccumulator {
        r: number
        g: number
        b: number
        a: number
        count: number
      }

      const accumulateColor = (
        current: ColorAccumulator,
        r: number,
        g: number,
        b: number,
        a: number
      ): ColorAccumulator => ({
        r: current.r + r,
        g: current.g + g,
        b: current.b + b,
        a: current.a + a,
        count: current.count + 1
      })

      const finalizeAverageColor = (
        current: ColorAccumulator
      ): SampledColor | null =>
        current.count === 0
          ? null
          : {
              r: current.r / current.count,
              g: current.g / current.count,
              b: current.b / current.count,
              a: current.a / current.count
            }

      const finalizeAverageRedExcess = (current: ColorAccumulator) =>
        current.count === 0
          ? null
          : (current.r - current.g + (current.r - current.b)) /
            (2 * current.count)

      const isOverlayUiPixel = (r: number, g: number, b: number) =>
        (b >= 110 && b - r >= 20 && b - g >= 10) ||
        (Math.max(r, g, b) >= 140 &&
          Math.max(r, g, b) - Math.min(r, g, b) <= 35)

      interface BoundsAccumulator {
        minX: number
        minY: number
        maxX: number
        maxY: number
      }

      const updateBounds = (
        current: BoundsAccumulator | null,
        x: number,
        y: number
      ): BoundsAccumulator =>
        current
          ? {
              minX: Math.min(current.minX, x),
              minY: Math.min(current.minY, y),
              maxX: Math.max(current.maxX, x),
              maxY: Math.max(current.maxY, y)
            }
          : {
              minX: x,
              minY: y,
              maxX: x,
              maxY: y
            }

      const finalizeBounds = (bounds: BoundsAccumulator | null) =>
        bounds
          ? {
              ...bounds,
              width: bounds.maxX - bounds.minX + 1,
              height: bounds.maxY - bounds.minY + 1
            }
          : null

      const computeBoundaryAdjacentRatio = (
        sourceCoverage: boolean[][],
        neighborCoverage: boolean[][]
      ) => {
        let sourcePixels = 0
        let boundaryAdjacentPixels = 0
        for (let y = 0; y < sourceCoverage.length; y += 1) {
          for (let x = 0; x < sourceCoverage[y].length; x += 1) {
            if (!sourceCoverage[y][x]) {
              continue
            }
            sourcePixels += 1
            let adjacent = false
            for (
              let neighborY = Math.max(0, y - 1);
              neighborY <= Math.min(sourceCoverage.length - 1, y + 1) &&
              !adjacent;
              neighborY += 1
            ) {
              for (
                let neighborX = Math.max(0, x - 1);
                neighborX <= Math.min(sourceCoverage[y].length - 1, x + 1);
                neighborX += 1
              ) {
                if (neighborCoverage[neighborY][neighborX]) {
                  adjacent = true
                  break
                }
              }
            }
            if (adjacent) {
              boundaryAdjacentPixels += 1
            }
          }
        }

        return sourcePixels === 0 ? 1 : boundaryAdjacentPixels / sourcePixels
      }

      const erodeCoverage = (coverage: boolean[][]) =>
        coverage.map((row, y) =>
          row.map((covered, x) => {
            if (!covered) {
              return false
            }

            for (
              let neighborY = Math.max(0, y - 1);
              neighborY <= Math.min(coverage.length - 1, y + 1);
              neighborY += 1
            ) {
              for (
                let neighborX = Math.max(0, x - 1);
                neighborX <= Math.min(row.length - 1, x + 1);
                neighborX += 1
              ) {
                if (!coverage[neighborY][neighborX]) {
                  return false
                }
              }
            }

            return true
          })
        )

      const computeCoverageIoU = (
        firstCoverage: boolean[][],
        secondCoverage: boolean[][]
      ) => {
        let firstPixels = 0
        let secondPixels = 0
        let intersection = 0

        for (let y = 0; y < firstCoverage.length; y += 1) {
          for (let x = 0; x < firstCoverage[y].length; x += 1) {
            const firstCovered = firstCoverage[y][x]
            const secondCovered = secondCoverage[y][x]
            if (firstCovered) {
              firstPixels += 1
            }
            if (secondCovered) {
              secondPixels += 1
            }
            if (firstCovered && secondCovered) {
              intersection += 1
            }
          }
        }

        const union = firstPixels + secondPixels - intersection
        return union === 0 ? 1 : intersection / union
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const renderElement =
        core?.deps?.render?.getElementById?.(targetElementId)
      if (!renderElement?.parent) {
        return {
          intersectionOverUnion: 0,
          coreIntersectionOverUnion: 0,
          overlayAdjustedIntersectionOverUnion: null,
          screenshotStrokePixels: 0,
          meshStrokePixels: 0,
          intersectionPixels: 0,
          symmetricDifferencePixels: 0,
          sampleStride: screenshotRaster.sampleStride ?? 1,
          screenshotOnlyPixels: 0,
          meshOnlyPixels: 0,
          screenshotOnlyBoundaryAdjacentRatio: 1,
          meshOnlyBoundaryAdjacentRatio: 1,
          screenshotOnlyAverageColor: null,
          meshOnlyAverageColor: null,
          screenshotOnlyAverageRedExcess: null,
          meshOnlyAverageRedExcess: null,
          meshOnlyOverlayOccludedPixels: 0,
          meshOnlyOverlayOccludedRatio: null,
          mismatchBounds: null
        }
      }

      interface LooseMeshNode {
        children?: LooseMeshNode[]
        geometry?: {
          getBuffer?: (name: string) => { data?: ArrayLike<number> } | undefined
          getIndex?: () => { data?: ArrayLike<number> } | undefined
        }
        toLocal?: (
          position: { x: number; y: number },
          from?: unknown
        ) => { x: number; y: number }
      }

      const meshes: LooseMeshNode[] = []
      const collectMeshes = (node: LooseMeshNode) => {
        if (
          typeof node.geometry?.getBuffer === 'function' &&
          typeof node.geometry?.getIndex === 'function'
        ) {
          meshes.push(node)
        }

        if (Array.isArray(node.children)) {
          node.children.forEach((child) => collectMeshes(child))
        }
      }

      const pointInTriangle = (
        point: WorkspacePoint,
        a: WorkspacePoint,
        b: WorkspacePoint,
        c: WorkspacePoint
      ) => {
        const denominator =
          (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
        if (Math.abs(denominator) <= 1e-9) {
          return false
        }

        const w1 =
          ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) /
          denominator
        const w2 =
          ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) /
          denominator
        const w3 = 1 - w1 - w2

        return w1 >= -1e-6 && w2 >= -1e-6 && w3 >= -1e-6
      }

      const response = await fetch(
        `data:image/png;base64,${screenshotRaster.imageBase64}`
      )
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) {
        return {
          intersectionOverUnion: 0,
          coreIntersectionOverUnion: 0,
          overlayAdjustedIntersectionOverUnion: null,
          screenshotStrokePixels: 0,
          meshStrokePixels: 0,
          intersectionPixels: 0,
          symmetricDifferencePixels: 0,
          sampleStride: screenshotRaster.sampleStride ?? 1,
          screenshotOnlyPixels: 0,
          meshOnlyPixels: 0,
          screenshotOnlyBoundaryAdjacentRatio: 1,
          meshOnlyBoundaryAdjacentRatio: 1,
          screenshotOnlyAverageColor: null,
          meshOnlyAverageColor: null,
          screenshotOnlyAverageRedExcess: null,
          meshOnlyAverageRedExcess: null,
          meshOnlyOverlayOccludedPixels: 0,
          meshOnlyOverlayOccludedRatio: null,
          mismatchBounds: null
        }
      }

      context.drawImage(bitmap, 0, 0)
      collectMeshes(renderElement as LooseMeshNode)

      const isStrokePixel = (r: number, g: number, b: number) =>
        r >= 70 && r - g >= 25 && r - b >= 25

      const sampleStride = Math.max(1, screenshotRaster.sampleStride ?? 1)
      let screenshotStrokePixels = 0
      let meshStrokePixels = 0
      let intersectionPixels = 0
      let symmetricDifferencePixels = 0
      let screenshotOnlyPixels = 0
      let meshOnlyPixels = 0
      let meshOnlyOverlayOccludedPixels = 0
      let mismatchBounds: BoundsAccumulator | null = null
      let screenshotOnlyColor: ColorAccumulator = {
        r: 0,
        g: 0,
        b: 0,
        a: 0,
        count: 0
      }
      let meshOnlyColor: ColorAccumulator = {
        r: 0,
        g: 0,
        b: 0,
        a: 0,
        count: 0
      }
      const screenshotCoverage: boolean[][] = []
      const meshCoverage: boolean[][] = []
      const screenshotOnlyCoverage: boolean[][] = []
      const meshOnlyCoverage: boolean[][] = []

      for (let y = 0; y < canvas.height; y += sampleStride) {
        screenshotCoverage.push([])
        meshCoverage.push([])
        screenshotOnlyCoverage.push([])
        meshOnlyCoverage.push([])
      }

      for (
        let y = 0, sampleY = 0;
        y < canvas.height;
        y += sampleStride, sampleY += 1
      ) {
        for (
          let x = 0, sampleX = 0;
          x < canvas.width;
          x += sampleStride, sampleX += 1
        ) {
          const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
          const screenshotCovered = isStrokePixel(r, g, b)

          const workspacePoint = {
            x:
              (screenshotRaster.clip.x + x - screenshotRaster.viewport.x) /
              screenshotRaster.zoom,
            y:
              (screenshotRaster.clip.y + y - screenshotRaster.viewport.y) /
              screenshotRaster.zoom
          }

          const meshCovered = meshes.some((mesh) => {
            if (typeof mesh.toLocal !== 'function') {
              return false
            }

            const localPoint = mesh.toLocal(
              workspacePoint,
              renderElement.parent
            )
            const positionData = mesh.geometry?.getBuffer?.('aPosition')?.data
            const indexData = mesh.geometry?.getIndex?.()?.data
            if (!positionData || !indexData) {
              return false
            }

            for (let index = 0; index < indexData.length; index += 3) {
              const ia = indexData[index] * 2
              const ib = indexData[index + 1] * 2
              const ic = indexData[index + 2] * 2

              if (
                pointInTriangle(
                  localPoint,
                  { x: positionData[ia], y: positionData[ia + 1] },
                  { x: positionData[ib], y: positionData[ib + 1] },
                  { x: positionData[ic], y: positionData[ic + 1] }
                )
              ) {
                return true
              }
            }

            return false
          })

          if (screenshotCovered) {
            screenshotStrokePixels += 1
          }
          if (meshCovered) {
            meshStrokePixels += 1
          }
          screenshotCoverage[sampleY][sampleX] = screenshotCovered
          meshCoverage[sampleY][sampleX] = meshCovered
          if (screenshotCovered && meshCovered) {
            intersectionPixels += 1
          }
          if (screenshotCovered !== meshCovered) {
            symmetricDifferencePixels += 1
            mismatchBounds = updateBounds(mismatchBounds, x, y)
          }
          if (screenshotCovered && !meshCovered) {
            screenshotOnlyPixels += 1
            screenshotOnlyColor = accumulateColor(
              screenshotOnlyColor,
              r,
              g,
              b,
              a
            )
            screenshotOnlyCoverage[sampleY][sampleX] = true
          } else {
            screenshotOnlyCoverage[sampleY][sampleX] = false
          }
          if (!screenshotCovered && meshCovered) {
            meshOnlyPixels += 1
            meshOnlyColor = accumulateColor(meshOnlyColor, r, g, b, a)
            if (isOverlayUiPixel(r, g, b)) {
              meshOnlyOverlayOccludedPixels += 1
            }
            meshOnlyCoverage[sampleY][sampleX] = true
          } else {
            meshOnlyCoverage[sampleY][sampleX] = false
          }
        }
      }

      const unionPixels =
        screenshotStrokePixels + meshStrokePixels - intersectionPixels
      const coreIntersectionOverUnion = computeCoverageIoU(
        erodeCoverage(screenshotCoverage),
        erodeCoverage(meshCoverage)
      )
      const overlayAdjustedUnionPixels =
        unionPixels - meshOnlyOverlayOccludedPixels
      const overlayAdjustedIntersectionOverUnion =
        overlayAdjustedUnionPixels <= 0
          ? 1
          : intersectionPixels / overlayAdjustedUnionPixels

      return {
        intersectionOverUnion:
          unionPixels === 0 ? 1 : intersectionPixels / unionPixels,
        coreIntersectionOverUnion,
        overlayAdjustedIntersectionOverUnion,
        screenshotStrokePixels,
        meshStrokePixels,
        intersectionPixels,
        symmetricDifferencePixels,
        sampleStride,
        screenshotOnlyPixels,
        meshOnlyPixels,
        screenshotOnlyBoundaryAdjacentRatio: computeBoundaryAdjacentRatio(
          screenshotOnlyCoverage,
          meshCoverage
        ),
        meshOnlyBoundaryAdjacentRatio: computeBoundaryAdjacentRatio(
          meshOnlyCoverage,
          screenshotCoverage
        ),
        screenshotOnlyAverageColor: finalizeAverageColor(screenshotOnlyColor),
        meshOnlyAverageColor: finalizeAverageColor(meshOnlyColor),
        screenshotOnlyAverageRedExcess:
          finalizeAverageRedExcess(screenshotOnlyColor),
        meshOnlyAverageRedExcess: finalizeAverageRedExcess(meshOnlyColor),
        meshOnlyOverlayOccludedPixels,
        meshOnlyOverlayOccludedRatio:
          meshOnlyPixels === 0
            ? null
            : meshOnlyOverlayOccludedPixels / meshOnlyPixels,
        mismatchBounds: finalizeBounds(mismatchBounds)
      }
    },
    {
      targetElementId: elementId,
      screenshotRaster: raster
    }
  )

const compareLocalStrokeMasks = async (
  page: Page,
  firstRaster: {
    imageBase64: string
    sampleStride?: number
  },
  secondRaster: {
    imageBase64: string
    sampleStride?: number
  }
): Promise<LocalMaskComparison> =>
  page.evaluate(
    async ({ first, second }) => {
      interface ColorAccumulator {
        r: number
        g: number
        b: number
        a: number
        count: number
      }

      const accumulateColor = (
        current: ColorAccumulator,
        r: number,
        g: number,
        b: number,
        a: number
      ): ColorAccumulator => ({
        r: current.r + r,
        g: current.g + g,
        b: current.b + b,
        a: current.a + a,
        count: current.count + 1
      })

      const finalizeAverageColor = (
        current: ColorAccumulator
      ): SampledColor | null =>
        current.count === 0
          ? null
          : {
              r: current.r / current.count,
              g: current.g / current.count,
              b: current.b / current.count,
              a: current.a / current.count
            }

      const finalizeAverageRedExcess = (current: ColorAccumulator) =>
        current.count === 0
          ? null
          : (current.r - current.g + (current.r - current.b)) /
            (2 * current.count)

      interface BoundsAccumulator {
        minX: number
        minY: number
        maxX: number
        maxY: number
      }

      const updateBounds = (
        current: BoundsAccumulator | null,
        x: number,
        y: number
      ): BoundsAccumulator =>
        current
          ? {
              minX: Math.min(current.minX, x),
              minY: Math.min(current.minY, y),
              maxX: Math.max(current.maxX, x),
              maxY: Math.max(current.maxY, y)
            }
          : {
              minX: x,
              minY: y,
              maxX: x,
              maxY: y
            }

      const finalizeBounds = (bounds: BoundsAccumulator | null) =>
        bounds
          ? {
              ...bounds,
              width: bounds.maxX - bounds.minX + 1,
              height: bounds.maxY - bounds.minY + 1
            }
          : null

      const computeBoundaryAdjacentRatio = (
        sourceCoverage: boolean[][],
        neighborCoverage: boolean[][]
      ) => {
        let sourcePixels = 0
        let boundaryAdjacentPixels = 0
        for (let y = 0; y < sourceCoverage.length; y += 1) {
          for (let x = 0; x < sourceCoverage[y].length; x += 1) {
            if (!sourceCoverage[y][x]) {
              continue
            }
            sourcePixels += 1
            let adjacent = false
            for (
              let neighborY = Math.max(0, y - 1);
              neighborY <= Math.min(sourceCoverage.length - 1, y + 1) &&
              !adjacent;
              neighborY += 1
            ) {
              for (
                let neighborX = Math.max(0, x - 1);
                neighborX <= Math.min(sourceCoverage[y].length - 1, x + 1);
                neighborX += 1
              ) {
                if (neighborCoverage[neighborY][neighborX]) {
                  adjacent = true
                  break
                }
              }
            }
            if (adjacent) {
              boundaryAdjacentPixels += 1
            }
          }
        }

        return sourcePixels === 0 ? 1 : boundaryAdjacentPixels / sourcePixels
      }

      const erodeCoverage = (coverage: boolean[][]) =>
        coverage.map((row, y) =>
          row.map((covered, x) => {
            if (!covered) {
              return false
            }

            for (
              let neighborY = Math.max(0, y - 1);
              neighborY <= Math.min(coverage.length - 1, y + 1);
              neighborY += 1
            ) {
              for (
                let neighborX = Math.max(0, x - 1);
                neighborX <= Math.min(row.length - 1, x + 1);
                neighborX += 1
              ) {
                if (!coverage[neighborY][neighborX]) {
                  return false
                }
              }
            }

            return true
          })
        )

      const computeCoverageIoU = (
        firstCoverage: boolean[][],
        secondCoverage: boolean[][]
      ) => {
        let firstPixels = 0
        let secondPixels = 0
        let intersection = 0

        for (let y = 0; y < firstCoverage.length; y += 1) {
          for (let x = 0; x < firstCoverage[y].length; x += 1) {
            const firstCovered = firstCoverage[y][x]
            const secondCovered = secondCoverage[y][x]
            if (firstCovered) {
              firstPixels += 1
            }
            if (secondCovered) {
              secondPixels += 1
            }
            if (firstCovered && secondCovered) {
              intersection += 1
            }
          }
        }

        const union = firstPixels + secondPixels - intersection
        return union === 0 ? 1 : intersection / union
      }

      const loadCanvas = async (base64: string) => {
        const response = await fetch(`data:image/png;base64,${base64}`)
        const blob = await response.blob()
        const bitmap = await createImageBitmap(blob)
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const context = canvas.getContext('2d')
        if (!context) {
          return null
        }

        context.drawImage(bitmap, 0, 0)
        return { canvas, context }
      }

      const firstCanvas = await loadCanvas(first.imageBase64)
      const secondCanvas = await loadCanvas(second.imageBase64)
      if (
        !firstCanvas ||
        !secondCanvas ||
        firstCanvas.canvas.width !== secondCanvas.canvas.width ||
        firstCanvas.canvas.height !== secondCanvas.canvas.height
      ) {
        return {
          intersectionOverUnion: 0,
          coreIntersectionOverUnion: 0,
          overlayAdjustedIntersectionOverUnion: null,
          screenshotStrokePixels: 0,
          meshStrokePixels: 0,
          intersectionPixels: 0,
          symmetricDifferencePixels: 0,
          sampleStride: Math.max(
            1,
            first.sampleStride ?? second.sampleStride ?? 1
          ),
          screenshotOnlyPixels: 0,
          meshOnlyPixels: 0,
          screenshotOnlyBoundaryAdjacentRatio: 1,
          meshOnlyBoundaryAdjacentRatio: 1,
          screenshotOnlyAverageColor: null,
          meshOnlyAverageColor: null,
          screenshotOnlyAverageRedExcess: null,
          meshOnlyAverageRedExcess: null,
          meshOnlyOverlayOccludedPixels: 0,
          meshOnlyOverlayOccludedRatio: null,
          mismatchBounds: null
        }
      }

      const sampleStride = Math.max(
        1,
        first.sampleStride ?? second.sampleStride ?? 1
      )
      const isStrokePixel = (r: number, g: number, b: number) =>
        r >= 70 && r - g >= 25 && r - b >= 25

      let firstStrokePixels = 0
      let secondStrokePixels = 0
      let intersectionPixels = 0
      let symmetricDifferencePixels = 0
      let firstOnlyPixels = 0
      let secondOnlyPixels = 0
      let mismatchBounds: BoundsAccumulator | null = null
      let firstOnlyColor: ColorAccumulator = {
        r: 0,
        g: 0,
        b: 0,
        a: 0,
        count: 0
      }
      let secondOnlyColor: ColorAccumulator = {
        r: 0,
        g: 0,
        b: 0,
        a: 0,
        count: 0
      }
      const firstCoverage: boolean[][] = []
      const secondCoverage: boolean[][] = []
      const firstOnlyCoverage: boolean[][] = []
      const secondOnlyCoverage: boolean[][] = []

      for (let y = 0; y < firstCanvas.canvas.height; y += sampleStride) {
        firstCoverage.push([])
        secondCoverage.push([])
        firstOnlyCoverage.push([])
        secondOnlyCoverage.push([])
      }

      for (
        let y = 0, sampleY = 0;
        y < firstCanvas.canvas.height;
        y += sampleStride, sampleY += 1
      ) {
        for (
          let x = 0, sampleX = 0;
          x < firstCanvas.canvas.width;
          x += sampleStride, sampleX += 1
        ) {
          const [firstR, firstG, firstB, firstA] =
            firstCanvas.context.getImageData(x, y, 1, 1).data
          const [secondR, secondG, secondB, secondA] =
            secondCanvas.context.getImageData(x, y, 1, 1).data

          const firstCovered = isStrokePixel(firstR, firstG, firstB)
          const secondCovered = isStrokePixel(secondR, secondG, secondB)

          if (firstCovered) {
            firstStrokePixels += 1
          }
          if (secondCovered) {
            secondStrokePixels += 1
          }
          firstCoverage[sampleY][sampleX] = firstCovered
          secondCoverage[sampleY][sampleX] = secondCovered
          if (firstCovered && secondCovered) {
            intersectionPixels += 1
          }
          if (firstCovered !== secondCovered) {
            symmetricDifferencePixels += 1
            mismatchBounds = updateBounds(mismatchBounds, x, y)
          }
          if (firstCovered && !secondCovered) {
            firstOnlyPixels += 1
            firstOnlyColor = accumulateColor(
              firstOnlyColor,
              firstR,
              firstG,
              firstB,
              firstA
            )
            firstOnlyCoverage[sampleY][sampleX] = true
          } else {
            firstOnlyCoverage[sampleY][sampleX] = false
          }
          if (!firstCovered && secondCovered) {
            secondOnlyPixels += 1
            secondOnlyColor = accumulateColor(
              secondOnlyColor,
              secondR,
              secondG,
              secondB,
              secondA
            )
            secondOnlyCoverage[sampleY][sampleX] = true
          } else {
            secondOnlyCoverage[sampleY][sampleX] = false
          }
        }
      }

      const unionPixels =
        firstStrokePixels + secondStrokePixels - intersectionPixels
      const coreIntersectionOverUnion = computeCoverageIoU(
        erodeCoverage(firstCoverage),
        erodeCoverage(secondCoverage)
      )

      return {
        intersectionOverUnion:
          unionPixels === 0 ? 1 : intersectionPixels / unionPixels,
        coreIntersectionOverUnion,
        overlayAdjustedIntersectionOverUnion: null,
        screenshotStrokePixels: firstStrokePixels,
        meshStrokePixels: secondStrokePixels,
        intersectionPixels,
        symmetricDifferencePixels,
        sampleStride,
        screenshotOnlyPixels: firstOnlyPixels,
        meshOnlyPixels: secondOnlyPixels,
        screenshotOnlyBoundaryAdjacentRatio: computeBoundaryAdjacentRatio(
          firstOnlyCoverage,
          secondCoverage
        ),
        meshOnlyBoundaryAdjacentRatio: computeBoundaryAdjacentRatio(
          secondOnlyCoverage,
          firstCoverage
        ),
        screenshotOnlyAverageColor: finalizeAverageColor(firstOnlyColor),
        meshOnlyAverageColor: finalizeAverageColor(secondOnlyColor),
        screenshotOnlyAverageRedExcess:
          finalizeAverageRedExcess(firstOnlyColor),
        meshOnlyAverageRedExcess: finalizeAverageRedExcess(secondOnlyColor),
        meshOnlyOverlayOccludedPixels: 0,
        meshOnlyOverlayOccludedRatio: null,
        mismatchBounds: finalizeBounds(mismatchBounds)
      }
    },
    {
      first: firstRaster,
      second: secondRaster
    }
  )

const getRenderMeshSnapshot = async (
  page: Page,
  elementId: string
): Promise<RenderMeshSnapshot | null> =>
  page.evaluate((targetElementId) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const renderElement = core?.deps?.render?.getElementById?.(targetElementId)
    if (!renderElement) {
      return null
    }

    interface LooseDisplayNode {
      constructor?: { name?: string }
      visible?: boolean
      renderable?: boolean
      children?: LooseDisplayNode[]
      geometry?: {
        getBuffer?: (name: string) => { data?: { length?: number } } | undefined
        getIndex?: () => { data?: { length?: number } } | undefined
      }
      getBounds?: () =>
        | {
            x: number
            y: number
            width: number
            height: number
          }
        | undefined
    }

    const describeNode = (node: LooseDisplayNode): RenderMeshNodeSnapshot => {
      const bounds = node.getBounds?.()
      return {
        type: node.constructor?.name ?? typeof node,
        visible: node.visible !== false,
        renderable: node.renderable !== false,
        childCount: Array.isArray(node.children) ? node.children.length : 0,
        meshVertexCount:
          typeof node.geometry?.getBuffer === 'function'
            ? (node.geometry.getBuffer('aPosition')?.data?.length ?? undefined)
            : undefined,
        meshIndexCount:
          typeof node.geometry?.getIndex === 'function'
            ? (node.geometry.getIndex()?.data?.length ?? undefined)
            : undefined,
        bounds: bounds
          ? {
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height
            }
          : undefined,
        children: Array.isArray(node.children)
          ? node.children.map((child) => describeNode(child))
          : undefined
      }
    }

    return {
      childCount: Array.isArray(renderElement.children)
        ? renderElement.children.length
        : 0,
      children: Array.isArray(renderElement.children)
        ? renderElement.children.map(describeNode)
        : []
    }
  }, elementId)

const clearElementSelectionByClick = async (page: Page) => {
  await page.keyboard.press('v')
  const blankCanvasPoint = await getCanvasPosition(page, 0.08, 0.08)
  await page.mouse.click(blankCanvasPoint.x, blankCanvasPoint.y)
  await page.waitForTimeout(150)

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        return core?.deps?.selection?.getElementSelectionIds?.()?.length ?? 0
      })
    })
    .toBe(0)
}

const clearVectorOverlayState = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    core?.setSystemProperty?.('pathEditingVectorId', null)
    core?.setSystemProperty?.('pathEditingMode', false)
    core?.setSystemProperty?.('selectedVectorPoint', null)
    core?.setSystemProperty?.('hoveredVectorPoint', null)
    core?.setSystemProperty?.('selectedVectorSegment', null)
    core?.setSystemProperty?.('hoveredVectorSegment', null)
    core?.setSystemProperty?.('hoveredVectorSegmentInsertPoint', null)
    core?.setUIProperty?.('vectorPointSelection', new Set())
    core?.setUIProperty?.('vectorSegmentSelection', new Set())
    core?.deps?.selection?.clearVectorPointSelection?.({ undoable: false })
    core?.deps?.selection?.clearVectorSegmentSelection?.({ undoable: false })
  })

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        return {
          pathEditingVectorId:
            core?.getSystemProperty?.('pathEditingVectorId') ?? null,
          pathEditingMode:
            core?.getSystemProperty?.('pathEditingMode') ?? false,
          selectedVectorPoint:
            core?.getSystemProperty?.('selectedVectorPoint') ?? null,
          hoveredVectorPoint:
            core?.getSystemProperty?.('hoveredVectorPoint') ?? null,
          selectedVectorSegment:
            core?.getSystemProperty?.('selectedVectorSegment') ?? null,
          hoveredVectorSegment:
            core?.getSystemProperty?.('hoveredVectorSegment') ?? null,
          hoveredVectorSegmentInsertPoint:
            core?.getSystemProperty?.('hoveredVectorSegmentInsertPoint') ?? null
        }
      })
    })
    .toEqual({
      pathEditingVectorId: null,
      pathEditingMode: false,
      selectedVectorPoint: null,
      hoveredVectorPoint: null,
      selectedVectorSegment: null,
      hoveredVectorSegment: null,
      hoveredVectorSegmentInsertPoint: null
    })
}

const cubicPointAt = (
  start: WorkspacePoint,
  outHandle: WorkspacePoint,
  inHandle: WorkspacePoint,
  end: WorkspacePoint,
  t: number
): WorkspacePoint => {
  const inverse = 1 - t
  const a = inverse ** 3
  const b = 3 * inverse ** 2 * t
  const c = 3 * inverse * t ** 2
  const d = t ** 3

  return {
    x: a * start.x + b * outHandle.x + c * inHandle.x + d * end.x,
    y: a * start.y + b * outHandle.y + c * inHandle.y + d * end.y
  }
}

const cubicDerivativeAt = (
  start: WorkspacePoint,
  outHandle: WorkspacePoint,
  inHandle: WorkspacePoint,
  end: WorkspacePoint,
  t: number
): WorkspacePoint => {
  const inverse = 1 - t

  return {
    x:
      3 * inverse ** 2 * (outHandle.x - start.x) +
      6 * inverse * t * (inHandle.x - outHandle.x) +
      3 * t ** 2 * (end.x - inHandle.x),
    y:
      3 * inverse ** 2 * (outHandle.y - start.y) +
      6 * inverse * t * (inHandle.y - outHandle.y) +
      3 * t ** 2 * (end.y - inHandle.y)
  }
}

const buildArcLengthTable = (
  start: WorkspacePoint,
  outHandle: WorkspacePoint,
  inHandle: WorkspacePoint,
  end: WorkspacePoint,
  steps = 512
): ArcLengthSample[] => {
  const samples: ArcLengthSample[] = [{ t: 0, point: start, distance: 0 }]
  let previous = start
  let distance = 0

  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps
    const point = cubicPointAt(start, outHandle, inHandle, end, t)
    distance += Math.hypot(point.x - previous.x, point.y - previous.y)
    samples.push({ t, point, distance })
    previous = point
  }

  return samples
}

const getPointAtDistance = (
  arcTable: ArcLengthSample[],
  targetDistance: number,
  start: WorkspacePoint,
  outHandle: WorkspacePoint,
  inHandle: WorkspacePoint,
  end: WorkspacePoint
) => {
  const clampedDistance = Math.max(
    0,
    Math.min(targetDistance, arcTable[arcTable.length - 1]?.distance ?? 0)
  )

  for (let index = 1; index < arcTable.length; index += 1) {
    const previous = arcTable[index - 1]
    const current = arcTable[index]
    if (clampedDistance > current.distance) {
      continue
    }

    const span = current.distance - previous.distance || 1
    const ratio = (clampedDistance - previous.distance) / span
    const t = previous.t + (current.t - previous.t) * ratio

    return {
      point: cubicPointAt(start, outHandle, inHandle, end, t),
      tangent: cubicDerivativeAt(start, outHandle, inHandle, end, t)
    }
  }

  return {
    point: end,
    tangent: cubicDerivativeAt(start, outHandle, inHandle, end, 1)
  }
}

const normalizeVector = (vector: WorkspacePoint) => {
  const magnitude = Math.hypot(vector.x, vector.y) || 1
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude
  }
}

const pointToLineSegmentDistance = (
  point: WorkspacePoint,
  start: WorkspacePoint,
  end: WorkspacePoint
) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-9) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )

  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t))
}

const pointToPathSegmentDistance = (
  point: WorkspacePoint,
  segment: PathSegmentRecord
) => {
  if (segment.kind === 'line') {
    return pointToLineSegmentDistance(point, segment.start, segment.end)
  }

  const arcTable = segment.arcTable ?? []
  let best = Number.POSITIVE_INFINITY
  for (let index = 1; index < arcTable.length; index += 1) {
    best = Math.min(
      best,
      pointToLineSegmentDistance(
        point,
        arcTable[index - 1].point,
        arcTable[index].point
      )
    )
  }

  return best
}

const getNearestOtherSegmentDistance = (
  point: WorkspacePoint,
  segments: PathSegmentRecord[],
  ownerSegmentIndex: number
) => {
  let best = Number.POSITIVE_INFINITY

  segments.forEach((segment) => {
    if (segment.index === ownerSegmentIndex) {
      return
    }

    best = Math.min(best, pointToPathSegmentDistance(point, segment))
  })

  return best
}

const getSignedArea = (points: { x: number | null; y: number | null }[]) => {
  if (points.length < 3) {
    return 0
  }

  let total = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    total += (current.x ?? 0) * (next.y ?? 0) - (next.x ?? 0) * (current.y ?? 0)
  }

  return total / 2
}

const getInwardNormal = (
  tangent: WorkspacePoint,
  orderedPoints: { x: number | null; y: number | null }[]
): WorkspacePoint => {
  const orientation = getSignedArea(orderedPoints)
  const unit = normalizeVector(tangent)

  return orientation >= 0
    ? { x: -unit.y, y: unit.x }
    : { x: unit.y, y: -unit.x }
}

const captureSelectedVectorRaster = async (
  page: Page,
  snapshot: SelectedVectorSnapshot,
  padding = 36
): Promise<VectorRaster> => {
  const viewportSize = page.viewportSize()
  if (
    snapshot.x === null ||
    snapshot.y === null ||
    snapshot.width === null ||
    snapshot.height === null ||
    !viewportSize
  ) {
    throw new Error('Selected vector snapshot unavailable for raster capture')
  }

  const clip = {
    x: Math.max(
      0,
      Math.floor(snapshot.x * snapshot.zoom + snapshot.viewport.x - padding)
    ),
    y: Math.max(
      0,
      Math.floor(snapshot.y * snapshot.zoom + snapshot.viewport.y - padding)
    ),
    width: Math.max(
      1,
      Math.min(
        viewportSize.width,
        Math.ceil(snapshot.width * snapshot.zoom + padding * 2)
      )
    ),
    height: Math.max(
      1,
      Math.min(
        viewportSize.height,
        Math.ceil(snapshot.height * snapshot.zoom + padding * 2)
      )
    )
  }

  const imageBuffer = await page.screenshot({ clip })

  return {
    snapshot,
    imageBase64: imageBuffer.toString('base64'),
    clip
  }
}

const cropRasterAroundWorkspacePoint = async (
  page: Page,
  raster: VectorRaster,
  workspacePoint: WorkspacePoint,
  clipSize: number
): Promise<VectorRaster> => {
  const cropped = await page.evaluate(
    async ({
      base64,
      clip,
      zoom,
      viewport,
      point,
      targetSize
    }: {
      base64: string
      clip: VectorRaster['clip']
      zoom: number
      viewport: WorkspacePoint
      point: WorkspacePoint
      targetSize: number
    }) => {
      const response = await fetch(`data:image/png;base64,${base64}`)
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      const sourceCanvas = document.createElement('canvas')
      sourceCanvas.width = bitmap.width
      sourceCanvas.height = bitmap.height
      const sourceContext = sourceCanvas.getContext('2d')
      if (!sourceContext) {
        throw new Error('Unable to create source raster context')
      }

      sourceContext.drawImage(bitmap, 0, 0)

      const rasterScaleX = sourceCanvas.width / Math.max(1, clip.width)
      const rasterScaleY = sourceCanvas.height / Math.max(1, clip.height)
      const centerX = (point.x * zoom + viewport.x - clip.x) * rasterScaleX
      const centerY = (point.y * zoom + viewport.y - clip.y) * rasterScaleY
      const cropWidth = Math.max(1, Math.min(sourceCanvas.width, targetSize))
      const cropHeight = Math.max(1, Math.min(sourceCanvas.height, targetSize))
      const sourceX = Math.max(
        0,
        Math.min(
          Math.round(centerX - cropWidth / 2),
          Math.max(0, sourceCanvas.width - cropWidth)
        )
      )
      const sourceY = Math.max(
        0,
        Math.min(
          Math.round(centerY - cropHeight / 2),
          Math.max(0, sourceCanvas.height - cropHeight)
        )
      )

      const targetCanvas = document.createElement('canvas')
      targetCanvas.width = cropWidth
      targetCanvas.height = cropHeight
      const targetContext = targetCanvas.getContext('2d')
      if (!targetContext) {
        throw new Error('Unable to create target raster context')
      }

      targetContext.drawImage(
        sourceCanvas,
        sourceX,
        sourceY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      )

      return {
        imageBase64: targetCanvas.toDataURL('image/png').split(',')[1] ?? '',
        clip: {
          x: clip.x + sourceX / rasterScaleX,
          y: clip.y + sourceY / rasterScaleY,
          width: cropWidth / rasterScaleX,
          height: cropHeight / rasterScaleY
        }
      }
    },
    {
      base64: raster.imageBase64,
      clip: raster.clip,
      zoom: raster.snapshot.zoom,
      viewport: raster.snapshot.viewport,
      point: workspacePoint,
      targetSize: HIGH_CURVATURE_TURN_SELECTED_LOCAL_CLIP_SIZE
    }
  )

  return {
    snapshot: raster.snapshot,
    imageBase64: cropped.imageBase64,
    clip: cropped.clip
  }
}

const sampleRasterAtWorkspacePoints = async (
  page: Page,
  raster: VectorRaster,
  points: WorkspacePoint[],
  radius = 4
): Promise<RasterProbeResult[]> =>
  page.evaluate(
    async ({
      base64,
      clip,
      zoom,
      viewport,
      workspacePoints,
      probeRadius
    }: {
      base64: string
      clip: VectorRaster['clip']
      zoom: number
      viewport: WorkspacePoint
      workspacePoints: WorkspacePoint[]
      probeRadius: number
    }) => {
      const response = await fetch(`data:image/png;base64,${base64}`)
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) {
        return []
      }

      context.drawImage(bitmap, 0, 0)

      const isStrokePixel = (color: SampledColor) =>
        color.r >= 70 && color.r - color.g >= 25 && color.r - color.b >= 25
      const rasterScaleX = canvas.width / Math.max(1, clip.width)
      const rasterScaleY = canvas.height / Math.max(1, clip.height)

      return workspacePoints.map((point) => {
        const centerX = (point.x * zoom + viewport.x - clip.x) * rasterScaleX
        const centerY = (point.y * zoom + viewport.y - clip.y) * rasterScaleY
        let redPixels = 0
        let totalPixels = 0
        let strongestColor: SampledColor = { r: 255, g: 255, b: 255, a: 255 }
        let strongestScore = Number.NEGATIVE_INFINITY

        for (let offsetY = -probeRadius; offsetY <= probeRadius; offsetY += 1) {
          for (
            let offsetX = -probeRadius;
            offsetX <= probeRadius;
            offsetX += 1
          ) {
            if (offsetX ** 2 + offsetY ** 2 > probeRadius ** 2) {
              continue
            }

            const sampleX = Math.round(centerX + offsetX)
            const sampleY = Math.round(centerY + offsetY)
            if (
              sampleX < 0 ||
              sampleY < 0 ||
              sampleX >= canvas.width ||
              sampleY >= canvas.height
            ) {
              continue
            }

            const [r, g, b, a] = context.getImageData(
              sampleX,
              sampleY,
              1,
              1
            ).data
            const color = { r, g, b, a }
            const score = r - Math.max(g, b)

            if (score > strongestScore) {
              strongestScore = score
              strongestColor = color
            }

            totalPixels += 1
            if (isStrokePixel(color)) {
              redPixels += 1
            }
          }
        }

        const redPixelRatio = totalPixels === 0 ? 0 : redPixels / totalPixels

        return {
          color: strongestColor,
          covered: redPixels >= Math.max(3, Math.ceil(totalPixels * 0.12)),
          redPixelRatio
        }
      })
    },
    {
      base64: raster.imageBase64,
      clip: raster.clip,
      zoom: raster.snapshot.zoom,
      viewport: raster.snapshot.viewport,
      workspacePoints: points,
      probeRadius: radius
    }
  )

const sampleRasterCrossSectionRatios = async (
  page: Page,
  raster: VectorRaster,
  samples: {
    sourcePoint: WorkspacePoint
    inwardNormal: WorkspacePoint
  }[],
  strokeWidth: number
): Promise<number[]> =>
  page.evaluate(
    async ({
      base64,
      clip,
      zoom,
      viewport,
      crossSectionSamples,
      sampleWidth
    }: {
      base64: string
      clip: VectorRaster['clip']
      zoom: number
      viewport: WorkspacePoint
      crossSectionSamples: {
        sourcePoint: WorkspacePoint
        inwardNormal: WorkspacePoint
      }[]
      sampleWidth: number
    }) => {
      const response = await fetch(`data:image/png;base64,${base64}`)
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) {
        return []
      }

      context.drawImage(bitmap, 0, 0)

      const isStrokePixel = (r: number, g: number, b: number) =>
        r >= 70 && r - g >= 25 && r - b >= 25
      const rasterScaleX = canvas.width / Math.max(1, clip.width)
      const rasterScaleY = canvas.height / Math.max(1, clip.height)

      const probePointCovered = (x: number, y: number) => {
        let coveredPixels = 0
        let totalPixels = 0

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const sampleX = Math.round(x + offsetX)
            const sampleY = Math.round(y + offsetY)
            if (
              sampleX < 0 ||
              sampleY < 0 ||
              sampleX >= canvas.width ||
              sampleY >= canvas.height
            ) {
              continue
            }

            const [r, g, b] = context.getImageData(sampleX, sampleY, 1, 1).data
            totalPixels += 1
            if (isStrokePixel(r, g, b)) {
              coveredPixels += 1
            }
          }
        }

        return coveredPixels >= Math.max(3, Math.ceil(totalPixels * 0.2))
      }

      return crossSectionSamples.map(({ sourcePoint, inwardNormal }) => {
        const sampleCount = Math.max(2, Math.round(sampleWidth))
        let coveredSteps = 0

        for (let step = 1; step <= sampleCount; step += 1) {
          const distance = (step / sampleCount) * sampleWidth
          const sampleX =
            ((sourcePoint.x + inwardNormal.x * distance) * zoom +
              viewport.x -
              clip.x) *
            rasterScaleX
          const sampleY =
            ((sourcePoint.y + inwardNormal.y * distance) * zoom +
              viewport.y -
              clip.y) *
            rasterScaleY

          if (probePointCovered(sampleX, sampleY)) {
            coveredSteps += 1
          }
        }

        return coveredSteps / sampleCount
      })
    },
    {
      base64: raster.imageBase64,
      clip: raster.clip,
      zoom: raster.snapshot.zoom,
      viewport: raster.snapshot.viewport,
      crossSectionSamples: samples,
      sampleWidth: strokeWidth
    }
  )

const measureDashBodyLengths = (
  probes: PathProbeSample[],
  crossSectionRatios: number[],
  bodyThreshold = 0.82
): DashBodyLengthMeasurement[] => {
  const measurements: DashBodyLengthMeasurement[] = []
  let dashIndex = 0
  let currentStartIndex: number | null = null

  const flush = (endIndexExclusive: number) => {
    if (currentStartIndex === null) {
      return
    }

    const startProbe = probes[currentStartIndex]
    const endProbe = probes[endIndexExclusive - 1]
    if (!startProbe || !endProbe) {
      currentStartIndex = null
      return
    }

    measurements.push({
      dashIndex,
      startDistance: startProbe.distance,
      endDistance: endProbe.distance + PROBE_STEP,
      bodyStartDistance: startProbe.distance,
      bodyEndDistance: endProbe.distance + PROBE_STEP,
      bodyLength: endProbe.distance + PROBE_STEP - startProbe.distance,
      sampleCount: endIndexExclusive - currentStartIndex
    })
    dashIndex += 1
    currentStartIndex = null
  }

  probes.forEach((probe, index) => {
    const bodyCovered =
      probe.expectedCovered === true &&
      (crossSectionRatios[index] ?? 0) >= bodyThreshold

    if (bodyCovered && currentStartIndex === null) {
      currentStartIndex = index
      return
    }

    if (!bodyCovered && currentStartIndex !== null) {
      flush(index)
    }
  })

  flush(probes.length)

  return measurements
}

const measureCapExcludedDashBodyLengths = (
  probes: PathProbeSample[],
  crossSectionRatios: number[],
  minPeakRatio = 0.8,
  relativePlateauRatio = 0.92
): DashBodyLengthMeasurement[] => {
  const measurements: DashBodyLengthMeasurement[] = []
  let dashIndex = 0
  let currentDashStart: number | null = null

  const flushDash = (endIndexExclusive: number) => {
    if (currentDashStart === null) {
      return
    }

    const dashStart = currentDashStart
    const dashEnd = endIndexExclusive
    currentDashStart = null

    const dashRatios = crossSectionRatios
      .slice(dashStart, dashEnd)
      .map((ratio) => ratio ?? 0)
    if (dashRatios.length === 0) {
      return
    }

    const peakRatio = Math.max(...dashRatios)
    if (peakRatio < minPeakRatio) {
      dashIndex += 1
      return
    }

    const plateauThreshold = peakRatio * relativePlateauRatio
    const peakOffset = dashRatios.findIndex((ratio) => ratio === peakRatio)
    if (peakOffset < 0) {
      dashIndex += 1
      return
    }

    let plateauStartOffset = peakOffset
    while (
      plateauStartOffset > 0 &&
      dashRatios[plateauStartOffset - 1] >= plateauThreshold
    ) {
      plateauStartOffset -= 1
    }

    let plateauEndOffset = peakOffset
    while (
      plateauEndOffset < dashRatios.length - 1 &&
      dashRatios[plateauEndOffset + 1] >= plateauThreshold
    ) {
      plateauEndOffset += 1
    }

    const plateauStartIndex = dashStart + plateauStartOffset
    const plateauEndIndex = dashStart + plateauEndOffset
    const startProbe = probes[plateauStartIndex]
    const endProbe = probes[plateauEndIndex]
    if (!startProbe || !endProbe) {
      dashIndex += 1
      return
    }

    measurements.push({
      dashIndex,
      startDistance: probes[dashStart]?.distance ?? startProbe.distance,
      endDistance:
        (probes[dashEnd - 1]?.distance ?? endProbe.distance) + PROBE_STEP,
      bodyStartDistance: startProbe.distance,
      bodyEndDistance: endProbe.distance + PROBE_STEP,
      bodyLength: endProbe.distance + PROBE_STEP - startProbe.distance,
      sampleCount: plateauEndIndex - plateauStartIndex + 1
    })
    dashIndex += 1
  }

  probes.forEach((probe, index) => {
    const dashCovered = probe.expectedCovered === true
    if (dashCovered && currentDashStart === null) {
      currentDashStart = index
      return
    }

    if (!dashCovered && currentDashStart !== null) {
      flushDash(index)
    }
  })

  flushDash(probes.length)

  return measurements
}

const measureExpectedCapExcludedDashBodyLengths = (
  probes: PathProbeSample[],
  crossSectionRatios: number[],
  dashLength: number,
  strokeWidth: number,
  bodyThreshold = 0.6
): ExpectedDashBodyLengthMeasurement[] => {
  const measurements: ExpectedDashBodyLengthMeasurement[] = []
  let dashIndex = 0
  let currentDashStart: number | null = null

  const flushDash = (endIndexExclusive: number) => {
    if (currentDashStart === null) {
      return
    }

    const dashStart = currentDashStart
    const dashEnd = endIndexExclusive
    currentDashStart = null

    const startProbe = probes[dashStart]
    const endProbe = probes[dashEnd - 1]
    if (!startProbe || !endProbe) {
      dashIndex += 1
      return
    }

    const intervalStartDistance = startProbe.distance
    const intervalEndDistance = endProbe.distance + PROBE_STEP
    const intervalLength = intervalEndDistance - intervalStartDistance
    if (Math.abs(intervalLength - dashLength) > PROBE_STEP + 1e-6) {
      dashIndex += 1
      return
    }

    const expectedBodyStartDistance = intervalStartDistance + strokeWidth / 2
    const expectedBodyEndDistance = intervalEndDistance - strokeWidth / 2
    const expectedBodyLength =
      expectedBodyEndDistance - expectedBodyStartDistance
    if (expectedBodyLength <= 0) {
      dashIndex += 1
      return
    }

    const bodyIndices = probes
      .map((probe, index) => ({ probe, index }))
      .filter(
        ({ probe }) =>
          probe.distance >= expectedBodyStartDistance - 1e-6 &&
          probe.distance < expectedBodyEndDistance - 1e-6
      )
      .map(({ index }) => index)

    if (bodyIndices.length === 0) {
      measurements.push({
        dashIndex,
        startDistance: intervalStartDistance,
        endDistance: intervalEndDistance,
        bodyStartDistance: expectedBodyStartDistance,
        bodyEndDistance: expectedBodyStartDistance,
        bodyLength: 0,
        sampleCount: 0,
        expectedBodyStartDistance,
        expectedBodyEndDistance,
        expectedBodyLength,
        coveredRatio: 0
      })
      dashIndex += 1
      return
    }

    let longestRunStartIndex: number | null = null
    let longestRunEndIndexExclusive: number | null = null
    let currentRunStartIndex: number | null = null
    let coveredSampleCount = 0

    const finalizeRun = (runEndIndexExclusive: number) => {
      if (currentRunStartIndex === null) {
        return
      }

      const currentRunEndProbe = probes[runEndIndexExclusive - 1]
      const currentRunStartProbe = probes[currentRunStartIndex]
      if (!currentRunEndProbe || !currentRunStartProbe) {
        currentRunStartIndex = null
        return
      }

      const currentLength =
        currentRunEndProbe.distance + PROBE_STEP - currentRunStartProbe.distance
      const longestLength =
        longestRunStartIndex === null || longestRunEndIndexExclusive === null
          ? -1
          : (() => {
              const longestRunEndProbe = probes[longestRunEndIndexExclusive - 1]
              const longestRunStartProbe = probes[longestRunStartIndex]
              if (!longestRunEndProbe || !longestRunStartProbe) {
                return -1
              }

              return (
                longestRunEndProbe.distance +
                PROBE_STEP -
                longestRunStartProbe.distance
              )
            })()

      if (currentLength > longestLength) {
        longestRunStartIndex = currentRunStartIndex
        longestRunEndIndexExclusive = runEndIndexExclusive
      }

      currentRunStartIndex = null
    }

    bodyIndices.forEach((probeIndex, bodyIndexOffset) => {
      const covered = (crossSectionRatios[probeIndex] ?? 0) >= bodyThreshold
      if (covered) {
        coveredSampleCount += 1
        if (currentRunStartIndex === null) {
          currentRunStartIndex = probeIndex
        }
      }

      const nextProbeIndex =
        bodyIndexOffset < bodyIndices.length - 1
          ? bodyIndices[bodyIndexOffset + 1]
          : null

      if (
        currentRunStartIndex !== null &&
        (!covered ||
          nextProbeIndex === null ||
          nextProbeIndex !== probeIndex + 1)
      ) {
        finalizeRun(covered ? probeIndex + 1 : probeIndex)
      }
    })

    if (longestRunStartIndex === null || longestRunEndIndexExclusive === null) {
      longestRunStartIndex = bodyIndices[0] ?? dashStart
      longestRunEndIndexExclusive = longestRunStartIndex
    }

    const runStartProbe =
      longestRunEndIndexExclusive > longestRunStartIndex
        ? probes[longestRunStartIndex]
        : null
    const runEndProbe =
      longestRunEndIndexExclusive > longestRunStartIndex
        ? probes[longestRunEndIndexExclusive - 1]
        : null

    measurements.push({
      dashIndex,
      startDistance: intervalStartDistance,
      endDistance: intervalEndDistance,
      bodyStartDistance: runStartProbe?.distance ?? expectedBodyStartDistance,
      bodyEndDistance:
        runEndProbe !== null
          ? runEndProbe.distance + PROBE_STEP
          : expectedBodyStartDistance,
      bodyLength:
        runStartProbe !== null && runEndProbe !== null
          ? runEndProbe.distance + PROBE_STEP - runStartProbe.distance
          : 0,
      sampleCount:
        longestRunEndIndexExclusive > longestRunStartIndex
          ? longestRunEndIndexExclusive - longestRunStartIndex
          : 0,
      expectedBodyStartDistance,
      expectedBodyEndDistance,
      expectedBodyLength,
      coveredRatio: coveredSampleCount / bodyIndices.length
    })
    dashIndex += 1
  }

  probes.forEach((probe, index) => {
    const dashCovered = probe.expectedCovered === true
    if (dashCovered && currentDashStart === null) {
      currentDashStart = index
      return
    }

    if (!dashCovered && currentDashStart !== null) {
      flushDash(index)
    }
  })

  flushDash(probes.length)

  return measurements
}

const normalizeCoverage = (coverage: boolean[]) => {
  if (coverage.length < 3) {
    return coverage
  }

  const normalized = [...coverage]

  for (let index = 1; index < normalized.length - 1; index += 1) {
    if (!normalized[index] && normalized[index - 1] && normalized[index + 1]) {
      normalized[index] = true
    }

    if (normalized[index] && !normalized[index - 1] && !normalized[index + 1]) {
      normalized[index] = false
    }
  }

  return normalized
}

const buildBenchmarkReport = (metrics: BenchmarkMetric[]) => {
  const summary = metrics.every((metric) => metric.passed) ? 'PASS' : 'FAIL'
  const lines = [`Benchmark Summary: ${summary}`, '']

  for (const metric of metrics) {
    lines.push(
      `${metric.passed ? 'PASS' : 'FAIL'} ${metric.label}: actual=${metric.actual} expected=${metric.expected}`
    )
  }

  return lines.join('\n')
}

const getNormalizedSnapshotPathPoints = (
  snapshot: SelectedVectorSnapshot
): VectorPointSnapshot[] => {
  const xs = snapshot.points
    .map((point) => point.x)
    .filter((value): value is number => typeof value === 'number')
  const ys = snapshot.points
    .map((point) => point.y)
    .filter((value): value is number => typeof value === 'number')

  if (
    xs.length === 0 ||
    ys.length === 0 ||
    snapshot.x === null ||
    snapshot.y === null
  ) {
    return snapshot.points
  }

  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const offsetX = snapshot.x - minX
  const offsetY = snapshot.y - minY

  return snapshot.points.map((point) => ({
    ...point,
    x: point.x === null ? null : point.x + offsetX,
    y: point.y === null ? null : point.y + offsetY,
    inHandle: point.inHandle
      ? {
          x: point.inHandle.x + offsetX,
          y: point.inHandle.y + offsetY
        }
      : null,
    outHandle: point.outHandle
      ? {
          x: point.outHandle.x + offsetX,
          y: point.outHandle.y + offsetY
        }
      : null
  }))
}

const buildPathSegments = (
  snapshot: SelectedVectorSnapshot
): { segments: PathSegmentRecord[]; totalLength: number } => {
  if (snapshot.points.length < 2) {
    return { segments: [], totalLength: 0 }
  }

  const orderedPoints = getNormalizedSnapshotPathPoints(snapshot)
  const lastSegmentIndex = snapshot.closed
    ? orderedPoints.length
    : orderedPoints.length - 1

  const segments: PathSegmentRecord[] = []
  let cursor = 0

  for (let index = 0; index < lastSegmentIndex; index += 1) {
    const startPoint = orderedPoints[index]
    const endPoint = orderedPoints[(index + 1) % orderedPoints.length]
    if (
      startPoint?.x === null ||
      startPoint?.x === undefined ||
      startPoint?.y === null ||
      startPoint?.y === undefined ||
      endPoint?.x === null ||
      endPoint?.x === undefined ||
      endPoint?.y === null ||
      endPoint?.y === undefined
    ) {
      continue
    }

    const start = { x: startPoint.x, y: startPoint.y }
    const end = { x: endPoint.x, y: endPoint.y }
    const outHandle = startPoint.outHandle
      ? { x: startPoint.outHandle.x, y: startPoint.outHandle.y }
      : undefined
    const inHandle = endPoint.inHandle
      ? { x: endPoint.inHandle.x, y: endPoint.inHandle.y }
      : undefined
    const isCubic = Boolean(outHandle || inHandle)

    if (isCubic) {
      const curveOutHandle = outHandle ?? start
      const curveInHandle = inHandle ?? end
      const arcTable = buildArcLengthTable(
        start,
        curveOutHandle,
        curveInHandle,
        end
      )
      const length = arcTable[arcTable.length - 1]?.distance ?? 0
      segments.push({
        index,
        kind: 'cubic',
        start,
        end,
        outHandle: curveOutHandle,
        inHandle: curveInHandle,
        startDistance: cursor,
        endDistance: cursor + length,
        length,
        arcTable
      })
      cursor += length
      continue
    }

    const length = Math.hypot(end.x - start.x, end.y - start.y)
    segments.push({
      index,
      kind: 'line',
      start,
      end,
      startDistance: cursor,
      endDistance: cursor + length,
      length
    })
    cursor += length
  }

  return {
    segments,
    totalLength: cursor
  }
}

const getPathSampleAtDistance = (
  segments: PathSegmentRecord[],
  targetDistance: number
) => {
  const segment =
    segments.find(
      (candidate) =>
        targetDistance >= candidate.startDistance &&
        targetDistance < candidate.endDistance
    ) ?? segments[segments.length - 1]

  if (!segment) {
    throw new Error('No path segment available for sampling')
  }

  const localDistance = Math.max(
    0,
    Math.min(targetDistance - segment.startDistance, segment.length)
  )

  if (segment.kind === 'cubic') {
    const sample = getPointAtDistance(
      segment.arcTable ?? [],
      localDistance,
      segment.start,
      segment.outHandle ?? segment.start,
      segment.inHandle ?? segment.end,
      segment.end
    )

    return {
      segmentIndex: segment.index,
      point: sample.point,
      tangent: sample.tangent
    }
  }

  const ratio = segment.length <= 0 ? 0 : localDistance / segment.length
  return {
    segmentIndex: segment.index,
    point: {
      x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
      y: segment.start.y + (segment.end.y - segment.start.y) * ratio
    },
    tangent: {
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    }
  }
}

const classifyDashExpectation = (
  distanceAlongPath: number,
  segment: PathSegmentRecord,
  dash: number,
  gap: number,
  strokeWidth: number
) => {
  const phase = distanceAlongPath % (dash + gap)
  const distanceToDashStart = Math.min(phase, dash + gap - phase)
  const distanceToDashEnd = Math.abs(phase - dash)
  const distanceToSegmentBoundary = Math.min(
    distanceAlongPath - segment.startDistance,
    segment.endDistance - distanceAlongPath
  )
  const dashTransitionMargin = Math.max(
    TRANSITION_MARGIN,
    strokeWidth / 2 + PROBE_STEP / 2
  )

  if (
    distanceToDashStart <= dashTransitionMargin ||
    distanceToDashEnd <= dashTransitionMargin ||
    distanceToSegmentBoundary <= CORNER_MARGIN
  ) {
    return null
  }

  return phase < dash
}

const buildPathProbeSamples = (
  snapshot: SelectedVectorSnapshot,
  dashLength: number,
  gapLength: number
) => {
  const { segments, totalLength } = buildPathSegments(snapshot)
  const probes: PathProbeSample[] = []
  const normalizedPoints = getNormalizedSnapshotPathPoints(snapshot)
  const strokeWidth = snapshot.stroke?.width ?? PROBE_OFFSET * 2
  const isolationClearance = strokeWidth + 0.5

  for (
    let distanceAlongPath = 0;
    distanceAlongPath < totalLength;
    distanceAlongPath += PROBE_STEP
  ) {
    const sample = getPathSampleAtDistance(segments, distanceAlongPath)
    const segment = segments[sample.segmentIndex]
    const expectedCovered = classifyDashExpectation(
      distanceAlongPath,
      segment,
      dashLength,
      gapLength,
      strokeWidth
    )
    const inwardNormal = getInwardNormal(sample.tangent, normalizedPoints)
    const insidePoint = {
      x: sample.point.x + inwardNormal.x * PROBE_OFFSET,
      y: sample.point.y + inwardNormal.y * PROBE_OFFSET
    }
    const outsidePoint = {
      x: sample.point.x - inwardNormal.x * PROBE_OFFSET,
      y: sample.point.y - inwardNormal.y * PROBE_OFFSET
    }
    const isolatedExpectation =
      expectedCovered !== null &&
      Math.min(
        getNearestOtherSegmentDistance(
          insidePoint,
          segments,
          sample.segmentIndex
        ),
        getNearestOtherSegmentDistance(
          outsidePoint,
          segments,
          sample.segmentIndex
        )
      ) <= isolationClearance
        ? null
        : expectedCovered

    probes.push({
      distance: distanceAlongPath,
      segmentIndex: sample.segmentIndex,
      expectedCovered: isolatedExpectation,
      sourcePoint: sample.point,
      inwardNormal,
      insidePoint,
      outsidePoint
    })
  }

  return {
    probes,
    totalLength,
    segmentCount: segments.length,
    segments
  }
}

const buildChosenSideIsolationMask = (
  probes: PathProbeSample[],
  selectedCrossSectionSide: ('forward' | 'reverse')[],
  segments: PathSegmentRecord[],
  strokeWidth: number
) => {
  const sampleCount = Math.max(4, Math.round(strokeWidth))
  const contaminationThreshold = strokeWidth / 2 + 0.5

  return probes.map((probe, index) => {
    const side = selectedCrossSectionSide[index] ?? 'forward'
    const normal =
      side === 'forward'
        ? probe.inwardNormal
        : {
            x: -probe.inwardNormal.x,
            y: -probe.inwardNormal.y
          }

    for (let step = 1; step <= sampleCount; step += 1) {
      const distance = (step / sampleCount) * strokeWidth
      const samplePoint = {
        x: probe.sourcePoint.x + normal.x * distance,
        y: probe.sourcePoint.y + normal.y * distance
      }

      if (
        getNearestOtherSegmentDistance(
          samplePoint,
          segments,
          probe.segmentIndex
        ) <= contaminationThreshold
      ) {
        return false
      }
    }

    return true
  })
}

const alignProbeSamplesToMesh = async (
  page: Page,
  elementId: string | null,
  probes: PathProbeSample[]
) => {
  if (!elementId || probes.length === 0) {
    return {
      probes,
      meshInsideHits: 0,
      meshOutsideHits: 0,
      flipped: false
    }
  }

  const [insideSamples, outsideSamples] = await Promise.all([
    sampleRenderMeshAtWorkspacePoints(
      page,
      elementId,
      probes.map((probe) => probe.insidePoint),
      2
    ),
    sampleRenderMeshAtWorkspacePoints(
      page,
      elementId,
      probes.map((probe) => probe.outsidePoint),
      2
    )
  ])

  const meshInsideHits = insideSamples.filter((sample) => sample.covered).length
  const meshOutsideHits = outsideSamples.filter(
    (sample) => sample.covered
  ).length

  if (meshOutsideHits <= meshInsideHits) {
    return {
      probes,
      meshInsideHits,
      meshOutsideHits,
      flipped: false
    }
  }

  return {
    probes: probes.map((probe) => ({
      ...probe,
      inwardNormal: {
        x: -probe.inwardNormal.x,
        y: -probe.inwardNormal.y
      },
      insidePoint: probe.outsidePoint,
      outsidePoint: probe.insidePoint
    })),
    meshInsideHits: meshOutsideHits,
    meshOutsideHits: meshInsideHits,
    flipped: true
  }
}

const ratio = (numerator: number, denominator: number) =>
  denominator <= 0 ? 1 : numerator / denominator

const formatRatio = (value: number) => value.toFixed(3)

const pointDistance = (
  a: { x: number | null; y: number | null } | null | undefined,
  b: { x: number | null; y: number | null } | null | undefined
) => {
  if (
    a?.x === null ||
    a?.x === undefined ||
    a?.y === null ||
    a?.y === undefined ||
    b?.x === null ||
    b?.x === undefined ||
    b?.y === null ||
    b?.y === undefined
  ) {
    return null
  }

  return Math.hypot(a.x - b.x, a.y - b.y)
}

const buildReferencePointDeltas = (snapshot: SelectedVectorSnapshot) => {
  const pointDeltas: ReferencePointDelta[] = snapshot.points.map(
    (point, index) => ({
      index,
      anchorDelta: pointDistance(point, REFERENCE_POINTS[index]) ?? Number.NaN,
      inHandleDelta: pointDistance(
        point.inHandle,
        REFERENCE_POINTS[index].inHandle
      ),
      outHandleDelta: pointDistance(
        point.outHandle,
        REFERENCE_POINTS[index].outHandle
      )
    })
  )

  const finiteAnchorDeltas = pointDeltas
    .map((point) => point.anchorDelta)
    .filter(Number.isFinite)
  const finiteHandleDeltas = pointDeltas
    .flatMap((point) => [point.inHandleDelta, point.outHandleDelta])
    .filter(
      (value): value is number => value !== null && Number.isFinite(value)
    )

  return {
    pointDeltas,
    maxAnchorDelta:
      finiteAnchorDeltas.length > 0 ? Math.max(...finiteAnchorDeltas) : null,
    maxHandleDelta:
      finiteHandleDeltas.length > 0 ? Math.max(...finiteHandleDeltas) : null
  }
}

const getHighCurvatureTurnProbeTarget = (
  snapshot: SelectedVectorSnapshot,
  dashLength: number,
  gapLength: number
): HighCurvatureTurnProbeTarget | null => {
  const normalizedPoints = getNormalizedSnapshotPathPoints(snapshot)
  const referenceAnchor = normalizedPoints[4]
  if (referenceAnchor?.x == null || referenceAnchor?.y == null) {
    return null
  }

  const anchorWorkspacePoint = {
    x: referenceAnchor.x,
    y: referenceAnchor.y
  }
  const { probes } = buildPathProbeSamples(snapshot, dashLength, gapLength)
  const bestCandidate = probes
    .filter((probe) => probe.expectedCovered === true)
    .map((probe) => ({
      probe,
      distanceToAnchor: Math.hypot(
        probe.sourcePoint.x - anchorWorkspacePoint.x,
        probe.sourcePoint.y - anchorWorkspacePoint.y
      )
    }))
    .sort((left, right) => left.distanceToAnchor - right.distanceToAnchor)[0]

  if (!bestCandidate) {
    return null
  }

  return {
    anchorWorkspacePoint,
    sourcePoint: bestCandidate.probe.sourcePoint,
    insidePoint: bestCandidate.probe.insidePoint,
    segmentIndex: bestCandidate.probe.segmentIndex,
    distanceToAnchor: bestCandidate.distanceToAnchor
  }
}

const _materializeReferenceVectorGeometry = async (
  page: Page,
  vectorId: string
) => {
  await page.evaluate(
    ({ elementId, referencePoints }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const element = core?.deps?.sceneTree?.getElementById?.(elementId)
      const computed = element?.getAllComputedData?.()
      const primaryNetwork = Object.values(computed?.networks ?? {})[0] as
        | {
            id: string
            pointIds?: string[]
            segmentIds?: string[]
          }
        | undefined

      if (!computed || !primaryNetwork) {
        throw new Error('Missing vector topology for geometry patch')
      }

      const existingPointIds = [...(primaryNetwork.pointIds ?? [])]
      const firstPointId =
        existingPointIds[0] ?? Object.keys(computed.points ?? {})[0] ?? null

      if (!firstPointId) {
        throw new Error('Missing initial anchor point for topology patch')
      }

      const pointIds = referencePoints.map((_, index) =>
        index === 0 ? firstPointId : `${firstPointId}:ref-${index}`
      )
      const nextPoints = {} as Record<string, Record<string, unknown>>

      pointIds.forEach((pointId, index) => {
        const referencePoint = referencePoints[index]
        nextPoints[pointId] = {
          ...(computed.points?.[pointId] ?? {}),
          id: pointId,
          kind: 'anchor',
          anchorType: referencePoint.anchorType,
          x: referencePoint.x,
          y: referencePoint.y
        }

        const inControlId = `${pointId}:in`
        const outControlId = `${pointId}:out`

        if (referencePoint.inHandle) {
          nextPoints[inControlId] = {
            id: inControlId,
            kind: 'control',
            controlForId: pointId,
            controlRole: 'in',
            x: referencePoint.inHandle.x,
            y: referencePoint.inHandle.y
          }
        }

        if (referencePoint.outHandle) {
          nextPoints[outControlId] = {
            id: outControlId,
            kind: 'control',
            controlForId: pointId,
            controlRole: 'out',
            x: referencePoint.outHandle.x,
            y: referencePoint.outHandle.y
          }
        }
      })

      const nextSegments: Record<string, Record<string, unknown>> = {}
      const segmentIds = referencePoints.map(
        (_, index) => `${primaryNetwork.id}:ref-segment-${index}`
      )

      segmentIds.forEach((segmentId, index) => {
        const startId = pointIds[index]
        const endId = pointIds[(index + 1) % pointIds.length]
        const outControlId = `${startId}:out`
        const inControlId = `${endId}:in`

        nextSegments[segmentId] = {
          id: segmentId,
          startId,
          endId,
          outControlId: nextPoints[outControlId] ? outControlId : null,
          inControlId: nextPoints[inControlId] ? inControlId : null
        }
      })

      core?.changeComputedData?.(
        [elementId],
        {
          points: nextPoints,
          segments: nextSegments,
          networks: {
            ...(computed.networks ?? {}),
            [primaryNetwork.id]: {
              ...primaryNetwork,
              pointIds,
              segmentIds,
              closed: true
            }
          },
          closed: true
        },
        { undoable: false }
      )
    },
    {
      elementId: vectorId,
      referencePoints: REFERENCE_POINTS
    }
  )
}

const setVectorPositionFromReference = async (page: Page) => {
  await page.evaluate((position) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const elementId =
      core?.getSystemProperty?.('pathEditingVectorId') ??
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ??
      null

    if (!elementId) {
      throw new Error('No vector selected for position update')
    }

    const element = core?.deps?.sceneTree?.getElementById?.(elementId)
    const computed = element?.getAllComputedData?.()
    if (!computed?.points || computed.x == null || computed.y == null) {
      throw new Error('Missing vector geometry for position update')
    }

    const deltaX = position.x - computed.x
    const deltaY = position.y - computed.y
    const nextPoints = Object.fromEntries(
      Object.entries(computed.points).map(([pointId, point]) => {
        const currentPoint = point as { x?: number; y?: number }

        if (
          typeof currentPoint.x === 'number' &&
          typeof currentPoint.y === 'number'
        ) {
          return [
            pointId,
            {
              ...point,
              x: currentPoint.x + deltaX,
              y: currentPoint.y + deltaY
            }
          ]
        }

        return [pointId, point]
      })
    )

    core?.changeComputedData?.(
      [elementId],
      {
        points: nextPoints
      },
      { undoable: false }
    )
  }, REFERENCE_VECTOR_POSITION)
}

const getLongestExpectedMissSpan = (
  expectedCoverage: boolean[],
  actualCoverage: boolean[]
) => {
  let current = 0
  let longest = 0

  for (let index = 0; index < expectedCoverage.length; index += 1) {
    if (expectedCoverage[index] && !actualCoverage[index]) {
      current += PROBE_STEP
      longest = Math.max(longest, current)
      continue
    }

    current = 0
  }

  return longest
}

const runCompletenessScenario = async (
  page: Page,
  testInfo: TestInfo,
  config: {
    dashLength: number
    gapLength: number
    initialDashLength?: number
    initialGapLength?: number
    artifactPrefix: string
    insideRecallMin: number
    gapLeakRateMax: number
    outsideLeakRateMax: number
    enforceLeakMetrics?: boolean
    worstSegmentRecallMin: number
    longestMissSpanMax: number
  }
) => {
  const initialCount = await getElementCount(page)
  let selectedHighZoomMaskComparison: LocalMaskComparison | null = null
  let selectedVsDeselectedHighZoomMaskComparison: LocalMaskComparison | null =
    null
  let deselectedHighZoomMaskComparison: LocalMaskComparison | null = null
  let highZoomLocalScreenshotBase64: string | null = null
  let highZoomLocalClip: {
    x: number
    y: number
    width: number
    height: number
  } | null = null
  const toolbar = getToolbar(page)
  await toolbar.click({ position: { x: 8, y: 8 } })
  await zoomOutForReferenceDrawing(page)

  await activatePenTool(page)

  const skeletonSteps: { step: string; pointCount: number | null }[] = []
  await clickWorkspaceUntilElementCount(
    page,
    toWorkspace(REFERENCE_POINTS[0]),
    initialCount + 1
  )
  await _clickWorkspaceUntilPointCount(
    page,
    toWorkspace(REFERENCE_POINTS[1]),
    2
  )
  await _clickWorkspaceUntilPointCount(
    page,
    toWorkspace(REFERENCE_POINTS[2]),
    3
  )
  await _clickWorkspaceUntilPointCount(
    page,
    toWorkspace(REFERENCE_POINTS[3]),
    4
  )
  await _clickWorkspaceUntilPointCount(
    page,
    toWorkspace(REFERENCE_POINTS[4]),
    5
  )
  await _closeWorkspacePathUntilClosed(
    page,
    toWorkspace(REFERENCE_POINTS[0]),
    5,
    5
  )
  const skeletonVectorId = (await getVectorSnapshot(page))?.elementId ?? null
  skeletonSteps.push({
    step: 'after-skeleton-path',
    pointCount:
      (await getVectorSnapshot(page, skeletonVectorId))?.pointCount ?? null
  })
  expect(skeletonVectorId).toBeTruthy()
  if (!skeletonVectorId) {
    return
  }

  const skeletonSnapshot = await getVectorSnapshot(page, skeletonVectorId)
  expect(skeletonSnapshot).not.toBeNull()
  expect(skeletonSnapshot?.pointCount).toBe(5)
  if (!skeletonSnapshot) {
    return
  }

  const pointBindings = bindReferencePointsToSnapshot(skeletonSnapshot)
  expect(pointBindings).toHaveLength(5)

  await applyReferenceVectorGeometry(page, skeletonVectorId, pointBindings)
  skeletonSteps.push({
    step: 'after-apply-reference-geometry',
    pointCount:
      (await getVectorSnapshot(page, skeletonVectorId))?.pointCount ?? null
  })

  const appliedSkeletonSnapshot = await getVectorSnapshot(
    page,
    skeletonVectorId
  )
  const skeletonDebugPath = testInfo.outputPath(
    `${config.artifactPrefix}-skeleton-debug.json`
  )
  await writeFile(
    skeletonDebugPath,
    JSON.stringify(
      {
        steps: skeletonSteps,
        snapshot: appliedSkeletonSnapshot
      },
      null,
      2
    )
  )
  await testInfo.attach(`${config.artifactPrefix}-skeleton-debug`, {
    path: skeletonDebugPath,
    contentType: 'application/json'
  })
  expect(appliedSkeletonSnapshot?.pointCount).toBe(5)
  expect(appliedSkeletonSnapshot?.segmentCount).toBe(5)
  expect(appliedSkeletonSnapshot?.closed).toBe(true)
  expect(appliedSkeletonSnapshot).not.toBeNull()
  const vectorId = appliedSkeletonSnapshot?.elementId ?? null
  expect(vectorId).not.toBeNull()
  if (!appliedSkeletonSnapshot || !vectorId) {
    return
  }

  await clearSelectedVectorPoint(page)
  if (config.initialDashLength != null || config.initialGapLength != null) {
    await configureStrokeFromReference(page, {
      dashLength: config.initialDashLength ?? config.dashLength,
      gapLength: config.initialGapLength ?? config.gapLength
    })
  }
  await configureStrokeFromReference(page, config)
  await setVectorPositionFromReference(page)

  const initialSnapshot = await getVectorSnapshot(page)
  expect(initialSnapshot).not.toBeNull()
  expect(initialSnapshot?.pointCount).toBe(5)

  const highCurvatureTurnSnapshot = initialSnapshot?.points[4] ?? null
  const highCurvatureTurnTarget = initialSnapshot
    ? getHighCurvatureTurnProbeTarget(
        initialSnapshot,
        config.dashLength,
        config.gapLength
      )
    : null
  const initialSnapshotPath = testInfo.outputPath(
    `${config.artifactPrefix}-initial-snapshot.json`
  )
  await writeFile(
    initialSnapshotPath,
    JSON.stringify(
      {
        vectorId,
        pointCount: initialSnapshot?.pointCount ?? null,
        points: initialSnapshot?.points ?? [],
        highCurvatureTurnSnapshot,
        highCurvatureTurnTarget
      },
      null,
      2
    )
  )
  await testInfo.attach(`${config.artifactPrefix}-initial-snapshot`, {
    path: initialSnapshotPath,
    contentType: 'application/json'
  })
  expect(highCurvatureTurnSnapshot?.id).toBeTruthy()
  expect(highCurvatureTurnSnapshot?.x).not.toBeNull()
  expect(highCurvatureTurnSnapshot?.y).not.toBeNull()
  expect(highCurvatureTurnTarget).not.toBeNull()

  await page.evaluate(
    ({ elementId, point }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      core?.setSystemProperty?.('selectedVectorPoint', {
        elementId,
        pointId: point.id,
        index: 4,
        target: 'anchor',
        x: point.x,
        y: point.y
      })
    },
    {
      elementId: vectorId,
      point: highCurvatureTurnSnapshot
    }
  )
  await page.waitForTimeout(120)
  await centerVectorInViewport(page, vectorId)
  await settleRenderFrames(page, 3)
  const selectedPointScreenshotPath = testInfo.outputPath(
    `${config.artifactPrefix}-edit-state-high-curvature-turn-selected-full.png`
  )
  const selectedPointScreenshot = await page.screenshot()
  await writeFile(selectedPointScreenshotPath, selectedPointScreenshot)
  await testInfo.attach(
    `${config.artifactPrefix}-edit-state-high-curvature-turn-selected-full`,
    {
      path: selectedPointScreenshotPath,
      contentType: 'image/png'
    }
  )

  await centerVectorInViewport(page, vectorId)
  await settleRenderFrames(page, 3)
  const editStateScreenshotPath = testInfo.outputPath(
    `${config.artifactPrefix}-edit-state-full.png`
  )
  await page.screenshot({ path: editStateScreenshotPath })
  await testInfo.attach(`${config.artifactPrefix}-edit-state-full`, {
    path: editStateScreenshotPath,
    contentType: 'image/png'
  })

  if (RUN_SELECTED_STATE_LOCAL_DIAGNOSTICS && highCurvatureTurnTarget) {
    const selectedRaster = await captureSelectedVectorRaster(
      page,
      initialSnapshot,
      36
    )
    const highZoomLocalRaster = await cropRasterAroundWorkspacePoint(
      page,
      selectedRaster,
      highCurvatureTurnTarget.insidePoint,
      HIGH_CURVATURE_TURN_SELECTED_LOCAL_CLIP_SIZE
    )
    highZoomLocalClip = highZoomLocalRaster.clip
    const highZoomLocalScreenshotPath = testInfo.outputPath(
      `${config.artifactPrefix}-edit-state-high-curvature-turn-selected-zoomed-local.png`
    )
    highZoomLocalScreenshotBase64 = highZoomLocalRaster.imageBase64
    await writeFile(
      highZoomLocalScreenshotPath,
      Buffer.from(highZoomLocalRaster.imageBase64, 'base64')
    )
    await testInfo.attach(
      `${config.artifactPrefix}-edit-state-high-curvature-turn-selected-zoomed-local`,
      {
        path: highZoomLocalScreenshotPath,
        contentType: 'image/png'
      }
    )

    selectedHighZoomMaskComparison = await compareRasterToRenderMeshLocalMask(
      page,
      vectorId,
      {
        imageBase64: highZoomLocalScreenshotBase64,
        clip: highZoomLocalClip,
        zoom: highZoomLocalRaster.snapshot.zoom,
        viewport: highZoomLocalRaster.snapshot.viewport,
        sampleStride: HIGH_CURVATURE_TURN_SELECTED_MASK_SAMPLE_STRIDE
      }
    )
    const selectedHighZoomMaskComparisonPath = testInfo.outputPath(
      `${config.artifactPrefix}-edit-state-high-curvature-turn-selected-zoomed-local-mask-comparison.json`
    )
    await writeFile(
      selectedHighZoomMaskComparisonPath,
      JSON.stringify(selectedHighZoomMaskComparison, null, 2)
    )
    await testInfo.attach(
      `${config.artifactPrefix}-edit-state-high-curvature-turn-selected-zoomed-local-mask-comparison`,
      {
        path: selectedHighZoomMaskComparisonPath,
        contentType: 'application/json'
      }
    )
  }

  await page.keyboard.press('Escape')
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        return core?.getSystemProperty?.('pathEditingVectorId') ?? null
      })
    })
    .toBeNull()

  await clearElementSelectionByClick(page)
  await clearVectorOverlayState(page)
  await movePointerToBlankCanvas(page)

  await clearVectorOverlayState(page)
  await settleRenderFrames(page, 3)
  await movePointerToBlankCanvas(page)

  const snapshot = await getVectorSnapshot(page, vectorId)
  expect(snapshot).not.toBeNull()
  if (!snapshot) {
    return
  }
  const renderMeshSnapshot = await getRenderMeshSnapshot(page, vectorId ?? '')

  const raster = await captureSelectedVectorRaster(page, snapshot, 36)
  const screenshotPath = testInfo.outputPath(`${config.artifactPrefix}.png`)
  await page.screenshot({ path: screenshotPath, clip: raster.clip })
  await testInfo.attach(config.artifactPrefix, {
    path: screenshotPath,
    contentType: 'image/png'
  })

  const deselectedHighCurvatureTurnTarget = getHighCurvatureTurnProbeTarget(
    snapshot,
    config.dashLength,
    config.gapLength
  )
  if (
    RUN_SELECTED_STATE_LOCAL_DIAGNOSTICS &&
    deselectedHighCurvatureTurnTarget
  ) {
    const deselectedLocalRaster = await cropRasterAroundWorkspacePoint(
      page,
      raster,
      deselectedHighCurvatureTurnTarget.insidePoint,
      HIGH_CURVATURE_TURN_SELECTED_LOCAL_CLIP_SIZE
    )
    const deselectedLocalClip = deselectedLocalRaster.clip
    const deselectedLocalScreenshotPath = testInfo.outputPath(
      `${config.artifactPrefix}-deselected-high-curvature-turn-local.png`
    )
    await writeFile(
      deselectedLocalScreenshotPath,
      Buffer.from(deselectedLocalRaster.imageBase64, 'base64')
    )
    await testInfo.attach(
      `${config.artifactPrefix}-deselected-high-curvature-turn-local`,
      {
        path: deselectedLocalScreenshotPath,
        contentType: 'image/png'
      }
    )

    deselectedHighZoomMaskComparison = await compareRasterToRenderMeshLocalMask(
      page,
      vectorId,
      {
        imageBase64: deselectedLocalRaster.imageBase64,
        clip: deselectedLocalClip,
        zoom: deselectedLocalRaster.snapshot.zoom,
        viewport: deselectedLocalRaster.snapshot.viewport,
        sampleStride: HIGH_CURVATURE_TURN_SELECTED_MASK_SAMPLE_STRIDE
      }
    )
    const deselectedMaskComparisonPath = testInfo.outputPath(
      `${config.artifactPrefix}-deselected-high-curvature-turn-local-mask-comparison.json`
    )
    await writeFile(
      deselectedMaskComparisonPath,
      JSON.stringify(deselectedHighZoomMaskComparison, null, 2)
    )
    await testInfo.attach(
      `${config.artifactPrefix}-deselected-high-curvature-turn-local-mask-comparison`,
      {
        path: deselectedMaskComparisonPath,
        contentType: 'application/json'
      }
    )

    if (highZoomLocalScreenshotBase64) {
      selectedVsDeselectedHighZoomMaskComparison =
        await compareLocalStrokeMasks(
          page,
          {
            imageBase64: highZoomLocalScreenshotBase64,
            sampleStride: HIGH_CURVATURE_TURN_SELECTED_MASK_SAMPLE_STRIDE
          },
          {
            imageBase64: deselectedLocalRaster.imageBase64,
            sampleStride: HIGH_CURVATURE_TURN_SELECTED_MASK_SAMPLE_STRIDE
          }
        )
      const selectedVsDeselectedMaskComparisonPath = testInfo.outputPath(
        `${config.artifactPrefix}-edit-state-high-curvature-turn-selected-vs-deselected-zoomed-local-mask-comparison.json`
      )
      await writeFile(
        selectedVsDeselectedMaskComparisonPath,
        JSON.stringify(selectedVsDeselectedHighZoomMaskComparison, null, 2)
      )
      await testInfo.attach(
        `${config.artifactPrefix}-edit-state-high-curvature-turn-selected-vs-deselected-zoomed-local-mask-comparison`,
        {
          path: selectedVsDeselectedMaskComparisonPath,
          contentType: 'application/json'
        }
      )
    }
  }

  const {
    probes: rawProbes,
    totalLength,
    segmentCount,
    segments
  } = buildPathProbeSamples(snapshot, config.dashLength, config.gapLength)
  const probeAlignment = await alignProbeSamplesToMesh(
    page,
    vectorId,
    rawProbes
  )
  const probes = probeAlignment.probes
  const [rasterSourceSamples, rasterInsideSamples, rasterOutsideSamples] =
    await Promise.all([
      sampleRasterAtWorkspacePoints(
        page,
        raster,
        probes.map((probe) => probe.sourcePoint),
        3
      ),
      sampleRasterAtWorkspacePoints(
        page,
        raster,
        probes.map((probe) => probe.insidePoint),
        3
      ),
      sampleRasterAtWorkspacePoints(
        page,
        raster,
        probes.map((probe) => probe.outsidePoint),
        3
      )
    ])
  const dashBodyCrossSectionRatios = await sampleRasterCrossSectionRatios(
    page,
    raster,
    probes.map((probe) => ({
      sourcePoint: probe.sourcePoint,
      inwardNormal: probe.inwardNormal
    })),
    snapshot.stroke?.width ?? 10
  )
  const oppositeDashBodyCrossSectionRatios =
    await sampleRasterCrossSectionRatios(
      page,
      raster,
      probes.map((probe) => ({
        sourcePoint: probe.sourcePoint,
        inwardNormal: {
          x: -probe.inwardNormal.x,
          y: -probe.inwardNormal.y
        }
      })),
      snapshot.stroke?.width ?? 10
    )
  const meshDashBodyCrossSectionRatios = vectorId
    ? await sampleRenderMeshCrossSectionRatios(
        page,
        vectorId,
        probes.map((probe) => ({
          sourcePoint: probe.sourcePoint,
          inwardNormal: probe.inwardNormal
        })),
        snapshot.stroke?.width ?? 10
      )
    : probes.map(() => 0)
  const oppositeMeshDashBodyCrossSectionRatios = vectorId
    ? await sampleRenderMeshCrossSectionRatios(
        page,
        vectorId,
        probes.map((probe) => ({
          sourcePoint: probe.sourcePoint,
          inwardNormal: {
            x: -probe.inwardNormal.x,
            y: -probe.inwardNormal.y
          }
        })),
        snapshot.stroke?.width ?? 10
      )
    : probes.map(() => 0)
  const strokeWidth = snapshot.stroke?.width ?? 10

  const selectedCrossSectionSide = dashBodyCrossSectionRatios.map(
    (ratio, index) =>
      ratio >= (oppositeDashBodyCrossSectionRatios[index] ?? 0)
        ? 'forward'
        : 'reverse'
  )
  const chosenSideIsolationMask = buildChosenSideIsolationMask(
    probes,
    selectedCrossSectionSide,
    segments,
    strokeWidth
  )
  const chosenDashBodyCrossSectionRatios = selectedCrossSectionSide.map(
    (side, index) =>
      side === 'forward'
        ? (dashBodyCrossSectionRatios[index] ?? 0)
        : (oppositeDashBodyCrossSectionRatios[index] ?? 0)
  )
  const rejectedDashBodyCrossSectionRatios = selectedCrossSectionSide.map(
    (side, index) =>
      side === 'forward'
        ? (oppositeDashBodyCrossSectionRatios[index] ?? 0)
        : (dashBodyCrossSectionRatios[index] ?? 0)
  )
  const chosenMeshDashBodyCrossSectionRatios = selectedCrossSectionSide.map(
    (side, index) =>
      side === 'forward'
        ? (meshDashBodyCrossSectionRatios[index] ?? 0)
        : (oppositeMeshDashBodyCrossSectionRatios[index] ?? 0)
  )
  const rejectedMeshDashBodyCrossSectionRatios = selectedCrossSectionSide.map(
    (side, index) =>
      side === 'forward'
        ? (oppositeMeshDashBodyCrossSectionRatios[index] ?? 0)
        : (meshDashBodyCrossSectionRatios[index] ?? 0)
  )

  const insideCoverage = normalizeCoverage(
    chosenDashBodyCrossSectionRatios.map(
      (ratio) => ratio >= CROSS_SECTION_COVERAGE_THRESHOLD
    )
  )
  const expectedInsideCoverage = probes.map(
    (probe) => probe.expectedCovered === true
  )
  const expectedGapCoverage = probes.map(
    (probe, index) =>
      probe.expectedCovered === false && chosenSideIsolationMask[index]
  )
  const outsideCoverage = normalizeCoverage(
    rejectedDashBodyCrossSectionRatios.map(
      (ratio) => ratio >= CROSS_SECTION_COVERAGE_THRESHOLD
    )
  )

  let expectedDashSampleCount = 0
  let expectedGapSampleCount = 0
  let coveredDashSampleCount = 0
  let leakedGapSampleCount = 0
  let outsideLeakSampleCount = 0
  let expectedOutsideSampleCount = 0
  const rasterSourceHitCount = rasterSourceSamples.filter(
    (sample) => sample.covered
  ).length
  const rasterInsideHitCount = rasterInsideSamples.filter(
    (sample) => sample.covered
  ).length
  const rasterOutsideHitCount = rasterOutsideSamples.filter(
    (sample) => sample.covered
  ).length

  const segmentCoverage = Array.from({ length: segmentCount }, (_, index) => ({
    segmentIndex: index,
    expectedDashSamples: 0,
    coveredDashSamples: 0
  }))

  probes.forEach((probe, index) => {
    if (probe.expectedCovered === true) {
      expectedDashSampleCount += 1
      segmentCoverage[probe.segmentIndex].expectedDashSamples += 1
      if (insideCoverage[index]) {
        coveredDashSampleCount += 1
        segmentCoverage[probe.segmentIndex].coveredDashSamples += 1
      }
    }

    if (probe.expectedCovered === false && chosenSideIsolationMask[index]) {
      expectedGapSampleCount += 1
      if (insideCoverage[index]) {
        leakedGapSampleCount += 1
      }
    }

    if (probe.expectedCovered !== null && chosenSideIsolationMask[index]) {
      expectedOutsideSampleCount += 1
    }

    if (
      probe.expectedCovered !== null &&
      chosenSideIsolationMask[index] &&
      outsideCoverage[index]
    ) {
      outsideLeakSampleCount += 1
    }
  })

  const insideRecall = ratio(coveredDashSampleCount, expectedDashSampleCount)
  const gapLeakRate = ratio(leakedGapSampleCount, expectedGapSampleCount)
  const outsideLeakRate = ratio(
    outsideLeakSampleCount,
    expectedOutsideSampleCount
  )
  const longestExpectedMissSpan = getLongestExpectedMissSpan(
    expectedInsideCoverage,
    insideCoverage
  )
  const segmentDashRecallMetrics = segmentCoverage.map((segment) => ({
    ...segment,
    recall: ratio(segment.coveredDashSamples, segment.expectedDashSamples)
  }))
  const worstSegmentDashRecall = Math.min(
    ...segmentDashRecallMetrics.map((segment) => segment.recall)
  )
  const dashBodyLengths = measureDashBodyLengths(
    probes,
    dashBodyCrossSectionRatios
  )
  const meshDashBodyLengths = measureDashBodyLengths(
    probes,
    meshDashBodyCrossSectionRatios
  )
  const stableDashBodyLengths = dashBodyLengths.filter(
    isStableDashBodyMeasurement
  )
  const stableMeshDashBodyLengths = meshDashBodyLengths.filter(
    isStableDashBodyMeasurement
  )
  const capExcludedDashBodyLengths = measureCapExcludedDashBodyLengths(
    probes,
    dashBodyCrossSectionRatios
  )
  const capExcludedMeshDashBodyLengths = measureCapExcludedDashBodyLengths(
    probes,
    meshDashBodyCrossSectionRatios
  )
  const stableCapExcludedDashBodyLengths = capExcludedDashBodyLengths.filter(
    isStableCapExcludedDashBodyMeasurement
  )
  const stableCapExcludedMeshDashBodyLengths =
    capExcludedMeshDashBodyLengths.filter(
      isStableCapExcludedDashBodyMeasurement
    )
  const expectedCapExcludedDashBodyLengths =
    measureExpectedCapExcludedDashBodyLengths(
      probes,
      dashBodyCrossSectionRatios,
      config.dashLength,
      strokeWidth
    )
  const expectedCapExcludedMeshDashBodyLengths =
    measureExpectedCapExcludedDashBodyLengths(
      probes,
      meshDashBodyCrossSectionRatios,
      config.dashLength,
      strokeWidth
    )
  const dashBodyLengthValues = dashBodyLengths.map(
    (measurement) => measurement.bodyLength
  )
  const meshDashBodyLengthValues = meshDashBodyLengths.map(
    (measurement) => measurement.bodyLength
  )
  const stableDashBodyLengthValues = stableDashBodyLengths.map(
    (measurement) => measurement.bodyLength
  )
  const stableMeshDashBodyLengthValues = stableMeshDashBodyLengths.map(
    (measurement) => measurement.bodyLength
  )
  const capExcludedDashBodyLengthValues = capExcludedDashBodyLengths.map(
    (measurement) => measurement.bodyLength
  )
  const capExcludedMeshDashBodyLengthValues =
    capExcludedMeshDashBodyLengths.map((measurement) => measurement.bodyLength)
  const stableCapExcludedDashBodyLengthValues =
    stableCapExcludedDashBodyLengths.map(
      (measurement) => measurement.bodyLength
    )
  const stableCapExcludedMeshDashBodyLengthValues =
    stableCapExcludedMeshDashBodyLengths.map(
      (measurement) => measurement.bodyLength
    )
  const expectedCapExcludedDashBodyLengthValues =
    expectedCapExcludedDashBodyLengths.map(
      (measurement) => measurement.bodyLength
    )
  const expectedCapExcludedMeshDashBodyLengthValues =
    expectedCapExcludedMeshDashBodyLengths.map(
      (measurement) => measurement.bodyLength
    )
  const expectedCapExcludedDashBodyDeviationValues =
    expectedCapExcludedDashBodyLengths.map((measurement) =>
      Math.abs(measurement.bodyLength - measurement.expectedBodyLength)
    )
  const expectedCapExcludedMeshDashBodyDeviationValues =
    expectedCapExcludedMeshDashBodyLengths.map((measurement) =>
      Math.abs(measurement.bodyLength - measurement.expectedBodyLength)
    )
  const dashBodyLengthMin =
    dashBodyLengthValues.length > 0 ? Math.min(...dashBodyLengthValues) : 0
  const dashBodyLengthMax =
    dashBodyLengthValues.length > 0 ? Math.max(...dashBodyLengthValues) : 0
  const dashBodyLengthSpan = dashBodyLengthMax - dashBodyLengthMin
  const stableDashBodyLengthMin =
    stableDashBodyLengthValues.length > 0
      ? Math.min(...stableDashBodyLengthValues)
      : 0
  const stableDashBodyLengthMax =
    stableDashBodyLengthValues.length > 0
      ? Math.max(...stableDashBodyLengthValues)
      : 0
  const stableDashBodyLengthSpan =
    stableDashBodyLengthMax - stableDashBodyLengthMin
  const meshDashBodyLengthMin =
    meshDashBodyLengthValues.length > 0
      ? Math.min(...meshDashBodyLengthValues)
      : 0
  const meshDashBodyLengthMax =
    meshDashBodyLengthValues.length > 0
      ? Math.max(...meshDashBodyLengthValues)
      : 0
  const meshDashBodyLengthSpan = meshDashBodyLengthMax - meshDashBodyLengthMin
  const stableMeshDashBodyLengthMin =
    stableMeshDashBodyLengthValues.length > 0
      ? Math.min(...stableMeshDashBodyLengthValues)
      : 0
  const stableMeshDashBodyLengthMax =
    stableMeshDashBodyLengthValues.length > 0
      ? Math.max(...stableMeshDashBodyLengthValues)
      : 0
  const stableMeshDashBodyLengthSpan =
    stableMeshDashBodyLengthMax - stableMeshDashBodyLengthMin
  const capExcludedDashBodyLengthMin =
    capExcludedDashBodyLengthValues.length > 0
      ? Math.min(...capExcludedDashBodyLengthValues)
      : 0
  const capExcludedDashBodyLengthMax =
    capExcludedDashBodyLengthValues.length > 0
      ? Math.max(...capExcludedDashBodyLengthValues)
      : 0
  const capExcludedDashBodyLengthSpan =
    capExcludedDashBodyLengthMax - capExcludedDashBodyLengthMin
  const capExcludedMeshDashBodyLengthMin =
    capExcludedMeshDashBodyLengthValues.length > 0
      ? Math.min(...capExcludedMeshDashBodyLengthValues)
      : 0
  const capExcludedMeshDashBodyLengthMax =
    capExcludedMeshDashBodyLengthValues.length > 0
      ? Math.max(...capExcludedMeshDashBodyLengthValues)
      : 0
  const capExcludedMeshDashBodyLengthSpan =
    capExcludedMeshDashBodyLengthMax - capExcludedMeshDashBodyLengthMin
  const stableCapExcludedDashBodyLengthMin =
    stableCapExcludedDashBodyLengthValues.length > 0
      ? Math.min(...stableCapExcludedDashBodyLengthValues)
      : 0
  const stableCapExcludedDashBodyLengthMax =
    stableCapExcludedDashBodyLengthValues.length > 0
      ? Math.max(...stableCapExcludedDashBodyLengthValues)
      : 0
  const stableCapExcludedDashBodyLengthSpan =
    stableCapExcludedDashBodyLengthMax - stableCapExcludedDashBodyLengthMin
  const stableCapExcludedMeshDashBodyLengthMin =
    stableCapExcludedMeshDashBodyLengthValues.length > 0
      ? Math.min(...stableCapExcludedMeshDashBodyLengthValues)
      : 0
  const stableCapExcludedMeshDashBodyLengthMax =
    stableCapExcludedMeshDashBodyLengthValues.length > 0
      ? Math.max(...stableCapExcludedMeshDashBodyLengthValues)
      : 0
  const stableCapExcludedMeshDashBodyLengthSpan =
    stableCapExcludedMeshDashBodyLengthMax -
    stableCapExcludedMeshDashBodyLengthMin
  const expectedCapExcludedDashBodyLengthMin =
    expectedCapExcludedDashBodyLengthValues.length > 0
      ? Math.min(...expectedCapExcludedDashBodyLengthValues)
      : 0
  const expectedCapExcludedDashBodyLengthMax =
    expectedCapExcludedDashBodyLengthValues.length > 0
      ? Math.max(...expectedCapExcludedDashBodyLengthValues)
      : 0
  const expectedCapExcludedDashBodyLengthSpan =
    expectedCapExcludedDashBodyLengthMax - expectedCapExcludedDashBodyLengthMin
  const expectedCapExcludedMeshDashBodyLengthMin =
    expectedCapExcludedMeshDashBodyLengthValues.length > 0
      ? Math.min(...expectedCapExcludedMeshDashBodyLengthValues)
      : 0
  const expectedCapExcludedMeshDashBodyLengthMax =
    expectedCapExcludedMeshDashBodyLengthValues.length > 0
      ? Math.max(...expectedCapExcludedMeshDashBodyLengthValues)
      : 0
  const expectedCapExcludedMeshDashBodyLengthSpan =
    expectedCapExcludedMeshDashBodyLengthMax -
    expectedCapExcludedMeshDashBodyLengthMin
  const expectedCapExcludedDashBodyDeviationMax =
    expectedCapExcludedDashBodyDeviationValues.length > 0
      ? Math.max(...expectedCapExcludedDashBodyDeviationValues)
      : 0
  const expectedCapExcludedMeshDashBodyDeviationMax =
    expectedCapExcludedMeshDashBodyDeviationValues.length > 0
      ? Math.max(...expectedCapExcludedMeshDashBodyDeviationValues)
      : 0
  const expectedCapExcludedDashBodyOutliers =
    expectedCapExcludedDashBodyLengths.filter(
      (measurement) =>
        Math.abs(measurement.bodyLength - measurement.expectedBodyLength) > 2
    )
  const expectedCapExcludedMeshDashBodyOutliers =
    expectedCapExcludedMeshDashBodyLengths.filter(
      (measurement) =>
        Math.abs(measurement.bodyLength - measurement.expectedBodyLength) > 2
    )

  const benchmarkMetrics: BenchmarkMetric[] = [
    {
      label: 'inside_dash_recall',
      actual: formatRatio(insideRecall),
      expected: `>= ${config.insideRecallMin.toFixed(3)}`,
      passed: insideRecall >= config.insideRecallMin
    },
    {
      label: 'inside_gap_leak_rate',
      actual: formatRatio(gapLeakRate),
      expected: config.enforceLeakMetrics
        ? `<= ${config.gapLeakRateMax.toFixed(3)}`
        : 'diagnostic only (Phase 3 containment / ownership)',
      passed: config.enforceLeakMetrics
        ? gapLeakRate <= config.gapLeakRateMax
        : true
    },
    {
      label: 'outside_leak_rate',
      actual: formatRatio(outsideLeakRate),
      expected: config.enforceLeakMetrics
        ? `<= ${config.outsideLeakRateMax.toFixed(3)}`
        : 'diagnostic only (Phase 3 containment / ownership)',
      passed: config.enforceLeakMetrics
        ? outsideLeakRate <= config.outsideLeakRateMax
        : true
    },
    {
      label: 'worst_segment_dash_recall',
      actual: formatRatio(worstSegmentDashRecall),
      expected: `>= ${config.worstSegmentRecallMin.toFixed(3)}`,
      passed: worstSegmentDashRecall >= config.worstSegmentRecallMin
    },
    {
      label: 'longest_expected_miss_span',
      actual: longestExpectedMissSpan,
      expected: `<= ${config.longestMissSpanMax}`,
      passed: longestExpectedMissSpan <= config.longestMissSpanMax
    },
    {
      label: 'dash_body_length_span',
      actual: dashBodyLengthSpan.toFixed(2),
      expected: 'report-only',
      passed: true
    },
    {
      label: 'stable_dash_body_length_span',
      actual: stableDashBodyLengthSpan.toFixed(2),
      expected:
        'diagnostic only (full-width coverage span, not cap-excluded body length)',
      passed: true
    },
    {
      label: 'stable_mesh_dash_body_length_span',
      actual: stableMeshDashBodyLengthSpan.toFixed(2),
      expected: 'diagnostic only (runtime mesh full-width coverage span)',
      passed: true
    },
    {
      label: 'cap_excluded_dash_body_length_span',
      actual: capExcludedDashBodyLengthSpan.toFixed(2),
      expected: 'diagnostic only (plateau-based cap-excluded raster body span)',
      passed: true
    },
    {
      label: 'cap_excluded_mesh_dash_body_length_span',
      actual: capExcludedMeshDashBodyLengthSpan.toFixed(2),
      expected:
        'diagnostic only (plateau-based cap-excluded runtime mesh body span)',
      passed: true
    },
    {
      label: 'stable_cap_excluded_dash_body_length_span',
      actual: stableCapExcludedDashBodyLengthSpan.toFixed(2),
      expected:
        'diagnostic only (stable plateau-based cap-excluded raster body span)',
      passed: true
    },
    {
      label: 'stable_cap_excluded_mesh_dash_body_length_span',
      actual: stableCapExcludedMeshDashBodyLengthSpan.toFixed(2),
      expected:
        'diagnostic only (stable plateau-based cap-excluded runtime mesh body span)',
      passed: true
    },
    {
      label: 'expected_cap_excluded_dash_body_length_span',
      actual: expectedCapExcludedDashBodyLengthSpan.toFixed(2),
      expected:
        'diagnostic only (full-dash raster body span inside theoretical cap-excluded body window)',
      passed: true
    },
    {
      label: 'expected_cap_excluded_mesh_dash_body_length_span',
      actual: expectedCapExcludedMeshDashBodyLengthSpan.toFixed(2),
      expected:
        'diagnostic only (full-dash runtime mesh body span inside theoretical cap-excluded body window)',
      passed: true
    },
    {
      label: 'expected_cap_excluded_dash_body_deviation_max',
      actual: expectedCapExcludedDashBodyDeviationMax.toFixed(2),
      expected:
        'diagnostic only (max raster deviation from theoretical full-dash cap-excluded body length)',
      passed: true
    },
    {
      label: 'expected_cap_excluded_mesh_dash_body_deviation_max',
      actual: expectedCapExcludedMeshDashBodyDeviationMax.toFixed(2),
      expected:
        'diagnostic only (max mesh deviation from theoretical full-dash cap-excluded body length)',
      passed: true
    },
    {
      label: 'selected_high_zoom_local_mask_iou',
      actual: selectedHighZoomMaskComparison
        ? formatRatio(selectedHighZoomMaskComparison.intersectionOverUnion)
        : 'n/a',
      expected: 'diagnostic only (selected-state local raster vs mesh)',
      passed: true
    },
    {
      label: 'selected_high_zoom_local_overlay_adjusted_mask_iou',
      actual:
        selectedHighZoomMaskComparison?.overlayAdjustedIntersectionOverUnion !==
          null &&
        selectedHighZoomMaskComparison?.overlayAdjustedIntersectionOverUnion !==
          undefined
          ? formatRatio(
              selectedHighZoomMaskComparison.overlayAdjustedIntersectionOverUnion
            )
          : 'n/a',
      expected:
        'diagnostic only (selected-state local raster vs mesh, discounting overlay-colored mesh-only pixels)',
      passed: true
    },
    {
      label: 'selected_high_zoom_local_overlay_occluded_ratio',
      actual:
        selectedHighZoomMaskComparison?.meshOnlyOverlayOccludedRatio !== null &&
        selectedHighZoomMaskComparison?.meshOnlyOverlayOccludedRatio !==
          undefined
          ? formatRatio(
              selectedHighZoomMaskComparison.meshOnlyOverlayOccludedRatio
            )
          : 'n/a',
      expected:
        'diagnostic only (selected-state local mesh-only pixels occluded by overlay chrome)',
      passed: true
    },
    {
      label: 'selected_vs_deselected_high_zoom_local_mask_iou',
      actual: selectedVsDeselectedHighZoomMaskComparison
        ? formatRatio(
            selectedVsDeselectedHighZoomMaskComparison.intersectionOverUnion
          )
        : 'n/a',
      expected:
        'diagnostic only (selected-state local raster vs deselected local raster)',
      passed: true
    },
    {
      label: 'deselected_high_curvature_turn_local_mask_iou',
      actual: deselectedHighZoomMaskComparison
        ? formatRatio(deselectedHighZoomMaskComparison.intersectionOverUnion)
        : 'n/a',
      expected: 'diagnostic only (deselected local raster vs mesh)',
      passed: true
    },
    {
      label: 'deselected_high_curvature_turn_overlay_adjusted_mask_iou',
      actual:
        deselectedHighZoomMaskComparison?.overlayAdjustedIntersectionOverUnion !==
          null &&
        deselectedHighZoomMaskComparison?.overlayAdjustedIntersectionOverUnion !==
          undefined
          ? formatRatio(
              deselectedHighZoomMaskComparison.overlayAdjustedIntersectionOverUnion
            )
          : 'n/a',
      expected:
        'diagnostic only (deselected local raster vs mesh, discounting overlay-colored mesh-only pixels)',
      passed: true
    }
  ]

  const referenceDelta = buildReferencePointDeltas(snapshot)

  for (const segment of segmentDashRecallMetrics) {
    benchmarkMetrics.push({
      label: `segment_${segment.segmentIndex}_dash_recall`,
      actual: formatRatio(segment.recall),
      expected: `>= ${config.worstSegmentRecallMin.toFixed(3)}`,
      passed: segment.recall >= config.worstSegmentRecallMin
    })
  }

  const benchmarkReport = buildBenchmarkReport(benchmarkMetrics)
  const benchmarkDetails = {
    metrics: benchmarkMetrics,
    dashLength: config.dashLength,
    gapLength: config.gapLength,
    snapshot,
    rasterClip: raster.clip,
    probeAlignment,
    totalLength,
    expectedDashSampleCount,
    expectedGapSampleCount,
    expectedOutsideSampleCount,
    coveredDashSampleCount,
    leakedGapSampleCount,
    outsideLeakSampleCount,
    rasterSourceHitCount,
    rasterInsideHitCount,
    rasterOutsideHitCount,
    renderMeshSnapshot,
    expectedInsideCoverage,
    expectedGapCoverage,
    insideCoverage,
    outsideCoverage,
    dashBodyCrossSectionRatios,
    oppositeDashBodyCrossSectionRatios,
    chosenDashBodyCrossSectionRatios,
    rejectedDashBodyCrossSectionRatios,
    meshDashBodyCrossSectionRatios,
    oppositeMeshDashBodyCrossSectionRatios,
    chosenMeshDashBodyCrossSectionRatios,
    rejectedMeshDashBodyCrossSectionRatios,
    selectedCrossSectionSide,
    chosenSideIsolationMask,
    dashBodyLengths,
    meshDashBodyLengths,
    stableDashBodyLengths,
    stableMeshDashBodyLengths,
    capExcludedDashBodyLengths,
    capExcludedMeshDashBodyLengths,
    stableCapExcludedDashBodyLengths,
    stableCapExcludedMeshDashBodyLengths,
    expectedCapExcludedDashBodyLengths,
    expectedCapExcludedMeshDashBodyLengths,
    expectedCapExcludedDashBodyOutliers,
    expectedCapExcludedMeshDashBodyOutliers,
    dashBodyLengthMin,
    dashBodyLengthMax,
    dashBodyLengthSpan,
    stableDashBodyLengthMin,
    stableDashBodyLengthMax,
    stableDashBodyLengthSpan,
    meshDashBodyLengthMin,
    meshDashBodyLengthMax,
    meshDashBodyLengthSpan,
    stableMeshDashBodyLengthMin,
    stableMeshDashBodyLengthMax,
    stableMeshDashBodyLengthSpan,
    capExcludedDashBodyLengthMin,
    capExcludedDashBodyLengthMax,
    capExcludedDashBodyLengthSpan,
    capExcludedMeshDashBodyLengthMin,
    capExcludedMeshDashBodyLengthMax,
    capExcludedMeshDashBodyLengthSpan,
    stableCapExcludedDashBodyLengthMin,
    stableCapExcludedDashBodyLengthMax,
    stableCapExcludedDashBodyLengthSpan,
    stableCapExcludedMeshDashBodyLengthMin,
    stableCapExcludedMeshDashBodyLengthMax,
    stableCapExcludedMeshDashBodyLengthSpan,
    expectedCapExcludedDashBodyLengthMin,
    expectedCapExcludedDashBodyLengthMax,
    expectedCapExcludedDashBodyLengthSpan,
    expectedCapExcludedMeshDashBodyLengthMin,
    expectedCapExcludedMeshDashBodyLengthMax,
    expectedCapExcludedMeshDashBodyLengthSpan,
    expectedCapExcludedDashBodyDeviationMax,
    expectedCapExcludedMeshDashBodyDeviationMax,
    selectedHighZoomMaskComparison,
    selectedVsDeselectedHighZoomMaskComparison,
    deselectedHighZoomMaskComparison,
    referenceDelta,
    segmentDashRecallMetrics,
    longestExpectedMissSpan,
    screenshotPath
  }

  const reportPath = testInfo.outputPath(`${config.artifactPrefix}-report.txt`)
  const reportJsonPath = testInfo.outputPath(
    `${config.artifactPrefix}-report.json`
  )

  await writeFile(reportPath, benchmarkReport, 'utf8')
  await writeFile(reportJsonPath, JSON.stringify(benchmarkDetails, null, 2))

  await testInfo.attach(`${config.artifactPrefix}-report`, {
    path: reportPath,
    contentType: 'text/plain'
  })
  await testInfo.attach(`${config.artifactPrefix}-report.json`, {
    path: reportJsonPath,
    contentType: 'application/json'
  })

  expect(insideRecall).toBeGreaterThanOrEqual(config.insideRecallMin)
  if (config.enforceLeakMetrics) {
    expect(gapLeakRate).toBeLessThanOrEqual(config.gapLeakRateMax)
    expect(outsideLeakRate).toBeLessThanOrEqual(config.outsideLeakRateMax)
  }
  expect(worstSegmentDashRecall).toBeGreaterThanOrEqual(
    config.worstSegmentRecallMin
  )
  expect(longestExpectedMissSpan).toBeLessThanOrEqual(config.longestMissSpanMax)

  segmentDashRecallMetrics.forEach((segment) => {
    expect(
      segment.recall,
      `segment ${segment.segmentIndex} dash recall`
    ).toBeGreaterThanOrEqual(config.worstSegmentRecallMin)
  })
}

test.describe('Reference Dashed Stroke Completeness', () => {
  test.describe.configure({ timeout: 180_000 })
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test('renders the dashed stroke across the full reference path without segment dropouts', async ({
    page
  }, testInfo) => {
    await runCompletenessScenario(page, testInfo, {
      dashLength: 30,
      gapLength: 40,
      artifactPrefix: 'reference-dashed-stroke-completeness',
      insideRecallMin: 0.93,
      gapLeakRateMax: 0.08,
      outsideLeakRateMax: 0.05,
      worstSegmentRecallMin: 0.85,
      longestMissSpanMax: 14
    })
  })

  test('renders the dashed stroke across the full reference path for dash 25 gap 20 without segment dropouts', async ({
    page
  }, testInfo) => {
    await runCompletenessScenario(page, testInfo, {
      dashLength: 25,
      gapLength: 20,
      artifactPrefix: 'reference-dashed-stroke-completeness-d25-g20',
      insideRecallMin: 0.9,
      gapLeakRateMax: 0.1,
      outsideLeakRateMax: 0.05,
      worstSegmentRecallMin: 0.8,
      longestMissSpanMax: 16
    })
  })

  test('renders the dashed stroke across the full reference path for dash 20 gap 20 without segment dropouts', async ({
    page
  }, testInfo) => {
    await runCompletenessScenario(page, testInfo, {
      dashLength: 20,
      gapLength: 20,
      artifactPrefix: 'reference-dashed-stroke-completeness-d20-g20',
      insideRecallMin: 0.9,
      gapLeakRateMax: 0.11,
      outsideLeakRateMax: 0.05,
      worstSegmentRecallMin: 0.8,
      longestMissSpanMax: 16
    })
  })

  test('keeps the dashed stroke stable when transitioning from dash 30 gap 40 to dash 20 gap 20', async ({
    page
  }, testInfo) => {
    await runCompletenessScenario(page, testInfo, {
      initialDashLength: 30,
      initialGapLength: 40,
      dashLength: 20,
      gapLength: 20,
      artifactPrefix:
        'reference-dashed-stroke-completeness-d20-g20-from-d30-g40',
      insideRecallMin: 0.9,
      gapLeakRateMax: 0.11,
      outsideLeakRateMax: 0.05,
      worstSegmentRecallMin: 0.8,
      longestMissSpanMax: 16
    })
  })
})
