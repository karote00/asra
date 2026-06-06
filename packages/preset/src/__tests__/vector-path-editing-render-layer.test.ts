import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { getVisibleHandleAnchorIds } from '../render-layers/vector-path-editing-render-layer'

const penToolFeatureSource = () =>
  readFileSync('../../apps/asyra-design/src/features/pen-tool/index.ts', 'utf8')

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

const changeComputedDataSource = () =>
  readFileSync(
    '../../apps/asyra-design/src/common-apis/element/change-computed-data.ts',
    'utf8'
  )

describe('vector path editing handle visibility', () => {
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

    const visible = getVisibleHandleAnchorIds(subpaths, 'a')
    expect(visible).toEqual(new Set(['a', 'b']))
  })

  it('wraps neighbors for closed subpath so endpoint selection shows both sides', () => {
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

    const visible = getVisibleHandleAnchorIds(subpaths, 'a')
    expect(visible).toEqual(new Set(['a', 'b', 'c']))
  })
})

describe('vector topology mutation intent', () => {
  it('routes vector mutation APIs through topology-native operation adapters', () => {
    const source = vectorApisSource()

    expect(source).toContain('appendVectorAnchorPoint:')
    expect(source).toContain('const nextTopology = vectorGeometry.addPoint(')
    expect(source).toContain('connectVectorAnchorEndpoints:')
    expect(source).toContain(
      'const connected = vectorGeometry.connectEndpoints('
    )
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
    expect(source).toContain("type: 'setClosed'")
    expect(source).toContain("type: 'setAnchorType'")
    expect(source).toContain("type: 'setHandleMode'")
    expect(source).toContain("type: 'setHandles'")
    expect(source).toContain("type: 'removeLastSinglePointSubpath'")
    expect(source).toContain(
      'commitVectorTopology(elementId, nextTopology, options)'
    )
    expect(source).not.toContain(
      'commitVectorTopology(elementId, splitResult.topology)'
    )
    expect(source).not.toContain(
      'commitVectorTopology(elementId, nextTopology)'
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
    expect(source).toContain(
      'const normalizedTopology = normalizeVectorTopology('
    )
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
    expect(source).toContain('elementApis.connectVectorAnchorEndpoints')
    expect(source).toContain('elementApis.splitVectorSegmentAtWorkspacePos')
    expect(source).toContain('elementApis.createVectorElementFromSinglePoint')

    expect(source).not.toMatch(/controllers\.sceneTree/)
    expect(source).not.toMatch(/changeElementComputedData/)
    expect(source).not.toMatch(/renderSceneTreeStore/)
    expect(source).not.toMatch(/@asyra\/preset/)
    expect(source).not.toMatch(/stroke-render/)
    expect(source).not.toMatch(/buildResolvedVectorGeometryModel/)
    expect(source).not.toMatch(/buildConstrained(?:Solid|Dashed)/)
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
      'updateVectorPointTargetPosition(dragTarget, targetPos, {'
    )
    expect(source).toContain('undoable: false')
    expect(source).toContain('skipResult: true')
    expect(source).toMatch(
      /updateVectorPointTargetPosition\(\s*dragTarget,\s*dragTarget\.initialTargetPos,/
    )
    expect(source).toContain('undoable: true')
    expect(source).not.toContain('getVectorComputedSnapshot(')
    expect(source).not.toContain('commitVectorComputedUndoSnapshot(')
    expect(source).not.toContain('syncVectorComputedRenderSnapshot(')
    expect(source).not.toContain('renderSceneTreeStore')
  })

  it('uses framework computed patch events for point drag mutations', () => {
    const source = vectorApisSource()

    expect(source).toContain('core.changeComputedDataPatch(')
    expect(source).toContain('commitVectorPointMutation(')
    expect(source).not.toContain('commitVectorComputedUndoSnapshot')
    expect(source).not.toContain('syncVectorComputedRenderSnapshot')
    expect(source).not.toContain('renderSceneTreeStore')
    expect(source).toMatch(
      /const \{\s*skipResult: _skipResult,[\s\S]*?closed: _closed,[\s\S]*?\.\.\.eventOptions[\s\S]*?\} = options/
    )
  })

  it('wraps computed-data writes in one explicit transaction boundary', () => {
    const source = changeComputedDataSource()

    expect(source).toMatch(
      /startTransaction\(\)\s+core\.changeComputedData\(elementIds, data, options\)\s+endTransaction\(\)/
    )
  })
})
