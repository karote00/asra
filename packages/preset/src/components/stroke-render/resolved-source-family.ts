import type {
  PathTopologyFamily,
  PathTopologyModel
} from './path-topology-model'
import type { RenderableStroke } from './renderable-stroke'

export type StrokeProductFamilyStatus =
  | 'verified-slice'
  | 'unverified-reference'
  | 'implementation-gap'
  | 'not-applicable'

export type StrokeProductFamilyScope =
  | 'degenerate'
  | 'open'
  | 'simple-closed'
  | 'compound-closed'
  | 'self-intersecting-closed'

export interface StrokeProductFamilyRuleEvidence {
  familyScope: StrokeProductFamilyScope
  status: StrokeProductFamilyStatus
  requiredForCompletion: boolean
  evidence: string[]
  gaps: string[]
}

export interface StrokeProductFamilyMatrixEntry
  extends StrokeProductFamilyRuleEvidence {
  strokeStyle: RenderableStroke['style']
  strokePosition: RenderableStroke['position']
}

export interface ResolvedSourceFamily {
  sourceId: string
  networkId: string
  sourceFamily: PathTopologyModel['sourceFamily']
  topologyFamily: PathTopologyFamily
  productRuleEvidence: StrokeProductFamilyRuleEvidence
  legalDomainHints: {
    fillRule: PathTopologyModel['fillRule']
    contourIds: string[]
    legalDomainIds: string[]
    closed: boolean
    compound: boolean
    selfIntersecting: boolean
  }
}

interface ResolveSourceFamilyInput {
  topology: PathTopologyModel
  stroke: Pick<RenderableStroke, 'style' | 'position'>
}

const isConstrainedPosition = (position: RenderableStroke['position']) =>
  position === 'inside' || position === 'outside'

const resolveFamilyScope = ({
  topology,
  compound,
  selfIntersecting
}: {
  topology: PathTopologyModel
  compound: boolean
  selfIntersecting: boolean
}): StrokeProductFamilyScope => {
  if (topology.topologyFamily === 'degenerate') {
    return 'degenerate'
  }
  if (!topology.closed) {
    return 'open'
  }
  if (selfIntersecting) {
    return 'self-intersecting-closed'
  }
  if (compound) {
    return 'compound-closed'
  }
  return 'simple-closed'
}

const resolveProductFamilyRuleEvidence = ({
  familyScope,
  stroke
}: {
  familyScope: StrokeProductFamilyScope
  stroke: Pick<RenderableStroke, 'style' | 'position'>
}): StrokeProductFamilyRuleEvidence => {
  if (familyScope === 'degenerate') {
    return {
      familyScope,
      status: 'not-applicable',
      requiredForCompletion: false,
      evidence: [
        'Degenerate topology is rejected before product stroke parity.'
      ],
      gaps: []
    }
  }

  if (isConstrainedPosition(stroke.position) && familyScope === 'open') {
    return {
      familyScope,
      status: 'verified-slice',
      requiredForCompletion: true,
      evidence: [
        'Open source topology is identified from PathTopologyModel.closed=false and remains source-family evidence for downstream bounded-domain decisions.'
      ],
      gaps: []
    }
  }

  if (
    isConstrainedPosition(stroke.position) &&
    familyScope === 'self-intersecting-closed' &&
    stroke.style === 'dashed'
  ) {
    return {
      familyScope,
      status: 'verified-slice',
      requiredForCompletion: true,
      evidence: [
        'Self-intersecting closed source topology is identified before downstream constrained dashed domain and interval stages consume legal-domain hints.'
      ],
      gaps: []
    }
  }

  return {
    familyScope,
    status: 'verified-slice',
    requiredForCompletion: true,
    evidence: [
      'PathTopologyModel family evidence and normalized stroke style/position select this source-family slice for downstream owner stages.'
    ],
    gaps: []
  }
}

export const resolveSourceFamily = ({
  topology,
  stroke
}: ResolveSourceFamilyInput): ResolvedSourceFamily => {
  const legalDomainIds = topology.legalDomainDescriptors.map(
    (domain) => domain.legalDomainId
  )
  const contourIds = topology.contours.map((contour) => contour.contourId)
  const compound = topology.contours.length > 1 || legalDomainIds.length > 1
  const selfIntersecting = topology.topologyFamily === 'self-intersecting'
  const familyScope = resolveFamilyScope({
    topology,
    compound,
    selfIntersecting
  })
  const productRuleEvidence = resolveProductFamilyRuleEvidence({
    familyScope,
    stroke
  })
  const baseResult = {
    sourceId: topology.sourceId,
    networkId: topology.networkId,
    sourceFamily: topology.sourceFamily,
    topologyFamily: topology.topologyFamily,
    productRuleEvidence,
    legalDomainHints: {
      fillRule: topology.fillRule,
      contourIds,
      legalDomainIds,
      closed: topology.closed,
      compound,
      selfIntersecting
    }
  } satisfies ResolvedSourceFamily

  return baseResult
}

const MATRIX_FAMILY_SCOPES: StrokeProductFamilyScope[] = [
  'open',
  'simple-closed',
  'compound-closed',
  'self-intersecting-closed'
]

const MATRIX_STROKE_STYLES: RenderableStroke['style'][] = ['solid', 'dashed']
const MATRIX_STROKE_POSITIONS: RenderableStroke['position'][] = [
  'center',
  'inside',
  'outside'
]

export const getStrokeProductFamilyMatrix =
  (): StrokeProductFamilyMatrixEntry[] =>
    MATRIX_FAMILY_SCOPES.flatMap((familyScope) =>
      MATRIX_STROKE_STYLES.flatMap((strokeStyle) =>
        MATRIX_STROKE_POSITIONS.map((strokePosition) => ({
          strokeStyle,
          strokePosition,
          ...resolveProductFamilyRuleEvidence({
            familyScope,
            stroke: {
              style: strokeStyle,
              position: strokePosition
            }
          })
        }))
      )
    )
