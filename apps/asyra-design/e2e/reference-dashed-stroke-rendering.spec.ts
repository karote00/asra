import { writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import {
  getCanvasPosition,
  getActiveTool,
  getElementCount,
  getZoomLevel,
  getToolbar,
  waitForAppReady,
  resetCanvas
} from './test-utils'

// Definition:
// apps/asyra-design/e2e/definitions/reference-dashed-stroke-rendering.definition.md

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

interface RasterStrokePixelStats {
  redPixelCount: number
  totalPixelCount: number
  redPixelRatio: number
}

interface MeshProbeResult {
  covered: boolean
}

interface BenchmarkMetric {
  label: string
  actual: number | string | boolean
  expected: string
  passed: boolean
}

interface PointDistanceCandidate {
  point: VectorPointSnapshot
  distance: number
}

interface ReferencePointBinding {
  referenceIndex: number
  point: VectorPointSnapshot
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

interface RenderMeshNodeSnapshot {
  type: string
  visible: boolean
  renderable: boolean
  childCount: number
  alpha?: number
  tint?: number
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

interface RenderMeshSnapshot {
  childCount: number
  children: RenderMeshNodeSnapshot[]
}

interface RenderProjectionCacheEntrySnapshot {
  key: string
  color: number
  alpha: number
  signatureLength: number
}

interface ArcLengthSample {
  t: number
  point: WorkspacePoint
  distance: number
}

const DRAW_ORIGIN = {
  x: 96,
  y: 32
} as const

const REFERENCE_DASH_LENGTH = Number(
  process.env.ASYRA_REFERENCE_DASH_LENGTH ?? 30
)
const REFERENCE_GAP_LENGTH = Number(
  process.env.ASYRA_REFERENCE_GAP_LENGTH ?? 40
)

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

const clickWorkspaceUntilPointCount = async (
  page: Page,
  point: WorkspacePoint,
  expectedPointCount: number,
  attempts = 3
) => {
  let lastError: unknown = null

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
      await page.waitForTimeout(120)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

const closeWorkspacePathUntilClosed = async (
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
            const snapshot = await getSelectedVectorSnapshot(page)
            return {
              pointCount: snapshot?.pointCount ?? null,
              segmentCount: snapshot?.segmentCount ?? null,
              closed: snapshot?.closed ?? null
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

const movePointerToBlankCanvas = async (page: Page) => {
  const blankCanvasPoint = await getCanvasPosition(page, 0.08, 0.08)
  await page.mouse.move(blankCanvasPoint.x, blankCanvasPoint.y, { steps: 4 })
  await page.waitForTimeout(80)
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

const getClosestSnapshotPoint = (
  snapshot: SelectedVectorSnapshot,
  referencePoint: ReferencePoint
): VectorPointSnapshot | null => {
  const candidates = snapshot.points
    .filter(
      (point): point is VectorPointSnapshot & { x: number; y: number } =>
        point.x != null && point.y != null
    )
    .map(
      (point): PointDistanceCandidate => ({
        point,
        distance: Math.hypot(
          point.x - referencePoint.x,
          point.y - referencePoint.y
        )
      })
    )
    .sort((left, right) => left.distance - right.distance)

  return candidates[0]?.point ?? null
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

const configureStrokeFromReference = async (page: Page) => {
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
  await strokePatternInput.fill(
    `${REFERENCE_DASH_LENGTH}, ${REFERENCE_GAP_LENGTH}`
  )
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
      const snapshot = await getSelectedVectorSnapshot(page)
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
      dash: REFERENCE_DASH_LENGTH,
      gap: REFERENCE_GAP_LENGTH,
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

    const stroke = computed.strokes?.[0] ?? null

    return {
      elementId: selectedId,
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
        alpha:
          typeof (node as { alpha?: number }).alpha === 'number'
            ? (node as { alpha?: number }).alpha
            : undefined,
        tint:
          typeof (node as { tint?: number }).tint === 'number'
            ? (node as { tint?: number }).tint
            : undefined,
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

const getRenderProjectionCacheSnapshot = async (
  page: Page,
  elementId: string
): Promise<RenderProjectionCacheEntrySnapshot[]> =>
  page.evaluate((targetElementId) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const renderElement = core?.deps?.render?.getElementById?.(targetElementId)
    const rawCache = renderElement?.__asyraMeshProjectionCache

    if (!rawCache || typeof rawCache.entries !== 'function') {
      return []
    }

    return Array.from(rawCache.entries()).map(([key, entry]) => ({
      key,
      color: typeof entry?.color === 'number' ? entry.color : Number.NaN,
      alpha: typeof entry?.alpha === 'number' ? entry.alpha : Number.NaN,
      signatureLength:
        typeof entry?.signature === 'string' ? entry.signature.length : 0
    }))
  }, elementId)

const toClientBounds = (
  bounds: { x: number; y: number; width: number; height: number },
  snapshot: Pick<SelectedVectorSnapshot, 'zoom' | 'viewport'>
) => ({
  x: bounds.x * snapshot.zoom + snapshot.viewport.x,
  y: bounds.y * snapshot.zoom + snapshot.viewport.y,
  width: bounds.width * snapshot.zoom,
  height: bounds.height * snapshot.zoom
})

const getIntersectionArea = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) => {
  const minX = Math.max(a.x, b.x)
  const minY = Math.max(a.y, b.y)
  const maxX = Math.min(a.x + a.width, b.x + b.width)
  const maxY = Math.min(a.y + a.height, b.y + b.height)
  const width = Math.max(0, maxX - minX)
  const height = Math.max(0, maxY - minY)
  return width * height
}

const sampleRenderMeshAtWorkspacePoints = async (
  page: Page,
  elementId: string,
  points: WorkspacePoint[],
  radius = 0
): Promise<MeshProbeResult[]> =>
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

      collectMeshes(renderElement as LooseMeshNode)

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

      const buildProbeOffsets = (radius: number) => {
        const normalizedRadius = Math.max(0, Math.floor(radius))
        const offsets: WorkspacePoint[] = [{ x: 0, y: 0 }]

        if (normalizedRadius <= 0) {
          return offsets
        }

        for (let y = -normalizedRadius; y <= normalizedRadius; y += 1) {
          for (let x = -normalizedRadius; x <= normalizedRadius; x += 1) {
            if (x === 0 && y === 0) {
              continue
            }

            if (Math.hypot(x, y) <= normalizedRadius + 1e-6) {
              offsets.push({ x, y })
            }
          }
        }

        return offsets
      }

      const probeOffsets = buildProbeOffsets(probeRadius)

      return workspacePoints.map((workspacePoint) => {
        let coveredOffsets = 0
        let totalOffsets = 0

        probeOffsets.forEach((offset) => {
          totalOffsets += 1
          const covered = meshes.some((mesh) => {
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

            const samplePoint = {
              x: localPoint.x + offset.x,
              y: localPoint.y + offset.y
            }

            for (let index = 0; index < indexData.length; index += 3) {
              const ia = indexData[index] * 2
              const ib = indexData[index + 1] * 2
              const ic = indexData[index + 2] * 2
              if (
                pointInTriangle(
                  samplePoint,
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
            coveredOffsets += 1
          }
        })

        return {
          covered: coveredOffsets >= Math.max(3, Math.ceil(totalOffsets * 0.12))
        }
      })
    },
    {
      targetElementId: elementId,
      workspacePoints: points,
      probeRadius: radius
    }
  )

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
  padding = 36,
  snapshotOverride?: SelectedVectorSnapshot | null
): Promise<VectorRaster> => {
  const snapshot = snapshotOverride ?? (await getSelectedVectorSnapshot(page))
  const viewportSize = page.viewportSize()
  if (
    !snapshot ||
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

const measureStrokePixelsInRaster = async (
  page: Page,
  raster: VectorRaster
): Promise<RasterStrokePixelStats> =>
  page.evaluate(
    async ({ base64 }) => {
      const response = await fetch(`data:image/png;base64,${base64}`)
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) {
        return {
          redPixelCount: 0,
          totalPixelCount: 0,
          redPixelRatio: 0
        }
      }

      context.drawImage(bitmap, 0, 0)
      const imageData = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      ).data
      let redPixelCount = 0
      const totalPixelCount = canvas.width * canvas.height

      for (let index = 0; index < imageData.length; index += 4) {
        const r = imageData[index]
        const g = imageData[index + 1]
        const b = imageData[index + 2]
        const a = imageData[index + 3]
        const isRedStrokePixel =
          a >= 32 && r >= 70 && r - g >= 25 && r - b >= 25
        if (isRedStrokePixel) {
          redPixelCount += 1
        }
      }

      return {
        redPixelCount,
        totalPixelCount,
        redPixelRatio:
          totalPixelCount === 0 ? 0 : redPixelCount / totalPixelCount
      }
    },
    { base64: raster.imageBase64 }
  )

const toAbsoluteWorkspacePoint = (
  origin: WorkspacePoint,
  point: { x: number | null; y: number | null } | null | undefined
): WorkspacePoint => ({
  x: origin.x + (point?.x ?? 0),
  y: origin.y + (point?.y ?? 0)
})

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

const getCoverageRuns = (coverage: boolean[]) => {
  if (coverage.length === 0) {
    return []
  }

  const runs: {
    covered: boolean
    start: number
    end: number
    length: number
  }[] = []
  let start = 0

  for (let index = 1; index <= coverage.length; index += 1) {
    if (index < coverage.length && coverage[index] === coverage[start]) {
      continue
    }

    runs.push({
      covered: coverage[start],
      start,
      end: index - 1,
      length: index - start
    })
    start = index
  }

  return runs
}

const withinTolerance = (
  actual: number | null | undefined,
  expected: number | null | undefined,
  tolerance: number
) =>
  typeof actual === 'number' &&
  typeof expected === 'number' &&
  Math.abs(actual - expected) <= tolerance

const formatColor = (color: SampledColor | undefined) =>
  color ? `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})` : 'n/a'

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

test.describe('Reference Dashed Stroke Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test('renders the dashed stroke with the expected first dash, gap, inside placement, and color', async ({
    page
  }, testInfo) => {
    const consoleMessages: string[] = []
    page.on('console', (msg) => {
      consoleMessages.push(msg.text())
    })

    const initialCount = await getElementCount(page)
    const toolbar = getToolbar(page)
    await toolbar.click({ position: { x: 8, y: 8 } })
    await zoomOutForReferenceDrawing(page)

    await activatePenTool(page)

    await clickWorkspaceUntilElementCount(
      page,
      toWorkspace(REFERENCE_POINTS[0]),
      initialCount + 1
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REFERENCE_POINTS[1]),
      2
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REFERENCE_POINTS[2]),
      3
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REFERENCE_POINTS[3]),
      4
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REFERENCE_POINTS[4]),
      5
    )
    await closeWorkspacePathUntilClosed(
      page,
      toWorkspace(REFERENCE_POINTS[0]),
      5,
      5
    )

    const skeletonSnapshot = await getSelectedVectorSnapshot(page)
    expect(skeletonSnapshot?.pointCount).toBe(5)
    expect(skeletonSnapshot).not.toBeNull()
    const vectorId = skeletonSnapshot?.elementId ?? null
    expect(vectorId).not.toBeNull()
    if (!skeletonSnapshot || !vectorId) {
      return
    }

    const pointBindings = bindReferencePointsToSnapshot(skeletonSnapshot)
    expect(pointBindings).toHaveLength(5)

    await applyReferenceVectorGeometry(page, vectorId, pointBindings)

    await clearSelectedVectorPoint(page)
    await configureStrokeFromReference(page)
    await setVectorPositionFromReference(page)

    const geometrySnapshot = await getSelectedVectorSnapshot(page)
    expect(geometrySnapshot).not.toBeNull()
    expect(geometrySnapshot?.stroke).toMatchObject({
      style: 'dashed',
      position: 'inside',
      width: 10,
      dash: REFERENCE_DASH_LENGTH,
      gap: REFERENCE_GAP_LENGTH,
      color: '#d90909',
      opacity: 0.5,
      joinType: 'miter',
      miterAngle: 28.96
    })
    expect(geometrySnapshot?.pointCount).toBe(5)

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

    await centerVectorInViewport(page, vectorId)
    await movePointerToBlankCanvas(page)
    await clearVectorOverlayState(page)
    await settleRenderFrames(page, 3)
    const snapshot = await getVectorSnapshot(page, vectorId)
    expect(snapshot).not.toBeNull()
    const renderMeshSnapshot = await getRenderMeshSnapshot(page, vectorId)
    const renderProjectionCacheSnapshot =
      await getRenderProjectionCacheSnapshot(page, vectorId)

    const raster = await captureSelectedVectorRaster(page, 36, snapshot)
    const screenshotPath = testInfo.outputPath(
      `reference-dashed-stroke-rendering-d${REFERENCE_DASH_LENGTH}-g${REFERENCE_GAP_LENGTH}.png`
    )
    await page.screenshot({ path: screenshotPath, clip: raster.clip })
    await testInfo.attach('reference-dashed-stroke-rendering', {
      path: screenshotPath,
      contentType: 'image/png'
    })
    const rasterStrokePixels = await measureStrokePixelsInRaster(page, raster)
    await testInfo.attach('reference-dashed-stroke-rendering-raster-stats', {
      body: JSON.stringify(rasterStrokePixels, null, 2),
      contentType: 'application/json'
    })

    const firstPoint = geometrySnapshot
      ? getClosestSnapshotPoint(geometrySnapshot, REFERENCE_POINTS[0])
      : null
    const secondPoint = geometrySnapshot
      ? getClosestSnapshotPoint(geometrySnapshot, REFERENCE_POINTS[1])
      : null
    expect(firstPoint?.x).not.toBeNull()
    expect(firstPoint?.y).not.toBeNull()
    expect(secondPoint?.x).not.toBeNull()
    expect(secondPoint?.y).not.toBeNull()

    const vectorOrigin = {
      x: geometrySnapshot?.x ?? 0,
      y: geometrySnapshot?.y ?? 0
    }
    const firstSegmentStart = toAbsoluteWorkspacePoint(
      vectorOrigin,
      REFERENCE_POINTS[0]
    )
    const firstSegmentEnd = toAbsoluteWorkspacePoint(
      vectorOrigin,
      REFERENCE_POINTS[1]
    )
    const firstSegmentOutHandle = toAbsoluteWorkspacePoint(
      vectorOrigin,
      REFERENCE_POINTS[0].outHandle
    )
    const firstSegmentInHandle = toAbsoluteWorkspacePoint(
      vectorOrigin,
      REFERENCE_POINTS[1].inHandle
    )
    const firstSegmentArc = buildArcLengthTable(
      firstSegmentStart,
      firstSegmentOutHandle,
      firstSegmentInHandle,
      firstSegmentEnd
    )
    const firstSegmentLength =
      firstSegmentArc[firstSegmentArc.length - 1]?.distance ?? 0
    const coverageProbeDistances = Array.from(
      { length: Math.max(2, Math.floor(firstSegmentLength) + 1) },
      (_, index) => index
    )
    const coverageProbePoints = coverageProbeDistances.map((distance) => {
      const probe = getPointAtDistance(
        firstSegmentArc,
        distance,
        firstSegmentStart,
        firstSegmentOutHandle,
        firstSegmentInHandle,
        firstSegmentEnd
      )
      const localInwardNormal = getInwardNormal(
        probe.tangent,
        snapshot?.points ?? []
      )

      return {
        x: probe.point.x + localInwardNormal.x * 5,
        y: probe.point.y + localInwardNormal.y * 5
      }
    })
    const coverageSamples = await sampleRasterAtWorkspacePoints(
      page,
      raster,
      coverageProbePoints,
      3
    )
    const meshCoverageSamples = vectorId
      ? await sampleRenderMeshAtWorkspacePoints(
          page,
          vectorId,
          coverageProbePoints,
          3
        )
      : []
    const normalizedCoverage = normalizeCoverage(
      coverageSamples.map((sample) => sample.covered)
    )
    const normalizedMeshCoverage = normalizeCoverage(
      meshCoverageSamples.map((sample) => sample.covered)
    )
    const coverageRuns = getCoverageRuns(normalizedCoverage)
    const meshCoverageRuns = getCoverageRuns(normalizedMeshCoverage)
    const firstCoveredIndex = normalizedCoverage.findIndex(Boolean)
    const firstMeshCoveredIndex = normalizedMeshCoverage.findIndex(Boolean)
    const firstDashStartDistance =
      firstCoveredIndex >= 0
        ? (coverageProbeDistances[firstCoveredIndex] ?? 'missing')
        : 'missing'
    const firstMeshDashStartDistance =
      firstMeshCoveredIndex >= 0
        ? (coverageProbeDistances[firstMeshCoveredIndex] ?? 'missing')
        : 'missing'
    const firstCoveredRun = coverageRuns.find((run) => run.covered)
    const firstMeshCoveredRun = meshCoverageRuns.find((run) => run.covered)
    const firstGapRun = firstCoveredRun
      ? coverageRuns.find(
          (run) => !run.covered && run.start > firstCoveredRun.end
        )
      : null
    const firstMeshGapRun = firstMeshCoveredRun
      ? meshCoverageRuns.find(
          (run) => !run.covered && run.start > firstMeshCoveredRun.end
        )
      : null

    const insideProbeDistance = firstMeshCoveredRun
      ? (firstMeshCoveredRun.start + firstMeshCoveredRun.end) / 2
      : firstCoveredRun
        ? (firstCoveredRun.start + firstCoveredRun.end) / 2
        : Math.min(12, firstSegmentLength / 2)
    const insideProbe = getPointAtDistance(
      firstSegmentArc,
      insideProbeDistance,
      firstSegmentStart,
      firstSegmentOutHandle,
      firstSegmentInHandle,
      firstSegmentEnd
    )
    const inwardNormal = getInwardNormal(
      insideProbe.tangent,
      snapshot?.points ?? []
    )

    const insidePoint = {
      x: insideProbe.point.x + inwardNormal.x * 5,
      y: insideProbe.point.y + inwardNormal.y * 5
    }
    const outsidePoint = {
      x: insideProbe.point.x - inwardNormal.x * 5,
      y: insideProbe.point.y - inwardNormal.y * 5
    }
    const [insideStroke, outsideStroke] = await sampleRasterAtWorkspacePoints(
      page,
      raster,
      [insidePoint, outsidePoint],
      3
    )
    const [meshInsideStroke, meshOutsideStroke] = vectorId
      ? await sampleRenderMeshAtWorkspacePoints(
          page,
          vectorId,
          [insidePoint, outsidePoint],
          3
        )
      : [{ covered: false }, { covered: false }]

    const debugMessages = consoleMessages.filter((message) =>
      /\[(?:.*Debug|Polyline Debug|VectorRender Debug)/.test(message)
    )
    const benchmarkMetrics: BenchmarkMetric[] = [
      {
        label: 'first_dash_start_distance_vs_mesh',
        actual: firstDashStartDistance,
        expected: `${firstMeshDashStartDistance} +/- 2`,
        passed: withinTolerance(
          typeof firstDashStartDistance === 'number'
            ? firstDashStartDistance
            : null,
          typeof firstMeshDashStartDistance === 'number'
            ? firstMeshDashStartDistance
            : null,
          2
        )
      },
      {
        label: 'first_dash_run_vs_mesh',
        actual: firstCoveredRun?.length ?? 'missing',
        expected: `${firstMeshCoveredRun?.length ?? 'missing'} +/- 5`,
        passed: withinTolerance(
          firstCoveredRun?.length,
          firstMeshCoveredRun?.length,
          5
        )
      },
      {
        label: 'first_gap_run_vs_mesh',
        actual: firstGapRun?.length ?? 'missing',
        expected: `${firstMeshGapRun?.length ?? 'missing'} +/- 5`,
        passed: withinTolerance(firstGapRun?.length, firstMeshGapRun?.length, 5)
      },
      {
        label: 'inside_probe_covered',
        actual: insideStroke?.covered ?? 'missing',
        expected: String(meshInsideStroke?.covered ?? 'missing'),
        passed: insideStroke?.covered === meshInsideStroke?.covered
      },
      {
        label: 'inside_probe_red_ratio',
        actual:
          insideStroke?.redPixelRatio !== undefined
            ? insideStroke.redPixelRatio.toFixed(3)
            : 'missing',
        expected: '> 0.08',
        passed: (insideStroke?.redPixelRatio ?? 0) > 0.08
      },
      {
        label: 'inside_probe_color',
        actual: formatColor(insideStroke?.color),
        expected: 'red-dominant',
        passed:
          (insideStroke?.color?.r ?? 0) >= 70 &&
          (insideStroke?.color?.r ?? 0) - (insideStroke?.color?.g ?? 0) >= 25 &&
          (insideStroke?.color?.r ?? 0) - (insideStroke?.color?.b ?? 0) >= 25
      },
      {
        label: 'outside_probe_covered',
        actual: outsideStroke?.covered ?? 'missing',
        expected: String(meshOutsideStroke?.covered ?? 'missing'),
        passed: outsideStroke?.covered === meshOutsideStroke?.covered
      },
      {
        label: 'debug_messages',
        actual: debugMessages.length,
        expected: '0',
        passed: debugMessages.length === 0
      }
    ]
    const benchmarkReport = buildBenchmarkReport(benchmarkMetrics)
    const benchmarkDetails = {
      snapshot,
      firstSegmentStart,
      firstSegmentEnd,
      firstSegmentOutHandle,
      firstSegmentInHandle,
      firstSegmentLength,
      coverageProbeDistances,
      normalizedCoverage,
      normalizedMeshCoverage,
      coverageRuns,
      meshCoverageRuns,
      metrics: benchmarkMetrics,
      firstDashStartDistance,
      firstMeshDashStartDistance,
      firstCoveredRun,
      firstMeshCoveredRun,
      firstGapRun,
      firstMeshGapRun,
      insideStroke,
      meshInsideStroke,
      outsideStroke,
      meshOutsideStroke,
      renderMeshSnapshot,
      renderProjectionCacheSnapshot,
      debugMessages,
      screenshotPath
    }
    const reportPath = testInfo.outputPath(
      'reference-dashed-stroke-benchmark-report.txt'
    )
    const reportJsonPath = testInfo.outputPath(
      'reference-dashed-stroke-benchmark-report.json'
    )

    await writeFile(reportPath, benchmarkReport, 'utf8')
    await writeFile(reportJsonPath, JSON.stringify(benchmarkDetails, null, 2))

    await testInfo.attach('reference-dashed-stroke-benchmark-report', {
      path: reportPath,
      contentType: 'text/plain'
    })
    await testInfo.attach('reference-dashed-stroke-benchmark-report.json', {
      path: reportJsonPath,
      contentType: 'application/json'
    })

    expect(firstMeshDashStartDistance).not.toBe('missing')
    expect(
      typeof firstMeshDashStartDistance === 'number'
        ? firstMeshDashStartDistance
        : -1
    ).toBeGreaterThanOrEqual(0)
    expect(firstMeshCoveredRun).not.toBeNull()
    expect(
      benchmarkMetrics.find(
        (metric) => metric.label === 'first_dash_run_vs_mesh'
      )?.passed
    ).toBe(true)
    expect(meshInsideStroke?.covered).toBe(true)
    expect(meshOutsideStroke?.covered).toBe(false)
    const meshNode = renderMeshSnapshot?.children?.[0]?.children?.[0]
    expect(meshNode?.type).toBe('Mesh')
    expect(meshNode?.visible).toBe(true)
    expect(meshNode?.renderable).toBe(true)
    expect(meshNode?.meshVertexCount ?? 0).toBeGreaterThan(0)
    expect(meshNode?.meshIndexCount ?? 0).toBeGreaterThan(0)
    expect(rasterStrokePixels.redPixelCount).toBeGreaterThan(0)
    expect(
      meshNode?.bounds
        ? getIntersectionArea(
            toClientBounds(meshNode.bounds, snapshot),
            raster.clip
          )
        : 0
    ).toBeGreaterThan(0)
    expect(snapshot.stroke?.opacity).toBeCloseTo(0.5, 2)
    expect(snapshot.stroke?.color).toBe('#d90909')
    expect(debugMessages).toEqual([])
    expect(benchmarkMetrics.every((metric) => metric.passed)).toBe(true)
  })
})
