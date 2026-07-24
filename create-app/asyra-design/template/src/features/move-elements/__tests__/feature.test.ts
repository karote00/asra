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
  getElementBounds: vi.fn(),
  getElementIdAtClientPos: vi.fn(),
  getElementPosition: vi.fn(),
  getMousePosInWorkspace: vi.fn(),
  getPathEditingMode: vi.fn(),
  getSelectedIds: vi.fn(),
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
    getElementBounds: mocks.getElementBounds,
    getElementIdAtClientPos: mocks.getElementIdAtClientPos,
    getElementPosition: mocks.getElementPosition,
    getMousePosInWorkspace: mocks.getMousePosInWorkspace,
    hasMovedBeyondThreshold: vi.fn(),
    isElementLocked: mocks.isElementLocked,
    isElementVisible: mocks.isElementVisible,
    setElementPositions: vi.fn()
  },
  selectionApis: {
    getSelectedIds: mocks.getSelectedIds,
    selectElements: mocks.selectElements
  },
  systemContextApis: {
    getPathEditingMode: mocks.getPathEditingMode
  },
  transactionApis: {
    runTransaction: mocks.runTransaction
  }
}))

vi.mock('../../../controllers/canvas-hierarchy-target', () => ({
  resolveCanvasHierarchyTargetAtClientPos: mocks.resolveAtClientPos
}))

import { PrimaryToolType } from '../../../constants'
import { moveElementsSession } from '../feature'

const startSnapshot = {
  primaryTool: PrimaryToolType.SELECT,
  mousePosition: { x: 10, y: 20 },
  keyShift: false
}

describe('move canvas hierarchy target handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPathEditingMode.mockReturnValue(false)
    mocks.getMousePosInWorkspace.mockReturnValue({ x: 10, y: 20 })
    mocks.getSelectedIds.mockReturnValue(['selected'])
    mocks.getElementBounds.mockReturnValue({
      x: 100,
      y: 100,
      width: 20,
      height: 20
    })
    mocks.getElementPosition.mockReturnValue({ x: 30, y: 40 })
    mocks.isElementLocked.mockReturnValue(false)
    mocks.isElementVisible.mockReturnValue(true)
  })

  it('starts from the shared resolved target without using the legacy raw fallback', () => {
    mocks.resolveAtClientPos.mockReturnValue('group-1')

    expect(moveElementsSession.onStart?.(startSnapshot as never)).toMatchObject(
      {
        initialPositions: {
          'group-1': { x: 30, y: 40 }
        },
        startedFromSelectionBounds: false
      }
    )
    expect(mocks.resolveAtClientPos).toHaveBeenCalledWith(startSnapshot)
    expect(mocks.selectElements).toHaveBeenCalledWith(['group-1'])
    expect(mocks.getElementIdAtClientPos).not.toHaveBeenCalled()
  })

  it('does not select or move a rejected cross-parent raw hit', () => {
    mocks.resolveAtClientPos.mockReturnValue(null)

    expect(moveElementsSession.onStart?.(startSnapshot as never)).toBeNull()
    expect(mocks.selectElements).not.toHaveBeenCalled()
    expect(mocks.getElementIdAtClientPos).not.toHaveBeenCalled()
  })

  it('uses the same resolver when a selection-bounds click settles', () => {
    mocks.resolveAtClientPos.mockReturnValue('rect-2b')

    moveElementsSession.onEnd?.(startSnapshot as never, {
      dragStartWorkspacePos: { x: 10, y: 20 },
      initialPositions: { selected: { x: 30, y: 40 } },
      latestPositions: null,
      isMoving: false,
      startedFromSelectionBounds: true
    })

    expect(mocks.resolveAtClientPos).toHaveBeenCalledWith(startSnapshot)
    expect(mocks.selectElements).toHaveBeenCalledWith(['rect-2b'])
    expect(mocks.getElementIdAtClientPos).not.toHaveBeenCalled()
  })
})
