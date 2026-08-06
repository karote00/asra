import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  changeElementGeometry: vi.fn(),
  configureSharedDeliverySequence: vi.fn(),
  createElement: vi.fn(),
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
  getMousePosInWorkspace: vi.fn(),
  getPositionInParent: vi.fn(),
  hasMovedBeyondThreshold: vi.fn(),
  resolveCreateParentAtClientPos: vi.fn(),
  selectElements: vi.fn()
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  defineFeature: mocks.defineFeature
}))

vi.mock('../../../common-apis', () => ({
  elementApis: {
    changeElementGeometry: mocks.changeElementGeometry,
    createElement: mocks.createElement,
    getMousePosInWorkspace: mocks.getMousePosInWorkspace,
    getPositionInParent: mocks.getPositionInParent,
    hasMovedBeyondThreshold: mocks.hasMovedBeyondThreshold,
    resetElementSize: vi.fn()
  },
  selectionApis: {
    selectElements: mocks.selectElements
  },
  systemContextApis: {
    switchPrimaryTool: vi.fn()
  },
  transactionApis: {
    configureSharedDeliverySequence: mocks.configureSharedDeliverySequence
  }
}))

vi.mock('../../../controllers/canvas-hierarchy-target', () => ({
  resolveCreateElementParentAtClientPos: mocks.resolveCreateParentAtClientPos
}))

import { PrimaryToolType } from '../../../constants'
import { createElementSession } from '../feature'

const startSnapshot = {
  primaryTool: PrimaryToolType.RECTANGLE,
  mousePosition: { x: 110, y: 220 },
  keyMeta: false,
  keyCtrl: false
}

describe('create-element canonical parent handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMousePosInWorkspace.mockReturnValue({ x: 110, y: 220 })
    mocks.resolveCreateParentAtClientPos.mockReturnValue('group-2')
    mocks.createElement.mockReturnValue('new-element')
    mocks.hasMovedBeyondThreshold.mockReturnValue(true)
  })

  it('passes the parent resolved from the mouse-down hierarchy target', () => {
    expect(
      createElementSession.onStart?.(startSnapshot as never)
    ).toMatchObject({
      elementId: 'new-element',
      parentId: 'group-2',
      dragStartWorkspacePos: { x: 110, y: 220 }
    })

    expect(mocks.resolveCreateParentAtClientPos).toHaveBeenCalledWith(
      startSnapshot
    )
    expect(mocks.createElement).toHaveBeenCalledWith(
      {
        type: PrimaryToolType.RECTANGLE,
        clientPosition: { x: 110, y: 220 },
        parentId: 'group-2'
      },
      { sharedDelivery: 'immediate' }
    )
    expect(mocks.configureSharedDeliverySequence).toHaveBeenCalledWith({
      mode: 'atomic',
      batchPublications: false,
      slices: []
    })
  })

  it('does not create when canonical hierarchy resolution rejects the target', () => {
    mocks.resolveCreateParentAtClientPos.mockReturnValue(null)

    expect(createElementSession.onStart?.(startSnapshot as never)).toBeNull()
    expect(mocks.createElement).not.toHaveBeenCalled()
    expect(mocks.selectElements).not.toHaveBeenCalled()
  })

  it('keeps drag geometry in the resolved Group parent coordinate space', () => {
    const state = createElementSession.onStart?.(startSnapshot as never)
    mocks.getMousePosInWorkspace.mockReturnValue({ x: 140, y: 260 })
    mocks.getPositionInParent
      .mockReturnValueOnce({ x: 10, y: 20 })
      .mockReturnValueOnce({ x: 40, y: 60 })

    createElementSession.onUpdate?.(
      {
        ...startSnapshot,
        mousePosition: { x: 140, y: 260 },
        mouseDragging: true
      } as never,
      state as never
    )

    expect(mocks.getPositionInParent).toHaveBeenLastCalledWith('group-2', {
      x: 140,
      y: 260
    })
    expect(mocks.changeElementGeometry).toHaveBeenCalledWith(
      'new-element',
      { x: 10, y: 20, width: 30, height: 40 },
      { sharedDelivery: 'immediate' }
    )
  })

  it('does not replay unchanged workspace geometry after Group rebasing', () => {
    const state = createElementSession.onStart?.(startSnapshot as never)
    mocks.getMousePosInWorkspace.mockReturnValue({ x: 140, y: 260 })
    mocks.getPositionInParent
      .mockReturnValueOnce({ x: 10, y: 20 })
      .mockReturnValueOnce({ x: 40, y: 60 })

    createElementSession.onUpdate?.(
      {
        ...startSnapshot,
        mousePosition: { x: 140, y: 260 },
        mouseDragging: true
      } as never,
      state as never
    )

    mocks.changeElementGeometry.mockClear()
    mocks.getPositionInParent
      .mockReturnValueOnce({ x: 0, y: 0 })
      .mockReturnValueOnce({ x: 30, y: 40 })

    createElementSession.onEnd?.(
      {
        ...startSnapshot,
        mousePosition: { x: 140, y: 260 }
      } as never,
      state as never
    )

    expect(mocks.changeElementGeometry).not.toHaveBeenCalled()
  })
})
