import { describe, expect, it } from 'vitest'
import {
  buildStrokeRuntimeRevisionSet,
  computeStrokeDirtyKeys,
  type StrokeRevisionSet
} from '../components/stroke-render/stroke-dirty-keys'

const baseRevisionSet: StrokeRevisionSet = {
  sourcePathRevision: 1,
  strokeSpecRevision: 1,
  domainPlanRevision: 1,
  sharedGeometryRevision: 1,
  strokeProductRevision: 1,
  strokeDomainRevision: 1,
  intervalAllocationRevision: 1,
  ownershipRevision: 1,
  legalityRevision: 1,
  paintRevision: 1,
  strokeFamilyRevision: 1,
  dashScheduleRevision: 1,
  terminalCapRevision: 1,
  joinShapeRevision: 1,
  smoothContinuityRevision: 1,
  productMaterializationRevision: 1,
  resolvedRegionRevision: 1,
  renderOutputRevision: 1
}

const buildParameterRevisionSet = (
  strokeOverrides: Partial<
    Parameters<typeof buildStrokeRuntimeRevisionSet>[0]['stroke']
  >,
  options: Partial<Parameters<typeof buildStrokeRuntimeRevisionSet>[0]> = {}
) =>
  buildStrokeRuntimeRevisionSet({
    points: options.points ?? [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ],
    closed: options.closed ?? true,
    stroke: {
      style: 'dashed',
      position: 'inside',
      width: 4,
      join: 'miter',
      miterLimit: 4,
      cap: 'butt',
      dashPattern: [10, 5],
      dashOffset: 0,
      color: 0x3366ff,
      alpha: 1,
      ...strokeOverrides
    },
    productMode: options.productMode ?? 'closed-constrained-domain',
    domainMode: options.domainMode ?? 'closed-constrained-domain',
    ownerKey: options.ownerKey ?? 'network-a:stroke:0',
    networkId: options.networkId ?? 'network-a',
    strokeId: options.strokeId ?? 'stroke:0',
    intervalSignature: options.intervalSignature ?? 'interval:0',
    endpointCapPolicySignature:
      options.endpointCapPolicySignature ?? 'terminal-policy:0',
    joinOwnershipSignature:
      options.joinOwnershipSignature ?? 'join-ownership:0',
    strokeProductSignature:
      options.strokeProductSignature ?? 'stroke-product:0',
    ownerCount: options.ownerCount ?? 1,
    smoothContinuitySignature:
      options.smoothContinuitySignature ?? 'smooth-group:0',
    productMaterializationSignature:
      options.productMaterializationSignature ?? 'product:0'
  })

describe('stroke dirty keys', () => {
  it('keeps paint-only changes out of geometry stages', () => {
    expect(
      computeStrokeDirtyKeys(baseRevisionSet, {
        ...baseRevisionSet,
        paintRevision: 2
      })
    ).toEqual({
      changedRevisionKeys: ['paintRevision'],
      dirtyKeys: ['paint-payload', 'render-hit-export']
    })
  })

  it('invalidates dash product intervals and downstream stages for interval allocation changes', () => {
    expect(
      computeStrokeDirtyKeys(baseRevisionSet, {
        ...baseRevisionSet,
        intervalAllocationRevision: 2
      })
    ).toEqual({
      changedRevisionKeys: ['intervalAllocationRevision'],
      dirtyKeys: [
        'interval-allocation',
        'dash-product-intervals',
        'endpoint-cap-policy',
        'join-ownership',
        'smooth-continuity',
        'product-materialization',
        'legality',
        'resolved-regions',
        'render-hit-export'
      ]
    })
  })

  it('invalidates every dependent stage for source path changes', () => {
    expect(
      computeStrokeDirtyKeys(baseRevisionSet, {
        ...baseRevisionSet,
        sourcePathRevision: 2
      })
    ).toEqual({
      changedRevisionKeys: ['sourcePathRevision'],
      dirtyKeys: [
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
        'render-hit-export'
      ]
    })
  })

  it('rejects missing required revision fields', () => {
    expect(() =>
      computeStrokeDirtyKeys(
        { ...baseRevisionSet, paintRevision: undefined },
        baseRevisionSet
      )
    ).toThrow('Invalid previous.paintRevision')
  })

  it('builds explicit revisions for new product contract stages', () => {
    const revisionSet = buildParameterRevisionSet({
      cap: 'round',
      join: 'round',
      dashPattern: [8, 4]
    })

    expect(revisionSet.dashScheduleRevision).toMatch(/^dash-schedule:/)
    expect(revisionSet.terminalCapRevision).toMatch(/^terminal-cap:/)
    expect(revisionSet.joinShapeRevision).toMatch(/^join-shape:/)
    expect(revisionSet.smoothContinuityRevision).toMatch(/^smooth-continuity:/)
    expect(revisionSet.productMaterializationRevision).toMatch(
      /^product-materialization:/
    )
    expect(revisionSet.resolvedRegionRevision).toMatch(/^resolved-region:/)
    expect(revisionSet.renderOutputRevision).toMatch(/^render-output:/)
    expect(Object.keys(revisionSet).sort()).toEqual(
      [
        'dashScheduleRevision',
        'intervalAllocationRevision',
        'joinShapeRevision',
        'legalityRevision',
        'ownershipRevision',
        'paintRevision',
        'productMaterializationRevision',
        'renderOutputRevision',
        'resolvedRegionRevision',
        'sharedGeometryRevision',
        'smoothContinuityRevision',
        'sourcePathRevision',
        'strokeProductRevision',
        'strokeFamilyRevision',
        'strokeDomainRevision',
        'strokeSpecRevision',
        'terminalCapRevision',
        'domainPlanRevision'
      ].sort()
    )
  })

  it('classifies shared geometry, stroke product, and stroke domain revisions before interval reuse', () => {
    expect(
      computeStrokeDirtyKeys(baseRevisionSet, {
        ...baseRevisionSet,
        sharedGeometryRevision: 2
      })
    ).toEqual({
      changedRevisionKeys: ['sharedGeometryRevision'],
      dirtyKeys: [
        'shared-geometry',
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
        'render-hit-export'
      ]
    })

    expect(
      computeStrokeDirtyKeys(baseRevisionSet, {
        ...baseRevisionSet,
        strokeProductRevision: 2
      })
    ).toEqual({
      changedRevisionKeys: ['strokeProductRevision'],
      dirtyKeys: [
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
        'render-hit-export'
      ]
    })

    expect(
      computeStrokeDirtyKeys(baseRevisionSet, {
        ...baseRevisionSet,
        strokeDomainRevision: 2
      })
    ).toEqual({
      changedRevisionKeys: ['strokeDomainRevision'],
      dirtyKeys: [
        'stroke-domain',
        'interval-allocation',
        'dash-product-intervals',
        'endpoint-cap-policy',
        'join-ownership',
        'smooth-continuity',
        'product-materialization',
        'legality',
        'resolved-regions',
        'render-hit-export'
      ]
    })
  })

  it('classifies product-stage revision changes before render-entry reuse', () => {
    expect(
      computeStrokeDirtyKeys(
        {
          ...baseRevisionSet,
          smoothContinuityRevision: 'smooth:1',
          productMaterializationRevision: 'product:1',
          resolvedRegionRevision: 'region:1',
          renderOutputRevision: 'output:1'
        },
        {
          ...baseRevisionSet,
          smoothContinuityRevision: 'smooth:2',
          productMaterializationRevision: 'product:1',
          resolvedRegionRevision: 'region:1',
          renderOutputRevision: 'output:1'
        }
      )
    ).toEqual({
      changedRevisionKeys: ['smoothContinuityRevision'],
      dirtyKeys: [
        'smooth-continuity',
        'product-materialization',
        'legality',
        'resolved-regions',
        'render-hit-export'
      ]
    })

    expect(
      computeStrokeDirtyKeys(
        {
          ...baseRevisionSet,
          smoothContinuityRevision: 'smooth:1',
          productMaterializationRevision: 'product:1',
          resolvedRegionRevision: 'region:1',
          renderOutputRevision: 'output:1'
        },
        {
          ...baseRevisionSet,
          smoothContinuityRevision: 'smooth:1',
          productMaterializationRevision: 'product:2',
          resolvedRegionRevision: 'region:2',
          renderOutputRevision: 'output:2'
        }
      )
    ).toEqual({
      changedRevisionKeys: [
        'productMaterializationRevision',
        'resolvedRegionRevision',
        'renderOutputRevision'
      ],
      dirtyKeys: [
        'product-materialization',
        'legality',
        'resolved-regions',
        'render-hit-export'
      ]
    })
  })

  it('keeps owner changes scoped to join ownership and later stages', () => {
    expect(
      computeStrokeDirtyKeys(baseRevisionSet, {
        ...baseRevisionSet,
        ownershipRevision: 2
      })
    ).toEqual({
      changedRevisionKeys: ['ownershipRevision'],
      dirtyKeys: [
        'join-ownership',
        'smooth-continuity',
        'product-materialization',
        'legality',
        'resolved-regions',
        'render-hit-export'
      ]
    })
  })

  it('keeps miter limit changes scoped to join ownership and downstream product stages', () => {
    const base = buildParameterRevisionSet({ join: 'miter', miterLimit: 4 })
    const miterChanged = buildParameterRevisionSet({
      join: 'miter',
      miterLimit: 1
    })

    expect(computeStrokeDirtyKeys(base, miterChanged)).toEqual({
      changedRevisionKeys: ['joinShapeRevision', 'renderOutputRevision'],
      dirtyKeys: [
        'join-ownership',
        'smooth-continuity',
        'product-materialization',
        'legality',
        'resolved-regions',
        'render-hit-export'
      ]
    })
  })

  it('keeps cap changes out of source, domain, and dash schedule stages', () => {
    const base = buildParameterRevisionSet({ cap: 'butt' })
    const capChanged = buildParameterRevisionSet({ cap: 'round' })

    expect(computeStrokeDirtyKeys(base, capChanged)).toEqual({
      changedRevisionKeys: ['terminalCapRevision', 'renderOutputRevision'],
      dirtyKeys: [
        'endpoint-cap-policy',
        'product-materialization',
        'legality',
        'resolved-regions',
        'render-hit-export'
      ]
    })
  })

  it('keeps open path cap changes out of dash schedule stages', () => {
    const base = buildParameterRevisionSet({ cap: 'butt' }, { closed: false })
    const capChanged = buildParameterRevisionSet(
      { cap: 'square' },
      { closed: false }
    )

    expect(computeStrokeDirtyKeys(base, capChanged)).toEqual({
      changedRevisionKeys: ['terminalCapRevision', 'renderOutputRevision'],
      dirtyKeys: [
        'endpoint-cap-policy',
        'product-materialization',
        'legality',
        'resolved-regions',
        'render-hit-export'
      ]
    })
  })

  it('keeps dash pattern and offset changes out of source and join policy inputs', () => {
    const base = buildParameterRevisionSet({
      dashPattern: [10, 5],
      dashOffset: 0
    })
    const dashChanged = buildParameterRevisionSet({
      dashPattern: [14, 6],
      dashOffset: 2
    })

    expect(computeStrokeDirtyKeys(base, dashChanged)).toEqual({
      changedRevisionKeys: [
        'intervalAllocationRevision',
        'dashScheduleRevision',
        'renderOutputRevision'
      ],
      dirtyKeys: [
        'interval-allocation',
        'dash-product-intervals',
        'endpoint-cap-policy',
        'join-ownership',
        'smooth-continuity',
        'product-materialization',
        'legality',
        'resolved-regions',
        'render-hit-export'
      ]
    })
  })

  it('keeps join changes scoped to join ownership and downstream product stages', () => {
    const base = buildParameterRevisionSet({ join: 'miter', miterLimit: 4 })
    const joinChanged = buildParameterRevisionSet({
      join: 'round',
      miterLimit: 4
    })

    expect(computeStrokeDirtyKeys(base, joinChanged)).toEqual({
      changedRevisionKeys: ['joinShapeRevision', 'renderOutputRevision'],
      dirtyKeys: [
        'join-ownership',
        'smooth-continuity',
        'product-materialization',
        'legality',
        'resolved-regions',
        'render-hit-export'
      ]
    })
  })

  it('keeps width changes out of source topology and dash schedule', () => {
    const base = buildParameterRevisionSet({ width: 4 })
    const widthChanged = buildParameterRevisionSet({ width: 8 })

    expect(computeStrokeDirtyKeys(base, widthChanged)).toEqual({
      changedRevisionKeys: [
        'strokeDomainRevision',
        'terminalCapRevision',
        'joinShapeRevision',
        'renderOutputRevision'
      ],
      dirtyKeys: [
        'stroke-domain',
        'interval-allocation',
        'dash-product-intervals',
        'endpoint-cap-policy',
        'join-ownership',
        'smooth-continuity',
        'product-materialization',
        'legality',
        'resolved-regions',
        'render-hit-export'
      ]
    })
  })

  it('keeps visibility changes scoped to render output', () => {
    const base = buildParameterRevisionSet({ visible: true })
    const hidden = buildParameterRevisionSet({ visible: false })

    expect(computeStrokeDirtyKeys(base, hidden)).toEqual({
      changedRevisionKeys: ['renderOutputRevision'],
      dirtyKeys: ['render-hit-export']
    })
  })

  it('keeps drag path changes from mutating stroke parameter revisions', () => {
    const base = buildParameterRevisionSet({})
    const dragged = buildParameterRevisionSet(
      {},
      {
        points: [
          { x: 0, y: 0 },
          { x: 14, y: 2 },
          { x: 10, y: 10 }
        ]
      }
    )
    const result = computeStrokeDirtyKeys(base, dragged)

    expect(result.changedRevisionKeys).toContain('sourcePathRevision')
    expect(result.changedRevisionKeys).toContain('dashScheduleRevision')
    expect(result.changedRevisionKeys).not.toContain('strokeSpecRevision')
    expect(result.changedRevisionKeys).not.toContain('terminalCapRevision')
    expect(result.changedRevisionKeys).not.toContain('joinShapeRevision')
    expect(result.changedRevisionKeys).not.toContain('paintRevision')
    expect(result.dirtyKeys).not.toContain('paint-payload')
  })

  it('emits counters for cache observability when a sink is installed', () => {
    const counters: Record<string, number> = {}
    ;(
      globalThis as typeof globalThis & {
        __asyraStrokePipelineCounterSink?: (
          counterName: string,
          value: number
        ) => void
      }
    ).__asyraStrokePipelineCounterSink = (counterName, value) => {
      counters[counterName] = (counters[counterName] ?? 0) + value
    }

    try {
      computeStrokeDirtyKeys(
        buildParameterRevisionSet({ color: 0x3366ff }),
        buildParameterRevisionSet({ color: 0xff3366 })
      )
      computeStrokeDirtyKeys(
        buildParameterRevisionSet({}),
        buildParameterRevisionSet(
          {},
          {
            points: [
              { x: 0, y: 0 },
              { x: 14, y: 2 },
              { x: 10, y: 10 }
            ]
          }
        )
      )
    } finally {
      ;(
        globalThis as typeof globalThis & {
          __asyraStrokePipelineCounterSink?: unknown
        }
      ).__asyraStrokePipelineCounterSink = undefined
    }

    expect(counters['stroke-cache:paint-only-update']).toBe(1)
    expect(counters['stroke-cache:drag-source-path-with-static-stroke']).toBe(1)
    expect(counters['stroke-dirty-key:paint-payload']).toBe(1)
    expect(counters['stroke-revision-change:sourcePathRevision']).toBe(1)
  })
})
