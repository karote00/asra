export type StrokeCoreRevisionKey =
  | 'sourcePathRevision'
  | 'strokeSpecRevision'
  | 'domainPlanRevision'
  | 'sharedGeometryRevision'
  | 'strokeProductRevision'
  | 'strokeDomainRevision'
  | 'intervalAllocationRevision'
  | 'ownershipRevision'
  | 'legalityRevision'
  | 'paintRevision'

export type StrokeStageRevisionKey =
  | 'strokeFamilyRevision'
  | 'dashAndGapRevision'
  | 'terminalCapRevision'
  | 'joinShapeRevision'
  | 'smoothContinuityRevision'
  | 'productMaterializationRevision'
  | 'resolvedRegionRevision'
  | 'renderOutputRevision'

export type StrokeRevisionKey = StrokeCoreRevisionKey | StrokeStageRevisionKey

export type StrokeDirtyKey =
  | 'path-topology'
  | 'shared-geometry'
  | 'domain-plan'
  | 'stroke-product'
  | 'stroke-domain'
  | 'interval-allocation'
  | 'dash-product-intervals'
  | 'endpoint-cap-policy'
  | 'join-ownership'
  | 'smooth-continuity'
  | 'product-materialization'
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
  dash?: number
  gap?: number
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
  productMode: string
  domainMode?: string
  ownerKey?: string
  networkId?: string
  strokeId?: string
  sharedGeometrySignature?: string
  strokeProductSignature?: string
  strokeDomainSignature?: string
  intervalSignature?: string
  endpointCapPolicySignature?: string
  joinOwnershipSignature?: string
  ownerCount?: number
  smoothContinuitySignature?: string
  productMaterializationSignature?: string
  legalitySignature?: string
  resolvedRegionSignature?: string
  renderOutputSignature?: string
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
  'domainPlanRevision',
  'sharedGeometryRevision',
  'strokeProductRevision',
  'strokeDomainRevision',
  'intervalAllocationRevision',
  'ownershipRevision',
  'legalityRevision',
  'paintRevision'
]

const OPTIONAL_STAGE_REVISION_KEYS: StrokeStageRevisionKey[] = [
  'strokeFamilyRevision',
  'dashAndGapRevision',
  'terminalCapRevision',
  'joinShapeRevision',
  'smoothContinuityRevision',
  'productMaterializationRevision',
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
  'domain-plan',
  'stroke-product',
  'stroke-domain',
  'interval-allocation',
  'dash-product-intervals',
  'endpoint-cap-policy',
  'join-ownership',
  'smooth-continuity',
  'product-materialization',
  'legality',
  'resolved-regions',
  'paint-payload',
  'render-hit-export'
]

const RENDER_OUTPUT_DIRTY: StrokeDirtyKey[] = ['render-hit-export']
const PAINT_DIRTY: StrokeDirtyKey[] = ['paint-payload', ...RENDER_OUTPUT_DIRTY]
const RESOLVED_REGION_DIRTY: StrokeDirtyKey[] = [
  'resolved-regions',
  ...RENDER_OUTPUT_DIRTY
]
const LEGALITY_DIRTY: StrokeDirtyKey[] = ['legality', ...RESOLVED_REGION_DIRTY]
const PRODUCT_MATERIALIZATION_DIRTY: StrokeDirtyKey[] = [
  'product-materialization',
  ...LEGALITY_DIRTY
]
const SMOOTH_CONTINUITY_DIRTY: StrokeDirtyKey[] = [
  'smooth-continuity',
  ...PRODUCT_MATERIALIZATION_DIRTY
]
const JOIN_OWNERSHIP_DIRTY: StrokeDirtyKey[] = [
  'join-ownership',
  ...SMOOTH_CONTINUITY_DIRTY
]
const ENDPOINT_CAP_POLICY_DIRTY: StrokeDirtyKey[] = [
  'endpoint-cap-policy',
  ...PRODUCT_MATERIALIZATION_DIRTY
]
const DASH_PRODUCT_INTERVAL_DIRTY: StrokeDirtyKey[] = [
  'dash-product-intervals',
  ...ENDPOINT_CAP_POLICY_DIRTY,
  'join-ownership',
  'smooth-continuity'
].filter(
  (key, index, keys): key is StrokeDirtyKey => keys.indexOf(key) === index
)
const STROKE_DOMAIN_DIRTY: StrokeDirtyKey[] = [
  'stroke-domain',
  'interval-allocation',
  ...DASH_PRODUCT_INTERVAL_DIRTY
]
const STROKE_PRODUCT_DIRTY: StrokeDirtyKey[] = [
  'stroke-product',
  ...STROKE_DOMAIN_DIRTY
]
const DOMAIN_PLAN_DIRTY: StrokeDirtyKey[] = [
  'domain-plan',
  ...STROKE_PRODUCT_DIRTY
]
const SHARED_GEOMETRY_DIRTY: StrokeDirtyKey[] = [
  'shared-geometry',
  ...STROKE_PRODUCT_DIRTY
]
const SOURCE_PATH_DIRTY: StrokeDirtyKey[] = [
  'path-topology',
  ...SHARED_GEOMETRY_DIRTY,
  'domain-plan'
].filter(
  (key, index, keys): key is StrokeDirtyKey => keys.indexOf(key) === index
)

const DIRTY_KEYS_BY_REVISION: Record<StrokeRevisionKey, StrokeDirtyKey[]> = {
  sourcePathRevision: SOURCE_PATH_DIRTY,
  strokeSpecRevision: STROKE_PRODUCT_DIRTY,
  strokeFamilyRevision: STROKE_PRODUCT_DIRTY,
  dashAndGapRevision: DASH_PRODUCT_INTERVAL_DIRTY,
  terminalCapRevision: ENDPOINT_CAP_POLICY_DIRTY,
  joinShapeRevision: JOIN_OWNERSHIP_DIRTY,
  smoothContinuityRevision: SMOOTH_CONTINUITY_DIRTY,
  productMaterializationRevision: PRODUCT_MATERIALIZATION_DIRTY,
  sharedGeometryRevision: SHARED_GEOMETRY_DIRTY,
  strokeProductRevision: STROKE_PRODUCT_DIRTY,
  strokeDomainRevision: STROKE_DOMAIN_DIRTY,
  intervalAllocationRevision: [
    'interval-allocation',
    ...DASH_PRODUCT_INTERVAL_DIRTY
  ],
  domainPlanRevision: DOMAIN_PLAN_DIRTY,
  ownershipRevision: JOIN_OWNERSHIP_DIRTY,
  legalityRevision: LEGALITY_DIRTY,
  resolvedRegionRevision: RESOLVED_REGION_DIRTY,
  paintRevision: PAINT_DIRTY,
  renderOutputRevision: RENDER_OUTPUT_DIRTY
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
    [stroke.style ?? '', stroke.position ?? ''].join('|')
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

const buildDomainPlanRevision = ({
  domainMode,
  strokeDomainSignature,
  intervalSignature
}: {
  domainMode?: string
  strokeDomainSignature?: string
  intervalSignature?: string
}) =>
  hashRevision(
    'domain-plan',
    [
      domainMode ?? '',
      strokeDomainSignature ?? '',
      intervalSignature ?? ''
    ].join('|')
  )

const buildSharedGeometryRevision = ({
  points,
  closed,
  sharedGeometrySignature
}: {
  points: readonly Vec2[]
  closed: boolean
  sharedGeometrySignature?: string
}) =>
  hashRevision(
    'shared-geometry',
    sharedGeometrySignature ?? buildSourcePathRevision(points, closed)
  )

const buildStrokeProductRevision = ({
  stroke,
  productMode,
  domainMode,
  strokeProductSignature
}: {
  stroke: StrokeRevisionStrokeInput
  productMode?: string
  domainMode?: string
  strokeProductSignature?: string
}) =>
  hashRevision(
    'stroke-product',
    strokeProductSignature ??
      [
        stroke.style ?? '',
        stroke.position ?? '',
        productMode ?? '',
        domainMode ?? ''
      ].join('|')
  )

const buildStrokeDomainRevision = ({
  stroke,
  domainMode,
  strokeDomainSignature
}: {
  stroke: StrokeRevisionStrokeInput
  domainMode?: string
  strokeDomainSignature?: string
}) =>
  hashRevision(
    'stroke-domain',
    strokeDomainSignature ??
      [
        stroke.style ?? '',
        stroke.position ?? '',
        stroke.width ?? '',
        domainMode ?? ''
      ].join('|')
  )

const buildDashAndGapRevision = (stroke: StrokeRevisionStrokeInput) =>
  hashRevision(
    'dash-and-gap',
    [stroke.style ?? '', stroke.dash ?? '', stroke.gap ?? ''].join('|')
  )

const buildIntervalAllocationRevision = ({
  stroke,
  closed,
  sourcePathRevision,
  intervalSignature
}: {
  stroke: StrokeRevisionStrokeInput
  closed: boolean
  sourcePathRevision: StrokeRevisionValue
  intervalSignature?: string
}) =>
  hashRevision(
    'interval-allocation',
    [
      stroke.style ?? '',
      stroke.dash ?? '',
      stroke.gap ?? '',
      closed ? 'closed' : 'open',
      sourcePathRevision,
      intervalSignature ?? ''
    ].join('|')
  )

const buildTerminalCapRevision = ({
  stroke,
  closed,
  endpointCapPolicySignature
}: {
  stroke: StrokeRevisionStrokeInput
  closed: boolean
  endpointCapPolicySignature?: string
}) =>
  hashRevision(
    'terminal-cap',
    [
      stroke.style ?? '',
      stroke.position ?? '',
      stroke.width ?? '',
      stroke.cap ?? '',
      closed ? 'closed' : 'open',
      endpointCapPolicySignature ?? ''
    ].join('|')
  )

const buildJoinShapeRevision = ({
  stroke,
  joinOwnershipSignature
}: {
  stroke: StrokeRevisionStrokeInput
  joinOwnershipSignature?: string
}) =>
  hashRevision(
    'join-shape',
    [
      stroke.style ?? '',
      stroke.position ?? '',
      stroke.width ?? '',
      stroke.join ?? '',
      stroke.miterLimit ?? '',
      joinOwnershipSignature ?? ''
    ].join('|')
  )

const buildOwnershipRevision = ({
  ownerKey,
  networkId,
  strokeId,
  joinOwnershipSignature,
  ownerCount
}: {
  ownerKey?: string
  networkId?: string
  strokeId?: string
  joinOwnershipSignature?: string
  ownerCount?: number
}) =>
  hashRevision(
    'ownership',
    [
      ownerKey ?? '',
      networkId ?? '',
      strokeId ?? '',
      joinOwnershipSignature ?? '',
      ownerCount ?? 0
    ].join('|')
  )

const buildSmoothContinuityRevision = ({
  smoothContinuitySignature
}: {
  smoothContinuitySignature?: string
}) => hashRevision('smooth-continuity', smoothContinuitySignature ?? 'none')

const buildProductMaterializationRevision = ({
  productMode,
  domainMode,
  productMaterializationSignature
}: {
  productMode?: string
  domainMode?: string
  productMaterializationSignature?: string
}) =>
  hashRevision(
    'product-materialization',
    productMaterializationSignature ??
      [productMode ?? '', domainMode ?? ''].join('|')
  )

const buildLegalityRevision = ({
  productMode,
  domainMode,
  legalitySignature,
  ownerCount
}: {
  productMode?: string
  domainMode?: string
  legalitySignature?: string
  ownerCount?: number
}) =>
  hashRevision(
    'legality',
    legalitySignature ??
      [productMode ?? '', domainMode ?? '', ownerCount ?? 0].join('|')
  )

const buildResolvedRegionRevision = ({
  productMode,
  domainMode,
  resolvedRegionSignature,
  ownerCount
}: {
  productMode?: string
  domainMode?: string
  resolvedRegionSignature?: string
  ownerCount?: number
}) =>
  hashRevision(
    'resolved-region',
    resolvedRegionSignature ??
      [productMode ?? '', domainMode ?? '', ownerCount ?? 0].join('|')
  )

const buildRenderOutputRevision = ({
  stroke,
  productMode,
  domainMode,
  renderOutputSignature
}: {
  stroke: StrokeRevisionStrokeInput
  productMode?: string
  domainMode?: string
  renderOutputSignature?: string
}) =>
  hashRevision(
    'render-output',
    renderOutputSignature ??
      [
        productMode ?? '',
        domainMode ?? '',
        stroke.visible ?? '',
        stroke.style ?? '',
        stroke.position ?? '',
        stroke.width ?? '',
        stroke.join ?? '',
        stroke.miterLimit ?? '',
        stroke.cap ?? '',
        stroke.dash ?? '',
        stroke.gap ?? ''
      ].join('|')
  )

const refineRevision = (
  prefix: string,
  baseRevision: StrokeRevisionValue | undefined,
  metadataSignature: string | undefined
) =>
  metadataSignature === undefined
    ? baseRevision
    : hashRevision(prefix, [baseRevision ?? '', metadataSignature].join('|'))

export const buildStrokeRuntimeRevisionSet = ({
  points,
  closed,
  stroke,
  productMode,
  domainMode,
  ownerKey,
  networkId,
  strokeId,
  sharedGeometrySignature,
  strokeProductSignature,
  strokeDomainSignature,
  intervalSignature = 'solid',
  endpointCapPolicySignature,
  joinOwnershipSignature,
  ownerCount = 0,
  smoothContinuitySignature,
  productMaterializationSignature,
  legalitySignature,
  resolvedRegionSignature,
  renderOutputSignature
}: StrokeRuntimeRevisionInput): StrokeRevisionSet => {
  const sourcePathRevision = buildSourcePathRevision(points, closed)
  const dashAndGapRevision = buildDashAndGapRevision(stroke)
  const intervalAllocationRevision = buildIntervalAllocationRevision({
    stroke,
    closed,
    sourcePathRevision,
    intervalSignature
  })

  return {
    sourcePathRevision,
    strokeSpecRevision: buildStrokeSpecRevision(stroke),
    domainPlanRevision: buildDomainPlanRevision({
      domainMode,
      strokeDomainSignature,
      intervalSignature
    }),
    sharedGeometryRevision: buildSharedGeometryRevision({
      points,
      closed,
      sharedGeometrySignature
    }),
    strokeProductRevision: buildStrokeProductRevision({
      stroke,
      productMode,
      domainMode,
      strokeProductSignature
    }),
    strokeDomainRevision: buildStrokeDomainRevision({
      stroke,
      domainMode,
      strokeDomainSignature
    }),
    intervalAllocationRevision,
    ownershipRevision: buildOwnershipRevision({
      ownerKey,
      networkId,
      strokeId,
      joinOwnershipSignature,
      ownerCount
    }),
    legalityRevision: buildLegalityRevision({
      productMode,
      domainMode,
      legalitySignature,
      ownerCount
    }),
    paintRevision: buildPaintRevision(stroke),
    strokeFamilyRevision: buildStrokeProductRevision({
      stroke,
      productMode,
      domainMode,
      strokeProductSignature
    }),
    dashAndGapRevision,
    terminalCapRevision: buildTerminalCapRevision({
      stroke,
      closed,
      endpointCapPolicySignature
    }),
    joinShapeRevision: buildJoinShapeRevision({
      stroke,
      joinOwnershipSignature
    }),
    smoothContinuityRevision: buildSmoothContinuityRevision({
      smoothContinuitySignature
    }),
    productMaterializationRevision: buildProductMaterializationRevision({
      productMode,
      domainMode,
      productMaterializationSignature
    }),
    resolvedRegionRevision: buildResolvedRegionRevision({
      productMode,
      domainMode,
      resolvedRegionSignature,
      ownerCount
    }),
    renderOutputRevision: buildRenderOutputRevision({
      stroke,
      productMode,
      domainMode,
      renderOutputSignature
    })
  }
}

export const updateStrokeRuntimeRevisionSetFromMetadata = (
  revisionSet: StrokeRevisionSet | undefined,
  metadata: {
    ownerKey?: string
    networkId?: string
    strokeId?: string
    productMode?: string
    domainMode?: string
    sharedGeometrySignature?: string
    strokeProductSignature?: string
    strokeDomainSignature?: string
    endpointCapPolicySignature?: string
    joinOwnershipSignature?: string
    ownerCount?: number
    smoothContinuitySignature?: string
    productMaterializationSignature?: string
    legalitySignature?: string
    resolvedRegionSignature?: string
    renderOutputSignature?: string
  }
): StrokeRevisionSet | undefined => {
  if (!revisionSet) {
    return undefined
  }

  return {
    ...revisionSet,
    domainPlanRevision:
      metadata.domainMode !== undefined ||
      metadata.strokeDomainSignature !== undefined
        ? buildDomainPlanRevision(metadata)
        : revisionSet.domainPlanRevision,
    sharedGeometryRevision:
      metadata.sharedGeometrySignature !== undefined
        ? hashRevision('shared-geometry', metadata.sharedGeometrySignature)
        : revisionSet.sharedGeometryRevision,
    strokeProductRevision:
      metadata.strokeProductSignature !== undefined
        ? (refineRevision(
            'stroke-product',
            revisionSet.strokeProductRevision,
            metadata.strokeProductSignature
          ) ?? revisionSet.strokeProductRevision)
        : revisionSet.strokeProductRevision,
    strokeFamilyRevision:
      metadata.strokeProductSignature !== undefined
        ? refineRevision(
            'stroke-product',
            revisionSet.strokeFamilyRevision,
            metadata.strokeProductSignature
          )
        : revisionSet.strokeFamilyRevision,
    strokeDomainRevision:
      metadata.strokeDomainSignature !== undefined
        ? (refineRevision(
            'stroke-domain',
            revisionSet.strokeDomainRevision,
            metadata.strokeDomainSignature
          ) ?? revisionSet.strokeDomainRevision)
        : revisionSet.strokeDomainRevision,
    terminalCapRevision:
      metadata.endpointCapPolicySignature !== undefined
        ? refineRevision(
            'terminal-cap',
            revisionSet.terminalCapRevision,
            metadata.endpointCapPolicySignature
          )
        : revisionSet.terminalCapRevision,
    joinShapeRevision:
      metadata.joinOwnershipSignature !== undefined
        ? refineRevision(
            'join-shape',
            revisionSet.joinShapeRevision,
            metadata.joinOwnershipSignature
          )
        : revisionSet.joinShapeRevision,
    smoothContinuityRevision: buildSmoothContinuityRevision(metadata),
    productMaterializationRevision:
      buildProductMaterializationRevision(metadata),
    ownershipRevision: buildOwnershipRevision(metadata),
    legalityRevision: buildLegalityRevision(metadata),
    resolvedRegionRevision: buildResolvedRegionRevision(metadata),
    renderOutputRevision:
      metadata.renderOutputSignature !== undefined
        ? refineRevision(
            'render-output',
            revisionSet.renderOutputRevision,
            metadata.renderOutputSignature
          )
        : revisionSet.renderOutputRevision
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
