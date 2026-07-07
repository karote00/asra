import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from 'vitest'

type StrokeParameterCoverageRole =
  | 'consume'
  | 'preserve'
  | 'forbid'
  | 'dirty-key'
  | 'cache-key'
  | 'output-metadata'
  | 'not-applicable'

interface InspectorData {
  steps: { id: string }[]
  inspectorContractErrors: string[]
  strokeParameterIds: string[]
  strokeParameterCoverageRoles: StrokeParameterCoverageRole[]
  strokeParameterCoverageMatrix: Record<
    string,
    Record<string, StrokeParameterCoverageRole[]>
  >
  strokeParameterCoverageErrors: string[]
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

const strokeParameterIds = [
  'stroke.fill.visible',
  'stroke.fill.kind',
  'stroke.fill.color',
  'stroke.fill.opacity',
  'stroke.fill.gradient',
  'stroke.fill.colorFormat',
  'stroke.fill.defaultColorFormat',
  'stroke.style',
  'stroke.position',
  'stroke.width',
  'stroke.dash',
  'stroke.gap',
  'stroke.capType',
  'stroke.joinType',
  'stroke.miterAngle'
]

const strokeParameterCoverageRoles: StrokeParameterCoverageRole[] = [
  'consume',
  'preserve',
  'forbid',
  'dirty-key',
  'cache-key',
  'output-metadata',
  'not-applicable'
]

const paintParameterIds = [
  'stroke.fill.visible',
  'stroke.fill.kind',
  'stroke.fill.color',
  'stroke.fill.opacity',
  'stroke.fill.gradient'
]
const paintDisplayParameterIds = [
  'stroke.fill.colorFormat',
  'stroke.fill.defaultColorFormat'
]
const strokeGeometryParameterIds = [
  'stroke.style',
  'stroke.position',
  'stroke.width',
  'stroke.dash',
  'stroke.gap',
  'stroke.capType',
  'stroke.joinType',
  'stroke.miterAngle'
]
const dashParameterIds = ['stroke.dash', 'stroke.gap']
const joinParameterIds = ['stroke.joinType', 'stroke.miterAngle']
const productFamilyParameterIds = [
  'stroke.style',
  'stroke.position',
  'stroke.dash',
  'stroke.gap'
]

const normalizeRoles = (
  roles: StrokeParameterCoverageRole | StrokeParameterCoverageRole[]
) => (Array.isArray(roles) ? roles : [roles])

const coverageFor = (
  defaultRoles: StrokeParameterCoverageRole | StrokeParameterCoverageRole[]
) =>
  Object.fromEntries(
    strokeParameterIds.map((parameterId) => [
      parameterId,
      normalizeRoles(defaultRoles)
    ])
  )

const withRoles = (
  base: Record<string, StrokeParameterCoverageRole[]>,
  parameterIds: string[],
  roles: StrokeParameterCoverageRole | StrokeParameterCoverageRole[]
) => {
  const next = { ...base }
  for (const parameterId of parameterIds) {
    next[parameterId] = normalizeRoles(roles)
  }
  return next
}

const baseForbiddenCoverage = coverageFor('forbid')
const basePreserveCoverage = coverageFor('preserve')
const baseOutputMetadataCoverage = coverageFor('output-metadata')

const expectedCoverageByStep: Record<
  string,
  Record<string, StrokeParameterCoverageRole[]>
> = {
  'feature-session-intent': coverageFor('consume'),
  'path-editing-intent': baseForbiddenCoverage,
  'point-handle-drag-operation': baseForbiddenCoverage,
  'structural-vector-operation': baseForbiddenCoverage,
  'common-api-domain-adapter': coverageFor(['consume', 'preserve']),
  'canonical-workspace-data': basePreserveCoverage,
  'validate-topology': baseForbiddenCoverage,
  'computed-patch-builder': coverageFor(['consume', 'preserve']),
  'transaction-undo-boundary': basePreserveCoverage,
  'scene-tree-commit': basePreserveCoverage,
  'computed-patch-event': basePreserveCoverage,
  'downstream-subscriber-routing': basePreserveCoverage,
  'render-mirror-patch-apply': basePreserveCoverage,
  'render-data-derivation': coverageFor(['consume', 'preserve']),
  'dirty-revision-graph': coverageFor('dirty-key'),
  'stage-product-cache': withRoles(
    coverageFor('cache-key'),
    paintDisplayParameterIds,
    'forbid'
  ),
  'render-strategy-entry': baseForbiddenCoverage,
  'normalize-render-data': coverageFor(['consume', 'preserve']),
  'normalize-stroke-spec': coverageFor('consume'),
  'shared-geometry-model': baseForbiddenCoverage,
  'resolve-source-families': withRoles(
    baseForbiddenCoverage,
    ['stroke.style', 'stroke.position'],
    'consume'
  ),
  'resolve-stroke-domains': withRoles(
    baseForbiddenCoverage,
    ['stroke.position'],
    'consume'
  ),
  'allocate-dash-intervals': withRoles(
    baseForbiddenCoverage,
    [
      'stroke.style',
      'stroke.width',
      'stroke.dash',
      'stroke.gap',
      'stroke.capType'
    ],
    'consume'
  ),
  'select-stroke-product-family': withRoles(
    baseForbiddenCoverage,
    productFamilyParameterIds,
    'consume'
  ),
  'build-center-stroke-products': withRoles(
    baseForbiddenCoverage,
    [
      'stroke.style',
      'stroke.position',
      'stroke.width',
      'stroke.dash',
      'stroke.gap',
      'stroke.capType',
      'stroke.joinType',
      'stroke.miterAngle'
    ],
    'consume'
  ),
  'build-constrained-solid-products': withRoles(
    baseForbiddenCoverage,
    [
      'stroke.style',
      'stroke.position',
      'stroke.width',
      'stroke.capType',
      'stroke.joinType',
      'stroke.miterAngle'
    ],
    'consume'
  ),
  'build-dash-interval-body-products': withRoles(
    baseForbiddenCoverage,
    [
      'stroke.style',
      'stroke.position',
      'stroke.width',
      'stroke.dash',
      'stroke.gap',
      'stroke.capType'
    ],
    'consume'
  ),
  'build-source-vertex-join-products': withRoles(
    withRoles(baseForbiddenCoverage, dashParameterIds, [
      'preserve',
      'output-metadata'
    ]),
    [
      'stroke.position',
      'stroke.width',
      'stroke.capType',
      'stroke.joinType',
      'stroke.miterAngle'
    ],
    'consume'
  ),
  'build-terminal-body-products': withRoles(
    withRoles(baseForbiddenCoverage, joinParameterIds, 'preserve'),
    [
      'stroke.position',
      'stroke.width',
      'stroke.dash',
      'stroke.gap',
      'stroke.capType'
    ],
    'consume'
  ),
  'build-smooth-continuity-products': withRoles(
    withRoles(baseForbiddenCoverage, joinParameterIds, 'forbid'),
    [
      'stroke.position',
      'stroke.width',
      'stroke.dash',
      'stroke.gap',
      'stroke.capType'
    ],
    'consume'
  ),
  'select-stroke-descriptor-strategy': withRoles(
    baseForbiddenCoverage,
    strokeGeometryParameterIds,
    'consume'
  ),
  'apply-legality': basePreserveCoverage,
  'build-resolved-stroke-regions': basePreserveCoverage,
  'attach-paint-payload': withRoles(
    withRoles(basePreserveCoverage, paintDisplayParameterIds, 'forbid'),
    paintParameterIds,
    'consume'
  ),
  'build-final-faces': basePreserveCoverage,
  'materialize-stroke-product-descriptors': withRoles(
    basePreserveCoverage,
    strokeGeometryParameterIds,
    ['consume', 'output-metadata']
  ),
  'emit-render-hit-export-packets': baseOutputMetadataCoverage,
  'render-entries': coverageFor(['preserve', 'output-metadata']),
  'renderer-projection': coverageFor(['preserve', 'forbid']),
  'hit-export': coverageFor(['preserve', 'output-metadata']),
  'runtime-diagnostics': baseOutputMetadataCoverage
}

let cachedInspectorData: InspectorData | null = null

const loadInspectorData = (): InspectorData => {
  if (cachedInspectorData) {
    return cachedInspectorData
  }

  const existingData = (
    globalThis as typeof globalThis & {
      window?: { STROKE_FLOW_INSPECTOR_DATA?: InspectorData }
    }
  ).window?.STROKE_FLOW_INSPECTOR_DATA
  if (existingData) {
    cachedInspectorData = existingData
    return cachedInspectorData
  }

  const windowRecord: { STROKE_FLOW_INSPECTOR_DATA?: InspectorData } = {}
  ;(globalThis as typeof globalThis & { window?: unknown }).window =
    windowRecord
  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  require(inspectorPath)

  const data = windowRecord.STROKE_FLOW_INSPECTOR_DATA
  expect(data).toBeDefined()
  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  cachedInspectorData = data as InspectorData
  return cachedInspectorData
}

export const assertStrokeParameterCoverageForStep = (stepId: string) => {
  const data = loadInspectorData()
  const step = data.steps.find((candidate) => candidate.id === stepId)
  const expectedCoverage = expectedCoverageByStep[stepId]

  expect(data.inspectorContractErrors).toEqual([])
  expect(data.strokeParameterCoverageErrors).toEqual([])
  expect(data.strokeParameterIds).toEqual(strokeParameterIds)
  expect(data.strokeParameterCoverageRoles).toEqual(
    strokeParameterCoverageRoles
  )
  expect(step, stepId).toBeDefined()
  expect(expectedCoverage, stepId).toBeDefined()
  expect(data.strokeParameterCoverageMatrix[stepId]).toEqual(expectedCoverage)
}

const collectRecordKeys = (value: unknown, keys = new Set<string>()) => {
  if (!value || typeof value !== 'object') {
    return keys
  }
  for (const key of Object.keys(value)) {
    keys.add(key)
    collectRecordKeys((value as Record<string, unknown>)[key], keys)
  }
  return keys
}

const semanticStrokeOutputKeys = [
  'stroke',
  'fill',
  'dash',
  'gap',
  'capType',
  'strokeCap',
  'cap',
  'joinType',
  'strokeJoin',
  'join',
  'miterAngle',
  'miterLimit',
  'resolvedJoin',
  'vertexAngle',
  'angleSource',
  'paintKey',
  'gradientStyle',
  'colorFormat',
  'defaultColorFormat',
  'strokePathStyle',
  'strokeMaskPolygons',
  'descriptorProductPolygons'
]

export const representativeStrokeParameterPayload = {
  id: 'stroke:parameter-matrix',
  fill: {
    visible: true,
    kind: 'gradient',
    color: '#4976ff',
    opacity: 0.72,
    gradient: {
      kind: 'linear',
      stops: [
        { offset: 0, color: '#4976ff' },
        { offset: 1, color: '#24c8db' }
      ]
    },
    colorFormat: 'srgb',
    defaultColorFormat: 'display-p3'
  },
  style: 'dashed',
  position: 'outside',
  width: 24,
  dash: 12,
  gap: 6,
  capType: 'round',
  joinType: 'miter',
  miterAngle: 29
} as const

export const alternateStrokeParameterPayload = {
  ...representativeStrokeParameterPayload,
  id: 'stroke:parameter-matrix-before',
  fill: {
    visible: true,
    kind: 'gradient',
    color: '#101820',
    opacity: 0.45,
    gradient: {
      kind: 'linear',
      stops: [
        { offset: 0, color: '#101820' },
        { offset: 1, color: '#f2aa4c' }
      ]
    },
    colorFormat: 'display-p3',
    defaultColorFormat: 'srgb'
  },
  style: 'solid',
  position: 'center',
  width: 18,
  dash: 0,
  gap: 0,
  capType: 'butt',
  joinType: 'bevel',
  miterAngle: 16
} as const

export const strokeParameterPayloadAllowedKeys = [
  'strokes',
  'fills',
  'fill',
  'visible',
  'kind',
  'color',
  'opacity',
  'gradient',
  'stops',
  'offset',
  'colorFormat',
  'defaultColorFormat',
  'style',
  'position',
  'width',
  'dash',
  'gap',
  'capType',
  'joinType',
  'miterAngle'
]

export const expectNoStrokeParameterOutputKeys = (
  value: unknown,
  allowedKeys: string[] = []
) => {
  const keys = collectRecordKeys(value)
  const allowed = new Set(allowedKeys)
  for (const key of semanticStrokeOutputKeys) {
    if (!allowed.has(key)) {
      expect(keys.has(key), key).toBe(false)
    }
  }
}

export const expectNoStrokeParameterSourceTokens = (
  source: string,
  allowedTokens: string[] = []
) => {
  const allowed = new Set(allowedTokens)
  for (const token of [
    'stroke.fill',
    'stroke.style',
    'stroke.position',
    'stroke.width',
    'stroke.dash',
    'stroke.gap',
    'stroke.cap',
    'stroke.join',
    'stroke.miter',
    'joinType',
    'capType',
    'miterAngle',
    'miterLimit',
    'resolvedJoin',
    'vertexAngle',
    'angleSource',
    'paintKey',
    'gradientStyle',
    'colorFormat',
    'defaultColorFormat'
  ]) {
    if (!allowed.has(token)) {
      expect(source, token).not.toContain(token)
    }
  }
}
