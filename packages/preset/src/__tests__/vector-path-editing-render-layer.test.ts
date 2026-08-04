import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { getVectorNetworkAnchorHandleRefs } from '@asyra/core'
import {
  VECTOR_EDITING_HOVER_SEGMENT_STROKE,
  VECTOR_EDITING_SELECTED_SEGMENT_STROKE,
  getVisibleHandleAnchorIds,
  resolveOverlayHandlePosition
} from '../render-layers/vector-path-editing-render-layer.js'
import {
  SELECTION_OVERLAY_STROKE_WIDTH,
  SELECTION_OVERLAY_VECTOR_HOVER_STROKE_WIDTH,
  projectWorkspacePointToOverlayScreen
} from '../render-layers/selection-overlay-render-layer.js'

const penToolFeatureSource = () =>
  readFileSync(
    '../../apps/asyra-design/src/features/pen-tool/feature.ts',
    'utf8'
  )

const keyCombinationsSource = () =>
  readFileSync('../../apps/asyra-design/src/config/key-combinations.ts', 'utf8')

const vectorApisSource = () =>
  readFileSync(
    '../../apps/asyra-design/src/common-apis/element/vector-apis.ts',
    'utf8'
  )

const vectorConsistencySource = () =>
  readFileSync(
    '../../apps/asyra-design/src/common-apis/element/vector-consistency.ts',
    'utf8'
  )

const updateElementPropertiesSource = () =>
  readFileSync(
    '../../apps/asyra-design/src/common-apis/element/update-element-properties.ts',
    'utf8'
  )

describe('vector path editing handle visibility', () => {
  it('keeps selection and vector hover outlines fully visible', () => {
    expect(SELECTION_OVERLAY_STROKE_WIDTH).toBe(2)
    expect(SELECTION_OVERLAY_VECTOR_HOVER_STROKE_WIDTH).toBe(2)
    expect(VECTOR_EDITING_HOVER_SEGMENT_STROKE).toEqual({
      width: 2,
      color: 0x157ae7
    })
    expect(VECTOR_EDITING_SELECTED_SEGMENT_STROKE).toEqual({
      width: 3,
      color: 0x157ae7
    })
    expect(VECTOR_EDITING_HOVER_SEGMENT_STROKE).not.toHaveProperty('alpha')
    expect(VECTOR_EDITING_SELECTED_SEGMENT_STROKE).not.toHaveProperty('alpha')
  })

  it('projects Render-resolved Vector workspace points through the viewport', () => {
    expect(
      projectWorkspacePointToOverlayScreen(
        { x: 288.3579534349085, y: 0 },
        { x: 120, y: 48 },
        12
      )
    ).toEqual({
      x: 3580.295441218902,
      y: 48
    })
  })

  it('creates a visible display handle for straight segment endpoints', () => {
    const handle = resolveOverlayHandlePosition(
      { x: 0, y: 0 },
      null,
      { x: 120, y: 0 },
      null
    )

    expect(handle).toEqual({ x: 40, y: 0 })
  })

  it('treats zero-distance handles as straight handles and mirrors the opposite handle length', () => {
    const handle = resolveOverlayHandlePosition(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: -120, y: 0 },
      { x: 30, y: 0 }
    )

    expect(handle).toEqual({ x: -30, y: 0 })
  })

  it('keeps actual visible handles instead of replacing them with display handles', () => {
    const handle = resolveOverlayHandlePosition(
      { x: 0, y: 0 },
      { x: 12, y: 6 },
      { x: 120, y: 0 },
      null
    )

    expect(handle).toEqual({ x: 12, y: 6 })
  })

  it('resolves closed first-anchor handles from segment references instead of control id naming', () => {
    const refs = getVectorNetworkAnchorHandleRefs(
      {
        pointIds: ['first', 'middle', 'last'],
        segmentIds: ['s0', 's1', 's2']
      },
      {
        s0: {
          id: 's0',
          startId: 'first',
          endId: 'middle',
          outControlId: 'custom-first-out',
          inControlId: 'custom-middle-in'
        },
        s1: {
          id: 's1',
          startId: 'middle',
          endId: 'last',
          outControlId: null,
          inControlId: null
        },
        s2: {
          id: 's2',
          startId: 'last',
          endId: 'first',
          outControlId: 'custom-last-out',
          inControlId: 'custom-first-in'
        }
      }
    )

    expect(refs.get('first')).toEqual({
      inControlId: 'custom-first-in',
      outControlId: 'custom-first-out'
    })
  })

  it('does not wrap open endpoint handle ownership across subpath ends', () => {
    const refs = getVectorNetworkAnchorHandleRefs(
      {
        pointIds: ['first', 'last'],
        segmentIds: ['s0']
      },
      {
        s0: {
          id: 's0',
          startId: 'first',
          endId: 'last',
          outControlId: 'custom-first-out',
          inControlId: 'custom-last-in'
        }
      }
    )

    expect(refs.get('first')).toEqual({
      inControlId: null,
      outControlId: 'custom-first-out'
    })
    expect(refs.get('last')).toEqual({
      inControlId: 'custom-last-in',
      outControlId: null
    })
  })

  it('shows n-1/n/n+1 for open subpath without wrapping', () => {
    const subpaths = [
      {
        closed: false,
        segmentIds: [],
        points: [
          { id: 'a', x: 0, y: 0, inHandle: null, outHandle: null },
          { id: 'b', x: 1, y: 0, inHandle: null, outHandle: null },
          { id: 'c', x: 2, y: 0, inHandle: null, outHandle: null }
        ]
      }
    ]

    const visible = getVisibleHandleAnchorIds(subpaths, [
      { pointId: 'a', index: 0 }
    ])
    expect(visible).toEqual(new Set(['a', 'b']))
  })

  it('uses selected point index to wrap neighbors for closed subpaths', () => {
    const subpaths = [
      {
        closed: true,
        segmentIds: [],
        points: [
          { id: 'a', x: 0, y: 0, inHandle: null, outHandle: null },
          { id: 'b', x: 1, y: 0, inHandle: null, outHandle: null },
          { id: 'c', x: 2, y: 0, inHandle: null, outHandle: null }
        ]
      }
    ]

    const visible = getVisibleHandleAnchorIds(subpaths, [
      { pointId: 'a', index: 0 }
    ])
    expect(visible).toEqual(new Set(['a', 'b', 'c']))
  })

  it('maps selected flat index into the owning subpath before wrapping neighbors', () => {
    const subpaths = [
      {
        closed: false,
        segmentIds: [],
        points: [
          { id: 'a', x: 0, y: 0, inHandle: null, outHandle: null },
          { id: 'b', x: 1, y: 0, inHandle: null, outHandle: null }
        ]
      },
      {
        closed: true,
        segmentIds: [],
        points: [
          { id: 'c', x: 2, y: 0, inHandle: null, outHandle: null },
          { id: 'd', x: 3, y: 0, inHandle: null, outHandle: null },
          { id: 'e', x: 4, y: 0, inHandle: null, outHandle: null }
        ]
      }
    ]

    const visible = getVisibleHandleAnchorIds(subpaths, [
      { pointId: 'c', index: 2 }
    ])
    expect(visible).toEqual(new Set(['c', 'd', 'e']))
  })

  it('unions selected points and their neighbors for multi-select', () => {
    const subpaths = [
      {
        closed: false,
        segmentIds: [],
        points: [
          { id: 'a', x: 0, y: 0, inHandle: null, outHandle: null },
          { id: 'b', x: 1, y: 0, inHandle: null, outHandle: null },
          { id: 'c', x: 2, y: 0, inHandle: null, outHandle: null },
          { id: 'd', x: 3, y: 0, inHandle: null, outHandle: null },
          { id: 'e', x: 4, y: 0, inHandle: null, outHandle: null }
        ]
      }
    ]

    const visible = getVisibleHandleAnchorIds(subpaths, [
      { pointId: 'b', index: 1 },
      { pointId: 'd', index: 3 }
    ])
    expect(visible).toEqual(new Set(['a', 'b', 'c', 'd', 'e']))
  })
})

describe('vector topology mutation intent', () => {
  it('routes vector mutation APIs through topology operation adapters', () => {
    const source = vectorApisSource()

    expect(source).toContain('appendVectorAnchorPoint:')
    expect(source).toContain('const nextTopology = vectorGeometry.addPoint(')
    expect(source).toContain('connectVectorAnchorEndpoints:')
    expect(source).toContain('connectVectorAnchorPoints:')
    expect(source).toContain('getVectorAnchorContinuation:')
    expect(source).toContain(
      'const connected = vectorGeometry.connectEndpoints('
    )
    expect(source).toContain('const connected = vectorGeometry.connectAnchors(')
    expect(source).toContain('splitVectorSegmentAtWorkspacePos:')
    expect(source).toContain('const splitResult = vectorGeometry.splitSegment(')
    expect(source).toContain('setVectorClosed:')
    expect(source).toContain('const nextTopology = setTopologyClosed(')
    expect(source).toContain('updateVectorAnchorPointPosition:')
    expect(source).toContain('vectorGeometry.movePoint(')
    expect(source).toContain('updateVectorAnchorPointHandlePosition:')
    expect(source).toContain('vectorGeometry.updateHandle(')
    expect(source).toContain('const commitVectorTopologyOperation = (')
    expect(source).toContain("type: 'appendAnchor'")
    expect(source).toContain("type: 'removeAnchor'")
    expect(source).toContain("type: 'splitSegment'")
    expect(source).toContain("type: 'connectEndpoints'")
    expect(source).toContain("type: 'connectAnchors'")
    expect(source).toContain("type: 'setClosed'")
    expect(source).toContain("type: 'setAnchorType'")
    expect(source).toContain("type: 'setHandleMode'")
    expect(source).toContain("type: 'setHandles'")
    expect(source).toContain("type: 'removeLastSinglePointSubpath'")
    expect(source).toContain('assertVectorTopologyOperationCanPatch(elementId)')
    expect(source).not.toContain(
      'commitVectorTopology(elementId, splitResult.topology)'
    )
    expect(source).not.toContain(
      'commitVectorTopology(elementId, nextTopology)'
    )
    expect(source).not.toContain(
      'commitVectorTopology(elementId, nextTopology, options)'
    )

    expect(source).not.toMatch(/\banchorPoints\s*:/)
    expect(source).not.toMatch(/createVectorComputedPatch\([^)]*anchorPoints/)
  })

  it('commits topology patches as points, segments, networks, closed state, and bounds together', () => {
    const source = vectorConsistencySource()

    expect(source).toContain('export const buildVectorComputedPatch = (')
    expect(source).toContain('assertVectorTopologyConsistency(')
    expect(source).toContain("'buildVectorComputedPatch'")
    expect(source).toContain(
      'const bounds = calculateVectorBounds(topologyInWorkspace)'
    )
    expect(source).toContain('normalizeVectorTopology(')
    expect(source).toContain('x: bounds.x')
    expect(source).toContain('y: bounds.y')
    expect(source).toContain('width: bounds.width')
    expect(source).toContain('height: bounds.height')
    expect(source).toContain('points: topologyInWorkspace.points')
    expect(source).toContain('segments: normalizedTopology.segments')
    expect(source).toContain('networks: normalizedTopology.networks')
    expect(source).toContain('closed: nextClosed')
    expect(source).toContain("pointCoordinateSpace: 'workspace'")
    expect(source).toContain('satisfies Record<string, DataTypes>')

    expect(source).not.toMatch(/\banchorPoints\s*:/)
  })
})

describe('vector path editing feature entry boundary', () => {
  it('keeps vector edits behind feature-system input sessions and common APIs', () => {
    const source = penToolFeatureSource()

    expect(source).toContain('defineFeature<Record<string, unknown>, PenState>')
    expect(source).toContain('FeatureNames.PEN')
    expect(source).toContain('FeatureNames.SELECT_VECTOR_POINT')
    expect(source).toContain('InputSystemEvents.INPUT_DRAG')
    expect(source).toContain('elementApis.updateVectorAnchorPointPosition')
    expect(source).toContain(
      'elementApis.updateVectorAnchorPointHandlePosition'
    )
    expect(source).toContain('elementApis.appendVectorAnchorPoint')
    expect(source).toContain('elementApis.connectVectorAnchorPoints')
    expect(source).toContain('elementApis.splitVectorSegmentAtWorkspacePos')
    expect(source).toContain('elementApis.createVectorElementFromSinglePoint')

    expect(source).not.toMatch(/controllers\.sceneTree/)
    expect(source).not.toMatch(/changeElementComputedData/)
    expect(source).not.toMatch(/renderSceneTreeStore/)
    expect(source).not.toMatch(/@asyra\/preset/)
  })

  it('clears drag state when the input drag session ends', () => {
    const source = keyCombinationsSource()
    const dragEndBlock = source.match(
      /\[InputSystemEvents\.INPUT_DRAG_END\]: \[[\s\S]*?\n {2}\],/
    )?.[0]

    expect(dragEndBlock).toContain('down: false')
    expect(dragEndBlock).toContain('dragging: false')
  })
})

describe('vector path editing transaction boundary', () => {
  it('keeps drag previews non-undoable and records final drag through the framework model flow', () => {
    const source = penToolFeatureSource()

    expect(source).toContain('pen-tool:drag-point-update')
    expect(source).toContain(
      'updateVectorPointTargetPosition(\n            dragTarget,\n            computedPatchIntent.patch.position,'
    )
    expect(source).toContain(
      'applyBezierDragForNewPoint(state, mouseWorkspacePos, {'
    )
    expect(source).toContain('updateVectorAnchorPointHandles(')
    expect(source).toContain('autoUpdateConnectedHandleTarget')
    expect(source).toContain('resolveAutoUpdateConnectedHandleTarget')
    expect(source).toContain('undoable: false')
    expect(source).toContain('skipResult: true')
    expect(source).toMatch(
      /elementApis\.discardTransientVectorPreviews\(\[dragTarget\.elementId\]\)\s*updateVectorPointTargetPosition\(\s*dragTarget,\s*computedPatchIntent\.patch\.position,\s*\{\s*undoable: computedPatchIntent\.patch\.undoable,\s*sharedDelivery: 'immediate',\s*skipResult: computedPatchIntent\.patch\.skipResult\s*\}\s*\)/
    )
    expect(source).not.toMatch(
      /updateVectorPointTargetPosition\(\s*dragTarget,\s*dragTarget\.initialTargetPos,/
    )
    expect(source).toContain('undoable: true')
    expect(source).not.toContain('getVectorComputedSnapshot(')
    expect(source).not.toContain('commitVectorComputedUndoSnapshot(')
    expect(source).not.toContain('syncVectorComputedRenderSnapshot(')
    expect(source).not.toContain('renderSceneTreeStore')
  })

  it('separates local drag previews from canonical vector commits', () => {
    const source = vectorApisSource()

    expect(source).toContain('core.patchLocalComputedData(')
    expect(source).not.toContain('core.changeComputedDataPatch(')
    expect(source).toContain('core.patchElementProperties(')
    expect(source).toContain('commitVectorPointMutation(')
    expect(source).not.toContain('commitVectorComputedUndoSnapshot')
    expect(source).not.toContain('syncVectorComputedRenderSnapshot')
    expect(source).not.toContain('renderSceneTreeStore')
    expect(source).toMatch(
      /const \{\s*skipResult: _skipResult,[\s\S]*?closed: _closed,[\s\S]*?\.\.\.eventOptions[\s\S]*?\} = options/
    )
  })

  it('stores vector handle mode through canonical computed topology records', () => {
    const vectorApis = vectorApisSource()
    const vectorConsistency = vectorConsistencySource()

    expect(vectorApis).toContain('getVectorAnchorHandleMode(')
    expect(vectorApis).toContain('vectorGeometry.setHandleMode(')
    expect(vectorConsistency).toContain('setAnchorHandleModeInTopology(')
    expect(vectorApis).not.toContain('setVectorHandleMode(')
    expect(vectorApis).not.toContain('handleModeByPointId')
    expect(vectorConsistency).not.toContain('handleModeByPointId')
  })

  it('wraps canonical element-property writes with runTransaction', () => {
    const source = updateElementPropertiesSource()

    expect(source).toMatch(
      /runTransaction\(\(\) => \{[\s\S]*?projectGroupGeometryPropertyUpdates\([\s\S]*?core\.updateElementProperties\(request, options\)[\s\S]*?\}\)/
    )
    expect(source).not.toContain('normalizeGroupsForElements(')
    expect(source).not.toContain('startTransaction')
    expect(source).not.toContain('endTransaction')
  })
})
