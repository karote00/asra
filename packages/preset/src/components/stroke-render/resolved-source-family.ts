import type {
  PathTopologyFamily,
  PathTopologyModel
} from './path-topology-model'
import type { RenderableStroke } from './renderable-stroke'

export type ResolvedSourceSupportState =
  | 'supported'
  | 'center-equivalent'
  | 'blocked'

export type ResolvedSourceBlockedReason =
  | 'degenerate-topology'
  | 'missing-legal-domain'

export type FigmaStrokeParityStatus =
  | 'verified-slice'
  | 'unverified-reference'
  | 'implementation-gap'
  | 'not-applicable'

export type FigmaStrokeFamilyScope =
  | 'degenerate'
  | 'open'
  | 'simple-closed'
  | 'compound-closed'
  | 'self-intersecting-closed'

export interface FigmaStrokeFamilyParity {
  familyScope: FigmaStrokeFamilyScope
  status: FigmaStrokeParityStatus
  requiredForCompletion: boolean
  evidence: string[]
  gaps: string[]
}

export interface FigmaStrokeFamilyMatrixEntry extends FigmaStrokeFamilyParity {
  strokeStyle: RenderableStroke['style']
  strokePosition: RenderableStroke['position']
}

export interface ResolvedSourceFamily {
  sourceId: string
  networkId: string
  sourceFamily: PathTopologyModel['sourceFamily']
  topologyFamily: PathTopologyFamily
  supportState: ResolvedSourceSupportState
  blockedReason?: ResolvedSourceBlockedReason
  figmaParity: FigmaStrokeFamilyParity
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
}): FigmaStrokeFamilyScope => {
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

const resolveFigmaParity = ({
  familyScope,
  stroke
}: {
  familyScope: FigmaStrokeFamilyScope
  stroke: Pick<RenderableStroke, 'style' | 'position'>
}): FigmaStrokeFamilyParity => {
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
        'Asyra open-path stroke alignment is center-equivalent, and current app gates cover open constrained solid and dashed visibility after inside/outside selection.'
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
        'Current targeted and final visual gates cover self-intersecting constrained dashed split-range terminal half-dash behavior, implicit fill/hole side resolution, and FinalFace-derived render/export projection.'
      ],
      gaps: []
    }
  }

  return {
    familyScope,
    status: 'verified-slice',
    requiredForCompletion: true,
    evidence: [
      'Current runtime has targeted support, projection, and visual evidence for this family slice.'
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
  const figmaParity = resolveFigmaParity({ familyScope, stroke })
  const baseResult = {
    sourceId: topology.sourceId,
    networkId: topology.networkId,
    sourceFamily: topology.sourceFamily,
    topologyFamily: topology.topologyFamily,
    figmaParity,
    legalDomainHints: {
      fillRule: topology.fillRule,
      contourIds,
      legalDomainIds,
      closed: topology.closed,
      compound,
      selfIntersecting
    }
  } satisfies Omit<ResolvedSourceFamily, 'supportState' | 'blockedReason'>

  if (topology.topologyFamily === 'degenerate') {
    return {
      ...baseResult,
      supportState: 'blocked',
      blockedReason: 'degenerate-topology'
    }
  }

  if (!isConstrainedPosition(stroke.position)) {
    return {
      ...baseResult,
      supportState: 'supported'
    }
  }

  if (!topology.closed) {
    return {
      ...baseResult,
      supportState: 'center-equivalent'
    }
  }

  if (legalDomainIds.length === 0) {
    return {
      ...baseResult,
      supportState: 'blocked',
      blockedReason: 'missing-legal-domain'
    }
  }

  return {
    ...baseResult,
    supportState: 'supported'
  }
}

const MATRIX_FAMILY_SCOPES: FigmaStrokeFamilyScope[] = [
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

export const getFigmaStrokeFamilyMatrix = (): FigmaStrokeFamilyMatrixEntry[] =>
  MATRIX_FAMILY_SCOPES.flatMap((familyScope) =>
    MATRIX_STROKE_STYLES.flatMap((strokeStyle) =>
      MATRIX_STROKE_POSITIONS.map((strokePosition) => ({
        strokeStyle,
        strokePosition,
        ...resolveFigmaParity({
          familyScope,
          stroke: {
            style: strokeStyle,
            position: strokePosition
          }
        })
      }))
    )
  )
