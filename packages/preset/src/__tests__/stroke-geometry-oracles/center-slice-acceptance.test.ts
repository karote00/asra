import {
  StrokeCapTypes,
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import { describe, expect, it } from 'vitest'
import { buildDashedCenterStrokeResolvedPackets } from '../../components/stroke-render/dashed-center-stroke-packets'
import {
  emitSolidCenterStrokeProductOutputPacketsFromFinalFaces,
  toSolidCenterStrokeRenderEntriesFromFinalFaces
} from '../../components/stroke-render/solid-center-stroke-packets'
import { projectSolidCenterStrokeRenderEntries } from '../../components/stroke-render/solid-center-stroke-render'
import { buildStrokeFinalFacesFromResolvedPackets } from '../../components/stroke-render/stroke-final-face'
import {
  assertFinitePolygons,
  assertNoForbiddenContributorTokens
} from './stroke-geometry-oracle-assertions'
import {
  getStrokeGeometryOracleFixture,
  type StrokeGeometryOracleFixtureScenarioId
} from './stroke-geometry-oracle-fixtures'
import { buildSolidCenterStrokeResolvedPackets } from '../../components/stroke-render/solid-center-stroke-packets'

type CenterSliceCase = {
  id: string
  fixtureId: StrokeGeometryOracleFixtureScenarioId
  style: 'solid' | 'dashed'
  capType: StrokeCapTypes
  joinType: StrokeJoinTypes
  expectedProductSignature: 'center-product:solid' | 'center-product:dashed'
}

const centerSliceCases: CenterSliceCase[] = [
  {
    id: 'solid-open-square-miter',
    fixtureId: 'straight-segment',
    style: 'solid',
    capType: StrokeCapTypes.SQUARE,
    joinType: StrokeJoinTypes.MITER,
    expectedProductSignature: 'center-product:solid'
  },
  {
    id: 'solid-closed-round-bevel',
    fixtureId: 'convex-closed-polygon',
    style: 'solid',
    capType: StrokeCapTypes.ROUND,
    joinType: StrokeJoinTypes.BEVEL,
    expectedProductSignature: 'center-product:solid'
  },
  {
    id: 'dashed-open-round-bevel',
    fixtureId: 'straight-segment',
    style: 'dashed',
    capType: StrokeCapTypes.ROUND,
    joinType: StrokeJoinTypes.BEVEL,
    expectedProductSignature: 'center-product:dashed'
  },
  {
    id: 'dashed-closed-butt-round',
    fixtureId: 'convex-closed-polygon',
    style: 'dashed',
    capType: StrokeCapTypes.BUTT,
    joinType: StrokeJoinTypes.ROUND,
    expectedProductSignature: 'center-product:dashed'
  }
]

const buildCenterSlicePackets = (testCase: CenterSliceCase) => {
  const fixture = getStrokeGeometryOracleFixture(testCase.fixtureId)
  const stroke = createDefaultStroke({
    id: `stroke:${testCase.id}`,
    position: StrokePositions.CENTER,
    style:
      testCase.style === 'solid' ? StrokeStyles.SOLID : StrokeStyles.DASHED,
    width: 12,
    joinType: testCase.joinType,
    capType: testCase.capType,
    miterAngle: 28.96,
    dash: 24,
    gap: 12,
    visible: true,
    color: '#3377cc',
    opacity: 0.82
  })

  return testCase.style === 'solid'
    ? buildSolidCenterStrokeResolvedPackets(
        `oracle:center-slice:${testCase.id}`,
        fixture.points,
        fixture.closed,
        [stroke]
      )
    : buildDashedCenterStrokeResolvedPackets(
        `oracle:center-slice:${testCase.id}`,
        fixture.points,
        fixture.closed,
        [stroke]
      )
}

describe('formal stroke geometry oracle: center slice acceptance', () => {
  it('accepts center solid and dashed open and closed products through final face, render entry, and renderer projection channels', () => {
    for (const testCase of centerSliceCases) {
      const packets = buildCenterSlicePackets(testCase)
      const finalFaces = buildStrokeFinalFacesFromResolvedPackets(packets)
      const renderEntries =
        toSolidCenterStrokeRenderEntriesFromFinalFaces(finalFaces)
      const projection = projectSolidCenterStrokeRenderEntries(renderEntries)
      const outputPackets =
        emitSolidCenterStrokeProductOutputPacketsFromFinalFaces(finalFaces)

      expect(packets.length, `${testCase.id}: packets`).toBeGreaterThan(0)
      expect(finalFaces.length, `${testCase.id}: final faces`).toBeGreaterThan(
        0
      )
      expect(
        renderEntries.length,
        `${testCase.id}: render entries`
      ).toBeGreaterThan(0)
      expect(projection.length, `${testCase.id}: projection`).toBe(
        renderEntries.length
      )
      expect(outputPackets.diagnosticPackets, testCase.id).toEqual([])

      for (const packet of packets) {
        assertFinitePolygons(packet.geometry.polygons, `${testCase.id}:packet`)
        expect(packet.geometry.debugMeta).toMatchObject({
          productMode: 'center-product',
          productSignature: testCase.expectedProductSignature,
          domainMode: 'center-product',
          strokePosition: 'center'
        })
        expect(packet.geometry.debugMeta?.strokeCap, testCase.id).toBe(
          testCase.capType
        )
        expect(packet.geometry.debugMeta?.strokeJoin, testCase.id).toBe(
          testCase.joinType
        )
      }

      for (const face of finalFaces) {
        assertFinitePolygons(face.polygons, `${testCase.id}:final-face`)
        expect(face.productMode, testCase.id).toBe('center-product')
        expect(face.productSignature, testCase.id).toBe(
          testCase.expectedProductSignature
        )
      }

      for (const entry of renderEntries) {
        assertFinitePolygons(entry.polygons, `${testCase.id}:render-entry`)
        expect(entry.runtimeMeta).toMatchObject({
          productMode: 'center-product',
          productSignature: testCase.expectedProductSignature,
          strokePosition: 'center'
        })
      }

      for (const command of projection) {
        expect(command).toMatchObject({
          channel: 'renderer-projection',
          visibility: 'visible-pixels',
          metadataMutation: false
        })
        expect(command.drawRouteType, testCase.id).toMatch(
          /^(polygon-fill|masked-solid|stroke-path-groups|stroke-paths)$/
        )
      }

      expect(outputPackets.renderPackets.length, testCase.id).toBeGreaterThan(0)
      expect(outputPackets.hitTestPackets.length, testCase.id).toBeGreaterThan(0)
      expect(outputPackets.exportPackets.length, testCase.id).toBeGreaterThan(0)
      expect(JSON.stringify(outputPackets.hitTestPackets), testCase.id).not.toContain(
        'renderer-projection'
      )
      expect(JSON.stringify(outputPackets.exportPackets), testCase.id).not.toContain(
        'renderer-projection'
      )
      assertNoForbiddenContributorTokens(
        { packets, finalFaces, renderEntries, projection, outputPackets },
        [
          'inside',
          'outside',
          'diagnostic/helper visible geometry',
          'renderer-local join repair',
          'renderer-local cap repair'
        ],
        testCase.id
      )
    }
  })
})
