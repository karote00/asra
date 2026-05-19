import type { StrokeAttrs } from '@asyra/utils'
import type { PathTopologyFamily } from './path-topology-model'
import type {
  StrokeIntervalDomainKind,
  StrokeSideAuthority
} from './stroke-domain-plan'

export type OneSidedCandidateFlowMode =
  | 'center-stroke'
  | 'center-equivalent'
  | 'one-sided-constrained'
  | 'unsupported'

export type OneSidedCandidateDomainKind =
  | 'native-center'
  | 'center-equivalent'
  | 'source-path'
  | 'split-range'
  | 'legal-boundary-span'
  | 'unsupported'

export interface OneSidedCandidateFlowInput {
  closed: boolean
  topologyFamily: PathTopologyFamily
  stroke: Pick<StrokeAttrs, 'style' | 'position'>
  boundaryContourCount?: number
  strokeDomainPlan?: {
    intervalDomainKind: StrokeIntervalDomainKind
    sideAuthority: StrokeSideAuthority
    splitRangeDomainCount?: number
    legalBoundaryDomainCount?: number
  }
}

export interface OneSidedCandidateFlow {
  mode: OneSidedCandidateFlowMode
  domainKind: OneSidedCandidateDomainKind
  requiresOneSidedCandidates: boolean
  reason:
    | 'native-center'
    | 'open-constrained-center-equivalent'
    | 'closed-constrained-one-sided'
    | 'unsupported-stroke-family'
}

export const resolveOneSidedCandidateFlow = (
  input: OneSidedCandidateFlowInput
): OneSidedCandidateFlow => {
  const { closed, stroke } = input

  if (stroke.position === 'center') {
    return {
      mode: 'center-stroke',
      domainKind: 'native-center',
      requiresOneSidedCandidates: false,
      reason: 'native-center'
    }
  }

  if (
    !closed &&
    (stroke.position === 'inside' || stroke.position === 'outside')
  ) {
    return {
      mode: 'center-equivalent',
      domainKind: 'center-equivalent',
      requiresOneSidedCandidates: false,
      reason: 'open-constrained-center-equivalent'
    }
  }

  if (stroke.style !== 'solid' && stroke.style !== 'dashed') {
    return {
      mode: 'unsupported',
      domainKind: 'unsupported',
      requiresOneSidedCandidates: false,
      reason: 'unsupported-stroke-family'
    }
  }

  if (
    closed &&
    (stroke.position === 'inside' || stroke.position === 'outside')
  ) {
    const domainKind = (() => {
      if (
        input.strokeDomainPlan?.intervalDomainKind === 'figma-like-split-range'
      ) {
        return 'split-range'
      }
      if (
        input.strokeDomainPlan?.intervalDomainKind === 'legal-boundary-span'
      ) {
        return 'legal-boundary-span'
      }
      return 'source-path'
    })()

    return {
      mode: 'one-sided-constrained',
      domainKind,
      requiresOneSidedCandidates: true,
      reason: 'closed-constrained-one-sided'
    }
  }

  return {
    mode: 'unsupported',
    domainKind: 'unsupported',
    requiresOneSidedCandidates: false,
    reason: 'unsupported-stroke-family'
  }
}
