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
  getElementClientBounds: vi.fn(),
  getElementIdAtClientPos: vi.fn(),
  getElementPosition: vi.fn(),
  getMousePosInWorkspace: vi.fn(),
  getPathEditingMode: vi.fn(),
  getSelectedIds: vi.fn(),
  isElementLocked: vi.fn(),
  isElementVisible: vi.fn(),
  normalizeGroupGeometryForElements: vi.fn(),
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
    getElementClientBounds: mocks.getElementClientBounds,
    getElementIdAtClientPos: mocks.getElementIdAtClientPos,
    getElementPosition: mocks.getElementPosition,
    getMousePosInWorkspace: mocks.getMousePosInWorkspace,
    hasMovedBeyondThreshold: vi.fn(),
    isElementLocked: mocks.isElementLocked,
    isElementVisible: mocks.isElementVisible,
    normalizeGroupGeometryForElements: mocks.normalizeGroupGeometryForElements,
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
    mocks.getElementClientBounds.mockReturnValue({
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
    expect(mocks.selectElements).toHaveBeenCalledWith(['group-1'], {
      undoable: false
    })
    expect(mocks.getElementIdAtClientPos).not.toHaveBeenCalled()
  })

  it('drags the current nested selection before Group hover resolution', () => {
    const snapshot = {
      ...startSnapshot,
      mouseDragStart: { x: 110, y: 110 },
      mousePosition: { x: 160, y: 160 }
    }
    mocks.getMousePosInWorkspace.mockReturnValue({ x: 410, y: 510 })
    mocks.resolveAtClientPos.mockReturnValue('outer-group')

    expect(moveElementsSession.onStart?.(snapshot as never)).toMatchObject({
      initialPositions: {
        selected: { x: 30, y: 40 }
      },
      startedFromSelectionBounds: true
    })
    expect(mocks.getElementClientBounds).toHaveBeenCalledWith('selected')
    expect(mocks.getMousePosInWorkspace).toHaveBeenCalledWith({
      x: 110,
      y: 110
    })
    expect(mocks.resolveAtClientPos).not.toHaveBeenCalled()
    expect(mocks.selectElements).not.toHaveBeenCalled()
  })

  it('drags a multi-selection from the gap inside its projected selection box', () => {
    const snapshot = {
      ...startSnapshot,
      mouseDragStart: { x: 50, y: 5 },
      mousePosition: { x: 52, y: 5 }
    }
    mocks.getSelectedIds.mockReturnValue(['selected-a', 'selected-b'])
    mocks.getElementClientBounds.mockImplementation((elementId: string) =>
      elementId === 'selected-a'
        ? { x: 0, y: 0, width: 10, height: 10 }
        : { x: 100, y: 0, width: 10, height: 10 }
    )
    mocks.resolveAtClientPos.mockReturnValue('outer-group')

    expect(moveElementsSession.onStart?.(snapshot as never)).toMatchObject({
      initialPositions: {
        'selected-a': { x: 30, y: 40 },
        'selected-b': { x: 30, y: 40 }
      },
      startedFromSelectionBounds: true
    })
    expect(mocks.resolveAtClientPos).not.toHaveBeenCalled()
    expect(mocks.selectElements).not.toHaveBeenCalled()
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

  it('normalizes affected Groups once after the final pointer position', () => {
    mocks.getMousePosInWorkspace.mockReturnValue({ x: 20, y: 30 })

    moveElementsSession.onEnd?.(startSnapshot as never, {
      dragStartWorkspacePos: { x: 10, y: 20 },
      initialPositions: { selected: { x: 30, y: 40 } },
      latestPositions: { selected: { x: 40, y: 50 } },
      isMoving: true,
      startedFromSelectionBounds: true
    })

    expect(mocks.normalizeGroupGeometryForElements).toHaveBeenCalledWith(
      ['selected'],
      { undoable: false, sharedDelivery: 'immediate' }
    )
  })
})
