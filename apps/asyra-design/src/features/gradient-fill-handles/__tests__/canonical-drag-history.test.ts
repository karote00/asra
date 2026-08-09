import { beforeEach, describe, expect, it, vi } from 'vitest'

interface CapturedSessionDefinition {
  readonly session?: {
    readonly onUpdate?: (
      snapshot: unknown,
      state: Record<string, unknown>
    ) => unknown
    readonly onEnd?: (
      snapshot: unknown,
      state: Record<string, unknown>
    ) => unknown
  }
}

const mocks = vi.hoisted(() => ({
  definitions: new Map<string, CapturedSessionDefinition>(),
  getMousePosInWorkspace: vi.fn(
    (position: { x: number; y: number }) => position
  ),
  getNextGradientForHandleWithDelta: vi.fn(
    (
      gradient: {
        gradientHandles: { x: number; y: number }[]
      },
      handleIndex: number,
      _width: number,
      _height: number,
      delta: { x: number; y: number }
    ) => ({
      ...gradient,
      gradientHandles: gradient.gradientHandles.map((handle, index) =>
        index === handleIndex
          ? { x: handle.x + delta.x / 100, y: handle.y + delta.y / 100 }
          : handle
      )
    })
  ),
  getCanvasPositionFromClient: vi.fn(
    (position: { x: number; y: number }) => position
  ),
  updateFillField: vi.fn()
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  defineFeature: (
    name: string,
    _event: unknown,
    definition: CapturedSessionDefinition
  ) => {
    mocks.definitions.set(name, definition)
    return { api: {}, dispose: vi.fn() }
  }
}))

vi.mock('../../../common-apis', () => ({
  cursorApis: {
    setCanvasCursor: vi.fn()
  },
  elementApis: {
    getMousePosInWorkspace: mocks.getMousePosInWorkspace
  },
  fillApis: {
    getNextGradientForHandleWithDelta: mocks.getNextGradientForHandleWithDelta,
    getCanvasPositionFromClient: mocks.getCanvasPositionFromClient,
    updateFillField: mocks.updateFillField
  },
  selectionApis: {},
  systemContextApis: {}
}))

import { FeatureNames } from '../../../constants'
import '../feature'

const gradient = {
  gradientType: 'linear',
  gradientHandles: [
    { x: 0, y: 0 },
    { x: 1, y: 1 }
  ],
  gradientStops: [
    { position: 0, color: '#ffffff', opacity: 1 },
    { position: 1, color: '#000000', opacity: 1 }
  ],
  metadata: {}
}

describe('Gradient canonical drag History', () => {
  let scheduledFrame: FrameRequestCallback | null

  beforeEach(() => {
    vi.clearAllMocks()
    scheduledFrame = null
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        scheduledFrame = callback
        return 1
      })
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  it('publishes handle frames immediately, replaces local History, and adds no mouse-up replay', () => {
    const session = mocks.definitions.get(
      FeatureNames.DRAG_GRADIENT_HANDLE
    )?.session
    const state = {
      elementId: 'element-a',
      fillId: 'fill-a',
      handleIndex: 0,
      dragStartWorkspacePos: { x: 0, y: 0 },
      initialGradient: gradient,
      latestGradient: gradient,
      currentFill: { color: '#ffffff', gradient },
      width: 100,
      height: 100,
      pendingWorkspacePos: null,
      rafId: null,
      isDragging: false,
      previousSelectedHandle: null,
      previousHoveredHandle: null
    }

    session?.onUpdate?.(
      {
        mouseDragging: true,
        mousePosition: { x: 25, y: 30 }
      },
      state
    )
    scheduledFrame?.(0)

    expect(mocks.updateFillField).toHaveBeenLastCalledWith(
      'element-a',
      'fill-a',
      expect.any(Object),
      'gradient',
      expect.any(Object),
      {
        sharedDelivery: 'immediate',
        history: {
          mode: 'replace-latest',
          key: 'gradient-fill-handle:geometry'
        }
      }
    )

    mocks.updateFillField.mockClear()
    session?.onEnd?.({}, state)
    expect(mocks.updateFillField).not.toHaveBeenCalled()
  })

  it('publishes stop frames with the same canonical immediate History contract and no mouse-up replay', () => {
    const session = mocks.definitions.get(
      FeatureNames.DRAG_GRADIENT_STOP
    )?.session
    const state = {
      elementId: 'element-a',
      fillId: 'fill-a',
      stopIndex: 0,
      initialGradient: gradient,
      latestGradient: gradient,
      currentFill: { color: '#ffffff', gradient },
      geometry: {
        fill: { color: '#ffffff', gradient },
        canvasHandles: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ]
      },
      canvasBounds: null,
      pendingClientPos: null,
      rafId: null,
      isDragging: false,
      previousSelectedStop: null,
      previousHoveredStop: null
    }

    session?.onUpdate?.(
      {
        mouseDragging: true,
        mouseDragStart: { x: 0, y: 0 },
        mousePosition: { x: 40, y: 0 }
      },
      state
    )
    scheduledFrame?.(0)

    expect(mocks.updateFillField).toHaveBeenLastCalledWith(
      'element-a',
      'fill-a',
      expect.any(Object),
      'gradient',
      expect.any(Object),
      {
        sharedDelivery: 'immediate',
        history: {
          mode: 'replace-latest',
          key: 'gradient-fill-stop:position'
        }
      }
    )

    mocks.updateFillField.mockClear()
    session?.onEnd?.({}, state)
    expect(mocks.updateFillField).not.toHaveBeenCalled()
  })
})
