import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  elementApis,
  selectionApis,
  systemContextApis,
  transactionApis
} from '../common-apis'
import { PrimaryToolType } from '../constants'
import { createElementSession } from './create-element'
import { moveElementsSession } from './move-elements'

const createStartSnapshot = {
  primaryTool: PrimaryToolType.RECTANGLE,
  mousePosition: { x: 0, y: 0 },
  mouseDragStart: { x: 0, y: 0 },
  mouseDragging: true
}

describe('Asyra Design canonical collaboration delivery timeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(elementApis, 'changeComputedData').mockImplementation(
      () => undefined
    )
    vi.spyOn(elementApis, 'createElement').mockReturnValue('element-created')
    vi.spyOn(elementApis, 'getElementBounds').mockReturnValue({
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })
    vi.spyOn(elementApis, 'getMousePosInWorkspace').mockImplementation(
      (position) => position
    )
    vi.spyOn(elementApis, 'hasMovedBeyondThreshold').mockReturnValue(true)
    vi.spyOn(elementApis, 'resetElementSize').mockImplementation(
      () => undefined
    )
    vi.spyOn(elementApis, 'setElementPositions').mockImplementation(
      () => undefined
    )
    vi.spyOn(selectionApis, 'selectElements').mockImplementation(
      () => undefined
    )
    vi.spyOn(systemContextApis, 'switchPrimaryTool').mockImplementation(
      () => undefined
    )
    vi.spyOn(transactionApis, 'runTransaction').mockImplementation((run) =>
      run()
    )
  })

  it('delivers mouse-down create and every applied drag geometry through the canonical immediate path', () => {
    const state = createElementSession.onStart?.(createStartSnapshot as never)

    expect(elementApis.createElement).toHaveBeenCalledWith(
      {
        type: PrimaryToolType.RECTANGLE,
        clientPosition: { x: 0, y: 0 }
      },
      { sharedDelivery: 'immediate' }
    )
    expect(selectionApis.selectElements).toHaveBeenCalledWith(
      ['element-created'],
      { sharedDelivery: 'immediate' }
    )

    createElementSession.onUpdate?.(
      {
        ...createStartSnapshot,
        mousePosition: { x: 30, y: 40 }
      } as never,
      state as never
    )

    expect(elementApis.changeComputedData).toHaveBeenLastCalledWith(
      ['element-created'],
      { x: 0, y: 0, width: 30, height: 40 },
      { sharedDelivery: 'immediate' }
    )
  })

  it('requests an immediate 100×100 mouse-up reset when movement stays below threshold', () => {
    vi.mocked(elementApis.hasMovedBeyondThreshold).mockReturnValue(false)
    const state = createElementSession.onStart?.(createStartSnapshot as never)

    createElementSession.onUpdate?.(
      {
        ...createStartSnapshot,
        mousePosition: { x: 2, y: 2 }
      } as never,
      state as never
    )

    createElementSession.onEnd?.(
      {
        ...createStartSnapshot,
        mousePosition: { x: 2, y: 2 }
      } as never,
      state as never
    )

    expect(elementApis.resetElementSize).toHaveBeenCalledWith(
      'element-created',
      {
        sharedDelivery: 'immediate'
      }
    )
  })

  it('does not replay the same create geometry on mouse up but sends a newer final pointer position', () => {
    const state = createElementSession.onStart?.(createStartSnapshot as never)
    createElementSession.onUpdate?.(
      {
        ...createStartSnapshot,
        mousePosition: { x: 30, y: 40 }
      } as never,
      state as never
    )

    vi.mocked(elementApis.changeComputedData).mockClear()
    createElementSession.onEnd?.(
      {
        ...createStartSnapshot,
        mousePosition: { x: 30, y: 40 }
      } as never,
      state as never
    )
    expect(elementApis.changeComputedData).not.toHaveBeenCalled()

    createElementSession.onEnd?.(
      {
        ...createStartSnapshot,
        mousePosition: { x: 35, y: 45 }
      } as never,
      state as never
    )
    expect(elementApis.changeComputedData).toHaveBeenCalledWith(
      ['element-created'],
      { x: 0, y: 0, width: 35, height: 45 },
      { sharedDelivery: 'immediate' }
    )
  })

  it('delivers multi-element drag positions immediately without a restore-final mouse-up replay', () => {
    const state = {
      dragStartWorkspacePos: { x: 0, y: 0 },
      initialPositions: {
        'element-a': { x: 10, y: 20 },
        'element-b': { x: 30, y: 40 }
      },
      latestPositions: null,
      isMoving: false,
      startedFromSelectionBounds: true
    }
    const snapshot = {
      primaryTool: PrimaryToolType.SELECT,
      mousePosition: { x: 5, y: 7 },
      mouseDragStart: { x: 0, y: 0 },
      mouseDragging: true
    }
    const target = {
      'element-a': { x: 15, y: 27 },
      'element-b': { x: 35, y: 47 }
    }

    moveElementsSession.onUpdate?.(snapshot as never, state as never)

    expect(elementApis.setElementPositions).toHaveBeenLastCalledWith(target, {
      sharedDelivery: 'immediate'
    })

    vi.mocked(elementApis.setElementPositions).mockClear()
    moveElementsSession.onEnd?.(snapshot as never, state as never)
    expect(elementApis.setElementPositions).not.toHaveBeenCalled()
  })

  it('delivers a newer final multi-element pointer position on mouse up', () => {
    const state = {
      dragStartWorkspacePos: { x: 0, y: 0 },
      initialPositions: {
        'element-a': { x: 10, y: 20 },
        'element-b': { x: 30, y: 40 }
      },
      latestPositions: {
        'element-a': { x: 15, y: 27 },
        'element-b': { x: 35, y: 47 }
      },
      isMoving: true,
      startedFromSelectionBounds: true
    }

    moveElementsSession.onEnd?.(
      {
        primaryTool: PrimaryToolType.SELECT,
        mousePosition: { x: 6, y: 8 },
        mouseDragStart: { x: 0, y: 0 },
        mouseDragging: false
      } as never,
      state as never
    )

    expect(elementApis.setElementPositions).toHaveBeenCalledWith(
      {
        'element-a': { x: 16, y: 28 },
        'element-b': { x: 36, y: 48 }
      },
      { sharedDelivery: 'immediate' }
    )
  })
})
