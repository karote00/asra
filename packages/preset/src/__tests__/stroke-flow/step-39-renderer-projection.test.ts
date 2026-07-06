import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  canReuseSolidGraphicsProjectionCache,
  projectSolidCenterStrokeRenderEntries,
  type SolidCenterStrokeRenderEntry
} from '../../components/stroke-render/solid-center-stroke-render'

type RefactorStatus = 'locked' | 'active' | 'verified'

interface InspectorStep {
  id: string
  refactorStatus: RefactorStatus
  implementationFiles: string[]
  allowedInputs: string[]
  requiredOutputs: string[]
  ownerStage: string
  forbiddenContributors: string[]
}

interface InspectorData {
  steps: InspectorStep[]
  inspectorContractErrors: string[]
}

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../'
)
const require = createRequire(import.meta.url)
const inspectorPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
)
const rendererSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/solid-center-stroke-render.ts'
)

let cachedInspectorData: InspectorData | null = null

const loadInspectorData = (): InspectorData => {
  if (cachedInspectorData) {
    return cachedInspectorData
  }
  const windowRecord: { STROKE_FLOW_INSPECTOR_DATA?: InspectorData } = {}
  ;(globalThis as typeof globalThis & { window?: unknown }).window =
    windowRecord
  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  require(inspectorPath)
  const data = windowRecord.STROKE_FLOW_INSPECTOR_DATA
  expect(data).toBeDefined()
  cachedInspectorData = data as InspectorData
  return cachedInspectorData
}

const visiblePolygon = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 20 },
  { x: 0, y: 20 }
]

const clipPolygon = [
  { x: -5, y: -5 },
  { x: 25, y: -5 },
  { x: 25, y: 25 },
  { x: -5, y: 25 }
]

const strokePathGroups = [
  {
    clipPolygons: [clipPolygon],
    strokePaths: [[{ x: 0, y: 0 }]],
    strokePathStyle: {
      width: 10,
      cap: 'butt' as const,
      join: 'miter' as const,
      miterLimit: 4,
      closed: false
    }
  }
]

const descriptorEntry: SolidCenterStrokeRenderEntry = {
  cacheKey: 'entry:descriptor',
  stroke: {
    color: 0x777777,
    alpha: 0.75,
    gradientStyle: null,
    paintKey: 'paint:descriptor'
  },
  polygons: [visiblePolygon],
  strokePathGroups,
  fillClipPolygons: [clipPolygon],
  fillExcludePolygons: [clipPolygon],
  debugMeta: {
    routeId: 'renderer-projection',
    productMode: 'post-legality-product',
    productSignature: 'descriptor-visible-route',
    visibleContributor: 'declared visible strokePathGroups'
  }
}

const canonicalEntry: SolidCenterStrokeRenderEntry = {
  cacheKey: 'entry:canonical',
  stroke: {
    color: 0x333333,
    alpha: 1,
    gradientStyle: null,
    paintKey: 'paint:canonical'
  },
  polygons: [visiblePolygon],
  strokeMaskPolygons: [visiblePolygon],
  debugMeta: {
    routeId: 'renderer-projection',
    productMode: 'post-legality-product',
    productSignature: 'canonical-final-face'
  }
}

describe('stroke flow step 39: renderer-projection', () => {
  it('keeps renderer-projection as the current or verified thirty-ninth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'renderer-projection')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'renderer-projection'
      ])
    }
  })

  it('declares the exact renderer projection implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'renderer-projection')

    expect(step).toMatchObject({
      ownerStage: 'Product Output renderer projection',
      allowedInputs: [
        'renderer-ready render entries',
        'declared visible stroke paths, masks, clips, excludes, and paint payload'
      ],
      requiredOutputs: [
        'visible pixels from declared render-entry geometry',
        'no stroke semantic metadata mutation'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-render.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
  })

  it('projects descriptor render entries through declared strokePathGroups and preserves style values', () => {
    const [command] = projectSolidCenterStrokeRenderEntries([descriptorEntry])

    expect(command).toEqual(
      expect.objectContaining({
        channel: 'renderer-projection',
        visibility: 'visible-pixels',
        cacheKey: 'entry:descriptor',
        drawRouteType: 'stroke-path-groups',
        stroke: descriptorEntry.stroke,
        polygons: [visiblePolygon],
        strokePathGroups,
        fillClipPolygons: [clipPolygon],
        fillExcludePolygons: [clipPolygon],
        debugMeta: descriptorEntry.debugMeta,
        metadataMutation: false
      })
    )
    expect(command.strokePathGroups?.[0]?.strokePathStyle).toEqual({
      width: 10,
      cap: 'butt',
      join: 'miter',
      miterLimit: 4,
      closed: false
    })
    expect(command).not.toHaveProperty('strokeMaskPolygons')
  })

  it('projects canonical visible masks without creating semantic repairs', () => {
    const [command] = projectSolidCenterStrokeRenderEntries([canonicalEntry])

    expect(command).toEqual(
      expect.objectContaining({
        channel: 'renderer-projection',
        visibility: 'visible-pixels',
        cacheKey: 'entry:canonical',
        drawRouteType: 'masked-solid',
        strokeMaskPolygons: [visiblePolygon],
        metadataMutation: false
      })
    )
    expect(command).not.toHaveProperty('strokePathGroups')
    expect(command).not.toHaveProperty('strokePaths')
  })

  it('does not mutate render entries while projecting draw-route metadata', () => {
    const before = JSON.stringify(descriptorEntry)
    const [command] = projectSolidCenterStrokeRenderEntries([descriptorEntry])

    expect(JSON.stringify(descriptorEntry)).toBe(before)
    expect(command.strokePathGroups).toBe(descriptorEntry.strokePathGroups)
    expect(command.debugMeta).toBe(descriptorEntry.debugMeta)
  })

  it('does not reuse solid-graphics cache when declared polygon coordinates change', () => {
    expect(
      canReuseSolidGraphicsProjectionCache({
        cachedSignature: 'revision:join-output',
        nextSignature: 'revision:join-output',
        cachedPaintKey: 'paint:red-50',
        nextPaintKey: 'paint:red-50',
        cachedCoordinateSignature: 'polygon:bevel',
        nextCoordinateSignature: 'polygon:round',
        dirtyKeys: [],
        geometryDirty: false,
        paintDirty: false,
        allowPaintChange: false
      })
    ).toBe(false)

    expect(
      canReuseSolidGraphicsProjectionCache({
        cachedSignature: 'revision:join-output',
        nextSignature: 'revision:join-output',
        cachedPaintKey: 'paint:red-50',
        nextPaintKey: 'paint:red-50',
        cachedCoordinateSignature: 'polygon:round',
        nextCoordinateSignature: 'polygon:round',
        dirtyKeys: [],
        geometryDirty: false,
        paintDirty: false,
        allowPaintChange: false
      })
    ).toBe(true)
  })

  it('keeps stroke parameters confined to declared render-entry styles without root-level semantic output', () => {
    const [command] = projectSolidCenterStrokeRenderEntries([descriptorEntry])

    expect(command.stroke).toEqual(descriptorEntry.stroke)
    expect(command.strokePathGroups?.[0]?.strokePathStyle).toBe(
      descriptorEntry.strokePathGroups?.[0]?.strokePathStyle
    )
    for (const forbiddenRootField of [
      'width',
      'cap',
      'join',
      'miterAngle',
      'miterLimit',
      'dash',
      'gap',
      'authoredJoin',
      'resolvedJoin',
      'vertexAngle',
      'angleSource'
    ]) {
      expect(command).not.toHaveProperty(forbiddenRootField)
    }
    expect(command.metadataMutation).toBe(false)
  })

  it('keeps projection planning free of geometry construction or owner-stage repair', () => {
    const source = readFileSync(rendererSourcePath, 'utf8')
    const helperStart = source.indexOf(
      'export const projectSolidCenterStrokeRenderEntries = ('
    )
    const helperEnd = source.indexOf('interface SolidStrokeCacheSolidEntry', helperStart)
    expect(helperStart).toBeGreaterThanOrEqual(0)
    expect(helperEnd).toBeGreaterThan(helperStart)
    const helperSource = source.slice(helperStart, helperEnd)

    for (const forbiddenToken of [
      'buildStrokeFinalFaces',
      'buildSourceVertexJoin',
      'endpoint cap repair',
      'descriptorProductPolygons',
      'isPointInside',
      'drawStrokePaths'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })
  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('renderer-projection')
  })

})
