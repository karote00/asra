import { expect, type Page, type TestInfo } from '@playwright/test'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import type {
  StrokeVisualE2ECoverageCase,
  StrokeVisualRuntimeEvidenceField,
  StrokeVisualRuntimeAssertion
} from './stroke-visual-e2e-coverage-map'
import { requiredVisualReviewBaseUrl } from './stroke-visual-e2e-coverage-map'

export type StrokeJoin = 'miter' | 'bevel' | 'round'

export interface WorkspacePoint {
  x: number
  y: number
}

interface VectorPoint extends WorkspacePoint {
  id: string
  kind: 'anchor' | 'control'
  anchorType?: 'sharp' | 'smooth'
  handleMode?: 'none'
  controlForId?: string
  controlRole?: 'in' | 'out'
}

interface VectorSegment {
  id: string
  startId: string
  endId: string
  outControlId: string | null
  inControlId: string | null
}

interface VectorNetwork {
  id: string
  pointIds: string[]
  segmentIds: string[]
  closed: boolean
}

interface StrokeFill {
  id: string
  type: 'fill'
  kind: 'solid'
  defaultColorFormat: 'hex'
  colorFormat: 'hex'
  color: string
  opacity: number
  visible: boolean
  gradient: null
}

interface StrokeInput {
  id: string
  style: 'solid' | 'dashed'
  position: 'center' | 'inside' | 'outside'
  width: number
  dash: number
  gap: number
  fill: StrokeFill
  joinType: StrokeJoin
  capType: 'butt' | 'round' | 'square'
  miterAngle: number
}

export interface StrokeVectorComputedData {
  id: string
  x: number
  y: number
  width: number
  height: number
  points: Record<string, VectorPoint>
  segments: Record<string, VectorSegment>
  networks: Record<string, VectorNetwork>
  closed: boolean
  pointCoordinateSpace: 'workspace'
  fills: unknown[]
  strokes: StrokeInput[]
}

export interface RuntimeRenderEntrySummary {
  index: number
  cacheKey: unknown
  preferSolidGraphics: boolean | null
  strokeColor: unknown
  strokeAlpha: unknown
  strokePaintKey: unknown
  polygonCount: number
  polygonBounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
    width: number
    height: number
  } | null
  polygonArea: number
  polygonSignature: string | null
  internalSharedBoundaryCount: number
  internalSharedBoundaryMaxLength: number
  strokeMaskPolygonCount: number
  fillPolygonCount: number
  strokePathGroupCount: number
  strokePathCount: number
  descriptorProductPolygonCount: number
  descriptorProductPolygonsVisible: boolean | null
  routeId: unknown
  ownerStage: unknown
  visibleContributor: unknown
  geometryBasis: unknown
  authoredJoin: unknown
  resolvedJoin: unknown
  vertexAngle: unknown
  miterAngle: unknown
  angleSource: unknown
  angleComparison: unknown
  productSignature: unknown
  productMode: unknown
  strokePosition: unknown
  intervalIds: string[]
  dashProductIntervalIds: string[]
  dashProductIntervalCount: number
  joinOwnershipRecordCount: number
  joinOwnershipMaterializationKinds: unknown[]
}

export interface StrokeRuntimeEvidence {
  caseId: string
  fixtureId: string
  elementId: string
  metadataHash: string
  computed: {
    id: string
    closed: boolean
    pointCoordinateSpace: string
    strokeCount: number
    strokes: unknown[]
    fills: unknown[]
    pointIds: string[]
    segmentIds: string[]
    networkIds: string[]
  } | null
  renderEntries: RuntimeRenderEntrySummary[]
  pipelineTrace: unknown[]
  pipelineCounters: Record<string, number>
  renderElementDiagnostics: Record<string, unknown>
}

export interface CapturedVisualArtifacts {
  metadataPath: string
  fullScreenshotPath: string
  focusedCropPath: string
  summaryPath: string
  focusedCropMetrics: StrokeVisualCropMetrics
}

export interface CapturedRuntimeMetadataArtifact {
  metadataPath: string
}

export interface StrokeVisualCropMetrics {
  width: number
  height: number
  redPixelCount: number
  redBounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
    width: number
    height: number
  } | null
  redDensity: number
  redMaskSignature: string
}

export const strokeJoinTypes: readonly StrokeJoin[] = [
  'miter',
  'bevel',
  'round'
]

const solidFill = (
  id: string,
  color: string,
  visible = true,
  opacity = 0.5
): StrokeFill => ({
  id,
  type: 'fill',
  kind: 'solid',
  defaultColorFormat: 'hex',
  colorFormat: 'hex',
  color,
  opacity,
  visible,
  gradient: null
})

const outsideDashedStroke = (
  id: string,
  joinType: StrokeJoin,
  overrides: Partial<StrokeInput> = {}
): StrokeInput => ({
  id,
  style: 'dashed',
  position: 'outside',
  width: 10,
  dash: 20,
  gap: 20,
  fill: solidFill(id, '#cccccc', true, 0.5),
  joinType,
  capType: 'butt',
  miterAngle: 28.96,
  ...overrides
})

const withStroke = (
  data: Omit<StrokeVectorComputedData, 'strokes'>,
  stroke: StrokeInput
): StrokeVectorComputedData => ({
  ...data,
  strokes: [stroke]
})

const reportedVector34Base = {
  id: 'vector-34',
  x: 1472.0139567292267,
  y: 1637.0696495055142,
  width: 406.7721238986164,
  height: 447.8094817329745,
  points: {
    'tp-113': {
      id: 'tp-113',
      kind: 'anchor',
      x: 1736.9285752346282,
      y: 1637.0696495055142,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'tp-114': {
      id: 'tp-114',
      kind: 'anchor',
      x: 1524.996880430307,
      y: 2084.8608111081926,
      anchorType: 'smooth',
      handleMode: 'none'
    },
    'tp-113:out': {
      id: 'tp-113:out',
      kind: 'control',
      x: 1695.827499455158,
      y: 1783.4973593495902,
      controlForId: 'tp-113',
      controlRole: 'out'
    },
    'tp-114:in': {
      id: 'tp-114:in',
      kind: 'control',
      x: 1426.5511899405578,
      y: 2087.5954136217965,
      controlForId: 'tp-114',
      controlRole: 'in'
    },
    'tp-114:out': {
      id: 'tp-114:out',
      kind: 'control',
      x: 1648.0539935424936,
      y: 2081.4425579661875,
      controlForId: 'tp-114',
      controlRole: 'out'
    },
    'tp-115': {
      id: 'tp-115',
      kind: 'anchor',
      x: 1878.7860806278431,
      y: 1801.1458003217629,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'tp-116': {
      id: 'tp-116',
      kind: 'anchor',
      x: 1472.0139567292267,
      y: 1708.852965487623,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'tp-117': {
      id: 'tp-117',
      kind: 'anchor',
      x: 1808.711891216737,
      y: 2055.8056594011487,
      anchorType: 'smooth',
      handleMode: 'none'
    },
    'tp-116:out': {
      id: 'tp-116:out',
      kind: 'control',
      x: 1472.0139567292267,
      y: 1708.852965487623,
      controlForId: 'tp-116',
      controlRole: 'out'
    },
    'tp-117:in': {
      id: 'tp-117:in',
      kind: 'control',
      x: 1772.8202332256828,
      y: 2115.6250893862393,
      controlForId: 'tp-117',
      controlRole: 'in'
    },
    'tp-117:out': {
      id: 'tp-117:out',
      kind: 'control',
      x: 1844.6035492077913,
      y: 1995.986229416058,
      controlForId: 'tp-117',
      controlRole: 'out'
    }
  },
  segments: {
    'ts-131': {
      id: 'ts-131',
      startId: 'tp-113',
      endId: 'tp-114',
      outControlId: 'tp-113:out',
      inControlId: 'tp-114:in'
    },
    'ts-132': {
      id: 'ts-132',
      startId: 'tp-114',
      endId: 'tp-115',
      outControlId: 'tp-114:out',
      inControlId: null
    },
    'ts-133': {
      id: 'ts-133',
      startId: 'tp-115',
      endId: 'tp-116',
      outControlId: null,
      inControlId: null
    },
    'ts-134': {
      id: 'ts-134',
      startId: 'tp-116',
      endId: 'tp-117',
      outControlId: 'tp-116:out',
      inControlId: 'tp-117:in'
    },
    'ts-135': {
      id: 'ts-135',
      startId: 'tp-117',
      endId: 'tp-113',
      outControlId: 'tp-117:out',
      inControlId: null
    }
  },
  networks: {
    'tn-28': {
      id: 'tn-28',
      pointIds: ['tp-113', 'tp-114', 'tp-115', 'tp-116', 'tp-117'],
      segmentIds: ['ts-131', 'ts-132', 'ts-133', 'ts-134', 'ts-135'],
      closed: true
    }
  },
  closed: true,
  pointCoordinateSpace: 'workspace' as const,
  fills: []
}

export const reportedVector34FocusPoint: WorkspacePoint = {
  x: 1736.9285752346282,
  y: 1637.0696495055142
}

export const reportedVector34AnchorFocusPoints = [
  {
    id: 'tp-113',
    point: {
      x: 1736.9285752346282,
      y: 1637.0696495055142
    }
  },
  {
    id: 'tp-114',
    point: {
      x: 1524.996880430307,
      y: 2084.8608111081926
    }
  },
  {
    id: 'tp-115',
    point: {
      x: 1878.7860806278431,
      y: 1801.1458003217629
    }
  },
  {
    id: 'tp-116',
    point: {
      x: 1472.0139567292267,
      y: 1708.852965487623
    }
  },
  {
    id: 'tp-117',
    point: {
      x: 1808.711891216737,
      y: 2055.8056594011487
    }
  }
] as const

export const ordinarySharpFocusPoint: WorkspacePoint = {
  x: 430,
  y: 185
}

export const referenceAcuteJoinFocusPoint: WorkspacePoint = {
  x: 430,
  y: 185
}

export const referenceAcuteEndpointOverviewFocusPoint: WorkspacePoint = {
  x: 430,
  y: 360
}

export const smoothCurvatureFocusPoint: WorkspacePoint = {
  x: 390,
  y: 155
}

export const buildReportedVector34ComputedData = (
  joinType: StrokeJoin
): StrokeVectorComputedData =>
  withStroke(reportedVector34Base, outsideDashedStroke('pp-711', joinType))

export const buildOrdinarySharpComputedData = (
  joinType: StrokeJoin,
  strokeOverrides: Partial<StrokeInput> = {}
): StrokeVectorComputedData =>
  withStroke(
    {
      id: 'ordinary-sharp-outside-dashed',
      x: 180,
      y: 120,
      width: 520,
      height: 420,
      points: {
        'op-1': {
          id: 'op-1',
          kind: 'anchor',
          x: 430,
          y: 185,
          anchorType: 'sharp',
          handleMode: 'none'
        },
        'op-2': {
          id: 'op-2',
          kind: 'anchor',
          x: 700,
          y: 540,
          anchorType: 'sharp',
          handleMode: 'none'
        },
        'op-3': {
          id: 'op-3',
          kind: 'anchor',
          x: 180,
          y: 480,
          anchorType: 'sharp',
          handleMode: 'none'
        }
      },
      segments: {
        'os-1': {
          id: 'os-1',
          startId: 'op-1',
          endId: 'op-2',
          outControlId: null,
          inControlId: null
        },
        'os-2': {
          id: 'os-2',
          startId: 'op-2',
          endId: 'op-3',
          outControlId: null,
          inControlId: null
        },
        'os-3': {
          id: 'os-3',
          startId: 'op-3',
          endId: 'op-1',
          outControlId: null,
          inControlId: null
        }
      },
      networks: {
        'on-1': {
          id: 'on-1',
          pointIds: ['op-1', 'op-2', 'op-3'],
          segmentIds: ['os-1', 'os-2', 'os-3'],
          closed: true
        }
      },
      closed: true,
      pointCoordinateSpace: 'workspace',
      fills: []
    },
    outsideDashedStroke('ordinary-stroke', joinType, {
      ...strokeOverrides
    })
  )

export const buildReferenceAcuteJoinComputedData = (
  joinType: StrokeJoin,
  strokeOverrides: Partial<StrokeInput> = {}
): StrokeVectorComputedData =>
  withStroke(
    {
      id: 'reference-acute-outside-dashed',
      x: 180,
      y: 120,
      width: 520,
      height: 420,
      points: {
        'ap-1': {
          id: 'ap-1',
          kind: 'anchor',
          x: 430,
          y: 185,
          anchorType: 'sharp',
          handleMode: 'none'
        },
        'ap-2': {
          id: 'ap-2',
          kind: 'anchor',
          x: 530,
          y: 540,
          anchorType: 'sharp',
          handleMode: 'none'
        },
        'ap-3': {
          id: 'ap-3',
          kind: 'anchor',
          x: 330,
          y: 540,
          anchorType: 'sharp',
          handleMode: 'none'
        }
      },
      segments: {
        'as-1': {
          id: 'as-1',
          startId: 'ap-1',
          endId: 'ap-2',
          outControlId: null,
          inControlId: null
        },
        'as-2': {
          id: 'as-2',
          startId: 'ap-2',
          endId: 'ap-3',
          outControlId: null,
          inControlId: null
        },
        'as-3': {
          id: 'as-3',
          startId: 'ap-3',
          endId: 'ap-1',
          outControlId: null,
          inControlId: null
        }
      },
      networks: {
        'an-1': {
          id: 'an-1',
          pointIds: ['ap-1', 'ap-2', 'ap-3'],
          segmentIds: ['as-1', 'as-2', 'as-3'],
          closed: true
        }
      },
      closed: true,
      pointCoordinateSpace: 'workspace',
      fills: [solidFill('reference-acute-fill', '#00ff00', true, 1)]
    },
    outsideDashedStroke('reference-acute-stroke', joinType, {
      fill: solidFill('reference-acute-stroke', '#ff0000', true, 0.5),
      ...strokeOverrides
    })
  )

export const buildReferenceAcuteConstrainedDashComputedData = (
  position: 'inside' | 'outside'
): StrokeVectorComputedData =>
  buildReferenceAcuteJoinComputedData('miter', {
    position,
    dash: 45,
    gap: 20,
    capType: 'butt',
    fill: solidFill(`reference-acute-${position}-stroke`, '#ff0000', true, 0.5)
  })

export const buildHiddenOutputComputedData = (): StrokeVectorComputedData =>
  buildOrdinarySharpComputedData('miter', {
    fill: solidFill('ordinary-stroke', '#cccccc', false, 0.5)
  })

export const buildPaintOnlyComputedData = (
  color: string
): StrokeVectorComputedData =>
  buildOrdinarySharpComputedData('miter', {
    fill: solidFill('ordinary-stroke', color, true, 0.5)
  })

export const buildSmoothCurvatureComputedData = (
  joinType: StrokeJoin = 'round'
): StrokeVectorComputedData =>
  withStroke(
    {
      id: 'smooth-high-curvature-outside-dashed',
      x: 80,
      y: 120,
      width: 620,
      height: 620,
      points: {
        'sp-1': {
          id: 'sp-1',
          kind: 'anchor',
          x: 390,
          y: 155,
          anchorType: 'smooth',
          handleMode: 'none'
        },
        'sp-2': {
          id: 'sp-2',
          kind: 'anchor',
          x: 700,
          y: 430,
          anchorType: 'smooth',
          handleMode: 'none'
        },
        'sp-3': {
          id: 'sp-3',
          kind: 'anchor',
          x: 390,
          y: 735,
          anchorType: 'smooth',
          handleMode: 'none'
        },
        'sp-4': {
          id: 'sp-4',
          kind: 'anchor',
          x: 80,
          y: 430,
          anchorType: 'smooth',
          handleMode: 'none'
        },
        'sp-1:in': {
          id: 'sp-1:in',
          kind: 'control',
          x: 210,
          y: 155,
          controlForId: 'sp-1',
          controlRole: 'in'
        },
        'sp-1:out': {
          id: 'sp-1:out',
          kind: 'control',
          x: 570,
          y: 155,
          controlForId: 'sp-1',
          controlRole: 'out'
        },
        'sp-2:in': {
          id: 'sp-2:in',
          kind: 'control',
          x: 700,
          y: 250,
          controlForId: 'sp-2',
          controlRole: 'in'
        },
        'sp-2:out': {
          id: 'sp-2:out',
          kind: 'control',
          x: 700,
          y: 610,
          controlForId: 'sp-2',
          controlRole: 'out'
        },
        'sp-3:in': {
          id: 'sp-3:in',
          kind: 'control',
          x: 570,
          y: 735,
          controlForId: 'sp-3',
          controlRole: 'in'
        },
        'sp-3:out': {
          id: 'sp-3:out',
          kind: 'control',
          x: 210,
          y: 735,
          controlForId: 'sp-3',
          controlRole: 'out'
        },
        'sp-4:in': {
          id: 'sp-4:in',
          kind: 'control',
          x: 80,
          y: 610,
          controlForId: 'sp-4',
          controlRole: 'in'
        },
        'sp-4:out': {
          id: 'sp-4:out',
          kind: 'control',
          x: 80,
          y: 250,
          controlForId: 'sp-4',
          controlRole: 'out'
        }
      },
      segments: {
        'ss-1': {
          id: 'ss-1',
          startId: 'sp-1',
          endId: 'sp-2',
          outControlId: 'sp-1:out',
          inControlId: 'sp-2:in'
        },
        'ss-2': {
          id: 'ss-2',
          startId: 'sp-2',
          endId: 'sp-3',
          outControlId: 'sp-2:out',
          inControlId: 'sp-3:in'
        },
        'ss-3': {
          id: 'ss-3',
          startId: 'sp-3',
          endId: 'sp-4',
          outControlId: 'sp-3:out',
          inControlId: 'sp-4:in'
        },
        'ss-4': {
          id: 'ss-4',
          startId: 'sp-4',
          endId: 'sp-1',
          outControlId: 'sp-4:out',
          inControlId: 'sp-1:in'
        }
      },
      networks: {
        'sn-1': {
          id: 'sn-1',
          pointIds: ['sp-1', 'sp-2', 'sp-3', 'sp-4'],
          segmentIds: ['ss-1', 'ss-2', 'ss-3', 'ss-4'],
          closed: true
        }
      },
      closed: true,
      pointCoordinateSpace: 'workspace',
      fills: []
    },
    outsideDashedStroke('smooth-stroke', joinType, {
      dash: 36,
      gap: 24,
      fill: solidFill('smooth-stroke', '#cccccc', true, 0.5)
    })
  )

export const assertNewFlowBaseUrl = () => {
  expect(process.env.ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL).toBe(
    requiredVisualReviewBaseUrl
  )
  expect(process.env.PLAYWRIGHT_TEST_BASE_URL).toBe(requiredVisualReviewBaseUrl)
}

export const waitForNewFlowAppReady = async (page: Page) => {
  const browserConsoleErrors: string[] = []
  const onConsole = (message: { type: () => string; text: () => string }) => {
    if (message.type() === 'error') {
      browserConsoleErrors.push(message.text())
    }
  }
  page.on('console', onConsole)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForSelector('#viewport-anchor')
  await page.waitForSelector('[data-testid="toolbar"]')
  await page.waitForSelector('canvas')
  try {
    await page.waitForFunction(
      () => {
        const globalRecord = window as unknown as {
          __Core__?: {
            deps?: {
              sceneTree?: {
                workspace?: string
                getAllElements?: () => Map<string, unknown>
                getElementById?: (id: string) => unknown
              }
              render?: unknown
            }
          }
          __AsyraE2E__?: {
            elementApis?: {
              createElement?: unknown
              changeComputedData?: unknown
            }
          }
        }
        return Boolean(
          globalRecord.__Core__?.deps?.sceneTree?.getElementById &&
            globalRecord.__Core__.deps.sceneTree.workspace &&
            globalRecord.__Core__.deps.sceneTree.getAllElements?.().size &&
            globalRecord.__Core__?.deps?.render &&
            globalRecord.__AsyraE2E__?.elementApis?.createElement &&
            globalRecord.__AsyraE2E__?.elementApis?.changeComputedData
        )
      },
      undefined,
      { timeout: 10_000 }
    )
  } catch (error) {
    const diagnostic = await page.evaluate(() => {
      const globalRecord = window as unknown as {
        __Core__?: {
          deps?: {
            sceneTree?: {
              workspace?: string
              workspaceList?: string[]
              getAllElements?: () => Map<string, unknown>
              getElementById?: (id: string) => unknown
            }
            render?: unknown
          }
        }
        __AsyraE2E__?: {
          elementApis?: {
            createElement?: unknown
            changeComputedData?: unknown
          }
        }
      }
      const sceneTree = globalRecord.__Core__?.deps?.sceneTree
      return {
        hasCore: Boolean(globalRecord.__Core__),
        hasRenderDep: Boolean(globalRecord.__Core__?.deps?.render),
        hasSceneTree: Boolean(sceneTree),
        workspace: sceneTree?.workspace ?? null,
        workspaceList: sceneTree?.workspaceList ?? [],
        elementIds: sceneTree?.getAllElements
          ? [...sceneTree.getAllElements().keys()]
          : [],
        hasE2EElementApis: Boolean(globalRecord.__AsyraE2E__?.elementApis),
        hasCreateElement: Boolean(
          globalRecord.__AsyraE2E__?.elementApis?.createElement
        ),
        hasChangeComputedData: Boolean(
          globalRecord.__AsyraE2E__?.elementApis?.changeComputedData
        )
      }
    })
    page.off('console', onConsole)
    throw new Error(
      `New stroke flow app runtime did not initialize scene tree: ${JSON.stringify(
        { diagnostic, browserConsoleErrors, cause: String(error) },
        null,
        2
      )}`
    )
  }
  page.off('console', onConsole)
  await page.waitForTimeout(350)
}

export const resetNewFlowCanvas = async (page: Page) => {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => {
    localStorage.setItem('FILE', JSON.stringify({}))
  })
  await page.reload()
  await waitForNewFlowAppReady(page)
}

export const installStrokeNewFlowEvidenceBridge = async (page: Page) => {
  await page.evaluate(() => {
    const globalRecord = window as unknown as {
      __ASYRA_STROKE_DIAGNOSTICS_MODE__?: 'off' | 'summary' | 'full'
      __asyraStrokeNewFlowTrace?: unknown[]
      __asyraStrokeNewFlowCounters?: Record<string, number>
      __asyraStrokePipelineTraceSink?: (
        eventName: string,
        payload: unknown
      ) => void
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value?: number
      ) => void
    }

    globalRecord.__ASYRA_STROKE_DIAGNOSTICS_MODE__ = 'full'
    globalRecord.__asyraStrokeNewFlowTrace = []
    globalRecord.__asyraStrokeNewFlowCounters = {}
    globalRecord.__asyraStrokePipelineTraceSink = (eventName, payload) => {
      globalRecord.__asyraStrokeNewFlowTrace?.push({
        eventName,
        payload
      })
    }
    globalRecord.__asyraStrokePipelineCounterSink = (
      counterName,
      value = 1
    ) => {
      const counters = globalRecord.__asyraStrokeNewFlowCounters ?? {}
      counters[counterName] = (counters[counterName] ?? 0) + value
      globalRecord.__asyraStrokeNewFlowCounters = counters
    }
  })
}

export const resetStrokeNewFlowRuntimeEvidence = async (page: Page) => {
  await page.evaluate(() => {
    const globalRecord = window as unknown as {
      __asyraStrokeNewFlowTrace?: unknown[]
      __asyraStrokeNewFlowCounters?: Record<string, number>
    }
    globalRecord.__asyraStrokeNewFlowTrace = []
    globalRecord.__asyraStrokeNewFlowCounters = {}
  })
}

export const createComputedVectorFixture = async (
  page: Page,
  computedData: StrokeVectorComputedData
) => {
  await installStrokeNewFlowEvidenceBridge(page)
  const elementIds = await page.evaluate((data) => {
    const globalRecord = window as unknown as {
      __Core__?: {
        selectElements?: (ids: string[], options?: unknown) => void
        setSystemProperty?: (key: string, value: unknown) => void
        deps?: {
          sceneTree?: {
            getElementById?: (id: string) => unknown
            getAllElements?: () => Map<string, unknown>
          }
          render?: { requestRender?: () => void }
        }
      }
      __AsyraE2E__?: {
        elementApis?: {
          createElement?: (data: unknown, options?: unknown) => string | null
          changeComputedData?: (
            ids: string[],
            data: unknown,
            options?: unknown
          ) => void
        }
      }
    }
    const core = globalRecord.__Core__
    const elementApis = globalRecord.__AsyraE2E__?.elementApis
    if (!core || !elementApis) {
      throw new Error('Missing E2E core or element APIs')
    }

    const createdId = elementApis.createElement?.(
      {
        type: 'vector',
        points: data.points,
        segments: data.segments,
        networks: data.networks,
        closed: data.closed,
        pointCoordinateSpace: data.pointCoordinateSpace
      },
      { undoable: false }
    )
    if (!createdId) {
      throw new Error(`Failed to create ${data.id} computed fixture`)
    }

    elementApis.changeComputedData?.([createdId], data, { undoable: false })
    return {
      createdId,
      dataId: data.id
    }
  }, computedData)

  const resolveCreatedElement = async (timeout = 5_000) =>
    page.waitForFunction(
      ({ createdId, dataId }) => {
        const globalRecord = window as unknown as {
          __Core__?: {
            deps?: {
              sceneTree?: {
                getElementById?: (id: string) =>
                  | {
                      get?: (key: string) => unknown
                      getAllComputedData?: () => Record<string, unknown>
                    }
                  | undefined
                getAllElements?: () => Map<string, unknown>
              }
            }
          }
        }
        const sceneTree = globalRecord.__Core__?.deps?.sceneTree
        const direct = [createdId, dataId].find((id) => {
          const element = sceneTree?.getElementById?.(id)
          return Boolean(element?.getAllComputedData?.())
        })
        if (direct) {
          return direct
        }

        const allElements = sceneTree?.getAllElements?.()
        if (!allElements) {
          return null
        }
        const match = [...allElements.entries()].find(([, element]) => {
          const candidate = element as {
            get?: (key: string) => unknown
            getAllComputedData?: () => Record<string, unknown>
          }
          return (
            candidate.get?.('type') === 'vector' ||
            candidate.getAllComputedData?.()?.id === dataId
          )
        })
        return match?.[0] ?? null
      },
      elementIds,
      { timeout }
    )

  const resolvedIdHandle = await resolveCreatedElement().catch(
    async (error) => {
      const diagnostic = await page.evaluate(({ createdId, dataId }) => {
        const globalRecord = window as unknown as {
          __Core__?: {
            deps?: {
              sceneTree?: {
                workspace?: string
                workspaceList?: string[]
                getElementById?: (id: string) =>
                  | {
                      get?: (key: string) => unknown
                      getAllComputedData?: () => Record<string, unknown>
                    }
                  | undefined
                getAllElements?: () => Map<string, unknown>
              }
            }
          }
        }
        const sceneTree = globalRecord.__Core__?.deps?.sceneTree
        const candidateIds = [createdId, dataId]
        const candidates = Object.fromEntries(
          candidateIds.map((id) => {
            const element = sceneTree?.getElementById?.(id)
            const computed = element?.getAllComputedData?.()
            return [
              id,
              {
                exists: Boolean(element),
                type: element?.get?.('type') ?? null,
                computedKeys: computed ? Object.keys(computed) : []
              }
            ]
          })
        )
        const allElements = sceneTree?.getAllElements?.()
        return {
          workspace: sceneTree?.workspace ?? null,
          workspaceList: sceneTree?.workspaceList ?? [],
          hasGetAllElements: Boolean(sceneTree?.getAllElements),
          allElementIds: allElements ? [...allElements.keys()] : [],
          candidates
        }
      }, elementIds)
      throw new Error(
        `Created vector fixture is not readable from scene tree: ${JSON.stringify(
          { elementIds, diagnostic, cause: String(error) },
          null,
          2
        )}`
      )
    }
  )
  const elementId = await resolvedIdHandle.jsonValue()
  if (typeof elementId !== 'string' || elementId.length === 0) {
    throw new Error(
      `Created vector fixture is not readable from scene tree: ${JSON.stringify(
        elementIds
      )}`
    )
  }

  await page.evaluate((resolvedId) => {
    const globalRecord = window as unknown as {
      __Core__?: {
        selectElements?: (ids: string[], options?: unknown) => void
        setSystemProperty?: (key: string, value: unknown) => void
        deps?: { render?: { requestRender?: () => void } }
      }
    }
    const core = globalRecord.__Core__
    core?.selectElements?.([resolvedId], { undoable: false })
    core?.setSystemProperty?.('pathEditingVectorId', resolvedId)
    core?.setSystemProperty?.('pathEditingMode', true)
    core?.deps?.render?.requestRender?.()
  }, elementId)
  await page.waitForTimeout(450)
  return elementId
}

export const changeComputedVectorFixture = async (
  page: Page,
  elementId: string,
  computedData: StrokeVectorComputedData
) => {
  await page.evaluate(
    ({ targetElementId, data }) => {
      const globalRecord = window as unknown as {
        __Core__?: {
          deps?: { render?: { requestRender?: () => void } }
        }
        __AsyraE2E__?: {
          elementApis?: {
            changeComputedData?: (
              ids: string[],
              data: unknown,
              options?: unknown
            ) => void
          }
        }
      }
      const elementApis = globalRecord.__AsyraE2E__?.elementApis
      if (!elementApis?.changeComputedData) {
        throw new Error('Missing E2E changeComputedData API')
      }
      elementApis.changeComputedData([targetElementId], data, {
        undoable: false
      })
      globalRecord.__Core__?.deps?.render?.requestRender?.()
    },
    {
      targetElementId: elementId,
      data: computedData
    }
  )
  await page.waitForTimeout(450)
}

export const setVectorEditOverlayVisible = async (
  page: Page,
  elementId: string,
  visible: boolean
) => {
  await page.evaluate(
    ({ targetElementId, shouldShowOverlay }) => {
      const globalRecord = window as unknown as {
        __Core__?: {
          selectElements?: (ids: string[], options?: unknown) => void
          setSystemProperty?: (key: string, value: unknown) => void
          deps?: { render?: { requestRender?: () => void } }
        }
      }
      const core = globalRecord.__Core__
      core?.selectElements?.(shouldShowOverlay ? [targetElementId] : [], {
        undoable: false
      })
      core?.setSystemProperty?.(
        'pathEditingVectorId',
        shouldShowOverlay ? targetElementId : null
      )
      core?.setSystemProperty?.('pathEditingMode', shouldShowOverlay)
      core?.deps?.render?.requestRender?.()
    },
    { targetElementId: elementId, shouldShowOverlay: visible }
  )
  await page.waitForTimeout(250)
}

export const changeSelectedStrokeJoinViaUi = async (
  page: Page,
  joinType: StrokeJoin
) => {
  const joinSelect = page.getByTestId('prop-stroke-join-0')
  const canUsePropertiesSelect = await joinSelect
    .waitFor({ state: 'visible', timeout: 2_000 })
    .then(() => true)
    .catch(() => false)

  if (canUsePropertiesSelect) {
    await joinSelect.selectOption(joinType)
  } else {
    await page.evaluate((nextJoinType) => {
      const globalRecord = window as unknown as {
        __Core__?: {
          deps?: {
            selection?: {
              getElementSelectionIds?: () => string[]
            }
            sceneTree?: {
              getElementById?: (id: string) =>
                | {
                    getAllComputedData?: () => Record<string, unknown>
                  }
                | undefined
            }
            render?: { requestRender?: () => void }
          }
          getSystemProperty?: (key: string) => unknown
          selectElements?: (ids: string[], options?: unknown) => void
        }
        __AsyraE2E__?: {
          elementApis?: {
            changeComputedData?: (
              ids: string[],
              data: unknown,
              options?: unknown
            ) => void
          }
        }
      }
      const core = globalRecord.__Core__
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()[0] ??
        (core?.getSystemProperty?.('pathEditingVectorId') as string | undefined)
      if (!selectedId) {
        throw new Error('No selected element available for join state change')
      }

      const sceneElement = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const computed = sceneElement?.getAllComputedData?.()
      if (!computed || !Array.isArray(computed.strokes)) {
        throw new Error('No computed stroke state available for join change')
      }

      const strokes = computed.strokes.map((stroke) =>
        stroke && typeof stroke === 'object'
          ? {
              ...(stroke as Record<string, unknown>),
              joinType: nextJoinType
            }
          : stroke
      )
      globalRecord.__AsyraE2E__?.elementApis?.changeComputedData?.(
        [selectedId],
        {
          ...computed,
          strokes
        },
        { undoable: false }
      )
      core?.selectElements?.([selectedId], { undoable: false })
      core?.deps?.render?.requestRender?.()
    }, joinType)
  }

  await page.waitForTimeout(450)
  await page.evaluate(() => {
    const globalRecord = window as unknown as {
      __Core__?: { deps?: { render?: { requestRender?: () => void } } }
    }
    globalRecord.__Core__?.deps?.render?.requestRender?.()
  })
  await page.waitForTimeout(250)
}

export const setZoomPercent = async (page: Page, percent: number) => {
  await page.evaluate((targetZoom) => {
    const globalRecord = window as unknown as {
      __Core__?: {
        setSystemProperty?: (key: string, value: unknown) => void
        deps?: { render?: { requestRender?: () => void } }
      }
    }
    globalRecord.__Core__?.setSystemProperty?.('zoom', targetZoom / 100)
    globalRecord.__Core__?.deps?.render?.requestRender?.()
  }, percent)
  await page.waitForTimeout(250)
}

export const centerWorkspacePointInViewport = async (
  page: Page,
  workspacePoint: WorkspacePoint
) => {
  await page.evaluate((targetPoint) => {
    const globalRecord = window as unknown as {
      __Core__?: {
        getSystemProperty?: (key: string) => unknown
        setSystemProperty?: (key: string, value: unknown) => void
        deps?: { render?: { requestRender?: () => void } }
      }
    }
    const core = globalRecord.__Core__
    const viewportAnchor = document.getElementById('viewport-anchor')
    const zoom = Number(core?.getSystemProperty?.('zoom') ?? 1)
    if (!viewportAnchor || !core) {
      throw new Error('Missing viewport anchor or core')
    }

    const bounds = viewportAnchor.getBoundingClientRect()
    core.setSystemProperty?.('viewportPosition', {
      x: bounds.left + bounds.width / 2 - targetPoint.x * zoom,
      y: bounds.top + bounds.height / 2 - targetPoint.y * zoom
    })
    core.deps?.render?.requestRender?.()
  }, workspacePoint)
  await page.waitForTimeout(250)
}

export const getViewportState = async (page: Page) =>
  page.evaluate(() => {
    const globalRecord = window as unknown as {
      __Core__?: {
        getSystemProperty?: (key: string) => unknown
      }
    }
    return {
      zoom: Number(globalRecord.__Core__?.getSystemProperty?.('zoom') ?? 1),
      viewport: (globalRecord.__Core__?.getSystemProperty?.(
        'viewportPosition'
      ) ?? {
        x: 0,
        y: 0
      }) as WorkspacePoint
    }
  })

export const getCenteredViewportClip = async (
  page: Page,
  size: { width: number; height: number }
) =>
  page.evaluate((targetSize) => {
    const viewportAnchor = document.getElementById('viewport-anchor')
    const rect = viewportAnchor?.getBoundingClientRect() ?? {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight
    }
    const width = Math.min(window.innerWidth, targetSize.width)
    const height = Math.min(window.innerHeight, targetSize.height)
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    return {
      x: Math.max(0, Math.floor(centerX - width / 2)),
      y: Math.max(0, Math.floor(centerY - height / 2)),
      width,
      height
    }
  }, size)

const isRuntimePoint = (value: unknown): value is { x: number; y: number } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { x?: unknown }).x === 'number' &&
  typeof (value as { y?: unknown }).y === 'number' &&
  Number.isFinite((value as { x: number }).x) &&
  Number.isFinite((value as { y: number }).y)

const collectRuntimePolygons = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((polygon) =>
          Array.isArray(polygon) ? polygon.filter(isRuntimePoint) : []
        )
        .filter((polygon) => polygon.length >= 3)
    : []

const getRuntimePolygonArea = (polygon: readonly { x: number; y: number }[]) =>
  Math.abs(
    polygon.reduce((area, point, index) => {
      const next = polygon[(index + 1) % polygon.length]
      return area + point.x * next.y - next.x * point.y
    }, 0) / 2
  )

const RUNTIME_RENDER_ENTRY_SHARED_BOUNDARY_TOLERANCE = 0.05

const subtractRuntimePoint = (
  first: { x: number; y: number },
  second: { x: number; y: number }
) => ({
  x: first.x - second.x,
  y: first.y - second.y
})

const getRuntimeCollinearSegmentOverlapLength = (
  leftStart: { x: number; y: number },
  leftEnd: { x: number; y: number },
  rightStart: { x: number; y: number },
  rightEnd: { x: number; y: number }
) => {
  const axis = subtractRuntimePoint(leftEnd, leftStart)
  const axisLength = Math.hypot(axis.x, axis.y)
  const rightAxis = subtractRuntimePoint(rightEnd, rightStart)
  const rightAxisLength = Math.hypot(rightAxis.x, rightAxis.y)
  if (axisLength <= Number.EPSILON || rightAxisLength <= Number.EPSILON) {
    return 0
  }

  const parallelDistance =
    Math.abs(axis.x * rightAxis.y - axis.y * rightAxis.x) /
    Math.max(axisLength, rightAxisLength)
  if (parallelDistance > RUNTIME_RENDER_ENTRY_SHARED_BOUNDARY_TOLERANCE) {
    return 0
  }

  const rightStartLineDistance =
    Math.abs(
      axis.x * (rightStart.y - leftStart.y) -
        axis.y * (rightStart.x - leftStart.x)
    ) / axisLength
  const rightEndLineDistance =
    Math.abs(
      axis.x * (rightEnd.y - leftStart.y) - axis.y * (rightEnd.x - leftStart.x)
    ) / axisLength
  if (
    rightStartLineDistance > RUNTIME_RENDER_ENTRY_SHARED_BOUNDARY_TOLERANCE ||
    rightEndLineDistance > RUNTIME_RENDER_ENTRY_SHARED_BOUNDARY_TOLERANCE
  ) {
    return 0
  }

  const normalizedAxis = {
    x: axis.x / axisLength,
    y: axis.y / axisLength
  }
  const rightRange = [rightStart, rightEnd]
    .map(
      (point) =>
        (point.x - leftStart.x) * normalizedAxis.x +
        (point.y - leftStart.y) * normalizedAxis.y
    )
    .sort((left, right) => left - right)
  return Math.max(
    0,
    Math.min(axisLength, rightRange[1]) - Math.max(0, rightRange[0])
  )
}

const getRuntimePolygonSharedBoundaryLength = (
  leftPolygon: readonly { x: number; y: number }[],
  rightPolygon: readonly { x: number; y: number }[]
) => {
  let sharedLength = 0
  leftPolygon.forEach((leftPoint, leftIndex) => {
    const leftNext = leftPolygon[(leftIndex + 1) % leftPolygon.length]
    rightPolygon.forEach((rightPoint, rightIndex) => {
      const rightNext = rightPolygon[(rightIndex + 1) % rightPolygon.length]
      sharedLength += getRuntimeCollinearSegmentOverlapLength(
        leftPoint,
        leftNext,
        rightPoint,
        rightNext
      )
    })
  })
  return sharedLength
}

const collectRuntimeInternalSharedBoundaryMetrics = (
  polygons: readonly (readonly { x: number; y: number }[])[]
) => {
  let count = 0
  let maxLength = 0
  for (let leftIndex = 0; leftIndex < polygons.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < polygons.length;
      rightIndex += 1
    ) {
      const sharedLength = getRuntimePolygonSharedBoundaryLength(
        polygons[leftIndex],
        polygons[rightIndex]
      )
      if (sharedLength > RUNTIME_RENDER_ENTRY_SHARED_BOUNDARY_TOLERANCE) {
        count += 1
        maxLength = Math.max(maxLength, sharedLength)
      }
    }
  }
  return {
    count,
    maxLength: Math.round(maxLength * 1000) / 1000
  }
}

const collectRuntimePolygonMetrics = (
  polygons: readonly (readonly { x: number; y: number }[])[]
) => {
  if (polygons.length === 0) {
    return { bounds: null, area: 0, signature: null }
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let area = 0
  const signatureParts: string[] = []

  polygons.forEach((polygon, polygonIndex) => {
    area += getRuntimePolygonArea(polygon)
    signatureParts.push(`p${polygonIndex}`)
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
      signatureParts.push(`${point.x.toFixed(3)},${point.y.toFixed(3)}`)
    })
  })

  return {
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    },
    area,
    signature: createHash('sha256')
      .update(signatureParts.join('|'))
      .digest('hex')
  }
}

const collectRenderEntrySummary = (
  entry: Record<string, unknown>,
  index: number
): RuntimeRenderEntrySummary => {
  const debugMeta = (entry.debugMeta ?? {}) as Record<string, unknown>
  const runtimeMeta = (entry.runtimeMeta ?? {}) as Record<string, unknown>
  const descriptorProductPolygons =
    entry.descriptorProductPolygons ??
    debugMeta.descriptorProductPolygons ??
    runtimeMeta.descriptorProductPolygons
  const joinOwnershipRecords = [
    debugMeta.joinOwnershipRecords,
    runtimeMeta.joinOwnershipRecords
  ].find(Array.isArray) as Record<string, unknown>[] | undefined
  const joinOwnershipMaterializationKinds =
    joinOwnershipRecords?.map((record) => record.materializationKind) ?? []
  const productSignature =
    debugMeta.productSignature ?? runtimeMeta.productSignature ?? null
  const productMode = debugMeta.productMode ?? runtimeMeta.productMode ?? null
  const intervalIds = [
    ...(Array.isArray(debugMeta.intervalIds) ? debugMeta.intervalIds : []),
    ...(typeof debugMeta.intervalId === 'string' ? [debugMeta.intervalId] : []),
    ...(Array.isArray(runtimeMeta.intervalIds) ? runtimeMeta.intervalIds : []),
    ...(typeof runtimeMeta.intervalId === 'string'
      ? [runtimeMeta.intervalId]
      : [])
  ].filter((value): value is string => typeof value === 'string')
  const dashProductIntervals = [
    debugMeta.dashProductIntervals,
    runtimeMeta.dashProductIntervals
  ].find(Array.isArray) as Record<string, unknown>[] | undefined
  const dashProductIntervalIds =
    dashProductIntervals
      ?.map((interval) => interval.intervalId)
      .filter((value): value is string => typeof value === 'string') ?? []
  const declaredPolygons = collectRuntimePolygons(entry.polygons)
  const declaredPolygonMetrics = collectRuntimePolygonMetrics(declaredPolygons)
  const internalSharedBoundaryMetrics =
    collectRuntimeInternalSharedBoundaryMetrics(declaredPolygons)

  return {
    index,
    cacheKey: entry.cacheKey ?? null,
    preferSolidGraphics:
      typeof entry.preferSolidGraphics === 'boolean'
        ? entry.preferSolidGraphics
        : null,
    strokeColor:
      typeof (entry.stroke as Record<string, unknown> | undefined)?.color ===
      'number'
        ? (entry.stroke as Record<string, unknown>).color
        : null,
    strokeAlpha:
      typeof (entry.stroke as Record<string, unknown> | undefined)?.alpha ===
      'number'
        ? (entry.stroke as Record<string, unknown>).alpha
        : null,
    strokePaintKey:
      (entry.stroke as Record<string, unknown> | undefined)?.paintKey ?? null,
    polygonCount: declaredPolygons.length,
    polygonBounds: declaredPolygonMetrics.bounds,
    polygonArea: declaredPolygonMetrics.area,
    polygonSignature: declaredPolygonMetrics.signature,
    internalSharedBoundaryCount: internalSharedBoundaryMetrics.count,
    internalSharedBoundaryMaxLength: internalSharedBoundaryMetrics.maxLength,
    strokeMaskPolygonCount: Array.isArray(entry.strokeMaskPolygons)
      ? entry.strokeMaskPolygons.length
      : 0,
    fillPolygonCount: Array.isArray(entry.fillPolygons)
      ? entry.fillPolygons.length
      : 0,
    strokePathGroupCount: Array.isArray(entry.strokePathGroups)
      ? entry.strokePathGroups.length
      : 0,
    strokePathCount: Array.isArray(entry.strokePaths)
      ? entry.strokePaths.length
      : 0,
    descriptorProductPolygonCount: Array.isArray(descriptorProductPolygons)
      ? descriptorProductPolygons.length
      : 0,
    descriptorProductPolygonsVisible:
      typeof debugMeta.descriptorProductPolygonsVisible === 'boolean'
        ? debugMeta.descriptorProductPolygonsVisible
        : typeof runtimeMeta.descriptorProductPolygonsVisible === 'boolean'
          ? runtimeMeta.descriptorProductPolygonsVisible
          : null,
    routeId: debugMeta.routeId ?? runtimeMeta.routeId ?? null,
    ownerStage: debugMeta.ownerStage ?? runtimeMeta.ownerStage ?? null,
    visibleContributor:
      debugMeta.visibleContributor ?? runtimeMeta.visibleContributor ?? null,
    geometryBasis: debugMeta.geometryBasis ?? runtimeMeta.geometryBasis ?? null,
    authoredJoin: debugMeta.authoredJoin ?? runtimeMeta.authoredJoin ?? null,
    resolvedJoin: debugMeta.resolvedJoin ?? runtimeMeta.resolvedJoin ?? null,
    vertexAngle: debugMeta.vertexAngle ?? runtimeMeta.vertexAngle ?? null,
    miterAngle: debugMeta.miterAngle ?? runtimeMeta.miterAngle ?? null,
    angleSource: debugMeta.angleSource ?? runtimeMeta.angleSource ?? null,
    angleComparison:
      debugMeta.angleComparison ?? runtimeMeta.angleComparison ?? null,
    productSignature,
    productMode,
    strokePosition:
      debugMeta.strokePosition ?? runtimeMeta.strokePosition ?? null,
    intervalIds: Array.from(new Set(intervalIds)).sort(),
    dashProductIntervalIds: Array.from(new Set(dashProductIntervalIds)).sort(),
    dashProductIntervalCount: dashProductIntervals?.length ?? 0,
    joinOwnershipRecordCount: joinOwnershipRecords?.length ?? 0,
    joinOwnershipMaterializationKinds
  }
}

export const captureRuntimeEvidence = async (
  page: Page,
  coverageCase: StrokeVisualE2ECoverageCase,
  elementId: string
): Promise<StrokeRuntimeEvidence> => {
  const evidenceWithoutHash = await page.evaluate(
    ({ caseId, fixtureId, targetElementId }) => {
      const globalRecord = window as unknown as {
        __Core__?: {
          deps?: {
            sceneTree?: {
              getElementById?: (id: string) => {
                getAllComputedData?: () => Record<string, unknown>
              } | null
            }
            render?: {
              getElementById?: (id: string) => Record<string, unknown> | null
            }
          }
        }
        __asyraStrokeNewFlowTrace?: unknown[]
        __asyraStrokeNewFlowCounters?: Record<string, number>
      }
      const core = globalRecord.__Core__
      const sceneElement =
        core?.deps?.sceneTree?.getElementById?.(targetElementId) ?? null
      const computed = sceneElement?.getAllComputedData?.() ?? null
      const renderElement =
        core?.deps?.render?.getElementById?.(targetElementId) ?? null
      const renderEntries = Array.isArray(
        renderElement?.__asyraStrokeRenderEntries
      )
        ? (renderElement.__asyraStrokeRenderEntries as Record<
            string,
            unknown
          >[])
        : []
      const diagnostics = Object.fromEntries(
        Object.entries(renderElement ?? {}).filter(([key]) =>
          key.startsWith('__asyra')
        )
      )

      return {
        caseId,
        fixtureId,
        elementId: targetElementId,
        computed: computed
          ? {
              id: computed.id,
              closed: computed.closed,
              pointCoordinateSpace: computed.pointCoordinateSpace,
              strokeCount: Array.isArray(computed.strokes)
                ? computed.strokes.length
                : 0,
              strokes: Array.isArray(computed.strokes) ? computed.strokes : [],
              fills: Array.isArray(computed.fills) ? computed.fills : [],
              pointIds: Object.keys(
                (computed.points ?? {}) as Record<string, unknown>
              ),
              segmentIds: Object.keys(
                (computed.segments ?? {}) as Record<string, unknown>
              ),
              networkIds: Object.keys(
                (computed.networks ?? {}) as Record<string, unknown>
              )
            }
          : null,
        rawRenderEntries: renderEntries,
        pipelineTrace: globalRecord.__asyraStrokeNewFlowTrace ?? [],
        pipelineCounters: globalRecord.__asyraStrokeNewFlowCounters ?? {},
        renderElementDiagnostics: diagnostics
      }
    },
    {
      caseId: coverageCase.id,
      fixtureId: coverageCase.fixtureId,
      targetElementId: elementId
    }
  )

  const evidence = {
    caseId: evidenceWithoutHash.caseId,
    fixtureId: evidenceWithoutHash.fixtureId,
    elementId: evidenceWithoutHash.elementId,
    metadataHash: '',
    computed: evidenceWithoutHash.computed,
    renderEntries: evidenceWithoutHash.rawRenderEntries.map(
      collectRenderEntrySummary
    ),
    pipelineTrace: evidenceWithoutHash.pipelineTrace,
    pipelineCounters: evidenceWithoutHash.pipelineCounters,
    renderElementDiagnostics: evidenceWithoutHash.renderElementDiagnostics
  }
  return {
    ...evidence,
    metadataHash: createHash('sha256')
      .update(JSON.stringify(evidence))
      .digest('hex')
  }
}

const serializedEvidenceText = (evidence: StrokeRuntimeEvidence) =>
  JSON.stringify(evidence).toLowerCase()

const isMeaningfulRuntimeValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return false
  }
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  if (Array.isArray(value)) {
    return value.length > 0
  }
  return true
}

const renderEntryHasField = (
  evidence: StrokeRuntimeEvidence,
  field: keyof RuntimeRenderEntrySummary
) =>
  evidence.renderEntries.some((entry) => isMeaningfulRuntimeValue(entry[field]))

const hasVisibleRenderGeometry = (entry: RuntimeRenderEntrySummary) =>
  entry.strokeMaskPolygonCount > 0 ||
  entry.fillPolygonCount > 0 ||
  entry.strokePathGroupCount > 0 ||
  entry.strokePathCount > 0

const isStrokeProductCacheHitCounter = (counterName: string) =>
  (counterName.startsWith('stroke-stage-cache:') ||
    counterName.startsWith('constrained-dashed-') ||
    counterName.startsWith('source-vertex-') ||
    counterName.startsWith('center-stroke-') ||
    counterName.startsWith('outside-') ||
    counterName.startsWith('inside-')) &&
  counterName.includes('cache-hit')

export const assertRuntimeEvidenceBasics = (
  evidence: StrokeRuntimeEvidence,
  assertions: readonly StrokeVisualRuntimeAssertion[]
) => {
  expect(evidence.computed, 'computed stroke state must exist').not.toBeNull()
  expect(evidence.computed?.strokeCount).toBeGreaterThan(0)

  if (assertions.includes('render-entry-presence')) {
    expect(evidence.renderEntries.length).toBeGreaterThan(0)
  }

  const evidenceText = serializedEvidenceText(evidence)
  if (assertions.includes('owner-stage-metadata')) {
    expect(
      renderEntryHasField(evidence, 'ownerStage'),
      'ownerStage metadata'
    ).toBe(true)
  }
  if (assertions.includes('visible-contributor-metadata')) {
    expect(
      renderEntryHasField(evidence, 'visibleContributor'),
      'visibleContributor metadata'
    ).toBe(true)
  }
  if (assertions.includes('geometry-basis-metadata')) {
    expect(
      renderEntryHasField(evidence, 'geometryBasis'),
      'geometryBasis metadata'
    ).toBe(true)
  }
  if (assertions.includes('route-product-signature-metadata')) {
    expect(
      renderEntryHasField(evidence, 'routeId') ||
        renderEntryHasField(evidence, 'productSignature') ||
        renderEntryHasField(evidence, 'productMode'),
      'route or product signature metadata'
    ).toBe(true)
  }
  if (assertions.includes('source-vertex-join-metadata')) {
    expect(evidenceText).toContain('source-vertex')
    expect(evidenceText).toContain('join')
  }
  if (assertions.includes('join-resolution-metadata')) {
    expect(
      renderEntryHasField(evidence, 'authoredJoin'),
      'authoredJoin metadata'
    ).toBe(true)
    expect(
      renderEntryHasField(evidence, 'resolvedJoin'),
      'resolvedJoin metadata'
    ).toBe(true)
    expect(
      renderEntryHasField(evidence, 'angleSource'),
      'angleSource metadata'
    ).toBe(true)
  }
  if (assertions.includes('dash-join-seam-evidence')) {
    expect(evidenceText).toContain('seam')
  }
  if (assertions.includes('render-entry-internal-boundary-fusion')) {
    const failures = evidence.renderEntries
      .filter((entry) => entry.internalSharedBoundaryCount > 0)
      .map((entry) => ({
        index: entry.index,
        cacheKey: entry.cacheKey,
        visibleContributor: entry.visibleContributor,
        routeId: entry.routeId,
        productSignature: entry.productSignature,
        polygonCount: entry.polygonCount,
        internalSharedBoundaryCount: entry.internalSharedBoundaryCount,
        internalSharedBoundaryMaxLength: entry.internalSharedBoundaryMaxLength
      }))
    expect(
      failures,
      `render entries must not carry internally shared-boundary polygons into renderer projection: ${JSON.stringify(
        failures,
        null,
        2
      )}`
    ).toEqual([])
  }
  if (assertions.includes('smooth-continuity-ownership')) {
    expect(evidenceText).toContain('smooth')
    expect(evidenceText).toContain('continuity')
  }
  if (assertions.includes('descriptor-channel-separation')) {
    expect(
      evidence.renderEntries.every(
        (entry) => entry.descriptorProductPolygonsVisible !== true
      )
    ).toBe(true)
  }
  if (assertions.includes('hidden-output-non-geometry')) {
    expect(
      evidence.renderEntries.every((entry) => !hasVisibleRenderGeometry(entry))
    ).toBe(true)
  }
  if (assertions.includes('cache-hit-non-geometry')) {
    expect(
      Object.keys(evidence.pipelineCounters).some((counterName) =>
        isStrokeProductCacheHitCounter(counterName)
      ),
      'stroke product cache-hit counter evidence'
    ).toBe(true)
  }
}

export const assertNoForbiddenContributors = (
  evidence: StrokeRuntimeEvidence,
  forbiddenContributors: readonly string[]
) => {
  const evidenceText = serializedEvidenceText(evidence)
  for (const contributor of forbiddenContributors) {
    expect(evidenceText, `forbidden contributor: ${contributor}`).not.toContain(
      contributor.toLowerCase()
    )
  }
}

export const assertComputedJoin = (
  evidence: StrokeRuntimeEvidence,
  joinType: StrokeJoin
) => {
  const stroke = evidence.computed?.strokes[0] as
    | { joinType?: unknown }
    | undefined
  expect(stroke?.joinType).toBe(joinType)
}

export const assertReferenceAcutePaintEvidence = (
  evidence: StrokeRuntimeEvidence
) => {
  const stroke = evidence.computed?.strokes[0] as
    | {
        fill?: {
          color?: unknown
          opacity?: unknown
          visible?: unknown
        }
      }
    | undefined
  const fill = evidence.computed?.fills[0] as
    | {
        color?: unknown
        opacity?: unknown
        visible?: unknown
      }
    | undefined

  expect(stroke?.fill?.color, 'reference stroke color').toBe('#ff0000')
  expect(stroke?.fill?.opacity, 'reference stroke opacity').toBe(0.5)
  expect(stroke?.fill?.visible, 'reference stroke visibility').toBe(true)
  expect(fill?.color, 'reference inside fill color').toBe('#00ff00')
  expect(fill?.opacity, 'reference inside fill opacity').toBe(1)
  expect(fill?.visible, 'reference inside fill visibility').toBe(true)
}

export const assertReferenceAcuteDashBodyEvidence = (
  evidence: StrokeRuntimeEvidence
) => {
  const dashBodyEntries = evidence.renderEntries.filter(
    (entry) =>
      entry.visibleContributor === 'dash-interval-body' ||
      (entry.visibleContributor === null &&
        entry.ownerStage === null &&
        entry.intervalIds.length > 0 &&
        entry.polygonCount > 0 &&
        entry.strokePathGroupCount === 0)
  )
  expect(
    dashBodyEntries.length,
    'reference acute runtime must expose visible dash body or same-paint aggregate render entries'
  ).toBeGreaterThan(0)

  const entryIndexesByInterval = new Map<string, number[]>()
  dashBodyEntries.forEach((entry) => {
    const intervalIds = Array.from(
      new Set([...entry.intervalIds, ...entry.dashProductIntervalIds])
    ).sort()
    expect(
      intervalIds.length,
      `dash body render entry must preserve at least one interval identity: ${JSON.stringify(
        {
          index: entry.index,
          intervalIds,
          productSignature: entry.productSignature,
          polygonCount: entry.polygonCount,
          polygonBounds: entry.polygonBounds,
          polygonArea: entry.polygonArea
        },
        null,
        2
      )}`
    ).toBeGreaterThan(0)

    expect(
      entry.polygonCount,
      `dash body render entry must expose visible product polygons: ${JSON.stringify(
        {
          index: entry.index,
          intervalIds,
          productSignature: entry.productSignature,
          polygonCount: entry.polygonCount,
          polygonBounds: entry.polygonBounds,
          polygonArea: entry.polygonArea
        },
        null,
        2
      )}`
    ).toBeGreaterThan(0)

    intervalIds.forEach((intervalId) => {
      const indexes = entryIndexesByInterval.get(intervalId) ?? []
      indexes.push(entry.index)
      entryIndexesByInterval.set(intervalId, indexes)
    })
  })

  for (const [intervalId, indexes] of entryIndexesByInterval) {
    expect(
      indexes.length,
      `dash interval ${intervalId} must not be emitted as duplicate fragmented render entries: ${JSON.stringify(
        {
          intervalId,
          indexes
        },
        null,
        2
      )}`
    ).toBe(1)
  }
}

interface IndependentSegmentDashPixelProbe {
  kind: 'terminal' | 'gap'
  segmentId: string
  sourceSegmentIndex: number
  role: 'start' | 'end' | 'start-gap' | 'end-gap'
  workspacePoint: WorkspacePoint
  radiusWorkspace: number
}

interface IndependentSegmentDashPixelProbeResult {
  kind: IndependentSegmentDashPixelProbe['kind']
  segmentId: string
  sourceSegmentIndex: number
  role: IndependentSegmentDashPixelProbe['role']
  workspacePoint: WorkspacePoint
  screenPoint: WorkspacePoint
  radiusPixels: number
  redPixelCount: number
  sampledPixelCount: number
}

interface OutsideDashedJoinPixelProbe {
  kind: 'dash-body' | 'seam' | 'gap' | 'wrong-side'
  segmentId: string
  sourceSegmentIndex: number
  role: 'start' | 'end'
  sampleIndex: number
  workspacePoint: WorkspacePoint
  radiusWorkspace: number
  expectedRed: boolean
}

interface OutsideDashedJoinPixelProbeResult {
  kind: OutsideDashedJoinPixelProbe['kind']
  segmentId: string
  sourceSegmentIndex: number
  role: OutsideDashedJoinPixelProbe['role']
  sampleIndex: number
  workspacePoint: WorkspacePoint
  screenPoint: WorkspacePoint
  radiusPixels: number
  redPixelCount: number
  sampledPixelCount: number
  redRatio: number
  expectedRed: boolean
}

const interpolatePoint = (
  start: WorkspacePoint,
  end: WorkspacePoint,
  ratio: number
): WorkspacePoint => ({
  x: start.x + (end.x - start.x) * ratio,
  y: start.y + (end.y - start.y) * ratio
})

const addPoint = (
  first: WorkspacePoint,
  second: WorkspacePoint
): WorkspacePoint => ({
  x: first.x + second.x,
  y: first.y + second.y
})

const scalePoint = (point: WorkspacePoint, scalar: number): WorkspacePoint => ({
  x: point.x * scalar,
  y: point.y * scalar
})

const normalizePoint = (point: WorkspacePoint): WorkspacePoint | null => {
  const length = Math.hypot(point.x, point.y)
  return length > 0 ? { x: point.x / length, y: point.y / length } : null
}

const isPointInsidePolygon = (
  point: WorkspacePoint,
  polygon: readonly WorkspacePoint[]
) => {
  let inside = false
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    if (!current || !previous) {
      continue
    }
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x
    if (intersects) {
      inside = !inside
    }
  }
  return inside
}

const getOutsideNormal = (
  start: WorkspacePoint,
  end: WorkspacePoint,
  fillPolygon: readonly WorkspacePoint[]
): WorkspacePoint | null => {
  const direction = normalizePoint({ x: end.x - start.x, y: end.y - start.y })
  if (!direction) {
    return null
  }
  const left = { x: -direction.y, y: direction.x }
  const right = { x: direction.y, y: -direction.x }
  const midpoint = interpolatePoint(start, end, 0.5)
  const leftInside = isPointInsidePolygon(
    addPoint(midpoint, scalePoint(left, 2)),
    fillPolygon
  )
  const rightInside = isPointInsidePolygon(
    addPoint(midpoint, scalePoint(right, 2)),
    fillPolygon
  )
  if (leftInside !== rightInside) {
    return leftInside ? right : left
  }
  return right
}

const buildIndependentSegmentDashPixelProbes = (
  computedData: StrokeVectorComputedData
): IndependentSegmentDashPixelProbe[] => {
  const stroke = computedData.strokes[0]
  const network = Object.values(computedData.networks)[0]
  if (!stroke || !network) {
    throw new Error('Missing stroke or vector network for dash pixel probes')
  }

  const terminalDistance = stroke.dash * 0.25
  const gapProbeDistance = stroke.dash * 0.5 + stroke.gap * 0.3
  const terminalRadiusWorkspace = Math.max(4, stroke.width * 0.35)
  const gapRadiusWorkspace = Math.max(1.25, stroke.width * 0.12)

  return network.segmentIds.flatMap((segmentId, sourceSegmentIndex) => {
    const segment = computedData.segments[segmentId]
    if (!segment) {
      return []
    }
    if (segment.outControlId !== null || segment.inControlId !== null) {
      throw new Error(
        `Independent segment dash pixel oracle expects straight segments; ${segmentId} has control handles`
      )
    }
    const start = computedData.points[segment.startId]
    const end = computedData.points[segment.endId]
    if (!start || !end) {
      return []
    }
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    if (length <= stroke.dash + stroke.gap) {
      throw new Error(
        `Independent segment ${segmentId} is too short for terminal/gap pixel probes`
      )
    }

    const startTerminalRatio = terminalDistance / length
    const endTerminalRatio = 1 - terminalDistance / length
    const startGapRatio = gapProbeDistance / length
    const endGapRatio = 1 - gapProbeDistance / length

    return [
      {
        kind: 'terminal' as const,
        segmentId,
        sourceSegmentIndex,
        role: 'start' as const,
        workspacePoint: interpolatePoint(start, end, startTerminalRatio),
        radiusWorkspace: terminalRadiusWorkspace
      },
      {
        kind: 'terminal' as const,
        segmentId,
        sourceSegmentIndex,
        role: 'end' as const,
        workspacePoint: interpolatePoint(start, end, endTerminalRatio),
        radiusWorkspace: terminalRadiusWorkspace
      },
      {
        kind: 'gap' as const,
        segmentId,
        sourceSegmentIndex,
        role: 'start-gap' as const,
        workspacePoint: interpolatePoint(start, end, startGapRatio),
        radiusWorkspace: gapRadiusWorkspace
      },
      {
        kind: 'gap' as const,
        segmentId,
        sourceSegmentIndex,
        role: 'end-gap' as const,
        workspacePoint: interpolatePoint(start, end, endGapRatio),
        radiusWorkspace: gapRadiusWorkspace
      }
    ]
  })
}

const getPrimaryNetwork = (computedData: StrokeVectorComputedData) =>
  Object.values(computedData.networks)[0]

const getPrimaryFillPolygon = (
  computedData: StrokeVectorComputedData
): WorkspacePoint[] => {
  const network = getPrimaryNetwork(computedData)
  return (
    network?.pointIds
      .map((pointId) => computedData.points[pointId])
      .filter((point): point is VectorPoint => point !== undefined) ?? []
  )
}

const getPolygonCentroid = (
  polygon: readonly WorkspacePoint[]
): WorkspacePoint | null => {
  if (polygon.length === 0) {
    return null
  }
  const summed = polygon.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x,
      y: accumulator.y + point.y
    }),
    { x: 0, y: 0 }
  )
  return {
    x: summed.x / polygon.length,
    y: summed.y / polygon.length
  }
}

const buildOutsideDashedJoinPixelProbes = (
  computedData: StrokeVectorComputedData
): OutsideDashedJoinPixelProbe[] => {
  const stroke = computedData.strokes[0]
  const network = getPrimaryNetwork(computedData)
  const fillPolygon = getPrimaryFillPolygon(computedData)
  const fillCentroid = getPolygonCentroid(fillPolygon)
  if (!stroke || !network || fillPolygon.length < 3 || !fillCentroid) {
    throw new Error('Missing stroke, network, or fill polygon for join probes')
  }
  if (stroke.position !== 'outside' || stroke.style !== 'dashed') {
    throw new Error(
      'Outside dashed join pixel oracle requires outside dashed stroke'
    )
  }

  const dashDistances = [
    Math.max(1.5, stroke.width * 0.25),
    stroke.width * 0.65,
    Math.min(stroke.dash * 0.45, stroke.width * 1.1)
  ]
  const gapDistance = stroke.dash * 0.5 + stroke.gap * 0.5
  const outsideOffsets = [stroke.width * 0.35, stroke.width * 0.7]
  const wrongSideOffset = stroke.width * 0.45
  const radiusWorkspace = Math.max(1, stroke.width * 0.12)

  return network.segmentIds.flatMap((segmentId, sourceSegmentIndex) => {
    const segment = computedData.segments[segmentId]
    if (!segment) {
      return []
    }
    if (segment.outControlId !== null || segment.inControlId !== null) {
      return []
    }
    const start = computedData.points[segment.startId]
    const end = computedData.points[segment.endId]
    if (!start || !end) {
      return []
    }
    const direction = normalizePoint({ x: end.x - start.x, y: end.y - start.y })
    const outsideNormal = getOutsideNormal(start, end, fillPolygon)
    if (!direction || !outsideNormal) {
      return []
    }
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y)
    if (segmentLength <= gapDistance + stroke.width) {
      return []
    }

    const buildEndpointProbes = (
      role: 'start' | 'end',
      endpoint: WorkspacePoint,
      sign: 1 | -1
    ) => {
      const probes: OutsideDashedJoinPixelProbe[] = []
      const fillDirection = normalizePoint({
        x: fillCentroid.x - endpoint.x,
        y: fillCentroid.y - endpoint.y
      })
      dashDistances.forEach((distanceFromEndpoint, dashSampleIndex) => {
        const sourcePoint = addPoint(
          endpoint,
          scalePoint(direction, sign * distanceFromEndpoint)
        )
        outsideOffsets.forEach((offset, offsetIndex) => {
          probes.push({
            kind: dashSampleIndex === 0 ? 'seam' : 'dash-body',
            segmentId,
            sourceSegmentIndex,
            role,
            sampleIndex: dashSampleIndex * outsideOffsets.length + offsetIndex,
            workspacePoint: addPoint(
              sourcePoint,
              scalePoint(outsideNormal, offset)
            ),
            radiusWorkspace,
            expectedRed: true
          })
        })
        if (fillDirection) {
          probes.push({
            kind: 'wrong-side',
            segmentId,
            sourceSegmentIndex,
            role,
            sampleIndex: dashSampleIndex,
            workspacePoint: addPoint(
              endpoint,
              scalePoint(
                fillDirection,
                wrongSideOffset + dashSampleIndex * stroke.width * 0.8
              )
            ),
            radiusWorkspace,
            expectedRed: false
          })
        }
      })

      const gapSourcePoint = addPoint(
        endpoint,
        scalePoint(direction, sign * gapDistance)
      )
      probes.push({
        kind: 'gap',
        segmentId,
        sourceSegmentIndex,
        role,
        sampleIndex: 0,
        workspacePoint: addPoint(
          gapSourcePoint,
          scalePoint(outsideNormal, stroke.width * 0.55)
        ),
        radiusWorkspace,
        expectedRed: false
      })
      return probes
    }

    return [
      ...buildEndpointProbes('start', start, 1),
      ...buildEndpointProbes('end', end, -1)
    ]
  })
}

const inspectOutsideDashedJoinPixels = async ({
  page,
  screenshotBuffer,
  probes
}: {
  page: Page
  screenshotBuffer: Buffer
  probes: OutsideDashedJoinPixelProbe[]
}): Promise<OutsideDashedJoinPixelProbeResult[]> => {
  const viewportState = await getViewportState(page)

  return page.evaluate(
    async ({ dataUrl, viewportState, probes }) => {
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () =>
          reject(new Error('Failed to decode outside dashed join oracle image'))
        image.src = dataUrl
      })

      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas context for outside dashed join oracle')
      }
      context.drawImage(image, 0, 0)
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      ).data
      const isStrokeRed = (
        red: number,
        green: number,
        blue: number,
        alpha: number
      ) =>
        alpha > 96 &&
        red > 70 &&
        blue < 120 &&
        green < 230 &&
        (red > green * 1.15 ||
          (green > 40 && green < 200 && Math.abs(red - green) < 105))

      return probes.map((probe) => {
        const screenPoint = {
          x:
            probe.workspacePoint.x * viewportState.zoom +
            viewportState.viewport.x,
          y:
            probe.workspacePoint.y * viewportState.zoom +
            viewportState.viewport.y
        }
        const radiusPixels = Math.max(
          1,
          Math.ceil(probe.radiusWorkspace * viewportState.zoom)
        )
        let redPixelCount = 0
        let sampledPixelCount = 0
        const minX = Math.max(0, Math.floor(screenPoint.x - radiusPixels))
        const maxX = Math.min(
          canvas.width - 1,
          Math.ceil(screenPoint.x + radiusPixels)
        )
        const minY = Math.max(0, Math.floor(screenPoint.y - radiusPixels))
        const maxY = Math.min(
          canvas.height - 1,
          Math.ceil(screenPoint.y + radiusPixels)
        )

        for (let y = minY; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            if (
              Math.hypot(x - screenPoint.x, y - screenPoint.y) > radiusPixels
            ) {
              continue
            }
            const offset = (y * canvas.width + x) * 4
            const red = pixels[offset]
            const green = pixels[offset + 1]
            const blue = pixels[offset + 2]
            const alpha = pixels[offset + 3]
            sampledPixelCount += 1
            if (isStrokeRed(red, green, blue, alpha)) {
              redPixelCount += 1
            }
          }
        }

        return {
          kind: probe.kind,
          segmentId: probe.segmentId,
          sourceSegmentIndex: probe.sourceSegmentIndex,
          role: probe.role,
          sampleIndex: probe.sampleIndex,
          workspacePoint: probe.workspacePoint,
          screenPoint,
          radiusPixels,
          redPixelCount,
          sampledPixelCount,
          redRatio:
            sampledPixelCount > 0 ? redPixelCount / sampledPixelCount : 0,
          expectedRed: probe.expectedRed
        }
      })
    },
    {
      dataUrl: `data:image/png;base64,${screenshotBuffer.toString('base64')}`,
      viewportState,
      probes
    }
  )
}

const inspectIndependentSegmentDashPixels = async ({
  page,
  screenshotBuffer,
  probes
}: {
  page: Page
  screenshotBuffer: Buffer
  probes: IndependentSegmentDashPixelProbe[]
}): Promise<IndependentSegmentDashPixelProbeResult[]> => {
  const viewportState = await getViewportState(page)

  return page.evaluate(
    async ({ dataUrl, viewportState, probes }) => {
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () =>
          reject(new Error('Failed to decode dash pixel oracle image'))
        image.src = dataUrl
      })

      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas context for dash pixel oracle')
      }
      context.drawImage(image, 0, 0)
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      ).data
      const isStrokeRed = (
        red: number,
        green: number,
        blue: number,
        alpha: number
      ) =>
        alpha > 96 &&
        red > 70 &&
        blue < 100 &&
        green < 220 &&
        (red > green * 1.2 ||
          (green > 40 && green < 190 && Math.abs(red - green) < 100))

      return probes.map((probe) => {
        const screenPoint = {
          x:
            probe.workspacePoint.x * viewportState.zoom +
            viewportState.viewport.x,
          y:
            probe.workspacePoint.y * viewportState.zoom +
            viewportState.viewport.y
        }
        const radiusPixels = Math.max(
          1,
          Math.ceil(probe.radiusWorkspace * viewportState.zoom)
        )
        let redPixelCount = 0
        let sampledPixelCount = 0
        const minX = Math.max(0, Math.floor(screenPoint.x - radiusPixels))
        const maxX = Math.min(
          canvas.width - 1,
          Math.ceil(screenPoint.x + radiusPixels)
        )
        const minY = Math.max(0, Math.floor(screenPoint.y - radiusPixels))
        const maxY = Math.min(
          canvas.height - 1,
          Math.ceil(screenPoint.y + radiusPixels)
        )

        for (let y = minY; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            if (
              Math.hypot(x - screenPoint.x, y - screenPoint.y) > radiusPixels
            ) {
              continue
            }
            const offset = (y * canvas.width + x) * 4
            const red = pixels[offset]
            const green = pixels[offset + 1]
            const blue = pixels[offset + 2]
            const alpha = pixels[offset + 3]
            sampledPixelCount += 1
            if (isStrokeRed(red, green, blue, alpha)) {
              redPixelCount += 1
            }
          }
        }

        return {
          kind: probe.kind,
          segmentId: probe.segmentId,
          sourceSegmentIndex: probe.sourceSegmentIndex,
          role: probe.role,
          workspacePoint: probe.workspacePoint,
          screenPoint,
          radiusPixels,
          redPixelCount,
          sampledPixelCount
        }
      })
    },
    {
      dataUrl: `data:image/png;base64,${screenshotBuffer.toString('base64')}`,
      viewportState,
      probes
    }
  )
}

export const assertIndependentSegmentDashPixelOracle = async ({
  page,
  computedData,
  label
}: {
  page: Page
  computedData: StrokeVectorComputedData
  label: string
}) => {
  const probes = buildIndependentSegmentDashPixelProbes(computedData)
  const screenshotBuffer = await page.screenshot({ fullPage: false })
  const results = await inspectIndependentSegmentDashPixels({
    page,
    screenshotBuffer,
    probes
  })
  const terminalFailures = results.filter(
    (result) => result.kind === 'terminal' && result.redPixelCount === 0
  )
  const gapFailures = results.filter(
    (result) =>
      result.kind === 'gap' &&
      result.sampledPixelCount > 0 &&
      result.redPixelCount / result.sampledPixelCount > 0.2
  )

  expect(
    terminalFailures,
    `${label} start/end terminal dash zones must contain painted red pixels: ${JSON.stringify(
      results,
      null,
      2
    )}`
  ).toEqual([])
  expect(
    gapFailures,
    `${label} expected gap zones must remain unpainted by red stroke pixels: ${JSON.stringify(
      results,
      null,
      2
    )}`
  ).toEqual([])

  return results
}

export const assertOutsideDashedJoinPixelOracle = async ({
  page,
  computedData,
  label
}: {
  page: Page
  computedData: StrokeVectorComputedData
  label: string
}) => {
  const probes = buildOutsideDashedJoinPixelProbes(computedData)
  expect(
    probes.length,
    `${label} outside dashed join pixel oracle must generate terminal, seam, gap, and wrong-side probes`
  ).toBeGreaterThan(0)

  const screenshotBuffer = await page.screenshot({ fullPage: false })
  const results = await inspectOutsideDashedJoinPixels({
    page,
    screenshotBuffer,
    probes
  })
  const visibleResults = results.filter(
    (result) => result.sampledPixelCount > 0
  )
  const missingCoverageKinds = (
    ['seam', 'dash-body', 'gap', 'wrong-side'] as const
  ).filter((kind) => !visibleResults.some((result) => result.kind === kind))
  const missingDashFailures = visibleResults.filter(
    (result) =>
      result.expectedRed &&
      (result.redPixelCount === 0 || result.redRatio < 0.08)
  )
  const forbiddenRedFailures = visibleResults.filter(
    (result) => !result.expectedRed && result.redRatio > 0.08
  )

  expect(
    missingCoverageKinds,
    `${label} outside dashed pixel oracle must keep seam, dash-body, gap, and fill-domain wrong-side probes inside the captured viewport: ${JSON.stringify(
      results,
      null,
      2
    )}`
  ).toEqual([])
  expect(
    missingDashFailures,
    `${label} outside dashed terminal seam and dash-body probes must stay painted without comb-like cracks or seam gaps: ${JSON.stringify(
      visibleResults,
      null,
      2
    )}`
  ).toEqual([])
  expect(
    forbiddenRedFailures,
    `${label} outside dashed gap and fill-domain wrong-side probes must stay free of red stroke pixels: ${JSON.stringify(
      visibleResults,
      null,
      2
    )}`
  ).toEqual([])

  return results
}

interface RuntimeCoverageAssertionOptions {
  runtimeMetadataAssertions?: readonly StrokeVisualRuntimeAssertion[]
  requiredRuntimeEvidenceFields?: readonly StrokeVisualRuntimeEvidenceField[]
  allowEmptyRenderEntries?: boolean
}

const assertRuntimeEvidenceField = (
  evidence: StrokeRuntimeEvidence,
  field: StrokeVisualRuntimeEvidenceField,
  allowEmptyRenderEntries: boolean
) => {
  switch (field) {
    case 'computedStrokeState':
      expect(
        evidence.computed,
        'computed stroke state must exist'
      ).not.toBeNull()
      expect(evidence.computed?.strokeCount).toBeGreaterThan(0)
      return
    case 'renderEntries':
      if (!allowEmptyRenderEntries) {
        expect(
          evidence.renderEntries.length,
          'render entries must exist'
        ).toBeGreaterThan(0)
      } else {
        expect(Array.isArray(evidence.renderEntries)).toBe(true)
      }
      return
    case 'ownerStage':
      expect(
        renderEntryHasField(evidence, 'ownerStage'),
        'ownerStage metadata'
      ).toBe(true)
      return
    case 'visibleContributor':
      expect(
        renderEntryHasField(evidence, 'visibleContributor'),
        'visibleContributor metadata'
      ).toBe(true)
      return
    case 'geometryBasis':
      expect(
        renderEntryHasField(evidence, 'geometryBasis'),
        'geometryBasis metadata'
      ).toBe(true)
      return
    case 'routeId':
      expect(renderEntryHasField(evidence, 'routeId'), 'routeId metadata').toBe(
        true
      )
      return
    case 'productSignature':
      expect(
        renderEntryHasField(evidence, 'productSignature'),
        'productSignature metadata'
      ).toBe(true)
      return
    case 'productMode':
      expect(
        renderEntryHasField(evidence, 'productMode'),
        'productMode metadata'
      ).toBe(true)
      return
    case 'authoredJoin':
      expect(
        renderEntryHasField(evidence, 'authoredJoin'),
        'authoredJoin metadata'
      ).toBe(true)
      return
    case 'resolvedJoin':
      expect(
        renderEntryHasField(evidence, 'resolvedJoin'),
        'resolvedJoin metadata'
      ).toBe(true)
      return
    case 'vertexAngle':
      expect(
        renderEntryHasField(evidence, 'vertexAngle'),
        'vertexAngle metadata'
      ).toBe(true)
      return
    case 'miterAngle':
      expect(
        renderEntryHasField(evidence, 'miterAngle'),
        'miterAngle metadata'
      ).toBe(true)
      return
    case 'angleSource':
      expect(
        renderEntryHasField(evidence, 'angleSource'),
        'angleSource metadata'
      ).toBe(true)
      return
    case 'angleComparison':
      expect(
        renderEntryHasField(evidence, 'angleComparison'),
        'angleComparison metadata'
      ).toBe(true)
      return
    case 'joinOwnershipRecords':
      expect(
        evidence.renderEntries.some(
          (entry) =>
            entry.joinOwnershipRecordCount > 0 ||
            entry.joinOwnershipMaterializationKinds.length > 0
        ),
        'join ownership records'
      ).toBe(true)
      return
    case 'internalSharedBoundaryRenderPolygons': {
      const failures = evidence.renderEntries
        .filter((entry) => entry.internalSharedBoundaryCount > 0)
        .map((entry) => ({
          index: entry.index,
          cacheKey: entry.cacheKey,
          visibleContributor: entry.visibleContributor,
          routeId: entry.routeId,
          productSignature: entry.productSignature,
          polygonCount: entry.polygonCount,
          internalSharedBoundaryCount: entry.internalSharedBoundaryCount,
          internalSharedBoundaryMaxLength: entry.internalSharedBoundaryMaxLength
        }))
      expect(
        failures,
        `render entries must have no internal shared-boundary polygon pairs: ${JSON.stringify(
          failures,
          null,
          2
        )}`
      ).toEqual([])
      return
    }
    case 'descriptorProductPolygonsVisible':
      expect(
        evidence.renderEntries.every(
          (entry) => entry.descriptorProductPolygonsVisible !== true
        ),
        'descriptor product polygons must not be promoted to visible output'
      ).toBe(true)
      return
    case 'pipelineTrace':
      expect(
        evidence.pipelineTrace.length,
        'pipeline trace evidence'
      ).toBeGreaterThan(0)
      return
    case 'pipelineCounters':
      expect(
        Object.keys(evidence.pipelineCounters).length,
        'pipeline counter evidence'
      ).toBeGreaterThan(0)
      return
    default: {
      const exhaustive: never = field
      throw new Error(`Unhandled runtime evidence field: ${exhaustive}`)
    }
  }
}

export const assertRuntimeEvidenceMatchesCoverageCase = (
  evidence: StrokeRuntimeEvidence,
  coverageCase: StrokeVisualE2ECoverageCase,
  options: RuntimeCoverageAssertionOptions = {}
) => {
  const runtimeMetadataAssertions =
    options.runtimeMetadataAssertions ?? coverageCase.runtimeMetadataAssertions
  const requiredRuntimeEvidenceFields =
    options.requiredRuntimeEvidenceFields ??
    coverageCase.requiredRuntimeEvidenceFields
  const allowEmptyRenderEntries = options.allowEmptyRenderEntries ?? false

  assertRuntimeEvidenceBasics(evidence, runtimeMetadataAssertions)
  assertNoForbiddenContributors(evidence, coverageCase.forbiddenContributors)

  for (const field of requiredRuntimeEvidenceFields) {
    assertRuntimeEvidenceField(evidence, field, allowEmptyRenderEntries)
  }
}

export const captureRuntimeMetadataArtifact = async ({
  testInfo,
  coverageCase,
  evidence,
  label
}: {
  testInfo: TestInfo
  coverageCase: StrokeVisualE2ECoverageCase
  evidence: StrokeRuntimeEvidence
  label: string
}): Promise<CapturedRuntimeMetadataArtifact> => {
  const metadataPath = testInfo.outputPath(
    `${coverageCase.id}-${label}-runtime-metadata.json`
  )
  await writeFile(
    metadataPath,
    `${JSON.stringify(
      {
        caseId: coverageCase.id,
        title: coverageCase.title,
        baseUrl: process.env.ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL ?? null,
        label,
        runtimeMetadataHash: evidence.metadataHash,
        runtimeEvidence: evidence
      },
      null,
      2
    )}\n`
  )
  await testInfo.attach(`${coverageCase.id}-${label}-runtime-metadata`, {
    path: metadataPath,
    contentType: 'application/json'
  })

  return { metadataPath }
}

export const captureVisualArtifacts = async ({
  page,
  testInfo,
  coverageCase,
  evidence,
  label,
  cropSize = { width: 1320, height: 930 }
}: {
  page: Page
  testInfo: TestInfo
  coverageCase: StrokeVisualE2ECoverageCase
  evidence: StrokeRuntimeEvidence
  label: string
  cropSize?: { width: number; height: number }
}): Promise<CapturedVisualArtifacts> => {
  const metadataPath = testInfo.outputPath(`${coverageCase.id}-${label}.json`)
  const fullScreenshotPath = testInfo.outputPath(
    `${coverageCase.id}-${label}-full.png`
  )
  const focusedCropPath = testInfo.outputPath(
    `${coverageCase.id}-${label}-crop.png`
  )
  const summaryPath = testInfo.outputPath(
    `${coverageCase.id}-${label}-summary.json`
  )

  const viewportState = await getViewportState(page)
  const metadata = {
    caseId: coverageCase.id,
    title: coverageCase.title,
    baseUrl: process.env.ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL ?? null,
    label,
    viewportState,
    runtimeMetadataHash: evidence.metadataHash,
    runtimeEvidence: evidence
  }
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
  await page.screenshot({
    path: fullScreenshotPath,
    fullPage: false
  })
  const focusedCropBuffer = await page.screenshot({
    path: focusedCropPath,
    fullPage: false,
    clip: await getCenteredViewportClip(page, cropSize)
  })
  const focusedCropMetrics = await collectStrokeVisualCropMetrics(
    page,
    focusedCropBuffer
  )
  await writeFile(
    summaryPath,
    `${JSON.stringify(
      {
        caseId: coverageCase.id,
        label,
        baseUrl: process.env.ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL ?? null,
        runtimeMetadataHash: evidence.metadataHash,
        renderEntryCount: evidence.renderEntries.length,
        focusedCropMetrics,
        fullScreenshotPath,
        focusedCropPath,
        metadataPath
      },
      null,
      2
    )}\n`
  )

  await testInfo.attach(`${coverageCase.id}-${label}-metadata`, {
    path: metadataPath,
    contentType: 'application/json'
  })
  await testInfo.attach(`${coverageCase.id}-${label}-full`, {
    path: fullScreenshotPath,
    contentType: 'image/png'
  })
  await testInfo.attach(`${coverageCase.id}-${label}-crop`, {
    path: focusedCropPath,
    contentType: 'image/png'
  })
  await testInfo.attach(`${coverageCase.id}-${label}-summary`, {
    path: summaryPath,
    contentType: 'application/json'
  })

  return {
    metadataPath,
    fullScreenshotPath,
    focusedCropPath,
    summaryPath,
    focusedCropMetrics
  }
}

const collectStrokeVisualCropMetrics = async (
  page: Page,
  screenshotBuffer: Buffer
): Promise<StrokeVisualCropMetrics> =>
  page.evaluate(
    async (dataUrl) => {
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Failed to decode crop image'))
        image.src = dataUrl
      })

      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas context for crop metrics')
      }
      context.drawImage(image, 0, 0)
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      ).data

      let redPixelCount = 0
      let minX = Number.POSITIVE_INFINITY
      let minY = Number.POSITIVE_INFINITY
      let maxX = Number.NEGATIVE_INFINITY
      let maxY = Number.NEGATIVE_INFINITY
      let hash = 2166136261
      const updateHash = (value: number) => {
        hash ^= value & 0xff
        hash = Math.imul(hash, 16777619) >>> 0
      }

      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const offset = (y * canvas.width + x) * 4
          const red = pixels[offset]
          const green = pixels[offset + 1]
          const blue = pixels[offset + 2]
          const alpha = pixels[offset + 3]
          const isStrokeRed =
            alpha > 128 && red > 80 && red > green * 1.2 && red > blue * 1.5
          if (!isStrokeRed) {
            continue
          }

          redPixelCount += 1
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
          updateHash(x)
          updateHash(x >> 8)
          updateHash(y)
          updateHash(y >> 8)
        }
      }

      const redBounds =
        redPixelCount > 0
          ? {
              minX,
              minY,
              maxX,
              maxY,
              width: maxX - minX + 1,
              height: maxY - minY + 1
            }
          : null
      const redBoundsArea = redBounds ? redBounds.width * redBounds.height : 0

      return {
        width: canvas.width,
        height: canvas.height,
        redPixelCount,
        redBounds,
        redDensity: redBoundsArea > 0 ? redPixelCount / redBoundsArea : 0,
        redMaskSignature: `${redPixelCount}:${hash.toString(16)}`
      }
    },
    `data:image/png;base64,${screenshotBuffer.toString('base64')}`
  )
