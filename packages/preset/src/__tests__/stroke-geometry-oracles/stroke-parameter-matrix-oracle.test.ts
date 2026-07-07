import {
  FillKinds,
  StrokeCapTypes,
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles,
  createDefaultFill,
  createDefaultGradientData,
  createDefaultStroke
} from '@asyra/utils'
import { describe, expect, it } from 'vitest'
import { normalizeStrokeSpec } from '../../components/stroke-render/renderable-stroke'
import { buildSourceVertexJoinFootprint } from '../../components/stroke-render/source-vertex-join-footprint'

const polygonSignature = (polygon: { x: number; y: number }[]) =>
  polygon
    .map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`)
    .join('|')

const distance = (
  first: { x: number; y: number },
  second: { x: number; y: number }
) => Math.hypot(first.x - second.x, first.y - second.y)

const maxDistanceFrom = (
  origin: { x: number; y: number },
  polygon: { x: number; y: number }[]
) => Math.max(...polygon.map((point) => distance(origin, point)))

const normalizeSingleStroke = (
  overrides: Parameters<typeof createDefaultStroke>[0]
) => {
  const result = normalizeStrokeSpec([createDefaultStroke(overrides)])
  expect(result.diagnostics).toEqual([])
  expect(result.strokes).toHaveLength(1)
  return result.strokes[0]
}

describe('formal stroke geometry oracle: full stroke parameter matrix', () => {
  it('normalizes every authored stroke style parameter into a renderable stroke without resolving product geometry', () => {
    const matrix = [
      {
        label: 'center solid miter butt',
        input: {
          id: 'stroke:center-solid',
          style: StrokeStyles.SOLID,
          position: StrokePositions.CENTER,
          width: 3,
          joinType: StrokeJoinTypes.MITER,
          capType: StrokeCapTypes.BUTT,
          miterAngle: 28.96,
          dash: 20,
          gap: 20
        },
        expected: {
          style: 'solid',
          position: 'center',
          width: 3,
          join: 'miter',
          cap: 'butt',
          dash: 20,
          gap: 20
        }
      },
      {
        label: 'inside dashed bevel square',
        input: {
          id: 'stroke:inside-dashed',
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          width: 12,
          joinType: StrokeJoinTypes.BEVEL,
          capType: StrokeCapTypes.SQUARE,
          miterAngle: 45,
          dash: 12,
          gap: 6
        },
        expected: {
          style: 'dashed',
          position: 'inside',
          width: 12,
          join: 'bevel',
          cap: 'square',
          dash: 12,
          gap: 6
        }
      },
      {
        label: 'outside dashed round round',
        input: {
          id: 'stroke:outside-dashed',
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
          width: 20,
          joinType: StrokeJoinTypes.ROUND,
          capType: StrokeCapTypes.ROUND,
          miterAngle: 80,
          dash: 30,
          gap: 10
        },
        expected: {
          style: 'dashed',
          position: 'outside',
          width: 20,
          join: 'round',
          cap: 'round',
          dash: 30,
          gap: 10
        }
      }
    ] as const

    for (const scenario of matrix) {
      const stroke = normalizeSingleStroke(scenario.input)

      expect(stroke, scenario.label).toMatchObject(scenario.expected)
      expect(stroke.miterAngle, scenario.label).toBe(scenario.input.miterAngle)
      expect(stroke.miterLimit, scenario.label).toBeGreaterThanOrEqual(1)
      expect(stroke).not.toHaveProperty('resolvedJoin')
      expect(stroke).not.toHaveProperty('vertexAngle')
      expect(stroke).not.toHaveProperty('angleSource')
      expect(stroke).not.toHaveProperty('polygons')
      expect(stroke).not.toHaveProperty('renderDescriptor')
    }
  })

  it('normalizes solid and gradient stroke paint without changing style geometry parameters', () => {
    const solid = normalizeSingleStroke({
      id: 'stroke:solid-paint',
      width: 8,
      style: StrokeStyles.SOLID,
      position: StrokePositions.OUTSIDE,
      fill: createDefaultFill({
        color: '#3366ff',
        opacity: 0.25,
        visible: true
      })
    })
    const gradient = normalizeSingleStroke({
      id: 'stroke:gradient-paint',
      width: 8,
      style: StrokeStyles.DASHED,
      position: StrokePositions.INSIDE,
      fill: createDefaultFill({
        kind: FillKinds.GRADIENT,
        gradient: {
          ...createDefaultGradientData(),
          gradientHandles: [
            { x: 0, y: 0.5 },
            { x: 1, y: 0.5 }
          ]
        }
      })
    })

    expect(solid).toMatchObject({
      kind: 'solid',
      color: 0x3366ff,
      alpha: 0.25,
      style: 'solid',
      position: 'outside',
      width: 8
    })
    expect(solid.paintKey).toBe('solid:3368703:0.25')
    expect(gradient).toMatchObject({
      kind: 'gradient',
      style: 'dashed',
      position: 'inside',
      width: 8
    })
    expect(gradient.gradientStyle).toBeTruthy()
    expect(gradient.paintKey).toContain('"kind":"gradient"')
    expect(gradient.join).toBe('miter')
    expect(gradient.cap).toBe('butt')
  })

  it('treats finite non-positive stroke widths as empty output without diagnostics', () => {
    const result = normalizeStrokeSpec([
      createDefaultStroke({
        id: 'stroke:zero-width',
        width: 0
      }),
      createDefaultStroke({
        id: 'stroke:negative-width',
        width: -1
      })
    ])

    expect(result.strokes).toEqual([])
    expect(result.diagnostics).toEqual([])
  })

  it('rejects non-renderable stroke parameters with diagnostics instead of fallback geometry', () => {
    const result = normalizeStrokeSpec([
      createDefaultStroke({
        id: 'stroke:hidden-paint',
        width: 8,
        fill: createDefaultFill({
          visible: false
        })
      }),
      {
        ...createDefaultStroke({
          id: 'stroke:invalid-paint',
          width: 8
        }),
        fill: createDefaultFill({
          color: 'not-a-color'
        })
      },
      createDefaultStroke({
        id: 'stroke:invalid-gradient',
        width: 8,
        fill: createDefaultFill({
          kind: FillKinds.GRADIENT,
          gradient: null
        })
      }),
      null
    ])

    expect(result.strokes).toEqual([])
    expect(result.diagnostics).toEqual([
      {
        index: 0,
        reason: 'invisible-paint',
        strokeId: 'stroke:hidden-paint'
      },
      {
        index: 1,
        reason: 'invalid-paint',
        strokeId: 'stroke:invalid-paint'
      },
      {
        index: 2,
        reason: 'invalid-gradient-paint',
        strokeId: 'stroke:invalid-gradient'
      },
      {
        index: 3,
        reason: 'invalid-entry'
      }
    ])
  })

  it('keeps join footprints distinct when join is the changed parameter', () => {
    const common = {
      vertex: { x: 0, y: 0 },
      previousPoint: { x: -100, y: 50 },
      nextPoint: { x: 100, y: 50 },
      strokeWidth: 12,
      side: 'left' as const,
      miterAngle: 28.96,
      ownerId: 'owner:parameter-matrix',
      angleSource: 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS' as const
    }
    const miter = buildSourceVertexJoinFootprint({
      ...common,
      authoredJoin: 'miter'
    })
    const bevel = buildSourceVertexJoinFootprint({
      ...common,
      authoredJoin: 'bevel'
    })
    const round = buildSourceVertexJoinFootprint({
      ...common,
      authoredJoin: 'round'
    })

    expect(miter).toMatchObject({
      authoredJoin: 'miter',
      resolvedJoin: 'miter',
      geometryBasis: 'canonical-join-footprint'
    })
    expect(bevel).toMatchObject({
      authoredJoin: 'bevel',
      resolvedJoin: 'bevel',
      geometryBasis: 'canonical-join-footprint'
    })
    expect(round).toMatchObject({
      authoredJoin: 'round',
      resolvedJoin: 'round',
      geometryBasis: 'canonical-join-footprint'
    })
    expect(
      new Set([
        polygonSignature(miter.polygon),
        polygonSignature(bevel.polygon),
        polygonSignature(round.polygon)
      ]).size
    ).toBe(3)
    expect(round.polygon.length).toBeGreaterThan(bevel.polygon.length)
    expect(maxDistanceFrom(common.vertex, miter.polygon)).toBeGreaterThan(
      maxDistanceFrom(common.vertex, bevel.polygon)
    )
  })
})
