import { expect, test, type Page } from '@playwright/test'
import { resetCanvas, waitForAppReady } from './test-utils'

interface ParameterSwitchSample {
  label: string
  elapsedMs: number
  visible: boolean
  productOutputCount: number
  counters: Record<string, number>
}

const SHOULD_ENFORCE_PARAMETER_E2E =
  process.env.ASYRA_STROKE_PARAMETER_SWITCH_E2E_ENFORCE === '1'
const PARAMETER_E2E_P95_BUDGET_MS = Number(
  process.env.ASYRA_STROKE_PARAMETER_SWITCH_E2E_P95_BUDGET_MS ?? 50
)
const PARAMETER_E2E_ACTION_BUDGET_MS = Number(
  process.env.ASYRA_STROKE_PARAMETER_SWITCH_E2E_ACTION_BUDGET_MS ?? 100
)

const getPercentile = (values: number[], percentile: number) => {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * percentile) - 1)
  )
  return sorted[index] ?? 0
}

const installCounterSink = async (page: Page) => {
  await page.evaluate(() => {
    const target = window as typeof window & {
      __asyraStrokeParameterSwitchCounters?: Record<string, number>
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value?: number
      ) => void
    }
    target.__asyraStrokeParameterSwitchCounters = {}
    target.__asyraStrokePipelineCounterSink = (counterName, value = 1) => {
      const counters = target.__asyraStrokeParameterSwitchCounters ?? {}
      counters[counterName] = (counters[counterName] ?? 0) + value
      target.__asyraStrokeParameterSwitchCounters = counters
    }
  })
}

const createSelfIntersectingStrokeVector = async (page: Page) =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elementApis = (window as any).__AsyraE2E__?.elementApis
    if (!core || !elementApis) {
      throw new Error('Missing E2E core or element APIs')
    }
    const starOrder = [0, 2, 4, 1, 3]
    const center = { x: 120, y: 120 }
    const radius = 104
    const pointIds: string[] = []
    const segmentIds: string[] = []
    const points: Record<string, unknown> = {}
    const segments: Record<string, unknown> = {}

    starOrder.forEach((outerPointIndex, pointIndex) => {
      const angle = -Math.PI / 2 + (outerPointIndex * Math.PI * 2) / 5
      const pointId = `parameter-star-p-${pointIndex}`
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
      const segmentId = `parameter-star-s-${pointIndex}`
      segments[segmentId] = {
        id: segmentId,
        startId,
        endId,
        outControlId: null,
        inControlId: null
      }
      segmentIds.push(segmentId)
    })

    const vectorId = elementApis.createElement(
      {
        type: 'vector',
        points,
        segments,
        networks: {
          'parameter-star-network': {
            id: 'parameter-star-network',
            pointIds,
            segmentIds,
            closed: true
          }
        },
        closed: true
      },
      { undoable: false }
    )
    if (!vectorId) {
      throw new Error('Failed to create parameter switch vector')
    }

    elementApis.changeComputedData(
      [vectorId],
      {
        x: 280,
        y: 130,
        width: 240,
        height: 240,
        points,
        segments,
        networks: {
          'parameter-star-network': {
            id: 'parameter-star-network',
            pointIds,
            segmentIds,
            closed: true
          }
        },
        closed: true,
        fills: [],
        strokes: [
          {
            id: 'parameter-star-stroke',
            kind: 'solid',
            style: 'dashed',
            position: 'inside',
            width: 14,
            dash: 22,
            gap: 14,
            color: '#b51212',
            opacity: 72,
            visible: true,
            fill: null,
            defaultColorFormat: 'hex',
            colorFormat: 'hex',
            gradient: null,
            joinType: 'miter',
            capType: 'butt',
            miterAngle: 28.96
          }
        ]
      },
      { undoable: false }
    )

    core?.selectElements?.([vectorId], { undoable: false })
    return vectorId as string
  })

const measureParameterSwitch = async (
  page: Page,
  label: string,
  field: string,
  value: unknown
): Promise<ParameterSwitchSample> =>
  page.evaluate(
    async ({ label, field, value }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const target = window as typeof window & {
        __asyraStrokeParameterSwitchCounters?: Record<string, number>
      }
      target.__asyraStrokeParameterSwitchCounters = {}

      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!selectedId) {
        throw new Error('No selected vector for stroke parameter switch')
      }
      const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const computed = element?.getAllComputedData?.() ?? {}
      const stroke = Array.isArray(computed.strokes)
        ? computed.strokes[0]
        : undefined
      if (!stroke?.id) {
        throw new Error('No selected vector stroke for parameter switch')
      }

      const start = performance.now()
      core.updatePropertyById(
        stroke.id,
        field,
        value,
        {
          ownerElementId: selectedId,
          ownerPropertyName: 'strokes'
        },
        { undoable: false }
      )
      core.commitPropertyChanges?.({ undoable: false })

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            resolve()
          })
        )
      )
      const elapsedMs = performance.now() - start

      const nextElement = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const nextComputed = nextElement?.getAllComputedData?.() ?? {}
      const nextStroke = Array.isArray(nextComputed.strokes)
        ? nextComputed.strokes[0]
        : undefined
      const renderElement = core?.deps?.render?.getElementById?.(selectedId) as
        | {
            __asyraStrokeMeshCache?: Map<string, unknown>
            __asyraStrokePipelineStageCache?: {
              products?: Map<string, unknown>
            }
            __asyraSolidCenterStrokeExportPackets?: unknown[]
            __asyraCenterPathSolidStrokeRenderCount?: number
            __asyraCenterSolidPathMaskRenderCount?: number
            hitArea?: unknown
          }
        | undefined
      const root = core?.deps?.render?.viewport?.view as
        | { label?: string; children?: unknown[] }
        | undefined
      const stack: { label?: string; children?: unknown[] }[] = root
        ? [root]
        : []
      let renderObjectCount = 0
      while (stack.length > 0) {
        const current = stack.pop()
        if (!current) {
          continue
        }
        if (current.label === selectedId) {
          renderObjectCount += 1
        }
        current.children?.forEach((child: unknown) =>
          stack.push(child as { label?: string; children?: unknown[] })
        )
      }

      const counters = target.__asyraStrokeParameterSwitchCounters ?? {}
      const productOutputCount =
        renderObjectCount +
        (renderElement?.__asyraStrokeMeshCache?.size ?? 0) +
        (renderElement?.__asyraStrokePipelineStageCache?.products?.size ?? 0) +
        (renderElement?.__asyraSolidCenterStrokeExportPackets?.length ?? 0) +
        (renderElement?.__asyraCenterPathSolidStrokeRenderCount ?? 0) +
        (renderElement?.__asyraCenterSolidPathMaskRenderCount ?? 0) +
        (renderElement?.hitArea ? 1 : 0) +
        (counters['stroke-stage-cache:product-geometry-hit'] ?? 0) +
        (counters['stroke-stage-cache:product-geometry-store'] ?? 0) +
        (counters['visual-overlap-collapse-no-union-backend'] ?? 0)

      return {
        label,
        elapsedMs,
        visible: nextStroke?.visible !== false,
        productOutputCount,
        counters
      }
    },
    { label, field, value }
  )

test.describe('stroke parameter switch performance UX gate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
    await installCounterSink(page)
    await createSelfIntersectingStrokeVector(page)
    await page.waitForTimeout(120)
  })

  test('should run: keep static stroke parameter switches on cached product stages', async ({
    page
  }) => {
    const samples: ParameterSwitchSample[] = []
    const switches: { label: string; field: string; value: unknown }[] = [
      { label: 'cap-square', field: 'capType', value: 'square' },
      { label: 'cap-round', field: 'capType', value: 'round' },
      { label: 'cap-butt', field: 'capType', value: 'butt' },
      { label: 'join-bevel', field: 'joinType', value: 'bevel' },
      { label: 'join-round', field: 'joinType', value: 'round' },
      { label: 'join-miter', field: 'joinType', value: 'miter' },
      { label: 'miter-low', field: 'miterAngle', value: 12 },
      { label: 'miter-high', field: 'miterAngle', value: 60 },
      { label: 'width-wide', field: 'width', value: 22 },
      { label: 'width-base', field: 'width', value: 14 },
      { label: 'position-outside', field: 'position', value: 'outside' },
      { label: 'position-center', field: 'position', value: 'center' },
      { label: 'position-inside', field: 'position', value: 'inside' },
      { label: 'style-solid', field: 'style', value: 'solid' },
      { label: 'style-dashed', field: 'style', value: 'dashed' },
      { label: 'dash-a', field: 'dash', value: 16 },
      { label: 'dash-b', field: 'dash', value: 22 },
      { label: 'gap-a', field: 'gap', value: 20 },
      { label: 'gap-b', field: 'gap', value: 14 },
      { label: 'paint-green', field: 'color', value: '#18a86f' },
      { label: 'paint-red', field: 'color', value: '#b51212' },
      { label: 'opacity-low', field: 'opacity', value: 48 },
      { label: 'opacity-high', field: 'opacity', value: 72 },
      { label: 'visible-off', field: 'visible', value: false },
      { label: 'visible-on', field: 'visible', value: true },
      { label: 'cap-square-warm', field: 'capType', value: 'square' },
      { label: 'cap-round-warm', field: 'capType', value: 'round' },
      { label: 'join-bevel-warm', field: 'joinType', value: 'bevel' },
      { label: 'join-round-warm', field: 'joinType', value: 'round' }
    ]

    for (const parameterSwitch of switches) {
      samples.push(
        await measureParameterSwitch(
          page,
          parameterSwitch.label,
          parameterSwitch.field,
          parameterSwitch.value
        )
      )
    }

    const visibleInvalidSamples = samples.filter(
      (sample) => sample.visible && sample.productOutputCount === 0
    )
    const elapsedMs = samples.map((sample) => sample.elapsedMs)
    const p95Ms = getPercentile(elapsedMs, 0.95)
    const maxMs = Math.max(...elapsedMs)
    const aggregateCounters = samples.reduce<Record<string, number>>(
      (counters, sample) => {
        Object.entries(sample.counters).forEach(([counterName, value]) => {
          counters[counterName] = (counters[counterName] ?? 0) + value
        })
        return counters
      },
      {}
    )

    process.stdout.write(
      `STROKE_PARAMETER_SWITCH_E2E ${JSON.stringify({
        sampleCount: samples.length,
        p95Ms,
        maxMs,
        visibleInvalidCount: visibleInvalidSamples.length,
        counters: aggregateCounters,
        samples
      })}\n`
    )

    expect(visibleInvalidSamples).toEqual([])
    expect(aggregateCounters['render-frame-count'] ?? 0).toBeGreaterThan(0)
    if (SHOULD_ENFORCE_PARAMETER_E2E) {
      expect(p95Ms).toBeLessThanOrEqual(PARAMETER_E2E_P95_BUDGET_MS)
      expect(maxMs).toBeLessThanOrEqual(PARAMETER_E2E_ACTION_BUDGET_MS)
    }
  })
})
