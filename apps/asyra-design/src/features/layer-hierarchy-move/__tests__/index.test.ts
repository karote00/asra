import type { MoveHierarchyResult } from '@asyra/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  defineFeature: vi.fn(
    (
      _name: string,
      _event: string,
      definition: { api?: Record<string, unknown> }
    ) => ({
      api: definition.api ?? {},
      dispose: vi.fn()
    })
  ),
  getSelectedIds: vi.fn(),
  selectElements: vi.fn(),
  moveElements: vi.fn()
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  defineFeature: mocks.defineFeature
}))

vi.mock('../../../common-apis', () => ({
  selectionApis: {
    getSelectedIds: mocks.getSelectedIds,
    selectElements: mocks.selectElements
  },
  hierarchyApis: {
    moveElements: mocks.moveElements
  }
}))

import { FeatureNames, InputSystemEvents } from '../../../constants'
import type { LayerPointerSession } from '../../../controllers/layer-pointer-session'
import type { LayerMoveSourcePlan } from '../../../controllers/layer-move-source'
import type { ValidLayerDropIntent } from '../../../controllers/layer-drop-intent'
import {
  layerHierarchyMoveFeatureDefinition,
  layerHierarchyMoveSession
} from '..'

const source: LayerMoveSourcePlan = {
  elementIds: ['b', 'a'],
  sourceParentId: 'workspace',
  preSessionSelection: ['other'],
  requestedSourceSelection: ['b', 'a'],
  replacesSelection: true
}

const pointer = (
  phase: LayerPointerSession['phase'],
  dragActive: boolean
): LayerPointerSession => ({
  phase,
  pointerId: 1,
  sourceElementId: 'b',
  startClientX: 0,
  startClientY: 0,
  clientX: dragActive ? 4 : 1,
  clientY: 0,
  dragActive,
  target: null
})

const intent: ValidLayerDropIntent = {
  kind: 'valid',
  zone: 'before',
  targetElementId: 'c',
  expandGroupId: null,
  request: {
    elementIds: ['b', 'a'],
    targetParentId: 'workspace',
    targetIndex: 0
  }
}

describe('Layer hierarchy move feature session', () => {
  beforeEach(() => {
    mocks.getSelectedIds.mockReset()
    mocks.selectElements.mockReset()
    mocks.moveElements.mockReset()
    mocks.getSelectedIds.mockReturnValue(['other'])
  })

  it('registers the one intended transaction session policy', () => {
    expect(mocks.defineFeature).toHaveBeenCalledWith(
      FeatureNames.MOVE_LAYER_HIERARCHY,
      InputSystemEvents.INPUT_LAYER_HIERARCHY_MOVE,
      layerHierarchyMoveFeatureDefinition
    )
    expect(layerHierarchyMoveFeatureDefinition).toMatchObject({
      priority: 110,
      exclusive: true,
      cancelPolicy: 'commit-current',
      session: layerHierarchyMoveSession
    })
  })

  it('applies an unselected source selection only at session start', () => {
    const state = layerHierarchyMoveSession.onStart?.({
      detail: {
        layerHierarchyMove: {
          phase: 'start',
          pointerSession: pointer('start', false),
          source
        }
      }
    } as never)

    expect(state).toEqual({ source })
    expect(mocks.selectElements).toHaveBeenCalledWith(['b', 'a'])
    expect(mocks.moveElements).not.toHaveBeenCalled()
  })

  it('does not write hierarchy or selection during pointer update', () => {
    const state = { source }

    layerHierarchyMoveSession.onUpdate?.(
      {
        detail: {
          layerHierarchyMove: {
            phase: 'update',
            pointerSession: pointer('update', true),
            dropIntent: intent
          }
        }
      } as never,
      state
    )

    expect(mocks.moveElements).not.toHaveBeenCalled()
    expect(mocks.selectElements).not.toHaveBeenCalled()
  })

  it('invokes exactly one canonical move and selects canonical moved order', () => {
    const canonicalResult: MoveHierarchyResult = {
      elementIds: ['a', 'b'],
      moves: [
        {
          elementId: 'a',
          before: { parentId: 'workspace', index: 0 },
          after: { parentId: 'workspace', index: 0 }
        }
      ]
    }
    mocks.moveElements.mockReturnValue(canonicalResult)

    layerHierarchyMoveSession.onEnd?.(
      {
        detail: {
          layerHierarchyMove: {
            phase: 'end',
            pointerSession: pointer('end', true),
            dropIntent: intent
          }
        }
      } as never,
      { source }
    )

    expect(mocks.moveElements).toHaveBeenCalledTimes(1)
    expect(mocks.moveElements).toHaveBeenCalledWith(intent.request)
    expect(mocks.selectElements).toHaveBeenCalledWith(['a', 'b'])
  })

  it.each([
    {
      label: 'below threshold',
      detail: {
        phase: 'end' as const,
        pointerSession: pointer('end', false),
        dropIntent: intent
      }
    },
    {
      label: 'invalid target',
      detail: {
        phase: 'end' as const,
        pointerSession: pointer('end', true),
        dropIntent: {
          kind: 'invalid' as const,
          zone: 'inside' as const,
          targetElementId: 'frame',
          reason: 'unsupported-container' as const
        }
      }
    }
  ])('does not request a hierarchy move for $label', ({ detail }) => {
    layerHierarchyMoveSession.onEnd?.(
      { detail: { layerHierarchyMove: detail } } as never,
      { source }
    )

    expect(mocks.moveElements).not.toHaveBeenCalled()
    expect(mocks.selectElements).not.toHaveBeenCalled()
  })

  it('surfaces canonical failure before post-selection', () => {
    const failure = new Error('canonical rejection')
    mocks.moveElements.mockImplementation(() => {
      throw failure
    })

    expect(() =>
      layerHierarchyMoveSession.onEnd?.(
        {
          detail: {
            layerHierarchyMove: {
              phase: 'end',
              pointerSession: pointer('end', true),
              dropIntent: intent
            }
          }
        } as never,
        { source }
      )
    ).toThrow(failure)
    expect(mocks.selectElements).not.toHaveBeenCalled()
  })
})
