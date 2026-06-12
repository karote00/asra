import { describe, expect, it } from 'vitest'
import {
  buildStrokeRuntimeRevisionSet,
  computeStrokeDirtyKeys,
  type StrokeRevisionSet
} from '../components/stroke-render/stroke-dirty-keys'

const baseRevisionSet: StrokeRevisionSet = {
  sourcePathRevision: 1,
  strokeSpecRevision: 1,
  topologyClassificationRevision: 1,
  sharedGeometryRevision: 1,
  sourceFamilyRevision: 1,
  strokeDomainRevision: 1,
  intervalAllocationRevision: 1,
  ownershipRevision: 1,
  legalityRevision: 1,
  paintRevision: 1,
  previewModeRevision: 1
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
    geometryFamily: options.geometryFamily ?? 'constrained-dashed',
    resolutionStatus: options.resolutionStatus ?? 'exact-constrained',
    runtimeStatus: options.runtimeStatus ?? 'accepted',
    runtimeReason: options.runtimeReason ?? 'single-owner',
    ownerKey: options.ownerKey ?? 'network-a:stroke:0',
    networkId: options.networkId ?? 'network-a',
    strokeId: options.strokeId ?? 'stroke:0',
    intervalSignature: options.intervalSignature ?? 'interval:0',
    sourceTopology: options.sourceTopology ?? 'broader-simple-closed',
    intervalTopology: options.intervalTopology ?? 'single-edge',
    ownershipStatus: options.ownershipStatus ?? 'accepted',
    ownerCount: options.ownerCount ?? 1,
    previewMode: options.previewMode ?? 'exact'
  })

describe('stroke dirty keys', () => {
  it('should run: keep paint-only changes out of geometry stages', () => {
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

  it('should run: invalidate interval and later stages for dash schedule changes', () => {
    expect(
      computeStrokeDirtyKeys(baseRevisionSet, {
        ...baseRevisionSet,
        intervalAllocationRevision: 2
      })
    ).toEqual({
      changedRevisionKeys: ['intervalAllocationRevision'],
      dirtyKeys: [
        'interval-allocation',
        'one-sided-candidates',
        'arrangement-faces',
        'ownership',
        'legality',
        'resolved-regions',
        'paint-payload',
        'render-hit-export'
      ]
    })
  })

  it('should run: invalidate every dependent stage for source path changes', () => {
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
        'source-topology-classification',
        'source-family',
        'stroke-domain',
        'interval-allocation',
        'one-sided-candidates',
        'arrangement-faces',
        'ownership',
        'legality',
        'resolved-regions',
        'paint-payload',
        'render-hit-export'
      ]
    })
  })

  it('should not run: accept missing or non-comparable revision fields', () => {
    expect(() =>
      computeStrokeDirtyKeys(
        { ...baseRevisionSet, paintRevision: undefined },
        baseRevisionSet
      )
    ).toThrow('Invalid previous.paintRevision')
  })

  it('should run: invalidate geometry and later stages for preview-to-exact transitions', () => {
    expect(
      computeStrokeDirtyKeys(baseRevisionSet, {
        ...baseRevisionSet,
        previewModeRevision: 2
      })
    ).toEqual({
      changedRevisionKeys: ['previewModeRevision'],
      dirtyKeys: [
        'one-sided-candidates',
        'arrangement-faces',
        'ownership',
        'legality',
        'resolved-regions',
        'paint-payload',
        'render-hit-export'
      ]
    })
  })

  it('should run: derive revisions from real stroke inputs instead of cache ids', () => {
    const base = buildStrokeRuntimeRevisionSet({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      closed: false,
      stroke: {
        style: 'solid',
        position: 'center',
        width: 4,
        join: 'miter',
        miterLimit: 4,
        cap: 'round',
        color: 0x3366ff,
        alpha: 1
      },
      geometryFamily: 'solid-center',
      resolutionStatus: 'center-product',
      runtimeStatus: 'not-applicable',
      runtimeReason: 'center-stroke',
      ownerKey: 'shape:a:stroke:0',
      strokeId: 'stroke:0'
    })
    const paintOnly = buildStrokeRuntimeRevisionSet({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      closed: false,
      stroke: {
        style: 'solid',
        position: 'center',
        width: 4,
        join: 'miter',
        miterLimit: 4,
        cap: 'round',
        color: 0xff0000,
        alpha: 1
      },
      geometryFamily: 'solid-center',
      resolutionStatus: 'center-product',
      runtimeStatus: 'not-applicable',
      runtimeReason: 'center-stroke',
      ownerKey: 'shape:a:stroke:0',
      strokeId: 'stroke:0'
    })

    expect(computeStrokeDirtyKeys(base, paintOnly)).toEqual({
      changedRevisionKeys: ['paintRevision'],
      dirtyKeys: ['paint-payload', 'render-hit-export']
    })
  })

  it('should run: build explicit revisions for candidate, arrangement, region, and render output stages', () => {
    const revisionSet = buildStrokeRuntimeRevisionSet({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ],
      closed: true,
      stroke: {
        style: 'dashed',
        position: 'inside',
        width: 4,
        join: 'round',
        miterLimit: 4,
        cap: 'round',
        dashPattern: [8, 4],
        dashOffset: 0,
        color: 0x3366ff,
        alpha: 1
      },
      geometryFamily: 'constrained-dashed',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted',
      runtimeReason: 'single-owner',
      ownerKey: 'network-a:stroke:0',
      networkId: 'network-a',
      strokeId: 'stroke:0',
      intervalSignature: 'interval:0',
      sourceTopology: 'broader-simple-closed',
      intervalTopology: 'single-edge',
      ownershipStatus: 'accepted',
      ownerCount: 1
    })

    expect(revisionSet.candidateRevision).toMatch(/^candidate:/)
    expect(revisionSet.arrangementRevision).toMatch(/^arrangement:/)
    expect(revisionSet.resolvedRegionRevision).toMatch(/^resolved-region:/)
    expect(revisionSet.renderOutputRevision).toMatch(/^render-output:/)
    expect(revisionSet.sharedGeometryRevision).toMatch(/^shared-geometry:/)
    expect(revisionSet.sourceFamilyRevision).toMatch(/^source-family:/)
    expect(revisionSet.strokeDomainRevision).toMatch(/^stroke-domain:/)
  })

  it('should run: classify shared geometry, source family, and stroke domain revisions before interval reuse', () => {
    expect(
      computeStrokeDirtyKeys(baseRevisionSet, {
        ...baseRevisionSet,
        sharedGeometryRevision: 2
      })
    ).toEqual({
      changedRevisionKeys: ['sharedGeometryRevision'],
      dirtyKeys: [
        'shared-geometry',
        'source-family',
        'stroke-domain',
        'interval-allocation',
        'one-sided-candidates',
        'arrangement-faces',
        'ownership',
        'legality',
        'resolved-regions',
        'paint-payload',
        'render-hit-export'
      ]
    })

    expect(
      computeStrokeDirtyKeys(baseRevisionSet, {
        ...baseRevisionSet,
        sourceFamilyRevision: 2
      })
    ).toEqual({
      changedRevisionKeys: ['sourceFamilyRevision'],
      dirtyKeys: [
        'source-family',
        'stroke-domain',
        'interval-allocation',
        'one-sided-candidates',
        'arrangement-faces',
        'ownership',
        'legality',
        'resolved-regions',
        'paint-payload',
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
        'one-sided-candidates',
        'arrangement-faces',
        'ownership',
        'legality',
        'resolved-regions',
        'paint-payload',
        'render-hit-export'
      ]
    })
  })

  it('should run: classify stage-specific revision changes before render-entry reuse', () => {
    expect(
      computeStrokeDirtyKeys(
        {
          ...baseRevisionSet,
          candidateRevision: 'candidate:1',
          arrangementRevision: 'arrangement:1',
          resolvedRegionRevision: 'region:1',
          renderOutputRevision: 'output:1'
        },
        {
          ...baseRevisionSet,
          candidateRevision: 'candidate:2',
          arrangementRevision: 'arrangement:1',
          resolvedRegionRevision: 'region:1',
          renderOutputRevision: 'output:1'
        }
      )
    ).toEqual({
      changedRevisionKeys: ['candidateRevision'],
      dirtyKeys: [
        'one-sided-candidates',
        'arrangement-faces',
        'ownership',
        'legality',
        'resolved-regions',
        'paint-payload',
        'render-hit-export'
      ]
    })

    expect(
      computeStrokeDirtyKeys(
        {
          ...baseRevisionSet,
          candidateRevision: 'candidate:1',
          arrangementRevision: 'arrangement:1',
          resolvedRegionRevision: 'region:1',
          renderOutputRevision: 'output:1'
        },
        {
          ...baseRevisionSet,
          candidateRevision: 'candidate:1',
          arrangementRevision: 'arrangement:2',
          resolvedRegionRevision: 'region:2',
          renderOutputRevision: 'output:2'
        }
      )
    ).toEqual({
      changedRevisionKeys: [
        'arrangementRevision',
        'resolvedRegionRevision',
        'renderOutputRevision'
      ],
      dirtyKeys: [
        'arrangement-faces',
        'ownership',
        'legality',
        'resolved-regions',
        'paint-payload',
        'render-hit-export'
      ]
    })
  })

  it('should run: keep owner changes scoped to ownership and later stages', () => {
    const base = buildStrokeRuntimeRevisionSet({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      closed: false,
      stroke: {
        style: 'solid',
        position: 'inside',
        width: 4,
        join: 'miter',
        miterLimit: 4,
        cap: 'butt',
        color: 0x3366ff,
        alpha: 1
      },
      geometryFamily: 'constrained-solid',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted',
      runtimeReason: 'constrained-solid-exact',
      ownerKey: 'network-a:stroke:0',
      networkId: 'network-a',
      strokeId: 'stroke:0'
    })
    const ownerChanged = buildStrokeRuntimeRevisionSet({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      closed: false,
      stroke: {
        style: 'solid',
        position: 'inside',
        width: 4,
        join: 'miter',
        miterLimit: 4,
        cap: 'butt',
        color: 0x3366ff,
        alpha: 1
      },
      geometryFamily: 'constrained-solid',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted',
      runtimeReason: 'constrained-solid-exact',
      ownerKey: 'network-b:stroke:0',
      networkId: 'network-b',
      strokeId: 'stroke:0'
    })

    expect(computeStrokeDirtyKeys(base, ownerChanged)).toEqual({
      changedRevisionKeys: ['ownershipRevision'],
      dirtyKeys: [
        'ownership',
        'legality',
        'resolved-regions',
        'paint-payload',
        'render-hit-export'
      ]
    })
  })

  it('should run: keep miter limit changes scoped to join geometry and later stages', () => {
    const base = buildStrokeRuntimeRevisionSet({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ],
      closed: false,
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
        alpha: 1
      },
      geometryFamily: 'constrained-dashed',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted',
      runtimeReason: 'single-owner',
      ownerKey: 'network-a:stroke:0',
      networkId: 'network-a',
      strokeId: 'stroke:0',
      intervalSignature: 'interval:0'
    })
    const miterChanged = buildStrokeRuntimeRevisionSet({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ],
      closed: false,
      stroke: {
        style: 'dashed',
        position: 'inside',
        width: 4,
        join: 'miter',
        miterLimit: 1,
        cap: 'butt',
        dashPattern: [10, 5],
        dashOffset: 0,
        color: 0x3366ff,
        alpha: 1
      },
      geometryFamily: 'constrained-dashed',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted',
      runtimeReason: 'single-owner',
      ownerKey: 'network-a:stroke:0',
      networkId: 'network-a',
      strokeId: 'stroke:0',
      intervalSignature: 'interval:0'
    })

    expect(computeStrokeDirtyKeys(base, miterChanged)).toEqual({
      changedRevisionKeys: ['joinShapeRevision', 'renderOutputRevision'],
      dirtyKeys: [
        'one-sided-candidates',
        'arrangement-faces',
        'ownership',
        'legality',
        'resolved-regions',
        'paint-payload',
        'render-hit-export'
      ]
    })
  })

  it('should run: keep cap changes out of source, domain, and dash schedule stages for closed paths', () => {
    const base = buildParameterRevisionSet({ cap: 'butt' })
    const capChanged = buildParameterRevisionSet({ cap: 'round' })

    expect(computeStrokeDirtyKeys(base, capChanged)).toEqual({
      changedRevisionKeys: ['terminalCapRevision', 'renderOutputRevision'],
      dirtyKeys: [
        'one-sided-candidates',
        'arrangement-faces',
        'ownership',
        'legality',
        'resolved-regions',
        'paint-payload',
        'render-hit-export'
      ]
    })
  })

  it('should run: conservatively invalidate dash schedule for open path cap changes', () => {
    const base = buildParameterRevisionSet({ cap: 'butt' }, { closed: false })
    const capChanged = buildParameterRevisionSet(
      { cap: 'square' },
      { closed: false }
    )

    expect(computeStrokeDirtyKeys(base, capChanged)).toEqual({
      changedRevisionKeys: [
        'intervalAllocationRevision',
        'dashScheduleRevision',
        'terminalCapRevision',
        'renderOutputRevision'
      ],
      dirtyKeys: [
        'interval-allocation',
        'one-sided-candidates',
        'arrangement-faces',
        'ownership',
        'legality',
        'resolved-regions',
        'paint-payload',
        'render-hit-export'
      ]
    })
  })

  it('should run: keep dash pattern and offset changes out of source and join stages', () => {
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
        'one-sided-candidates',
        'arrangement-faces',
        'ownership',
        'legality',
        'resolved-regions',
        'paint-payload',
        'render-hit-export'
      ]
    })
  })

  it('should run: keep join changes scoped to join geometry and later stages', () => {
    const base = buildParameterRevisionSet({ join: 'miter', miterLimit: 4 })
    const joinChanged = buildParameterRevisionSet({
      join: 'round',
      miterLimit: 4
    })

    expect(computeStrokeDirtyKeys(base, joinChanged)).toEqual({
      changedRevisionKeys: ['joinShapeRevision', 'renderOutputRevision'],
      dirtyKeys: [
        'one-sided-candidates',
        'arrangement-faces',
        'ownership',
        'legality',
        'resolved-regions',
        'paint-payload',
        'render-hit-export'
      ]
    })
  })

  it('should run: keep width changes out of source topology and dash schedule', () => {
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
        'one-sided-candidates',
        'arrangement-faces',
        'ownership',
        'legality',
        'resolved-regions',
        'paint-payload',
        'render-hit-export'
      ]
    })
  })

  it('should run: keep paint changes out of every geometry stage', () => {
    const base = buildParameterRevisionSet({ color: 0x3366ff, alpha: 1 })
    const paintChanged = buildParameterRevisionSet({
      color: 0xff3366,
      alpha: 0.5
    })

    expect(computeStrokeDirtyKeys(base, paintChanged)).toEqual({
      changedRevisionKeys: ['paintRevision'],
      dirtyKeys: ['paint-payload', 'render-hit-export']
    })
  })

  it('should run: keep visibility changes scoped to render output', () => {
    const base = buildParameterRevisionSet({ visible: true })
    const hidden = buildParameterRevisionSet({ visible: false })

    expect(computeStrokeDirtyKeys(base, hidden)).toEqual({
      changedRevisionKeys: ['renderOutputRevision'],
      dirtyKeys: ['render-hit-export']
    })
  })

  it('should run: keep drag path changes from mutating stroke parameter revisions', () => {
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
    expect(result.changedRevisionKeys).not.toContain('paintRevision')
  })

  it('should run: emit counters for cache observability when a sink is installed', () => {
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
    expect(counters['stroke-dirty-key:paint-payload']).toBeGreaterThan(0)
    expect(counters['stroke-revision-change:sourcePathRevision']).toBe(1)
  })
})
