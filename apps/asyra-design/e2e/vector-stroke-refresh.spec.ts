import { expect, test, type Page } from '@playwright/test'
import {
  createVectorPath,
  fillStrokeDashGap,
  getCanvasPosition,
  getPropertiesPanel,
  resetCanvas,
  waitForAppReady
} from './test-utils'

interface VectorStrokeRenderSnapshot {
  vectorId: string
  renderObjectCount: number
  computedStrokeCount: number
  computedStrokeStyle: string | null
  computedStrokePosition: string | null
  strokeCacheSize: number
  acceptedConstrainedSolidCount: number
  blockedConstrainedSolidCount: number
  acceptedConstrainedDashedCount: number
  blockedConstrainedDashedCount: number
  topologyModelCount: number
  geometryModelCount: number
}

interface VectorStrokeRenderSummary {
  vectorCount: number
  renderObjectCount: number
  dashedCenterCount: number
  dashedInsideCount: number
  dashedOutsideCount: number
  closedVectorCount: number
  openVectorCount: number
  totalStrokeCacheSize: number
  acceptedConstrainedDashedCount: number
  blockedConstrainedDashedCount: number
  topologyModelCount: number
  geometryModelCount: number
}

const clearVectorOverlayState = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    core?.setSystemProperty?.('selectedVectorPoint', null)
    core?.setSystemProperty?.('pathEditingVectorId', null)
    core?.setSystemProperty?.('pathEditingMode', false)
  })
}

const drawSelfIntersectingStarWithPen = async (page: Page) => {
  const center = await getCanvasPosition(page, 0.5, 0.45)
  const radius = 82
  const starOrder = [0, 2, 4, 1, 3]
  const points = starOrder.map((outerPointIndex) => {
    const angle = -Math.PI / 2 + (outerPointIndex * Math.PI * 2) / 5
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    }
  })

  await page.keyboard.press('p')
  await page.waitForTimeout(100)
  for (const point of points) {
    await page.mouse.click(point.x, point.y)
    await page.waitForTimeout(120)
  }
  await page.mouse.move(points[0].x, points[0].y)
  await page.waitForTimeout(180)
  await page.mouse.click(points[0].x, points[0].y)
  await page.waitForTimeout(240)
  await page.keyboard.press('v')
  await page.waitForTimeout(120)
  await clearVectorOverlayState(page)
}

const patchSelectedVectorToSimpleStar = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      throw new Error('No selected vector to patch')
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.()
    const primaryNetwork = Object.values(computed?.networks ?? {})[0] as
      | { id: string }
      | undefined
    if (!computed || !primaryNetwork) {
      throw new Error('Missing selected vector topology')
    }

    const center = { x: 90, y: 90 }
    const pointIds = Array.from({ length: 10 }, (_, index) => `p-${index}`)
    const segmentIds = Array.from({ length: 10 }, (_, index) => `s-${index}`)
    const points = pointIds.reduce<Record<string, unknown>>(
      (accumulator, pointId, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / pointIds.length
        const radius = index % 2 === 0 ? 78 : 38
        accumulator[pointId] = {
          id: pointId,
          kind: 'anchor',
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
          anchorType: 'sharp'
        }
        return accumulator
      },
      {}
    )
    const segments = segmentIds.reduce<Record<string, unknown>>(
      (accumulator, segmentId, index) => {
        accumulator[segmentId] = {
          id: segmentId,
          startId: pointIds[index],
          endId: pointIds[(index + 1) % pointIds.length],
          outControlId: null,
          inControlId: null
        }
        return accumulator
      },
      {}
    )

    core?.changeComputedData?.(
      [selectedId],
      {
        x: 220,
        y: 140,
        width: 180,
        height: 180,
        points,
        segments,
        networks: {
          [primaryNetwork.id]: {
            id: primaryNetwork.id,
            pointIds,
            segmentIds,
            closed: true
          }
        },
        closed: true
      },
      { undoable: false }
    )
    core?.selectElements?.([selectedId], { undoable: false })
  })

  await clearVectorOverlayState(page)
}

const patchSelectedVectorToSelfIntersectingStarNetworks = async (
  page: Page,
  starCount: number
) => {
  await page.evaluate((count) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      throw new Error('No selected vector to patch')
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.()
    if (!computed) {
      throw new Error('Missing selected vector computed data')
    }

    const starOrder = [0, 2, 4, 1, 3]
    const points: Record<string, unknown> = {}
    const segments: Record<string, unknown> = {}
    const networks: Record<string, unknown> = {}

    for (let starIndex = 0; starIndex < count; starIndex += 1) {
      const networkId = `self-star-network-${starIndex}`
      const center = {
        x: (starIndex % 4) * 84 + 42,
        y: Math.floor(starIndex / 4) * 84 + 42
      }
      const radius = 34
      const pointIds: string[] = []
      const segmentIds: string[] = []

      starOrder.forEach((outerPointIndex, pointIndex) => {
        const angle = -Math.PI / 2 + (outerPointIndex * Math.PI * 2) / 5
        const pointId = `self-star-${starIndex}-p-${pointIndex}`
        points[pointId] = {
          id: pointId,
          kind: 'anchor',
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
          anchorType: 'sharp'
        }
        pointIds.push(pointId)
      })

      pointIds.forEach((startId, pointIndex) => {
        const endId = pointIds[(pointIndex + 1) % pointIds.length]
        const segmentId = `self-star-${starIndex}-s-${pointIndex}`
        segments[segmentId] = {
          id: segmentId,
          startId,
          endId,
          outControlId: null,
          inControlId: null
        }
        segmentIds.push(segmentId)
      })

      networks[networkId] = {
        id: networkId,
        pointIds,
        segmentIds,
        closed: true
      }
    }

    core?.changeComputedData?.(
      [selectedId],
      {
        x: 180,
        y: 120,
        width: 340,
        height: 260,
        points,
        segments,
        networks,
        closed: true,
        fills: [
          {
            kind: 'solid',
            defaultColorFormat: 'hex',
            colorFormat: 'hex',
            color: '#000000',
            opacity: 1,
            visible: true,
            gradient: null
          }
        ]
      },
      { undoable: false }
    )
    core?.selectElements?.([selectedId], { undoable: false })
  }, starCount)

  await clearVectorOverlayState(page)
}

const createSeparateSelfIntersectingStarVectors = async (
  page: Page,
  starCount: number
) => {
  await page.evaluate((count) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const starOrder = [0, 2, 4, 1, 3]

    for (let starIndex = 0; starIndex < count; starIndex += 1) {
      const points: Record<string, unknown> = {}
      const segments: Record<string, unknown> = {}
      const pointIds: string[] = []
      const segmentIds: string[] = []
      const radius = 34
      const localCenter = { x: radius + 8, y: radius + 8 }

      starOrder.forEach((outerPointIndex, pointIndex) => {
        const angle = -Math.PI / 2 + (outerPointIndex * Math.PI * 2) / 5
        const pointId = `separate-star-${starIndex}-p-${pointIndex}`
        points[pointId] = {
          id: pointId,
          kind: 'anchor',
          x: localCenter.x + Math.cos(angle) * radius,
          y: localCenter.y + Math.sin(angle) * radius,
          anchorType: 'sharp'
        }
        pointIds.push(pointId)
      })

      pointIds.forEach((startId, pointIndex) => {
        const endId = pointIds[(pointIndex + 1) % pointIds.length]
        const segmentId = `separate-star-${starIndex}-s-${pointIndex}`
        segments[segmentId] = {
          id: segmentId,
          startId,
          endId,
          outControlId: null,
          inControlId: null
        }
        segmentIds.push(segmentId)
      })

      const x = 160 + (starIndex % 4) * 96
      const y = 120 + Math.floor(starIndex / 4) * 96
      core?.createElement?.(
        {
          type: 'vector',
          x,
          y,
          width: 84,
          height: 84,
          points,
          segments,
          networks: {
            [`separate-star-network-${starIndex}`]: {
              id: `separate-star-network-${starIndex}`,
              pointIds,
              segmentIds,
              closed: true
            }
          },
          closed: true,
          fills: [
            {
              kind: 'solid',
              defaultColorFormat: 'hex',
              colorFormat: 'hex',
              color: '#000000',
              opacity: 1,
              visible: true,
              gradient: null
            }
          ],
          strokes: [
            {
              id: `separate-star-stroke-${starIndex}`,
              style: 'dashed',
              position: 'inside',
              width: 6,
              dashPattern: [18, 10],
              dashOffset: 0,
              color: '#000000',
              opacity: 1,
              visible: true,
              joinType: 'round',
              capType: 'round',
              miterAngle: 28.96
            }
          ]
        },
        undefined,
        undefined,
        { undoable: false }
      )
    }
    core?.selectElements?.([], { undoable: false })
  }, starCount)
}

const createMixedDashedStarAndOpenPathVectors = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const starOrder = [0, 2, 4, 1, 3]
    const strokePositions = [
      'inside',
      'center',
      'outside',
      'inside',
      'center',
      'outside',
      'inside',
      'center',
      'outside',
      'inside'
    ]

    strokePositions.forEach((position, starIndex) => {
      const points: Record<string, unknown> = {}
      const segments: Record<string, unknown> = {}
      const pointIds: string[] = []
      const segmentIds: string[] = []
      const radius = 34
      const localCenter = { x: radius + 8, y: radius + 8 }

      starOrder.forEach((outerPointIndex, pointIndex) => {
        const angle = -Math.PI / 2 + (outerPointIndex * Math.PI * 2) / 5
        const pointId = `mixed-star-${starIndex}-p-${pointIndex}`
        points[pointId] = {
          id: pointId,
          kind: 'anchor',
          x: localCenter.x + Math.cos(angle) * radius,
          y: localCenter.y + Math.sin(angle) * radius,
          anchorType: 'sharp'
        }
        pointIds.push(pointId)
      })

      pointIds.forEach((startId, pointIndex) => {
        const endId = pointIds[(pointIndex + 1) % pointIds.length]
        const segmentId = `mixed-star-${starIndex}-s-${pointIndex}`
        segments[segmentId] = {
          id: segmentId,
          startId,
          endId,
          outControlId: null,
          inControlId: null
        }
        segmentIds.push(segmentId)
      })

      core?.createElement?.(
        {
          type: 'vector',
          x: 120 + (starIndex % 5) * 104,
          y: 120 + Math.floor(starIndex / 5) * 104,
          width: 84,
          height: 84,
          points,
          segments,
          networks: {
            [`mixed-star-network-${starIndex}`]: {
              id: `mixed-star-network-${starIndex}`,
              pointIds,
              segmentIds,
              closed: true
            }
          },
          closed: true,
          fills: [
            {
              kind: 'solid',
              defaultColorFormat: 'hex',
              colorFormat: 'hex',
              color: '#000000',
              opacity: 1,
              visible: true,
              gradient: null
            }
          ],
          strokes: [
            {
              id: `mixed-star-stroke-${starIndex}`,
              style: 'dashed',
              position,
              width: 6,
              dashPattern: [18, 10],
              dashOffset: 0,
              color: '#000000',
              opacity: 1,
              visible: true,
              joinType: 'round',
              capType: 'round',
              miterAngle: 28.96
            }
          ]
        },
        undefined,
        undefined,
        { undoable: false }
      )
    })

    const openPointIds = ['open-p-0', 'open-p-1', 'open-p-2']
    const openSegmentIds = ['open-s-0', 'open-s-1']
    core?.createElement?.(
      {
        type: 'vector',
        x: 140,
        y: 360,
        width: 260,
        height: 96,
        points: {
          [openPointIds[0]]: {
            id: openPointIds[0],
            kind: 'anchor',
            x: 0,
            y: 78,
            anchorType: 'sharp'
          },
          [openPointIds[1]]: {
            id: openPointIds[1],
            kind: 'anchor',
            x: 120,
            y: 8,
            anchorType: 'sharp'
          },
          [openPointIds[2]]: {
            id: openPointIds[2],
            kind: 'anchor',
            x: 240,
            y: 78,
            anchorType: 'sharp'
          }
        },
        segments: {
          [openSegmentIds[0]]: {
            id: openSegmentIds[0],
            startId: openPointIds[0],
            endId: openPointIds[1],
            outControlId: null,
            inControlId: null
          },
          [openSegmentIds[1]]: {
            id: openSegmentIds[1],
            startId: openPointIds[1],
            endId: openPointIds[2],
            outControlId: null,
            inControlId: null
          }
        },
        networks: {
          'mixed-open-network': {
            id: 'mixed-open-network',
            pointIds: openPointIds,
            segmentIds: openSegmentIds,
            closed: false
          }
        },
        closed: false,
        fills: [],
        strokes: [
          {
            id: 'mixed-open-stroke',
            style: 'dashed',
            position: 'center',
            width: 6,
            dashPattern: [18, 10],
            dashOffset: 0,
            color: '#000000',
            opacity: 1,
            visible: true,
            joinType: 'round',
            capType: 'round',
            miterAngle: 28.96
          }
        ]
      },
      undefined,
      undefined,
      { undoable: false }
    )
    core?.selectElements?.([], { undoable: false })
  })
}

const configureSelectedVectorInsideDashedStroke = async (page: Page) => {
  const propertiesPanel = getPropertiesPanel(page)
  await expect(
    propertiesPanel.getByTestId('prop-strokes-section')
  ).toBeVisible()
  if (!(await propertiesPanel.getByTestId('prop-stroke-style-0').isVisible())) {
    await propertiesPanel.getByTestId('prop-stroke-add').click()
  }
  await expect(propertiesPanel.getByTestId('prop-stroke-style-0')).toBeVisible()

  await propertiesPanel
    .getByTestId('prop-stroke-style-0')
    .selectOption('dashed')
  await propertiesPanel
    .getByTestId('prop-stroke-position-0')
    .selectOption('inside')
  await propertiesPanel.getByTestId('prop-stroke-join-0').selectOption('round')
  await propertiesPanel.getByTestId('prop-stroke-cap-0').selectOption('round')
  await propertiesPanel.getByTestId('prop-stroke-width-0').fill('6')
  await propertiesPanel.getByTestId('prop-stroke-width-0').press('Enter')
  await fillStrokeDashGap(propertiesPanel, 0, '18, 10')
}

const configureSelectedVectorInsideSolidStroke = async (page: Page) => {
  const propertiesPanel = getPropertiesPanel(page)
  await expect(
    propertiesPanel.getByTestId('prop-strokes-section')
  ).toBeVisible()
  if (!(await propertiesPanel.getByTestId('prop-stroke-style-0').isVisible())) {
    await propertiesPanel.getByTestId('prop-stroke-add').click()
  }
  await expect(propertiesPanel.getByTestId('prop-stroke-style-0')).toBeVisible()

  await propertiesPanel.getByTestId('prop-stroke-style-0').selectOption('solid')
  await propertiesPanel
    .getByTestId('prop-stroke-position-0')
    .selectOption('inside')
  await propertiesPanel.getByTestId('prop-stroke-join-0').selectOption('round')
  await propertiesPanel.getByTestId('prop-stroke-cap-0').selectOption('round')
  await propertiesPanel.getByTestId('prop-stroke-width-0').fill('6')
  await propertiesPanel.getByTestId('prop-stroke-width-0').press('Enter')
}

const saveCurrentFileToLocalStorage = async (page: Page) => {
  await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    localStorage.setItem('FILE', JSON.stringify(await core.save()))
  })
}

const getVectorStrokeRenderSnapshot = async (
  page: Page
): Promise<VectorStrokeRenderSnapshot | null> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const elements = core?.deps?.sceneTree?.getAllElements?.()
    let vectorId: string | null = null
    elements?.forEach?.(
      (element: { get?: (key: string) => unknown } | undefined, id: string) => {
        if (element?.get?.('type') === 'vector') {
          vectorId = id
        }
      }
    )
    if (!vectorId) {
      return null
    }

    const root = core?.deps?.render?.viewport?.view as
      | { label?: string; children?: unknown[] }
      | undefined
    const stack: { label?: string; children?: unknown[] }[] = root ? [root] : []
    let renderObjectCount = 0
    while (stack.length > 0) {
      const current = stack.pop()
      if (!current) {
        continue
      }
      if (current.label === vectorId) {
        renderObjectCount += 1
      }
      current.children?.forEach((child: unknown) =>
        stack.push(child as { label?: string; children?: unknown[] })
      )
    }

    const renderElement = core?.deps?.render?.getElementById?.(vectorId) as
      | {
          __asyraStrokeMeshCache?: Map<string, unknown>
          __asyraConstrainedSolidRuntimeDiagnostics?: {
            acceptedCount?: number
            blockedCount?: number
          }
          __asyraConstrainedDashedRuntimeDiagnostics?: {
            acceptedCount?: number
            blockedCount?: number
          }
          __asyraVectorPathTopologyModelCount?: number
          __asyraVectorPathGeometryModelCount?: number
        }
      | undefined
    const element = core?.deps?.sceneTree?.getElementById?.(vectorId)
    const computed = element?.getAllComputedData?.() ?? {}
    const strokes = Array.isArray(computed.strokes) ? computed.strokes : []
    const firstStroke = strokes[0] as
      | {
          style?: unknown
          position?: unknown
        }
      | undefined

    return {
      vectorId,
      renderObjectCount,
      computedStrokeCount: strokes.length,
      computedStrokeStyle:
        typeof firstStroke?.style === 'string' ? firstStroke.style : null,
      computedStrokePosition:
        typeof firstStroke?.position === 'string' ? firstStroke.position : null,
      strokeCacheSize: renderElement?.__asyraStrokeMeshCache?.size ?? 0,
      acceptedConstrainedSolidCount:
        renderElement?.__asyraConstrainedSolidRuntimeDiagnostics
          ?.acceptedCount ?? 0,
      blockedConstrainedSolidCount:
        renderElement?.__asyraConstrainedSolidRuntimeDiagnostics
          ?.blockedCount ?? 0,
      acceptedConstrainedDashedCount:
        renderElement?.__asyraConstrainedDashedRuntimeDiagnostics
          ?.acceptedCount ?? 0,
      blockedConstrainedDashedCount:
        renderElement?.__asyraConstrainedDashedRuntimeDiagnostics
          ?.blockedCount ?? 0,
      topologyModelCount:
        renderElement?.__asyraVectorPathTopologyModelCount ?? 0,
      geometryModelCount:
        renderElement?.__asyraVectorPathGeometryModelCount ?? 0
    }
  })

const getSelectedVectorTopologySnapshot = async (page: Page) =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      return null
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    if (element?.get?.('type') !== 'vector') {
      return null
    }

    const computed = element?.getAllComputedData?.() ?? {}
    const networks = Object.values(computed.networks ?? {}) as {
      closed?: boolean
      pointIds?: unknown[]
      segmentIds?: unknown[]
    }[]
    const firstNetwork = networks[0]

    return {
      vectorId: selectedId,
      pointCount: Object.keys(computed.points ?? {}).length,
      segmentCount: Object.keys(computed.segments ?? {}).length,
      networkCount: networks.length,
      firstNetworkClosed: firstNetwork?.closed === true,
      firstNetworkPointCount: firstNetwork?.pointIds?.length ?? 0,
      firstNetworkSegmentCount: firstNetwork?.segmentIds?.length ?? 0
    }
  })

const getVectorStrokeRenderSummary = async (
  page: Page
): Promise<VectorStrokeRenderSummary> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const elements = core?.deps?.sceneTree?.getAllElements?.()
    const vectorIds: string[] = []
    elements?.forEach?.(
      (element: { get?: (key: string) => unknown } | undefined, id: string) => {
        if (element?.get?.('type') === 'vector') {
          vectorIds.push(id)
        }
      }
    )
    const vectorIdSet = new Set(vectorIds)

    const root = core?.deps?.render?.viewport?.view as
      | { label?: string; children?: unknown[] }
      | undefined
    const stack: { label?: string; children?: unknown[] }[] = root ? [root] : []
    let renderObjectCount = 0
    while (stack.length > 0) {
      const current = stack.pop()
      if (!current) {
        continue
      }
      if (current.label && vectorIdSet.has(current.label)) {
        renderObjectCount += 1
      }
      current.children?.forEach((child: unknown) =>
        stack.push(child as { label?: string; children?: unknown[] })
      )
    }

    return vectorIds.reduce<VectorStrokeRenderSummary>(
      (summary, vectorId) => {
        const renderElement = core?.deps?.render?.getElementById?.(vectorId) as
          | {
              __asyraStrokeMeshCache?: Map<string, unknown>
              __asyraConstrainedDashedRuntimeDiagnostics?: {
                acceptedCount?: number
                blockedCount?: number
              }
              __asyraVectorPathTopologyModelCount?: number
              __asyraVectorPathGeometryModelCount?: number
            }
          | undefined
        const element = core?.deps?.sceneTree?.getElementById?.(vectorId)
        const computed = element?.getAllComputedData?.() ?? {}
        const strokes = Array.isArray(computed.strokes) ? computed.strokes : []
        strokes.forEach((stroke: { style?: unknown; position?: unknown }) => {
          if (stroke.style !== 'dashed') {
            return
          }
          if (stroke.position === 'center') {
            summary.dashedCenterCount += 1
          } else if (stroke.position === 'inside') {
            summary.dashedInsideCount += 1
          } else if (stroke.position === 'outside') {
            summary.dashedOutsideCount += 1
          }
        })

        const networks = Object.values(computed.networks ?? {}) as {
          closed?: boolean
        }[]
        if (networks.some((network) => network.closed === false)) {
          summary.openVectorCount += 1
        } else if (networks.length > 0) {
          summary.closedVectorCount += 1
        }

        summary.totalStrokeCacheSize +=
          renderElement?.__asyraStrokeMeshCache?.size ?? 0
        summary.acceptedConstrainedDashedCount +=
          renderElement?.__asyraConstrainedDashedRuntimeDiagnostics
            ?.acceptedCount ?? 0
        summary.blockedConstrainedDashedCount +=
          renderElement?.__asyraConstrainedDashedRuntimeDiagnostics
            ?.blockedCount ?? 0
        summary.topologyModelCount +=
          renderElement?.__asyraVectorPathTopologyModelCount ?? 0
        summary.geometryModelCount +=
          renderElement?.__asyraVectorPathGeometryModelCount ?? 0
        return summary
      },
      {
        vectorCount: vectorIds.length,
        renderObjectCount,
        dashedCenterCount: 0,
        dashedInsideCount: 0,
        dashedOutsideCount: 0,
        closedVectorCount: 0,
        openVectorCount: 0,
        totalStrokeCacheSize: 0,
        acceptedConstrainedDashedCount: 0,
        blockedConstrainedDashedCount: 0,
        topologyModelCount: 0,
        geometryModelCount: 0
      }
    )
  })

test.describe('vector stroke refresh rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(
        window as typeof window & {
          __ASYRA_STROKE_DIAGNOSTICS_MODE__?: 'full'
        }
      ).__ASYRA_STROKE_DIAGNOSTICS_MODE__ = 'full'
    })
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test('should run: keep inside dashed vector stroke render geometry after refresh', async ({
    page
  }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })

    await createVectorPath(page, 0.32, 0.32, 0.12, 0.12)
    await patchSelectedVectorToSimpleStar(page)
    await configureSelectedVectorInsideDashedStroke(page)

    await expect
      .poll(() => getVectorStrokeRenderSnapshot(page))
      .toMatchObject({
        renderObjectCount: 1,
        computedStrokeCount: 1,
        computedStrokeStyle: 'dashed',
        computedStrokePosition: 'inside',
        acceptedConstrainedDashedCount: 1,
        blockedConstrainedDashedCount: 0,
        topologyModelCount: 1,
        geometryModelCount: 1
      })
    const beforeReload = await getVectorStrokeRenderSnapshot(page)
    expect(beforeReload?.strokeCacheSize).toBeGreaterThan(0)

    await saveCurrentFileToLocalStorage(page)
    await page.reload()
    await waitForAppReady(page)

    await expect
      .poll(() => getVectorStrokeRenderSnapshot(page))
      .toMatchObject({
        vectorId: beforeReload?.vectorId,
        renderObjectCount: 1,
        computedStrokeCount: 1,
        computedStrokeStyle: 'dashed',
        computedStrokePosition: 'inside',
        acceptedConstrainedDashedCount: 1,
        blockedConstrainedDashedCount: 0,
        topologyModelCount: 1,
        geometryModelCount: 1
      })
    const afterReload = await getVectorStrokeRenderSnapshot(page)
    expect(afterReload?.strokeCacheSize).toBeGreaterThan(0)
    expect(consoleErrors).toEqual([])
  })

  test('should run: keep an actually pen-drawn self-intersecting inside dashed star visible after refresh', async ({
    page
  }) => {
    test.setTimeout(20_000)
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })

    await drawSelfIntersectingStarWithPen(page)
    await expect
      .poll(() => getSelectedVectorTopologySnapshot(page))
      .toMatchObject({
        pointCount: 5,
        segmentCount: 5,
        networkCount: 1,
        firstNetworkClosed: true,
        firstNetworkPointCount: 5,
        firstNetworkSegmentCount: 5
      })
    await configureSelectedVectorInsideDashedStroke(page)

    await expect
      .poll(() => getVectorStrokeRenderSnapshot(page))
      .toMatchObject({
        renderObjectCount: 1,
        computedStrokeCount: 1,
        computedStrokeStyle: 'dashed',
        computedStrokePosition: 'inside',
        acceptedConstrainedDashedCount: 1,
        blockedConstrainedDashedCount: 0,
        topologyModelCount: 1,
        geometryModelCount: 1
      })
    const beforeReload = await getVectorStrokeRenderSnapshot(page)
    expect(beforeReload?.strokeCacheSize).toBeGreaterThan(0)

    await saveCurrentFileToLocalStorage(page)
    const reloadStart = Date.now()
    await page.reload()
    await waitForAppReady(page)
    const reloadElapsedMs = Date.now() - reloadStart

    await expect
      .poll(() => getVectorStrokeRenderSnapshot(page))
      .toMatchObject({
        vectorId: beforeReload?.vectorId,
        renderObjectCount: 1,
        computedStrokeCount: 1,
        computedStrokeStyle: 'dashed',
        computedStrokePosition: 'inside',
        acceptedConstrainedDashedCount: 1,
        blockedConstrainedDashedCount: 0,
        topologyModelCount: 1,
        geometryModelCount: 1
      })
    const afterReload = await getVectorStrokeRenderSnapshot(page)
    expect(afterReload?.strokeCacheSize).toBeGreaterThan(0)
    expect(reloadElapsedMs).toBeLessThan(5_000)
    expect(consoleErrors).toEqual([])
  })

  test('should run: keep an actually pen-drawn self-intersecting inside solid star fast after refresh', async ({
    page
  }) => {
    test.setTimeout(20_000)
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })

    await drawSelfIntersectingStarWithPen(page)
    await expect
      .poll(() => getSelectedVectorTopologySnapshot(page))
      .toMatchObject({
        pointCount: 5,
        segmentCount: 5,
        networkCount: 1,
        firstNetworkClosed: true,
        firstNetworkPointCount: 5,
        firstNetworkSegmentCount: 5
      })
    await configureSelectedVectorInsideSolidStroke(page)

    await expect
      .poll(() => getVectorStrokeRenderSnapshot(page))
      .toMatchObject({
        renderObjectCount: 1,
        computedStrokeCount: 1,
        computedStrokeStyle: 'solid',
        computedStrokePosition: 'inside',
        acceptedConstrainedSolidCount: 1,
        blockedConstrainedSolidCount: 0,
        topologyModelCount: 1,
        geometryModelCount: 1
      })
    const beforeReload = await getVectorStrokeRenderSnapshot(page)
    expect(beforeReload?.strokeCacheSize).toBeGreaterThan(0)

    await saveCurrentFileToLocalStorage(page)
    const reloadStart = Date.now()
    await page.reload()
    await waitForAppReady(page)
    const reloadElapsedMs = Date.now() - reloadStart

    await expect
      .poll(() => getVectorStrokeRenderSnapshot(page))
      .toMatchObject({
        vectorId: beforeReload?.vectorId,
        renderObjectCount: 1,
        computedStrokeCount: 1,
        computedStrokeStyle: 'solid',
        computedStrokePosition: 'inside',
        acceptedConstrainedSolidCount: 1,
        blockedConstrainedSolidCount: 0,
        topologyModelCount: 1,
        geometryModelCount: 1
      })
    const afterReload = await getVectorStrokeRenderSnapshot(page)
    expect(afterReload?.strokeCacheSize).toBeGreaterThan(0)
    expect(reloadElapsedMs).toBeLessThan(2_000)
    expect(consoleErrors).toEqual([])
  })

  test('should run: keep many self-intersecting inside dashed star networks visible after refresh', async ({
    page
  }) => {
    test.setTimeout(45_000)
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })

    await createVectorPath(page, 0.32, 0.32, 0.12, 0.12)
    await patchSelectedVectorToSelfIntersectingStarNetworks(page, 12)
    await configureSelectedVectorInsideDashedStroke(page)

    await expect
      .poll(() => getVectorStrokeRenderSnapshot(page))
      .toMatchObject({
        renderObjectCount: 1,
        computedStrokeCount: 1,
        computedStrokeStyle: 'dashed',
        computedStrokePosition: 'inside',
        acceptedConstrainedDashedCount: 12,
        blockedConstrainedDashedCount: 0,
        topologyModelCount: 12,
        geometryModelCount: 12
      })
    const beforeReload = await getVectorStrokeRenderSnapshot(page)
    expect(beforeReload?.strokeCacheSize).toBeGreaterThan(0)

    await saveCurrentFileToLocalStorage(page)
    const reloadStart = Date.now()
    await page.reload()
    await waitForAppReady(page)
    const reloadElapsedMs = Date.now() - reloadStart

    await expect
      .poll(() => getVectorStrokeRenderSnapshot(page))
      .toMatchObject({
        vectorId: beforeReload?.vectorId,
        renderObjectCount: 1,
        computedStrokeCount: 1,
        computedStrokeStyle: 'dashed',
        computedStrokePosition: 'inside',
        acceptedConstrainedDashedCount: 12,
        blockedConstrainedDashedCount: 0,
        topologyModelCount: 12,
        geometryModelCount: 12
      })
    const afterReload = await getVectorStrokeRenderSnapshot(page)
    expect(afterReload?.strokeCacheSize).toBeGreaterThan(0)
    expect(reloadElapsedMs).toBeLessThan(5_000)
    expect(consoleErrors).toEqual([])
  })

  test('should run: keep many separate self-intersecting inside dashed star vectors visible after refresh', async ({
    page
  }) => {
    test.setTimeout(20_000)
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })

    await createSeparateSelfIntersectingStarVectors(page, 12)
    expect((await getVectorStrokeRenderSummary(page)).vectorCount).toBe(12)

    await saveCurrentFileToLocalStorage(page)
    const reloadStart = Date.now()
    await page.reload()
    await waitForAppReady(page)
    const reloadElapsedMs = Date.now() - reloadStart

    await expect
      .poll(() => getVectorStrokeRenderSummary(page))
      .toMatchObject({
        vectorCount: 12,
        renderObjectCount: 12,
        acceptedConstrainedDashedCount: 12,
        blockedConstrainedDashedCount: 0,
        topologyModelCount: 12,
        geometryModelCount: 12
      })
    const afterReload = await getVectorStrokeRenderSummary(page)
    expect(afterReload.totalStrokeCacheSize).toBeGreaterThan(0)
    expect(reloadElapsedMs).toBeLessThan(5_000)
    expect(consoleErrors).toEqual([])
  })

  test('should run: keep mixed dashed star positions and a three-point open path after refresh', async ({
    page
  }) => {
    test.setTimeout(20_000)
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })

    await createMixedDashedStarAndOpenPathVectors(page)

    await expect
      .poll(() => getVectorStrokeRenderSummary(page))
      .toMatchObject({
        vectorCount: 11,
        dashedCenterCount: 4,
        dashedInsideCount: 4,
        dashedOutsideCount: 3,
        closedVectorCount: 10,
        openVectorCount: 1
      })

    await saveCurrentFileToLocalStorage(page)
    const reloadStart = Date.now()
    await page.reload()
    await waitForAppReady(page)
    const reloadElapsedMs = Date.now() - reloadStart

    await expect
      .poll(() => getVectorStrokeRenderSummary(page))
      .toMatchObject({
        vectorCount: 11,
        renderObjectCount: 11,
        dashedCenterCount: 4,
        dashedInsideCount: 4,
        dashedOutsideCount: 3,
        closedVectorCount: 10,
        openVectorCount: 1,
        acceptedConstrainedDashedCount: 7,
        blockedConstrainedDashedCount: 0,
        topologyModelCount: 11,
        geometryModelCount: 11
      })
    const afterReload = await getVectorStrokeRenderSummary(page)
    expect(afterReload.totalStrokeCacheSize).toBeGreaterThan(0)
    expect(reloadElapsedMs).toBeLessThan(5_000)
    if (process.env.ASYRA_STROKE_E2E_METRICS === '1') {
      console.info(
        `mixed dashed stroke render metrics: reloadElapsedMs=${reloadElapsedMs}, renderObjectCount=${afterReload.renderObjectCount}, totalStrokeCacheSize=${afterReload.totalStrokeCacheSize}, topologyModelCount=${afterReload.topologyModelCount}, geometryModelCount=${afterReload.geometryModelCount}`
      )
    }
    expect(consoleErrors).toEqual([])
  })
})
