export type StrokeCoreRevisionKey =
  | 'sourcePathRevision'
  | 'strokeSpecRevision'
  | 'topologyClassificationRevision'
  | 'sharedGeometryRevision'
  | 'sourceFamilyRevision'
  | 'strokeDomainRevision'
  | 'intervalAllocationRevision'
  | 'ownershipRevision'
  | 'legalityRevision'
  | 'paintRevision'
  | 'previewModeRevision'

export type StrokeStageRevisionKey =
  | 'sourceTopologyRevision'
  | 'strokeFamilyRevision'
  | 'dashScheduleRevision'
  | 'terminalCapRevision'
  | 'joinShapeRevision'
  | 'candidateRevision'
  | 'arrangementRevision'
  | 'resolvedRegionRevision'
  | 'renderOutputRevision'

export type StrokeRevisionKey = StrokeCoreRevisionKey | StrokeStageRevisionKey

export type StrokeDirtyKey =
  | 'path-topology'
  | 'shared-geometry'
  | 'source-topology-classification'
  | 'source-family'
  | 'stroke-domain'
  | 'interval-allocation'
  | 'one-sided-candidates'
  | 'arrangement-faces'
  | 'ownership'
  | 'legality'
  | 'resolved-regions'
  | 'paint-payload'
  | 'render-hit-export'

export type StrokeRevisionValue = string | number

export type StrokeRevisionSet = Record<
  StrokeCoreRevisionKey,
  StrokeRevisionValue
> &
  Partial<Record<StrokeStageRevisionKey, StrokeRevisionValue>>

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
  sharedGeometrySignature?: string
  sourceFamilySignature?: string
  strokeDomainSignature?: string
  intervalSignature?: string
  sourceTopology?: string
  intervalTopology?: string
  ownershipStatus?: string
  ownerCount?: number
  previewMode?: 'exact' | 'preview' | 'drag-visual'
}

export interface StrokeDirtyKeyResult {
  changedRevisionKeys: StrokeRevisionKey[]
  dirtyKeys: StrokeDirtyKey[]
}

const emitStrokeDirtyCounter = (counterName: string, value = 1) => {
  ;(
    globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value: number
      ) => void
    }
  ).__asyraStrokePipelineCounterSink?.(counterName, value)
}

const REQUIRED_REVISION_KEYS: StrokeCoreRevisionKey[] = [
  'sourcePathRevision',
  'strokeSpecRevision',
  'topologyClassificationRevision',
  'sharedGeometryRevision',
  'sourceFamilyRevision',
  'strokeDomainRevision',
  'intervalAllocationRevision',
  'ownershipRevision',
  'legalityRevision',
  'paintRevision',
  'previewModeRevision'
]

const OPTIONAL_STAGE_REVISION_KEYS: StrokeStageRevisionKey[] = [
  'sourceTopologyRevision',
  'strokeFamilyRevision',
  'dashScheduleRevision',
  'terminalCapRevision',
  'joinShapeRevision',
  'candidateRevision',
  'arrangementRevision',
  'resolvedRegionRevision',
  'renderOutputRevision'
]

const REVISION_KEYS: StrokeRevisionKey[] = [
  ...REQUIRED_REVISION_KEYS,
  ...OPTIONAL_STAGE_REVISION_KEYS
]

const DIRTY_KEY_ORDER: StrokeDirtyKey[] = [
  'path-topology',
  'shared-geometry',
  'source-topology-classification',
  'source-family',
  'stroke-domain',
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
    'shared-geometry',
    'source-topology-classification',
    'source-family',
    'stroke-domain',
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
    'source-family',
    'stroke-domain',
    'interval-allocation',
    'one-sided-candidates',
    'arrangement-faces',
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  sourceTopologyRevision: [
    'source-topology-classification',
    'source-family',
    'stroke-domain',
    'interval-allocation',
    'one-sided-candidates',
    'arrangement-faces',
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  strokeFamilyRevision: [
    'source-family',
    'stroke-domain',
    'interval-allocation',
    'one-sided-candidates',
    'arrangement-faces',
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  dashScheduleRevision: [
    'interval-allocation',
    'one-sided-candidates',
    'arrangement-faces',
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  terminalCapRevision: [
    'one-sided-candidates',
    'arrangement-faces',
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  joinShapeRevision: [
    'one-sided-candidates',
    'arrangement-faces',
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  sharedGeometryRevision: [
    'shared-geometry',
    'source-family',
    'stroke-domain',
    'interval-allocation',
    'one-sided-candidates',
    'arrangement-faces',
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  sourceFamilyRevision: [
    'source-family',
    'stroke-domain',
    'interval-allocation',
    'one-sided-candidates',
    'arrangement-faces',
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  strokeDomainRevision: [
    'stroke-domain',
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
    'source-family',
    'stroke-domain',
    'interval-allocation',
    'one-sided-candidates',
    'arrangement-faces',
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  candidateRevision: [
    'one-sided-candidates',
    'arrangement-faces',
    'ownership',
    'legality',
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  arrangementRevision: [
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
  resolvedRegionRevision: [
    'resolved-regions',
    'paint-payload',
    'render-hit-export'
  ],
  paintRevision: ['paint-payload', 'render-hit-export'],
  renderOutputRevision: ['render-hit-export'],
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
      stroke.style ?? '',
      stroke.position ?? ''
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

const buildSourceTopologyRevision = (
  sourceTopology: string,
  intervalTopology: string,
  closed?: boolean
) =>
  hashRevision(
    'source-topology',
    [sourceTopology, intervalTopology, closed ?? ''].join('|')
  )

const buildSharedGeometryRevision = ({
  points,
  closed,
  sourceTopology,
  intervalTopology,
  sharedGeometrySignature
}: {
  points: readonly Vec2[]
  closed: boolean
  sourceTopology?: string
  intervalTopology?: string
  sharedGeometrySignature?: string
}) =>
  hashRevision(
    'shared-geometry',
    sharedGeometrySignature ??
      [
        buildSourcePathRevision(points, closed),
        sourceTopology ?? '',
        intervalTopology ?? ''
      ].join('|')
  )

const buildSourceFamilyRevision = ({
  stroke,
  geometryFamily,
  resolutionStatus,
  runtimeStatus,
  sourceTopology,
  intervalTopology,
  sourceFamilySignature
}: {
  stroke: StrokeRevisionStrokeInput
  geometryFamily?: string
  resolutionStatus?: string
  runtimeStatus?: string
  sourceTopology?: string
  intervalTopology?: string
  sourceFamilySignature?: string
}) =>
  hashRevision(
    'source-family',
    sourceFamilySignature ??
      [
        stroke.style ?? '',
        stroke.position ?? '',
        geometryFamily ?? '',
        resolutionStatus ?? '',
        runtimeStatus ?? '',
        sourceTopology ?? '',
        intervalTopology ?? ''
      ].join('|')
  )

const buildStrokeDomainRevision = ({
  stroke,
  sourceTopology,
  intervalTopology,
  strokeDomainSignature
}: {
  stroke: StrokeRevisionStrokeInput
  sourceTopology?: string
  intervalTopology?: string
  strokeDomainSignature?: string
}) =>
  hashRevision(
    'stroke-domain',
    strokeDomainSignature ??
      [
        stroke.style ?? '',
        stroke.position ?? '',
        stroke.width ?? '',
        sourceTopology ?? '',
        intervalTopology ?? ''
      ].join('|')
  )

const buildDashScheduleRevision = ({
  stroke,
  closed,
  sourcePathRevision,
  sourceTopology,
  intervalTopology,
  intervalSignature
}: {
  stroke: StrokeRevisionStrokeInput
  closed: boolean
  sourcePathRevision: StrokeRevisionValue
  sourceTopology?: string
  intervalTopology?: string
  intervalSignature?: string
}) =>
  hashRevision(
    'dash-schedule',
    [
      stroke.style ?? '',
      stroke.dashPattern?.join(',') ?? '',
      stroke.dashOffset ?? '',
      closed ? 'closed' : `open-cap:${stroke.cap ?? ''}`,
      sourcePathRevision,
      sourceTopology ?? '',
      intervalTopology ?? '',
      intervalSignature ?? ''
    ].join('|')
  )

const buildTerminalCapRevision = ({
  stroke,
  closed,
  sourceTopology,
  intervalTopology
}: {
  stroke: StrokeRevisionStrokeInput
  closed: boolean
  sourceTopology?: string
  intervalTopology?: string
}) =>
  hashRevision(
    'terminal-cap',
    [
      stroke.style ?? '',
      stroke.position ?? '',
      stroke.width ?? '',
      stroke.cap ?? '',
      closed ? 'closed' : 'open',
      sourceTopology ?? '',
      intervalTopology ?? ''
    ].join('|')
  )

const buildJoinShapeRevision = ({
  stroke,
  sourceTopology,
  intervalTopology
}: {
  stroke: StrokeRevisionStrokeInput
  sourceTopology?: string
  intervalTopology?: string
}) =>
  hashRevision(
    'join-shape',
    [
      stroke.style ?? '',
      stroke.position ?? '',
      stroke.width ?? '',
      stroke.join ?? '',
      stroke.miterLimit ?? '',
      sourceTopology ?? '',
      intervalTopology ?? ''
    ].join('|')
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

const buildCandidateRevision = ({
  geometryFamily,
  sourceTopology,
  intervalTopology,
  previewMode
}: {
  geometryFamily?: string
  sourceTopology?: string
  intervalTopology?: string
  previewMode?: string
}) =>
  hashRevision(
    'candidate',
    [
      geometryFamily ?? '',
      sourceTopology ?? '',
      intervalTopology ?? '',
      previewMode ?? ''
    ].join('|')
  )

const buildArrangementRevision = ({
  geometryFamily,
  resolutionStatus,
  sourceTopology,
  intervalTopology
}: {
  geometryFamily?: string
  resolutionStatus?: string
  sourceTopology?: string
  intervalTopology?: string
}) =>
  hashRevision(
    'arrangement',
    [
      geometryFamily ?? '',
      resolutionStatus ?? '',
      sourceTopology ?? '',
      intervalTopology ?? ''
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

const buildResolvedRegionRevision = ({
  geometryFamily,
  resolutionStatus,
  runtimeStatus,
  runtimeReason,
  ownershipStatus,
  ownerCount
}: {
  geometryFamily?: string
  resolutionStatus?: string
  runtimeStatus?: string
  runtimeReason?: string
  ownershipStatus?: string
  ownerCount?: number
}) =>
  hashRevision(
    'resolved-region',
    [
      geometryFamily ?? '',
      resolutionStatus ?? '',
      runtimeStatus ?? '',
      runtimeReason ?? '',
      ownershipStatus ?? '',
      ownerCount ?? 0
    ].join('|')
  )

const buildRenderOutputRevision = ({
  stroke,
  geometryFamily,
  resolutionStatus,
  runtimeStatus,
  previewMode
}: {
  stroke: StrokeRevisionStrokeInput
  geometryFamily?: string
  resolutionStatus?: string
  runtimeStatus?: string
  previewMode?: string
}) =>
  hashRevision(
    'render-output',
    [
      geometryFamily ?? '',
      resolutionStatus ?? '',
      runtimeStatus ?? '',
      stroke.visible ?? '',
      stroke.style ?? '',
      stroke.position ?? '',
      stroke.width ?? '',
      stroke.join ?? '',
      stroke.miterLimit ?? '',
      stroke.cap ?? '',
      stroke.dashPattern?.join(',') ?? '',
      stroke.dashOffset ?? '',
      previewMode ?? ''
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
  sharedGeometrySignature,
  sourceFamilySignature,
  strokeDomainSignature,
  intervalSignature = 'solid',
  sourceTopology = closed ? 'closed' : 'open',
  intervalTopology = 'none',
  ownershipStatus = 'not-applicable',
  ownerCount = 0,
  previewMode = 'exact'
}: StrokeRuntimeRevisionInput): StrokeRevisionSet => {
  const sourcePathRevision = buildSourcePathRevision(points, closed)
  const dashScheduleRevision = buildDashScheduleRevision({
    stroke,
    closed,
    sourcePathRevision,
    sourceTopology,
    intervalTopology,
    intervalSignature
  })

  return {
    sourcePathRevision,
    strokeSpecRevision: buildStrokeSpecRevision(stroke),
    topologyClassificationRevision: buildTopologyClassificationRevision(
      sourceTopology,
      intervalTopology,
      closed
    ),
    sharedGeometryRevision: buildSharedGeometryRevision({
      points,
      closed,
      sourceTopology,
      intervalTopology,
      sharedGeometrySignature
    }),
    sourceFamilyRevision: buildSourceFamilyRevision({
      stroke,
      geometryFamily,
      resolutionStatus,
      runtimeStatus,
      sourceTopology,
      intervalTopology,
      sourceFamilySignature
    }),
    strokeDomainRevision: buildStrokeDomainRevision({
      stroke,
      sourceTopology,
      intervalTopology,
      strokeDomainSignature
    }),
    intervalAllocationRevision: dashScheduleRevision,
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
    previewModeRevision: `preview:${previewMode}`,
    sourceTopologyRevision: buildSourceTopologyRevision(
      sourceTopology,
      intervalTopology,
      closed
    ),
    strokeFamilyRevision: buildSourceFamilyRevision({
      stroke,
      geometryFamily,
      resolutionStatus,
      runtimeStatus,
      sourceTopology,
      intervalTopology,
      sourceFamilySignature
    }),
    dashScheduleRevision,
    terminalCapRevision: buildTerminalCapRevision({
      stroke,
      closed,
      sourceTopology,
      intervalTopology
    }),
    joinShapeRevision: buildJoinShapeRevision({
      stroke,
      sourceTopology,
      intervalTopology
    }),
    candidateRevision: buildCandidateRevision({
      geometryFamily,
      sourceTopology,
      intervalTopology,
      previewMode
    }),
    arrangementRevision: buildArrangementRevision({
      geometryFamily,
      resolutionStatus,
      sourceTopology,
      intervalTopology
    }),
    resolvedRegionRevision: buildResolvedRegionRevision({
      geometryFamily,
      resolutionStatus,
      runtimeStatus,
      runtimeReason,
      ownershipStatus,
      ownerCount
    }),
    renderOutputRevision: buildRenderOutputRevision({
      stroke,
      geometryFamily,
      resolutionStatus,
      runtimeStatus,
      previewMode
    })
  }
}

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
    closed?: boolean
    sharedGeometrySignature?: string
    sourceFamilySignature?: string
    strokeDomainSignature?: string
    ownershipStatus?: string
    ownerCount?: number
    previewMode?: 'exact' | 'preview' | 'drag-visual'
  }
): StrokeRevisionSet | undefined => {
  if (!revisionSet) {
    return undefined
  }

  return {
    ...revisionSet,
    topologyClassificationRevision: buildTopologyClassificationRevision(
      metadata.sourceTopology ?? '',
      metadata.intervalTopology ?? '',
      metadata.closed
    ),
    sharedGeometryRevision:
      metadata.sharedGeometrySignature !== undefined
        ? hashRevision('shared-geometry', metadata.sharedGeometrySignature)
        : revisionSet.sharedGeometryRevision,
    sourceFamilyRevision:
      metadata.sourceFamilySignature !== undefined
        ? hashRevision('source-family', metadata.sourceFamilySignature)
        : revisionSet.sourceFamilyRevision,
    strokeFamilyRevision:
      metadata.sourceFamilySignature !== undefined
        ? hashRevision('source-family', metadata.sourceFamilySignature)
        : revisionSet.strokeFamilyRevision,
    strokeDomainRevision:
      metadata.strokeDomainSignature !== undefined
        ? hashRevision('stroke-domain', metadata.strokeDomainSignature)
        : revisionSet.strokeDomainRevision,
    sourceTopologyRevision: buildSourceTopologyRevision(
      metadata.sourceTopology ?? '',
      metadata.intervalTopology ?? '',
      metadata.closed
    ),
    candidateRevision: buildCandidateRevision(metadata),
    arrangementRevision: buildArrangementRevision(metadata),
    ownershipRevision: buildOwnershipRevision(metadata),
    legalityRevision: buildLegalityRevision(metadata),
    resolvedRegionRevision: buildResolvedRegionRevision(metadata),
    renderOutputRevision:
      revisionSet.renderOutputRevision ?? buildRenderOutputRevision({
        stroke: {},
        ...metadata
      })
  }
}

const assertComparableRevisionSet = (
  revisionSet: Partial<StrokeRevisionSet>,
  label: string
) => {
  REQUIRED_REVISION_KEYS.forEach((key) => {
    if (!isValidRevisionValue(revisionSet[key])) {
      throw new Error(`Invalid ${label}.${key}`)
    }
  })
  OPTIONAL_STAGE_REVISION_KEYS.forEach((key) => {
    const value = revisionSet[key]
    if (value !== undefined && !isValidRevisionValue(value)) {
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

  const changedRevisionKeys = REVISION_KEYS.filter((key) => {
    const previousValue = previous[key]
    const nextValue = next[key]
    if (previousValue === undefined && nextValue === undefined) {
      return false
    }
    if (!isValidRevisionValue(previousValue)) {
      throw new Error(`Invalid previous.${key}`)
    }
    if (!isValidRevisionValue(nextValue)) {
      throw new Error(`Invalid next.${key}`)
    }
    return previousValue !== nextValue
  })
  const dirtyKeySet = new Set(
    changedRevisionKeys.flatMap((key) => DIRTY_KEYS_BY_REVISION[key])
  )
  const dirtyKeys = DIRTY_KEY_ORDER.filter((key) => dirtyKeySet.has(key))

  changedRevisionKeys.forEach((key) => {
    emitStrokeDirtyCounter(`stroke-revision-change:${key}`)
  })
  dirtyKeys.forEach((key) => {
    emitStrokeDirtyCounter(`stroke-dirty-key:${key}`)
  })
  if (
    dirtyKeys.length === 2 &&
    dirtyKeys.includes('paint-payload') &&
    dirtyKeys.includes('render-hit-export')
  ) {
    emitStrokeDirtyCounter('stroke-cache:paint-only-update')
  }
  if (
    changedRevisionKeys.includes('sourcePathRevision') &&
    !changedRevisionKeys.includes('strokeSpecRevision') &&
    !changedRevisionKeys.includes('strokeFamilyRevision') &&
    !changedRevisionKeys.includes('paintRevision')
  ) {
    emitStrokeDirtyCounter('stroke-cache:drag-source-path-with-static-stroke')
  }

  return {
    changedRevisionKeys,
    dirtyKeys
  }
}
