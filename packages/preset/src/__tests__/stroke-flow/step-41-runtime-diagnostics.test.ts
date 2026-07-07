import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  applyCenterDashedOverlapDiagnostics,
  clearCenterDashedOverlapDiagnostics
} from '../../components/stroke-render/center-dashed-overlap-diagnostics'
import {
  clearConstrainedSolidLegalityDiagnostics,
  setConstrainedSolidLegalityDiagnostics
} from '../../components/stroke-render/constrained-solid-legality-diagnostics'
import {
  clearConstrainedSolidOwnershipDiagnostics,
  createEmptyConstrainedSolidOwnershipDiagnostics,
  setConstrainedSolidOwnershipDiagnostics
} from '../../components/stroke-render/constrained-solid-ownership-diagnostics'
import {
  getStrokeDiagnosticsMode,
  shouldEmitFullStrokeDiagnostics,
  shouldEmitStrokeDiagnostics
} from '../../components/stroke-render/stroke-diagnostics-mode'
import { buildStrokeRegionPacketsFromFinalFaces } from '../../components/stroke-render/stroke-region-packet'

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

interface DiagnosticsGlobal {
  __ASYRA_STROKE_DIAGNOSTICS_MODE__?: unknown
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
const regionPacketSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/stroke-region-packet.ts'
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

afterEach(() => {
  delete (globalThis as DiagnosticsGlobal).__ASYRA_STROKE_DIAGNOSTICS_MODE__
})

type FinalFaceInput = Parameters<
  typeof buildStrokeRegionPacketsFromFinalFaces
>[0][number]

const visiblePolygon = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 20 },
  { x: 0, y: 20 }
]

const finalFace = {
  faceId: 'face:diagnostic',
  sourceGeometryIds: ['geometry:diagnostic'],
  polygons: [visiblePolygon],
  bounds: {
    minX: 0,
    minY: 0,
    maxX: 20,
    maxY: 20
  },
  visualPacketKey: 'visual:diagnostic',
  paintKey: 'paint:diagnostic',
  strokeSpecKey: 'stroke-spec:diagnostic',
  ownerSet: [
    {
      ownerKey: 'owner:diagnostic',
      strokeId: 'stroke:diagnostic',
      intervalId: 'interval:diagnostic'
    }
  ],
  intervalIds: ['interval:diagnostic'],
  sourceSpanIds: ['span:diagnostic'],
  sourceNetworkIds: ['network:diagnostic'],
  sourceContourIds: ['contour:diagnostic'],
  legalDomainIds: ['legal:diagnostic'],
  productMode: 'post-legality-product',
  productSignature: 'source-vertex-join',
  debugMeta: {
    productMode: 'post-legality-product',
    productSignature: 'source-vertex-join',
    strokePosition: 'outside' as const,
    revisionSet: {
      sourcePathRevision: 1,
      strokeSpecRevision: 2,
      domainPlanRevision: 3,
      sharedGeometryRevision: 4,
      strokeProductRevision: 5,
      strokeDomainRevision: 6,
      intervalAllocationRevision: 7,
      terminalCapRevision: 8,
      joinShapeRevision: 9,
      ownershipRevision: 10,
      legalityRevision: 11,
      renderOutputRevision: 12,
      paintRevision: 999
    }
  },
  paint: {
    geometryId: 'geometry:diagnostic',
    color: 0x777777,
    alpha: 1,
    paintKey: 'paint:diagnostic'
  }
} satisfies FinalFaceInput

describe('stroke flow step 41: runtime-diagnostics', () => {
  it('keeps runtime-diagnostics as the current or verified forty-first step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'runtime-diagnostics')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'runtime-diagnostics'
      ])
    }
  })

  it('declares the exact diagnostics implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'runtime-diagnostics')

    expect(step).toMatchObject({
      ownerStage: 'Diagnostics runtime evidence channels',
      allowedInputs: [
        'final faces, resolved packets, render entries, and hit/export output ids from upstream stages',
        'diagnostics mode configuration',
        'center dashed overlap candidates and constrained solid legality/ownership evidence'
      ],
      requiredOutputs: [
        'runtime diagnostic properties attached to the graphic object',
        'stroke region diagnostic packets without paint revision',
        'pipeline counters and debug metadata snapshots',
        'cleared diagnostic properties when diagnostics are disabled'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/stroke-diagnostics-mode.ts',
        'packages/preset/src/components/stroke-render/center-dashed-overlap-diagnostics.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-legality-diagnostics.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-ownership-diagnostics.ts',
        'packages/preset/src/components/stroke-render/stroke-region-packet.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
  })

  it('reads explicit diagnostics mode and defaults invalid values to off', () => {
    expect(getStrokeDiagnosticsMode()).toBe('off')
    expect(shouldEmitStrokeDiagnostics()).toBe(false)
    expect(shouldEmitFullStrokeDiagnostics()).toBe(false)
    ;(globalThis as DiagnosticsGlobal).__ASYRA_STROKE_DIAGNOSTICS_MODE__ =
      'summary'
    expect(getStrokeDiagnosticsMode()).toBe('summary')
    expect(shouldEmitStrokeDiagnostics()).toBe(true)
    expect(shouldEmitFullStrokeDiagnostics()).toBe(false)
    ;(globalThis as DiagnosticsGlobal).__ASYRA_STROKE_DIAGNOSTICS_MODE__ =
      'full'
    expect(getStrokeDiagnosticsMode()).toBe('full')
    expect(shouldEmitFullStrokeDiagnostics()).toBe(true)
    ;(globalThis as DiagnosticsGlobal).__ASYRA_STROKE_DIAGNOSTICS_MODE__ =
      'visible-repair'
    expect(getStrokeDiagnosticsMode()).toBe('off')
  })

  it('attaches and clears diagnostics-only runtime properties', () => {
    const graphic: {
      __asyraCenterDashedOverlapDiagnostics?: unknown
      __asyraConstrainedSolidLegalityDiagnostics?: unknown
      __asyraConstrainedSolidOwnershipDiagnostics?: unknown
    } = {}

    applyCenterDashedOverlapDiagnostics(graphic, [], { enabled: true })
    expect(graphic.__asyraCenterDashedOverlapDiagnostics).toEqual({
      candidates: [],
      edges: [],
      components: [],
      ownership: {
        ownedRegions: [],
        passthroughIntervals: [],
        unresolvedBailouts: []
      }
    })

    setConstrainedSolidLegalityDiagnostics(graphic, {
      domains: [],
      acceptedGeometryIds: []
    })
    setConstrainedSolidOwnershipDiagnostics(
      graphic,
      createEmptyConstrainedSolidOwnershipDiagnostics()
    )
    expect(graphic.__asyraConstrainedSolidLegalityDiagnostics).toEqual({
      domains: [],
      acceptedGeometryIds: []
    })
    expect(graphic.__asyraConstrainedSolidOwnershipDiagnostics).toMatchObject({
      candidates: [],
      edges: [],
      components: [],
      ownedRegions: []
    })

    clearCenterDashedOverlapDiagnostics(graphic)
    clearConstrainedSolidLegalityDiagnostics(graphic)
    clearConstrainedSolidOwnershipDiagnostics(graphic)
    expect(graphic).toEqual({})
  })

  it('builds region diagnostic packets without paint revision state', () => {
    const [region] = buildStrokeRegionPacketsFromFinalFaces([finalFace])

    expect(region).toEqual(
      expect.objectContaining({
        regionId: 'face:diagnostic',
        sourceGeometryIds: ['geometry:diagnostic'],
        ownerSet: finalFace.ownerSet,
        intervalIds: ['interval:diagnostic'],
        sourceSpanIds: ['span:diagnostic'],
        sourceNetworkIds: ['network:diagnostic'],
        sourceContourIds: ['contour:diagnostic'],
        legalDomainIds: ['legal:diagnostic'],
        productMode: 'post-legality-product',
        productSignature: 'source-vertex-join',
        strokePosition: 'outside'
      })
    )
    expect(region.revisionSet).toEqual(
      expect.objectContaining({
        sourcePathRevision: 1,
        strokeSpecRevision: 2,
        renderOutputRevision: 12
      })
    )
    expect(region.revisionSet).not.toHaveProperty('paintRevision')
  })

  it('keeps diagnostic region projection free of render, hit, and export output construction', () => {
    const source = readFileSync(regionPacketSourcePath, 'utf8')
    const helperStart = source.indexOf(
      'export const buildStrokeRegionPacketsFromFinalFaces = ('
    )
    const helperEnd = source.indexOf(
      'export const buildStrokeRegionPacketsFromResolvedPackets',
      helperStart
    )
    expect(helperStart).toBeGreaterThanOrEqual(0)
    expect(helperEnd).toBeGreaterThan(helperStart)
    const helperSource = source.slice(helperStart, helperEnd)

    for (const forbiddenToken of [
      'renderSolidCenterStrokeEntries',
      'buildRenderEntry',
      'hitArea',
      'ExportPacket',
      'endpoint cap repair',
      'buildSourceVertexJoin'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })
  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('runtime-diagnostics')
  })
})
