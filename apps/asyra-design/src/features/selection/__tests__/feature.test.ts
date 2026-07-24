import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clearAreaSelection: vi.fn(),
  defineFeature: vi.fn(
    (
      _name: string,
      _event: string,
      definition: {
        api?: Record<string, unknown>
        session?: {
          onStart?: (snapshot: unknown) => unknown
        }
      }
    ) => ({
      api: definition.api ?? {},
      dispose: vi.fn()
    })
  ),
  getElementIdAtClientPos: vi.fn(),
  getMousePosInWorkspace: vi.fn(),
  getPathEditingMode: vi.fn(),
  isElementLocked: vi.fn(),
  isElementVisible: vi.fn(),
  resolveAtClientPos: vi.fn(),
  runTransaction: vi.fn((operation: () => unknown) => operation()),
  selectElements: vi.fn()
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  defineFeature: mocks.defineFeature
}))

vi.mock('../../../common-apis', () => ({
  elementApis: {
    getElementIdAtClientPos: mocks.getElementIdAtClientPos,
    getElementIdsInBounds: vi.fn(() => []),
    getMousePosInWorkspace: mocks.getMousePosInWorkspace,
    hasMovedBeyondThreshold: vi.fn(),
    isElementLocked: mocks.isElementLocked,
    isElementVisible: mocks.isElementVisible
  },
  selectionApis: {
    clearSelection: vi.fn(),
    getSelectedIds: vi.fn(() => []),
    selectElements: mocks.selectElements,
    toggleSelection: vi.fn()
  },
  systemContextApis: {
    clearAreaSelection: mocks.clearAreaSelection,
    exitPathEditingMode: vi.fn(),
    getPathEditingMode: mocks.getPathEditingMode,
    getPathEditingVectorId: vi.fn(),
    setAreaSelection: vi.fn()
  },
  transactionApis: {
    runTransaction: mocks.runTransaction
  }
}))

vi.mock('../../../controllers/canvas-hierarchy-target', () => ({
  resolveCanvasHierarchyTargetAtClientPos: mocks.resolveAtClientPos
}))

import { FeatureNames, PrimaryToolType } from '../../../constants'
import '../feature'

const startSnapshot = {
  primaryTool: PrimaryToolType.SELECT,
  mousePosition: { x: 10, y: 20 },
  mouseDown: true,
  keyShift: false
}

const selectionSession = mocks.defineFeature.mock.calls.find(
  ([featureName]) => featureName === FeatureNames.SELECTION
)?.[2].session
if (!selectionSession) {
  throw new Error('Missing selection feature session')
}

describe('selection canvas hierarchy target handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPathEditingMode.mockReturnValue(false)
    mocks.getMousePosInWorkspace.mockReturnValue({ x: 10, y: 20 })
    mocks.isElementLocked.mockReturnValue(false)
    mocks.isElementVisible.mockReturnValue(true)
  })

  it('selects the shared resolved target without using the legacy raw fallback', () => {
    mocks.resolveAtClientPos.mockReturnValue('group-1')

    expect(selectionSession.onStart?.(startSnapshot as never)).toEqual({
      mode: 'click'
    })
    expect(mocks.resolveAtClientPos).toHaveBeenCalledWith(startSnapshot)
    expect(mocks.selectElements).toHaveBeenCalledWith(['group-1'])
    expect(mocks.getElementIdAtClientPos).not.toHaveBeenCalled()
  })

  it('does not select a rejected cross-parent raw hit', () => {
    mocks.resolveAtClientPos.mockReturnValue(null)

    expect(selectionSession.onStart?.(startSnapshot as never)).toMatchObject({
      mode: 'area'
    })
    expect(mocks.selectElements).not.toHaveBeenCalled()
    expect(mocks.getElementIdAtClientPos).not.toHaveBeenCalled()
  })
})
