import { describe, expect, it } from 'vitest'
import {
  buildConstrainedSolidLegalityDomain,
  type ConstrainedSolidLegalityDomain,
  isPointInConstrainedSolidLegalityDomain
} from '../components/stroke-render/constrained-solid-legality-domain'

const expectLegalityDomain = (
  domain: ConstrainedSolidLegalityDomain | null
) => {
  if (!domain) {
    throw new Error('Expected constrained solid legality domain')
  }
  return domain
}

describe('constrained solid legality domain', () => {
  it('should run: build one canonical inside legality domain for a simple closed rectangle', () => {
    const domain = buildConstrainedSolidLegalityDomain(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      'inside'
    )

    expect(domain).toEqual({
      mode: 'inside',
      fillRule: 'nonzero',
      canonicalPolygonForm: 'simple-closed-polygon',
      boundaryPolygon: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      orientation: 'ccw'
    })
    const resolvedDomain = expectLegalityDomain(domain)
    expect(
      isPointInConstrainedSolidLegalityDomain(resolvedDomain, { x: 10, y: 10 })
    ).toBe(true)
    expect(
      isPointInConstrainedSolidLegalityDomain(resolvedDomain, { x: -2, y: 10 })
    ).toBe(false)
  })

  it('should run: shape-generated and vector-generated equivalent paths yield identical domains', () => {
    const shapeDomain = buildConstrainedSolidLegalityDomain(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      'outside'
    )
    const vectorDomain = buildConstrainedSolidLegalityDomain(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      'outside'
    )

    expect(shapeDomain).toEqual(vectorDomain)
    const resolvedShapeDomain = expectLegalityDomain(shapeDomain)
    expect(
      isPointInConstrainedSolidLegalityDomain(resolvedShapeDomain, {
        x: 10,
        y: 10
      })
    ).toBe(false)
    expect(
      isPointInConstrainedSolidLegalityDomain(resolvedShapeDomain, {
        x: -2,
        y: 10
      })
    ).toBe(true)
  })

  it('should not run: reject open or self-intersecting constrained legality domains deterministically', () => {
    expect(
      buildConstrainedSolidLegalityDomain(
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 }
        ],
        false,
        'inside'
      )
    ).toBeNull()

    expect(
      buildConstrainedSolidLegalityDomain(
        [
          { x: 0, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 },
          { x: 20, y: 0 }
        ],
        true,
        'inside'
      )
    ).toBeNull()
  })
})
