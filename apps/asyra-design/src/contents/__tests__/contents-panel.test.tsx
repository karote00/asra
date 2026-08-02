import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const baseFlattenedIds = ['a', 'group', 'child', 'locked', 'b']
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
    baseElementIds: new Set(baseFlattenedIds),
    baseFlattenedIds,
    elementDataMap,
    flattenedIds: [...baseFlattenedIds],
    useRealVirtualizer: false,
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

vi.mock('@tanstack/react-virtual', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-virtual')>()
  const useVirtualizer = (
    options: Parameters<typeof actual.useVirtualizer>[0]
  ) => {
    const realVirtualizer = actual.useVirtualizer(options)
    if (mocks.useRealVirtualizer) {
      return realVirtualizer
    }
    return {
      getTotalSize: () => options.count * 34,
      getVirtualItems: () =>
        Array.from({ length: options.count }, (_, index) => ({
          key: index,
          index,
          start: index * 34
        })),
      measureElement: vi.fn()
    }
  }

  return {
    ...actual,
    useVirtualizer
  }
})

vi.mock('../../providers', () => ({
  useFlattenedIdsData: () => mocks.flattenedIds,
  useElementDataMap: () => mocks.elementDataMap,
  useElementSelection: () => mocks.selection,
  useHoveredElementId: () => null,
  useElementData: (elementId: string) =>
    (
      mocks.elementDataMap as Record<
        string,
        (typeof mocks.elementDataMap)[keyof typeof mocks.elementDataMap]
      >
    )[elementId],
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

vi.mock('@asyra/design-system', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@asyra/design-system')>()
  return {
    ...actual,
    Icon: ({ name }: { name: string }) => <span>{name}</span>
  }
})

vi.mock('../layer-hierarchy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../layer-hierarchy')>()
  return {
    ...actual,
    projectVisibleLayerRows: vi.fn(actual.projectVisibleLayerRows)
  }
})

import Contents from '../contents-panel'
import { projectVisibleLayerRows } from '../layer-hierarchy'

const resetLayerFixture = () => {
  mocks.flattenedIds = [...mocks.baseFlattenedIds]
  mocks.selection.clear()
  mocks.useRealVirtualizer = false
  for (const elementId of Object.keys(mocks.elementDataMap)) {
    if (!mocks.baseElementIds.has(elementId)) {
      Reflect.deleteProperty(mocks.elementDataMap, elementId)
    }
  }
}

describe('Layers pointer hierarchy presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetLayerFixture()
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
    resetLayerFixture()
  })

  it('keeps Group and Ungroup command buttons out of the Layers header', () => {
    render(<Contents />)

    expect(screen.queryByTestId('layers-group-button')).toBeNull()
    expect(screen.queryByTestId('layers-ungroup-button')).toBeNull()
  })

  it('uses Tailwind spacing for row indentation and content padding', () => {
    render(<Contents />)
    const rootRow = screen.getByTestId('element-item-a')
    const nestedRow = screen.getByTestId('element-item-child')
    const rootContent = rootRow.firstElementChild
    const rootLabel = screen.getByText('A')

    expect(rootRow.classList.contains('pl-[var(--content-row-indent)]')).toBe(
      true
    )
    expect(rootRow.style.getPropertyValue('--content-row-indent')).toBe('0px')
    expect(nestedRow.style.getPropertyValue('--content-row-indent')).toBe(
      '24px'
    )
    expect(rootRow.classList.contains('pr-1')).toBe(true)
    expect(rootLabel.classList.contains('px-1')).toBe(true)
    expect(
      [...(rootContent?.classList ?? [])].some((className) =>
        className.startsWith('gap-')
      )
    ).toBe(false)
  })

  it('virtualizes expanded canonical ids before deriving mounted row metadata', () => {
    render(<Contents />)

    expect(projectVisibleLayerRows).not.toHaveBeenCalled()
    expect(
      screen
        .getByTestId('element-item-child')
        .style.getPropertyValue('--content-row-indent')
    ).toBe('24px')
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

  it('keeps the final canonical row reachable across real virtualizer collapse and expansion', async () => {
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetHeight'
    )
    const originalOffsetWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetWidth'
    )
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        if (this.getAttribute('data-testid') === 'contents-panel') {
          return 400
        }
        if (this.getAttribute('data-layer-drop-workspace') === 'true') {
          return 160
        }
        if (this.hasAttribute('data-index')) {
          return 32
        }
        return 0
      }
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        return 240
      }
    })

    const largeIds = Array.from({ length: 128 }, (_, index) => `item-${index}`)
    const groupId = largeIds[0]
    const childIds = largeIds.slice(1, 9)
    Object.assign(
      mocks.elementDataMap,
      Object.fromEntries(
        largeIds.map((id, index) => {
          if (id === groupId) {
            return [
              id,
              {
                id,
                name: `Item ${index}`,
                type: 'group',
                parentId: 'workspace',
                children: childIds,
                lock: false,
                visible: true
              }
            ]
          }
          return [
            id,
            {
              id,
              name: `Item ${index}`,
              type: 'element',
              parentId: childIds.includes(id) ? groupId : 'workspace',
              lock: false,
              visible: true
            }
          ]
        })
      )
    )
    mocks.flattenedIds = largeIds
    mocks.selection.clear()
    mocks.useRealVirtualizer = true

    try {
      render(<Contents />)

      const panel = screen.getByTestId('contents-panel')
      const scrollElement = panel.querySelector<HTMLElement>(
        '[data-layer-drop-workspace="true"]'
      )
      expect(scrollElement).not.toBeNull()

      await waitFor(() => {
        const mountedRows = panel.querySelectorAll(
          '[data-layer-element="true"]'
        )
        expect(mountedRows.length).toBeGreaterThan(0)
        expect(mountedRows.length).toBeLessThan(40)
      })

      const getTotalSize = () =>
        Number.parseFloat(
          scrollElement?.firstElementChild
            ?.getAttribute('style')
            ?.match(/height:\s*([0-9.]+)px/)?.[1] ?? '0'
        )
      const scrollTo = (scrollTop: number) => {
        act(() => {
          if (!scrollElement) {
            return
          }
          scrollElement.scrollTop = scrollTop
          scrollElement.dispatchEvent(new Event('scroll', { bubbles: false }))
        })
      }
      const scrollToTail = async (expectedVirtualIndex: number) => {
        scrollTo(getTotalSize() - 160)
        const finalRow = await screen.findByTestId('element-item-item-127')
        expect(
          finalRow.closest('[data-index]')?.getAttribute('data-index')
        ).toBe(String(expectedVirtualIndex))
        expect(
          panel.querySelectorAll('[data-layer-element="true"]').length
        ).toBeLessThan(40)
        return finalRow
      }

      const expandedTotalSize = getTotalSize()
      expect(expandedTotalSize).toBeGreaterThan(160)
      await scrollToTail(127)

      scrollTo(0)
      const groupToggle = await screen.findByTestId(
        `layers-group-toggle-${groupId}`
      )
      fireEvent.click(groupToggle)
      await waitFor(() =>
        expect(groupToggle.getAttribute('aria-expanded')).toBe('false')
      )
      expect(screen.queryByTestId('element-item-item-1')).toBeNull()
      await waitFor(() =>
        expect(getTotalSize()).toBeLessThan(expandedTotalSize)
      )
      const collapsedTotalSize = getTotalSize()
      await scrollToTail(119)

      scrollTo(0)
      const collapsedGroupToggle = await screen.findByTestId(
        `layers-group-toggle-${groupId}`
      )
      fireEvent.click(collapsedGroupToggle)
      await waitFor(() =>
        expect(collapsedGroupToggle.getAttribute('aria-expanded')).toBe('true')
      )
      await waitFor(() =>
        expect(getTotalSize()).toBeGreaterThan(collapsedTotalSize)
      )
      const finalRow = await scrollToTail(127)
      expect(
        panel.querySelectorAll('[data-layer-element="true"]').length
      ).toBeLessThan(40)

      fireEvent.click(finalRow)
      expect(mocks.selectElements).toHaveBeenCalledWith(['item-127'])
    } finally {
      if (originalOffsetHeight) {
        Object.defineProperty(
          HTMLElement.prototype,
          'offsetHeight',
          originalOffsetHeight
        )
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight')
      }
      if (originalOffsetWidth) {
        Object.defineProperty(
          HTMLElement.prototype,
          'offsetWidth',
          originalOffsetWidth
        )
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth')
      }
    }
  })
})
