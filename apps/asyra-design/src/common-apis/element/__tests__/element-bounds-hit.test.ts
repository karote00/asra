import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getElementById: vi.fn(),
  getRenderElementById: vi.fn(),
  getCanvasBounds: vi.fn(),
  toLocal: vi.fn()
}))

vi.mock('../../../contexts', () => ({
  default: {
    isContainerType: vi.fn((type: string) => type === 'group')
  },
  render: {
    app: {
      canvas: {
        getBoundingClientRect: mocks.getCanvasBounds
      }
    },
    getElementById: mocks.getRenderElementById
  },
  sceneTree: {
    getElementById: mocks.getElementById,
    workspace: 'workspace'
  }
}))

vi.mock('../vector-apis', () => ({
  vectorApis: {
    createVectorElement: vi.fn()
  }
}))

vi.mock('../change-computed-data', () => ({
  changeComputedData: vi.fn()
}))

import { elementApis } from '../apis'

describe('canonical element bounds client hit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCanvasBounds.mockReturnValue({ left: 100, top: 50 })
    mocks.getElementById.mockReturnValue({
      get: vi.fn((key: string) => (key === 'type' ? 'group' : undefined)),
      getAllComputedData: vi.fn(() => ({
        x: 50,
        y: 40,
        width: 100,
        height: 80
      }))
    })
    mocks.getRenderElementById.mockReturnValue({
      toLocal: mocks.toLocal
    })
  })

  it('tests canonical dimensions through the current identity-safe Render transform', () => {
    mocks.toLocal.mockReturnValue({ x: 10, y: 20 })

    expect(
      elementApis.isClientPositionInsideElementBounds('group-1', {
        x: 160,
        y: 110
      })
    ).toBe(true)
    expect(mocks.toLocal).toHaveBeenCalledWith({ x: 60, y: 60 })

    mocks.toLocal.mockReturnValue({ x: 101, y: 20 })
    expect(
      elementApis.isClientPositionInsideElementBounds('group-1', {
        x: 160,
        y: 110
      })
    ).toBe(false)
  })

  it('fails closed for invalid canonical bounds or a missing Render handle', () => {
    mocks.getElementById.mockReturnValue({
      get: vi.fn((key: string) => (key === 'type' ? 'group' : undefined)),
      getAllComputedData: vi.fn(() => ({
        x: 50,
        y: 40,
        width: 0,
        height: 80
      }))
    })

    expect(
      elementApis.isClientPositionInsideElementBounds('group-1', {
        x: 160,
        y: 110
      })
    ).toBe(false)

    mocks.getElementById.mockReturnValue({
      get: vi.fn((key: string) => (key === 'type' ? 'group' : undefined)),
      getAllComputedData: vi.fn(() => ({
        x: 50,
        y: 40,
        width: 100,
        height: 80
      }))
    })
    mocks.getRenderElementById.mockReturnValue(null)

    expect(
      elementApis.isClientPositionInsideElementBounds('group-1', {
        x: 160,
        y: 110
      })
    ).toBe(false)
  })
})
