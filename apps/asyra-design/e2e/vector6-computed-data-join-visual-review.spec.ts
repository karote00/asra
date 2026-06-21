import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resetCanvas, waitForAppReady } from './test-utils'

type JoinType = 'miter' | 'bevel' | 'round'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ARTIFACT_DIR = path.resolve(
  __dirname,
  '../../../docs/ai/apps/asyra-design/plans/stroke-engine-final/artifacts'
)

const VECTOR_6_COMPUTED_DATA = {
  id: 'vector-6',
  x: 17.654489349902178,
  y: 55.12887331713321,
  width: 360.12094148356584,
  height: 367.70186652155667,
  points: {
    'tp-12': {
      id: 'tp-12',
      kind: 'anchor',
      x: 188.1928217922337,
      y: 0,
      anchorType: 'smooth',
      handleMode: 'none'
    },
    'tp-13': {
      id: 'tp-13',
      kind: 'anchor',
      x: 11.358174406717296,
      y: 365.76797704068724,
      anchorType: 'smooth',
      handleMode: 'none'
    },
    'tp-12:out': {
      id: 'tp-12:out',
      kind: 'control',
      x: 164.3673966581619,
      y: 140.9198821588739,
      controlForId: 'tp-12',
      controlRole: 'out'
    },
    'tp-13:in': {
      id: 'tp-13:in',
      kind: 'control',
      x: -42.09205809548172,
      y: 344.92238636482955,
      controlForId: 'tp-13',
      controlRole: 'in'
    },
    'tp-13:out': {
      id: 'tp-13:out',
      kind: 'control',
      x: 78.17096503446606,
      y: 391.8249653855095,
      controlForId: 'tp-13',
      controlRole: 'out'
    },
    'tp-14': {
      id: 'tp-14',
      kind: 'anchor',
      x: 360.12094148356584,
      y: 145.95389587539378,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'tp-15': {
      id: 'tp-15',
      kind: 'anchor',
      x: 0,
      y: 15.668954151283657,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'tp-16': {
      id: 'tp-16',
      kind: 'anchor',
      x: 270.59180204238254,
      y: 347.0603956649177,
      anchorType: 'smooth',
      handleMode: 'none'
    },
    'tp-15:out': {
      id: 'tp-15:out',
      kind: 'control',
      x: 0,
      y: 15.668954151283657,
      controlForId: 'tp-15',
      controlRole: 'out'
    },
    'tp-16:in': {
      id: 'tp-16:in',
      kind: 'control',
      x: 263.9105229796075,
      y: 364.43172122813246,
      controlForId: 'tp-16',
      controlRole: 'in'
    },
    'tp-16:out': {
      id: 'tp-16:out',
      kind: 'control',
      x: 277.27308110515736,
      y: 329.6890701017029,
      controlForId: 'tp-16',
      controlRole: 'out'
    }
  },
  segments: {
    'ts-23': {
      id: 'ts-23',
      startId: 'tp-12',
      endId: 'tp-13',
      outControlId: 'tp-12:out',
      inControlId: 'tp-13:in'
    },
    'ts-24': {
      id: 'ts-24',
      startId: 'tp-13',
      endId: 'tp-14',
      outControlId: 'tp-13:out',
      inControlId: null
    },
    'ts-25': {
      id: 'ts-25',
      startId: 'tp-14',
      endId: 'tp-15',
      outControlId: null,
      inControlId: null
    },
    'ts-26': {
      id: 'ts-26',
      startId: 'tp-15',
      endId: 'tp-16',
      outControlId: 'tp-15:out',
      inControlId: 'tp-16:in'
    },
    'ts-27': {
      id: 'ts-27',
      startId: 'tp-16',
      endId: 'tp-12',
      outControlId: 'tp-16:out',
      inControlId: null
    }
  },
  networks: {
    'tn-4': {
      id: 'tn-4',
      pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
      segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
      closed: true
    }
  },
  closed: true,
  fills: [
    {
      id: 'pp-60',
      kind: 'solid',
      defaultColorFormat: 'hex',
      colorFormat: 'hex',
      color: '#cccccc',
      opacity: 1,
      visible: true,
      gradient: null
    }
  ],
  strokes: [
    {
      id: 'pp-41',
      style: 'solid',
      position: 'inside',
      width: 10,
      dashPattern: [27, 20],
      dashOffset: 0,
      fill: {
        id: 'pp-41',
        type: 'fill',
        kind: 'solid',
        defaultColorFormat: 'hex',
        colorFormat: 'hex',
        color: '#df0606',
        opacity: 0.5,
        visible: true,
        gradient: null
      },
      joinType: 'round',
      capType: 'round',
      miterAngle: 28.96
    }
  ]
} as const

const setStrokeDebugDisableVisualOverlapCollapse = async (
  page: Page,
  disabled: boolean
) => {
  await page.evaluate((nextDisabled) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    core?.setSystemProperty?.(
      'strokeDebugDisableVisualOverlapCollapse',
      nextDisabled
    )
  }, disabled)
}

const createVector6ComputedData = async (page: Page, joinType: JoinType) => {
  await page.evaluate(
    ({ computedData, joinType: nextJoinType }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      if (!core || !elementApis) {
        throw new Error('Missing E2E core or element APIs')
      }

      const createdId = elementApis.createElement(
        {
          type: 'vector',
          points: computedData.points,
          segments: computedData.segments,
          networks: computedData.networks,
          closed: computedData.closed
        },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create vector-6 computed data fixture')
      }

      elementApis.changeComputedData(
        [createdId],
        {
          ...computedData,
          strokes: [
            {
              ...computedData.strokes[0],
              joinType: nextJoinType
            }
          ]
        },
        { undoable: false }
      )
      core.selectElements([createdId], { undoable: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__vector6ComputedDataReviewId = createdId
      core.setSystemProperty('zoom', 3.9)
      core.setSystemProperty('viewportPosition', { x: 120, y: 130 })
      core.setSystemProperty('pathEditingVectorId', createdId)
      core.setSystemProperty('pathEditingMode', true)
      core.setSystemProperty('strokeDebugDisableVisualOverlapCollapse', false)
    },
    { computedData: VECTOR_6_COMPUTED_DATA, joinType }
  )
  await page.waitForTimeout(600)
}

const readSelectedComputedData = async (page: Page) =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__vector6ComputedDataReviewId ??
      null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    return element?.getAllComputedData?.() ?? null
  })

const expectComputedDataMatches = (
  actual: Record<string, unknown> | null,
  joinType: JoinType
) => {
  expect(actual).toBeTruthy()
  expect(actual?.x).toBeCloseTo(VECTOR_6_COMPUTED_DATA.x, 8)
  expect(actual?.y).toBeCloseTo(VECTOR_6_COMPUTED_DATA.y, 8)
  expect(actual?.width).toBeCloseTo(VECTOR_6_COMPUTED_DATA.width, 8)
  expect(actual?.height).toBeCloseTo(VECTOR_6_COMPUTED_DATA.height, 8)
  expect(actual?.closed).toBe(true)
  expect(actual?.points).toEqual(VECTOR_6_COMPUTED_DATA.points)
  expect(actual?.segments).toEqual(VECTOR_6_COMPUTED_DATA.segments)
  expect(actual?.networks).toEqual(VECTOR_6_COMPUTED_DATA.networks)
  expect(actual?.fills).toEqual(VECTOR_6_COMPUTED_DATA.fills)
  expect(actual?.strokes).toEqual([
    {
      ...VECTOR_6_COMPUTED_DATA.strokes[0],
      joinType
    }
  ])
}

const captureCanvasScreenshot = async (
  page: Page,
  testInfo: TestInfo,
  joinType: JoinType
) => {
  const canvasRect = await page.evaluate(() => {
    const rect = document.querySelector('canvas')?.getBoundingClientRect()
    if (!rect) {
      throw new Error('Missing app canvas')
    }
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    }
  })
  const screenshotPath = path.join(
    ARTIFACT_DIR,
    `vector6-computed-data-inside-solid-${joinType}-visual-review.png`
  )
  await mkdir(ARTIFACT_DIR, { recursive: true })
  await page.screenshot({
    path: screenshotPath,
    clip: canvasRect
  })
  await testInfo.attach(`vector6-computed-data-${joinType}-visual-review`, {
    path: screenshotPath,
    contentType: 'image/png'
  })

  const metadata = {
    baseUrl:
      process.env.ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL ??
      process.env.PLAYWRIGHT_TEST_BASE_URL ??
      'http://localhost:3000',
    joinType,
    screenshotPath,
    viewport: page.viewportSize(),
    canvasRect,
    computedData: await readSelectedComputedData(page)
  }
  await writeFile(
    path.join(
      ARTIFACT_DIR,
      `vector6-computed-data-inside-solid-${joinType}-visual-review.json`
    ),
    `${JSON.stringify(metadata, null, 2)}\n`
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await waitForAppReady(page)
  await resetCanvas(page)
  await page.setViewportSize({ width: 1600, height: 1600 })
  await setStrokeDebugDisableVisualOverlapCollapse(page, false)
})

test.afterEach(async ({ page }) => {
  await setStrokeDebugDisableVisualOverlapCollapse(page, false)
})
;(['miter', 'bevel', 'round'] as const).forEach((joinType) => {
  test(`visual review: vector-6 computed data inside solid ${joinType}`, async ({
    page
  }, testInfo) => {
    await createVector6ComputedData(page, joinType)
    const computedData = await readSelectedComputedData(page)
    expectComputedDataMatches(computedData, joinType)
    await captureCanvasScreenshot(page, testInfo, joinType)
  })
})
