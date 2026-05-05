export type StrokeRevisionKey =
  | 'sourcePathRevision'
  | 'strokeSpecRevision'
  | 'intervalAllocationRevision'
  | 'topologyClassificationRevision'
  | 'ownershipRevision'
  | 'legalityRevision'
  | 'paintRevision'
  | 'previewModeRevision'

export type StrokeDirtyKey =
  | 'path-topology'
  | 'source-topology-classification'
  | 'interval-allocation'
  | 'one-sided-candidates'
  | 'arrangement-faces'
  | 'ownership'
  | 'legality'
  | 'resolved-regions'
  | 'paint-payload'
  | 'render-hit-export'

export type StrokeRevisionValue = string | number

export type StrokeRevisionSet = Record<StrokeRevisionKey, StrokeRevisionValue>

interface Vec2 {
  x: number
  y: number
}

interface StrokeRevisionStrokeInput {
  visible?: boolean
  style?: string
  position?: string
  width?: number
  join?: string
  miterLimit?: number
  cap?: string
  dashPattern?: readonly number[]
  dashOffset?: number
  kind?: string
  color?: number
  alpha?: number
  gradientStyle?: unknown
  paintKey?: string
}

export interface StrokeRuntimeRevisionInput {
  points: readonly Vec2[]
  closed: boolean
  stroke: StrokeRevisionStrokeInput
  geometryFamily: string
  resolutionStatus: string
  runtimeStatus: string
  runtimeReason?: string
  ownerKey?: string
  networkId?: string
  strokeId?: string
  intervalSignature?: string
  sourceTopology?: string
  intervalTopology?: string
  ownershipStatus?: string
  ownerCount?: number
  previewMode?: 'exact' | 'preview'
}

export interface StrokeDirtyKeyResult {
  changedRevisionKeys: StrokeRevisionKey[]
  dirtyKeys: StrokeDirtyKey[]
}

const REVISION_KEYS: StrokeRevisionKey[] = [
  'sourcePathRevision',
  'strokeSpecRevision',
  'intervalAllocationRevision',
  'topologyClassificationRevision',
  'ownershipRevision',
  'legalityRevision',
  'paintRevision',
  'previewModeRevision'
]

const DIRTY_KEY_ORDER: StrokeDirtyKey[] = [
  'path-topology',
  'source-topology-classification',
  'interval-allocation',
  'one-sided-candidates',
  'arrangement-faces',
  'ownership',
  'legality',
  'resolved-regions',
  'paint-payload',
  'render-hit-export'
]

const DIRTY_KEYS_BY_REVISION: Record<StrokeRevisionKey, StrokeDirtyKey[]> = {
  sourcePathRevision: [
    'path-topology',
    'source-topology-classification',
    'interval-allocation',
    'one-sided-candidates',
    'arrangement-faces',
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  strokeSpecRevision: [
    'interval-allocation',
    'one-sided-candidates',
    'arrangement-faces',
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  intervalAllocationRevision: [
    'interval-allocation',
    'one-sided-candidates',
    'arrangement-faces',
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  topologyClassificationRevision: [
    'source-topology-classification',
    'one-sided-candidates',
    'arrangement-faces',
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  ownershipRevision: [
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  legalityRevision: [
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  paintRevision: ['paint-payload', 'render-hit-export'],
  previewModeRevision: [
    'one-sided-candidates',
    'arrangement-faces',
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ]
}

const isValidRevisionValue = (value: unknown): value is StrokeRevisionValue =>
  (typeof value === 'string' && value.length > 0) ||
  (typeof value === 'number' && Number.isFinite(value))

const normalizeNumber = (value: number) =>
  Number.isFinite(value) ? Number(value.toFixed(6)) : 'invalid'

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`
}

const hashRevision = (prefix: string, value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `${prefix}:${(hash >>> 0).toString(36)}`
}

const buildSourcePathRevision = (points: readonly Vec2[], closed: boolean) =>
  hashRevision(
    'source-path',
    `${closed ? 'closed' : 'open'}|${points
      .map((point) => `${normalizeNumber(point.x)},${normalizeNumber(point.y)}`)
      .join(';')}`
  )

const buildStrokeSpecRevision = (stroke: StrokeRevisionStrokeInput) =>
  hashRevision(
    'stroke-spec',
    [
      stroke.visible ?? '',
      stroke.style ?? '',
      stroke.position ?? '',
      stroke.width ?? '',
      stroke.join ?? '',
      stroke.miterLimit ?? '',
      stroke.cap ?? '',
      stroke.dashPattern?.join(',') ?? '',
      stroke.dashOffset ?? ''
    ].join('|')
  )

const buildPaintRevision = (stroke: StrokeRevisionStrokeInput) =>
  hashRevision(
    'paint',
    [
      stroke.kind ?? '',
      stroke.color ?? '',
      stroke.alpha ?? '',
      stroke.paintKey ?? '',
      stroke.gradientStyle ? stableStringify(stroke.gradientStyle) : ''
    ].join('|')
  )

const buildTopologyClassificationRevision = (
  sourceTopology: string,
  intervalTopology: string,
  closed?: boolean
) =>
  hashRevision(
    'topology-classification',
    [sourceTopology, intervalTopology, closed ?? ''].join('|')
  )

const buildOwnershipRevision = ({
  ownerKey,
  networkId,
  strokeId,
  runtimeStatus,
  runtimeReason,
  ownershipStatus,
  ownerCount
}: {
  ownerKey?: string
  networkId?: string
  strokeId?: string
  runtimeStatus?: string
  runtimeReason?: string
  ownershipStatus?: string
  ownerCount?: number
}) =>
  hashRevision(
    'ownership',
    [
      ownerKey ?? '',
      networkId ?? '',
      strokeId ?? '',
      runtimeStatus ?? '',
      runtimeReason ?? '',
      ownershipStatus ?? '',
      ownerCount ?? 0
    ].join('|')
  )

const buildLegalityRevision = ({
  geometryFamily,
  resolutionStatus,
  runtimeStatus,
  runtimeReason,
  sourceTopology,
  intervalTopology,
  ownershipStatus,
  ownerCount
}: {
  geometryFamily?: string
  resolutionStatus?: string
  runtimeStatus?: string
  runtimeReason?: string
  sourceTopology?: string
  intervalTopology?: string
  ownershipStatus?: string
  ownerCount?: number
}) =>
  hashRevision(
    'legality',
    [
      geometryFamily ?? '',
      resolutionStatus ?? '',
      runtimeStatus ?? '',
      runtimeReason ?? '',
      sourceTopology ?? '',
      intervalTopology ?? '',
      ownershipStatus ?? '',
      ownerCount ?? 0
    ].join('|')
  )

export const buildStrokeRuntimeRevisionSet = ({
  points,
  closed,
  stroke,
  geometryFamily,
  resolutionStatus,
  runtimeStatus,
  runtimeReason,
  ownerKey,
  networkId,
  strokeId,
  intervalSignature = 'solid',
  sourceTopology = closed ? 'closed' : 'open',
  intervalTopology = 'none',
  ownershipStatus = 'not-applicable',
  ownerCount = 0,
  previewMode = 'exact'
}: StrokeRuntimeRevisionInput): StrokeRevisionSet => ({
  sourcePathRevision: buildSourcePathRevision(points, closed),
  strokeSpecRevision: buildStrokeSpecRevision(stroke),
  intervalAllocationRevision: hashRevision(
    'interval-allocation',
    intervalSignature
  ),
  topologyClassificationRevision: buildTopologyClassificationRevision(
    sourceTopology,
    intervalTopology,
    closed
  ),
  ownershipRevision: buildOwnershipRevision({
    ownerKey,
    networkId,
    strokeId,
    runtimeStatus,
    runtimeReason,
    ownershipStatus,
    ownerCount
  }),
  legalityRevision: buildLegalityRevision({
    geometryFamily,
    resolutionStatus,
    runtimeStatus,
    runtimeReason,
    sourceTopology,
    intervalTopology,
    ownershipStatus,
    ownerCount
  }),
  paintRevision: buildPaintRevision(stroke),
  previewModeRevision: `preview:${previewMode}`
})

export const updateStrokeRuntimeRevisionSetFromMetadata = (
  revisionSet: StrokeRevisionSet | undefined,
  metadata: {
    ownerKey?: string
    networkId?: string
    strokeId?: string
    geometryFamily?: string
    resolutionStatus?: string
    runtimeStatus?: string
    runtimeReason?: string
    sourceTopology?: string
    intervalTopology?: string
    ownershipStatus?: string
    ownerCount?: number
  }
): StrokeRevisionSet | undefined => {
  if (!revisionSet) {
    return undefined
  }

  return {
    ...revisionSet,
    topologyClassificationRevision: buildTopologyClassificationRevision(
      metadata.sourceTopology ?? '',
      metadata.intervalTopology ?? ''
    ),
    ownershipRevision: buildOwnershipRevision(metadata),
    legalityRevision: buildLegalityRevision(metadata)
  }
}

const assertComparableRevisionSet = (
  revisionSet: Partial<StrokeRevisionSet>,
  label: string
) => {
  REVISION_KEYS.forEach((key) => {
    if (!isValidRevisionValue(revisionSet[key])) {
      throw new Error(`Invalid ${label}.${key}`)
    }
  })
}

export const computeStrokeDirtyKeys = (
  previous: Partial<StrokeRevisionSet>,
  next: Partial<StrokeRevisionSet>
): StrokeDirtyKeyResult => {
  assertComparableRevisionSet(previous, 'previous')
  assertComparableRevisionSet(next, 'next')

  const changedRevisionKeys = REVISION_KEYS.filter(
    (key) => previous[key] !== next[key]
  )
  const dirtyKeySet = new Set(
    changedRevisionKeys.flatMap((key) => DIRTY_KEYS_BY_REVISION[key])
  )

  return {
    changedRevisionKeys,
    dirtyKeys: DIRTY_KEY_ORDER.filter((key) => dirtyKeySet.has(key))
  }
}
