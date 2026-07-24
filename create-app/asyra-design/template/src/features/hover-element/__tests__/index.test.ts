import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  defineFeature: vi.fn(
    (
      _name: string,
      _event: string,
      definition: {
        api?: Record<string, unknown>
        execution?: (snapshot: unknown) => unknown
      }
    ) => ({
      api: definition.api ?? {},
      dispose: vi.fn()
    })
  ),
  getPathEditingVectorId: vi.fn(),
  isElementLocked: vi.fn(),
  isElementVisible: vi.fn(),
  resolveAtClientPos: vi.fn(),
  resolveCurrent: vi.fn(),
  updateHoveredElementId: vi.fn()
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  defineFeature: mocks.defineFeature
}))

vi.mock('../../../common-apis', () => ({
  elementApis: {
    isElementLocked: mocks.isElementLocked,
    isElementVisible: mocks.isElementVisible
  },
  systemContextApis: {
    getPathEditingVectorId: mocks.getPathEditingVectorId,
    updateHoveredElementId: mocks.updateHoveredElementId
  }
}))

vi.mock('../../../controllers/canvas-hierarchy-target', () => ({
  resolveCanvasHierarchyTargetAtClientPos: mocks.resolveAtClientPos,
  resolveCurrentCanvasHierarchyTarget: mocks.resolveCurrent
}))

import { FeatureNames } from '../../../constants'
import '..'

const getFeatureDefinition = (featureName: string) => {
  const definition = mocks.defineFeature.mock.calls.find(
    ([registeredName]) => registeredName === featureName
  )?.[2]
  if (!definition) {
    throw new Error(`Missing feature definition for "${featureName}"`)
  }
  return definition
}

const hoverElementFeatureDefinition = getFeatureDefinition(
  FeatureNames.HOVER_ELEMENT
)
const hoverElementRenderHoverFeatureDefinition = getFeatureDefinition(
  `${FeatureNames.HOVER_ELEMENT}.render.hover`
)

describe('canvas hierarchy hover feature', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPathEditingVectorId.mockReturnValue(null)
    mocks.isElementLocked.mockReturnValue(false)
    mocks.isElementVisible.mockReturnValue(true)
  })

  it('resolves every pointer move from the current Render hit and modifier snapshot', () => {
    const snapshot = {
      mouseDragging: false,
      mousePosition: { x: 10, y: 20 },
      keyMeta: true,
      keyCtrl: false
    }
    mocks.resolveAtClientPos.mockReturnValue('nested-leaf')

    expect(
      hoverElementFeatureDefinition.execution?.(snapshot as never)
    ).toEqual({
      hoveredId: 'nested-leaf'
    })
    expect(mocks.resolveAtClientPos).toHaveBeenCalledWith(snapshot)
    expect(mocks.updateHoveredElementId).toHaveBeenCalledWith('nested-leaf')
  })

  it('resolves a Render hover payload before publishing canonical hover state', () => {
    const snapshot = {
      mouseDragging: false,
      keyMeta: false,
      keyCtrl: false,
      detail: {
        targetKind: 'element',
        elementId: 'nested-leaf'
      }
    }
    mocks.resolveCurrent.mockReturnValue('group-1')

    expect(
      hoverElementRenderHoverFeatureDefinition.execution?.(snapshot as never)
    ).toEqual({ hoveredId: 'group-1' })
    expect(mocks.resolveCurrent).toHaveBeenCalledWith('nested-leaf', snapshot)
    expect(mocks.updateHoveredElementId).toHaveBeenCalledWith('group-1')
  })

  it('clears hover when canonical hierarchy resolution rejects the raw hit', () => {
    mocks.resolveCurrent.mockReturnValue(null)

    expect(
      hoverElementRenderHoverFeatureDefinition.execution?.({
        mouseDragging: false,
        detail: {
          targetKind: 'element',
          elementId: 'nested-leaf'
        }
      } as never)
    ).toEqual({ hoveredId: null })
    expect(mocks.updateHoveredElementId).toHaveBeenCalledWith(null)
  })
})
