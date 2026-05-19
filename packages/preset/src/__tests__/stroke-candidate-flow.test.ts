import { describe, expect, it } from 'vitest'
import { StrokePositions, StrokeStyles } from '@asyra/utils'
import { resolveOneSidedCandidateFlow } from '../components/stroke-render/stroke-candidate-flow'

describe('stroke candidate flow', () => {
  it('should run: resolve open constrained solid strokes before one-sided candidate construction', () => {
    expect(
      resolveOneSidedCandidateFlow({
        closed: false,
        topologyFamily: 'open',
        stroke: {
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE
        }
      })
    ).toEqual({
      mode: 'center-equivalent',
      domainKind: 'center-equivalent',
      requiresOneSidedCandidates: false,
      reason: 'open-constrained-center-equivalent'
    })
    expect(
      resolveOneSidedCandidateFlow({
        closed: false,
        topologyFamily: 'open',
        stroke: {
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE
        }
      }).mode
    ).toBe('center-equivalent')
  })

  it('should run: keep closed constrained paths on one-sided candidate construction', () => {
    expect(
      resolveOneSidedCandidateFlow({
        closed: true,
        topologyFamily: 'rectangle-equivalent',
        stroke: {
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE
        }
      })
    ).toEqual({
      mode: 'one-sided-constrained',
      domainKind: 'source-path',
      requiresOneSidedCandidates: true,
      reason: 'closed-constrained-one-sided'
    })
  })

  it('should run: keep self-intersecting dashed strokes on authored source-path one-sided candidates', () => {
    expect(
      resolveOneSidedCandidateFlow({
        closed: true,
        topologyFamily: 'self-intersecting',
        boundaryContourCount: 2,
        stroke: {
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE
        },
        strokeDomainPlan: {
          intervalDomainKind: 'figma-like-split-range',
          sideAuthority: 'implicit-fill-hole-domain',
          splitRangeDomainCount: 2
        }
      })
    ).toEqual({
      mode: 'one-sided-constrained',
      domainKind: 'split-range',
      requiresOneSidedCandidates: true,
      reason: 'closed-constrained-one-sided'
    })
    expect(
      resolveOneSidedCandidateFlow({
        closed: true,
        topologyFamily: 'rectangle-equivalent',
        boundaryContourCount: 1,
        stroke: {
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE
        }
      }).mode
    ).toBe('one-sided-constrained')
    expect(
      resolveOneSidedCandidateFlow({
        closed: true,
        topologyFamily: 'self-intersecting',
        boundaryContourCount: 0,
        stroke: {
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE
        }
      })
    ).toEqual({
      mode: 'one-sided-constrained',
      domainKind: 'source-path',
      requiresOneSidedCandidates: true,
      reason: 'closed-constrained-one-sided'
    })
  })

  it('should run: keep compound constrained dashed candidates on legal-boundary-span domains', () => {
    expect(
      resolveOneSidedCandidateFlow({
        closed: true,
        topologyFamily: 'rectangle-equivalent',
        stroke: {
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE
        },
        strokeDomainPlan: {
          intervalDomainKind: 'legal-boundary-span',
          sideAuthority: 'implicit-fill-hole-domain',
          legalBoundaryDomainCount: 2
        }
      })
    ).toEqual({
      mode: 'one-sided-constrained',
      domainKind: 'legal-boundary-span',
      requiresOneSidedCandidates: true,
      reason: 'closed-constrained-one-sided'
    })
  })
})
