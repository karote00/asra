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
import { describe, expect } from 'vitest'
import { integrationCase } from './stroke-integration-inspector-test-helper'
import { normalizeStrokeSpec } from '../../components/stroke-render/renderable-stroke'
import { selectStrokeProductFamily } from '../../components/stroke-render/stroke-product-family'

const constrainedDomain = {
  planId: 'domain:parameters',
  sourceId: 'source:parameters',
  networkId: 'network:parameters',
  domainMode: 'closed-constrained-domain' as const,
  intervalDomainKind: 'domain-plan-split-range' as const
}

describe('stroke integration: source and domain planning', () => {
  integrationCase('normalized-source-domain-dash-family-chain', 'normalizes authored dashed parameters before constrained family selection', () => {
    const normalized = normalizeStrokeSpec([
      createDefaultStroke({
        id: 'stroke:flow',
        style: StrokeStyles.DASHED,
        position: StrokePositions.OUTSIDE,
        width: 10,
        dash: 24,
        gap: 12,
        joinType: StrokeJoinTypes.MITER,
        capType: StrokeCapTypes.BUTT,
        miterAngle: 28.96,
        visible: true,
        color: '#777777',
        opacity: 1
      })
    ])

    expect(normalized.diagnostics).toEqual([])
    expect(normalized.strokes).toHaveLength(1)
    const [stroke] = normalized.strokes
    expect(stroke).toMatchObject({
      style: 'dashed',
      position: 'outside',
      width: 10,
      dash: 24,
      gap: 12,
      join: 'miter',
      cap: 'butt',
      miterAngle: 28.96
    })

    const family = selectStrokeProductFamily({
      stroke,
      sourceFamily: { familyScope: 'self-intersecting-closed' },
      domainPlan: constrainedDomain,
      dashSignature: 'dash:24-12'
    })
    expect(family).toMatchObject({
      productFamilyId: 'constrained-dashed',
      selectedRouteIds: [],
      dashSignature: 'dash:24-12',
      coExecutionRouteIds: [
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'build-smooth-continuity-products'
      ],
      predicateInputs: {
        strokeStyle: 'dashed',
        strokePosition: 'outside',
        domainMode: 'closed-constrained-domain',
        intervalDomainKind: 'domain-plan-split-range',
        sourceFamilyScope: 'self-intersecting-closed'
      }
    })
  })

  integrationCase('product-family-selection-and-unsupported-terminal', 'selects product families from normalized style, position, and domain only', () => {
    const cases = [
      {
        style: 'solid' as const,
        position: 'center' as const,
        domainMode: 'center-product' as const,
        intervalDomainKind: 'topology-arc-length' as const,
        family: 'center',
        selected: ['build-center-stroke-products'],
        coexecute: []
      },
      {
        style: 'solid' as const,
        position: 'inside' as const,
        domainMode: 'closed-constrained-domain' as const,
        intervalDomainKind: 'domain-plan-split-range' as const,
        family: 'constrained-solid',
        selected: ['build-constrained-solid-products'],
        coexecute: []
      },
      {
        style: 'dashed' as const,
        position: 'outside' as const,
        domainMode: 'closed-constrained-domain' as const,
        intervalDomainKind: 'domain-plan-split-range' as const,
        family: 'constrained-dashed',
        selected: [],
        coexecute: [
          'build-dash-interval-body-products',
          'build-source-vertex-join-products',
          'build-terminal-body-products',
          'build-smooth-continuity-products'
        ]
      }
    ]

    for (const {
      style,
      position,
      domainMode,
      intervalDomainKind,
      family,
      selected,
      coexecute
    } of cases) {
      const selection = selectStrokeProductFamily({
        stroke: { style, position },
        sourceFamily: { familyScope: 'self-intersecting-closed' },
        domainPlan: {
          ...constrainedDomain,
          domainMode,
          intervalDomainKind
        },
        dashSignature: style === 'dashed' ? 'dash:20-10:0' : 'dash:none'
      })

      expect(selection).toMatchObject({
        productFamilyId: family,
        selectedRouteIds: selected,
        coExecutionRouteIds: coexecute,
        diagnostics: []
      })
      expect(JSON.stringify(selection)).not.toMatch(
        /polygon|resolvedJoin|strokeMaskPolygons/
      )
    }
  })

  integrationCase('normalized-source-domain-dash-family-chain', 'keeps gradient paint normalized but outside geometry planning ownership', () => {
    const [stroke] = normalizeStrokeSpec([
      createDefaultStroke({
        id: 'stroke:gradient-channel',
        style: StrokeStyles.SOLID,
        position: StrokePositions.CENTER,
        width: 6,
        joinType: StrokeJoinTypes.BEVEL,
        capType: StrokeCapTypes.ROUND,
        fill: createDefaultFill({
          kind: FillKinds.GRADIENT,
          gradient: createDefaultGradientData()
        })
      })
    ]).strokes

    expect(stroke).toMatchObject({
      kind: 'gradient',
      style: 'solid',
      position: 'center',
      width: 6,
      join: 'bevel',
      cap: 'round'
    })
    expect(stroke.gradientStyle).toBeTruthy()
    expect(stroke.paintKey).toContain('"kind":"gradient"')
    expect(stroke).not.toHaveProperty('polygons')
    expect(stroke).not.toHaveProperty('renderDescriptor')
  })
})
