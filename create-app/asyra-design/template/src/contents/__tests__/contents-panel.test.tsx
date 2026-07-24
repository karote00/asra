import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const elementDataMap = {
    a: {
      id: 'a',
      name: 'A',
      type: 'element',
      parentId: 'workspace',
      lock: false,
      visible: true
    },
    group: {
      id: 'group',
      name: 'Group',
      type: 'group',
      parentId: 'workspace',
      children: ['child'],
      lock: false,
      visible: true
    },
    child: {
      id: 'child',
      name: 'Child',
      type: 'element',
      parentId: 'group',
      lock: false,
      visible: true
    },
    locked: {
      id: 'locked',
      name: 'Locked Group',
      type: 'group',
      parentId: 'workspace',
      children: [],
      lock: true,
      visible: true
    },
    b: {
      id: 'b',
      name: 'B',
      type: 'element',
      parentId: 'workspace',
      lock: false,
      visible: true
    }
  }

  return {
    elementDataMap,
    selection: new Set<string>(),
    elementAtPoint: null as Element | null,
    start: vi.fn(),
    update: vi.fn(),
    end: vi.fn(),
    cancel: vi.fn(),
    selectElements: vi.fn(),
    clearSelection: vi.fn()
  }
})

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 34,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        key: index,
        index,
        start: index * 34
      })),
    measureElement: vi.fn()
  })
}))

vi.mock('../../providers', () => ({
  useFlattenedIdsData: () => ['a', 'group', 'child', 'locked', 'b'],
  useElementDataMap: () => mocks.elementDataMap,
  useElementSelection: () => mocks.selection,
  useHoveredElementId: () => null,
  useElementData: (elementId: keyof typeof mocks.elementDataMap) =>
    mocks.elementDataMap[elementId],
  useVectorIconPathMap: () => null
}))

vi.mock('../../controllers/element-selection', () => ({
  selectElements: mocks.selectElements,
  clearSelection: mocks.clearSelection
}))

vi.mock('../../controllers/hovered-element', () => ({
  setHoveredElementId: vi.fn()
}))

vi.mock('../../controllers/element-row-actions', () => ({
  toggleElementLock: vi.fn(),
  toggleElementVisible: vi.fn()
}))

vi.mock('../../controllers/group-command-actions', () => ({
  runGroupCommand: vi.fn()
}))

vi.mock('../../controllers/layer-move-session', () => ({
  startLayerHierarchyMoveSession: mocks.start,
  updateLayerHierarchyMoveSession: mocks.update,
  endLayerHierarchyMoveSession: mocks.end,
  cancelLayerHierarchyMoveSession: mocks.cancel
}))

vi.mock('@asyra/design-system', () => ({
  Icon: ({ name }: { name: string }) => <span>{name}</span>
}))

import Contents from '../contents-panel'

describe('Layers pointer hierarchy presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    class TestPointerEvent extends MouseEvent {
      pointerId: number

      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 0
      }
    }
    window.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent
    mocks.elementAtPoint = null
    mocks.start.mockResolvedValue(true)
    mocks.update.mockResolvedValue(undefined)
    mocks.end.mockResolvedValue(undefined)
    mocks.cancel.mockResolvedValue(undefined)
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => mocks.elementAtPoint
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps rows edge-aligned with a 4px content gap and depth-only indentation', () => {
    render(<Contents />)
    const rootRow = screen.getByTestId('element-item-a')
    const nestedRow = screen.getByTestId('element-item-child')
    const rootContent = rootRow.firstElementChild

    expect(rootRow.style.paddingLeft).toBe('0px')
    expect(nestedRow.style.paddingLeft).toBe('16px')
    expect(
      [...rootRow.classList].some((className) => className.startsWith('pr-'))
    ).toBe(false)
    expect(rootContent?.classList.contains('gap-1')).toBe(true)
    expect(rootContent?.classList.contains('gap-2')).toBe(false)
  })

  it('shows one inside indicator, commits once, clears preview, and reveals a collapsed Group', async () => {
    render(<Contents />)
    fireEvent.click(screen.getByTestId('layers-group-toggle-group'))
    const sourceRow = screen.getByTestId('element-item-a')
    const targetRow = screen.getByTestId('element-item-group')
    const contentsPanel = screen.getByTestId('contents-panel')
    const setPointerCapture = vi.fn()
    contentsPanel.setPointerCapture = setPointerCapture
    targetRow.getBoundingClientRect = () =>
      ({ top: 0, bottom: 30, height: 30 }) as DOMRect
    mocks.elementAtPoint = targetRow

    fireEvent.pointerDown(sourceRow, {
      pointerId: 1,
      button: 0,
      clientX: 0,
      clientY: 0
    })
    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(1))
    expect(setPointerCapture).not.toHaveBeenCalled()

    fireEvent.pointerMove(contentsPanel, {
      pointerId: 1,
      clientX: 0,
      clientY: 15
    })
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
    expect(setPointerCapture).toHaveBeenCalledWith(1)
    expect(targetRow.dataset.layerDropState).toBe('inside')

    fireEvent.pointerUp(contentsPanel, {
      pointerId: 1,
      clientX: 0,
      clientY: 15
    })

    await waitFor(() => expect(mocks.end).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(targetRow.dataset.layerDropState).toBeUndefined()
    )
    await waitFor(() =>
      expect(
        screen
          .getByTestId('layers-group-toggle-group')
          .getAttribute('aria-expanded')
      ).toBe('true')
    )

    await new Promise((resolve) => window.setTimeout(resolve, 0))
    fireEvent.click(screen.getByTestId('element-item-b'))
    expect(mocks.selectElements).toHaveBeenCalledWith(['b'])
  })

  it('projects invalid feedback and lost-capture cleanup without a move end', async () => {
    render(<Contents />)
    const sourceRow = screen.getByTestId('element-item-a')
    const lockedTarget = screen.getByTestId('element-item-locked')
    lockedTarget.getBoundingClientRect = () =>
      ({ top: 0, bottom: 30, height: 30 }) as DOMRect
    mocks.elementAtPoint = lockedTarget

    fireEvent.pointerDown(sourceRow, {
      pointerId: 2,
      button: 0,
      clientX: 0,
      clientY: 0
    })
    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(1))
    fireEvent.pointerMove(screen.getByTestId('contents-panel'), {
      pointerId: 2,
      clientX: 0,
      clientY: 15
    })
    await waitFor(() =>
      expect(lockedTarget.dataset.layerDropState).toBe('invalid')
    )

    fireEvent.lostPointerCapture(screen.getByTestId('contents-panel'), {
      pointerId: 2
    })
    await waitFor(() =>
      expect(mocks.cancel).toHaveBeenCalledWith('lost-capture')
    )
    expect(mocks.end).not.toHaveBeenCalled()
    expect(lockedTarget.dataset.layerDropState).toBeUndefined()

    fireEvent.pointerDown(lockedTarget, {
      pointerId: 3,
      button: 0,
      clientX: 0,
      clientY: 0
    })
    expect(mocks.start).toHaveBeenCalledTimes(1)
    expect(lockedTarget.dataset.layerDragEligible).toBe('false')
  })
})
