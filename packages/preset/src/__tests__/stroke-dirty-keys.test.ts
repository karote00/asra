import { describe, expect, it } from 'vitest'
import {
  buildStrokeRuntimeRevisionSet,
  computeStrokeDirtyKeys,
  type StrokeRevisionSet
} from '../components/stroke-render/stroke-dirty-keys'

const baseRevisionSet: StrokeRevisionSet = {
  sourcePathRevision: 1,
  strokeSpecRevision: 1,
  intervalAllocationRevision: 1,
  topologyClassificationRevision: 1,
  ownershipRevision: 1,
  legalityRevision: 1,
  paintRevision: 1,
  previewModeRevision: 1
}

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
        'source-topology-classification',
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
      resolutionStatus: 'native-center',
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
      resolutionStatus: 'native-center',
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

  it('should run: invalidate interval and one-sided geometry when miter limits change', () => {
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
      changedRevisionKeys: ['strokeSpecRevision'],
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
})
