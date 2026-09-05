// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ViewportControls } from '../viewport'
import { DEFAULT_CAMERA } from '../../render-app/workcell-frame'
import type { SpatialFrame } from '../../render-app/spatial-layer'
import type { SimRuntime } from '../../init/bootstrap'

let host: HTMLDivElement, controls: HTMLDivElement, root: Root
const meshes: SpatialFrame['meshes'] = [
  {
    id: 'part',
    visible: true,
    elementId: 'body',
    descriptor: {
      kind: 'mesh',
      position: [10, 2, 3],
      rotation: [0, 0, 0, 1],
      shape: { kind: 'box', size: [2, 4, 1] },
      color: 0xffffff,
      opacity: 1,
      wireframe: false,
      selectable: true
    }
  }
]
const onCamera = vi.fn(),
  onSelect = vi.fn(),
  pick = vi.fn(() => 'body')
const getFitMeshes = vi.fn(() => meshes)
let alive = true
const isCurrent = () => alive
const runtime = { pick } as unknown as SimRuntime
const render = (camera = DEFAULT_CAMERA) =>
  act(() =>
    root.render(
      createElement(ViewportControls, {
        host,
        runtime,
        camera,
        onCamera,
        onSelect,
        isCurrent,
        getFitMeshes
      })
    )
  )
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  alive = true
  host = document.createElement('div')
  controls = document.createElement('div')
  document.body.append(host, controls)
  root = createRoot(controls)
  host.getBoundingClientRect = () => ({
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    toJSON: () => ({ width: 800, height: 600 })
  })
  const captured = new Set<number>()
  host.setPointerCapture = vi.fn((id) => {
    captured.add(id)
  })
  host.hasPointerCapture = (id) => captured.has(id)
  host.releasePointerCapture = vi.fn((id) => {
    captured.delete(id)
  })
  await render()
})
afterEach(async () => {
  await act(() => root.unmount())
  host.remove()
  controls.remove()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
function pointer(type: string, options: MouseEventInit = {}, id = 1) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: 100,
    clientY: 100,
    ...options
  })
  Object.defineProperty(event, 'pointerId', { value: id })
  host.dispatchEvent(event)
  return event
}
function shortcut(options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    code: 'Digit1',
    key: '1',
    metaKey: true,
    ...options
  })
  host.dispatchEvent(event)
  return event
}
it.each([0, 1])(
  'Shift+button %i pans without orbiting or selecting',
  (button) => {
    const down = pointer('pointerdown', { button, shiftKey: true })
    pointer('pointermove', { clientX: 170, clientY: 140 })
    pointer('pointerup', { button, clientX: 170, clientY: 140 })
    expect(onCamera).toHaveBeenCalledTimes(1)
    const camera = onCamera.mock.calls[0][0]
    expect(camera.target).not.toEqual(DEFAULT_CAMERA.target)
    camera.position.forEach((value: number, i: number) => {
      expect(value - camera.target[i]).toBeCloseTo(
        DEFAULT_CAMERA.position[i] - DEFAULT_CAMERA.target[i],
        12
      )
    })
    expect(down.defaultPrevented).toBe(button === 1)
    expect(onSelect).not.toHaveBeenCalled()
    expect(pick).not.toHaveBeenCalled()
  }
)
it('keeps plain left click selection and plain drag orbit', () => {
  expect(pointer('pointerdown').defaultPrevented).toBe(false)
  pointer('pointerup')
  expect(onSelect).toHaveBeenCalledExactlyOnceWith('body')
  pointer('pointerdown')
  pointer('pointermove', { clientX: 160, clientY: 125, shiftKey: true })
  pointer('pointerup')
  expect(onCamera.mock.calls[0][0].target).toEqual(DEFAULT_CAMERA.target)
  expect(onSelect).toHaveBeenCalledTimes(1)
})
it('never selects on a Shift click or non-primary click', () => {
  pointer('pointerdown', { shiftKey: true })
  pointer('pointerup')
  pointer('pointerdown', { button: 1 })
  pointer('pointerup', { button: 1 })
  expect(onSelect).not.toHaveBeenCalled()
})
it.each(['pointercancel', 'lostpointercapture', 'blur'])(
  'ends navigation on %s without stale camera or selection',
  (reason) => {
    pointer('pointerdown', { shiftKey: true })
    if (reason === 'blur') window.dispatchEvent(new Event('blur'))
    else pointer(reason)
    pointer('pointermove', { clientX: 180 })
    pointer('pointerup')
    expect(onCamera).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
    expect(host.hasPointerCapture(1)).toBe(false)
  }
)
it('ignores secondary pointers and retired runtime callbacks', () => {
  pointer('pointerdown', { shiftKey: true })
  pointer('pointerdown', { clientX: 400 }, 2)
  pointer('pointermove', { clientX: 420 }, 2)
  expect(onCamera).not.toHaveBeenCalled()
  alive = false
  pointer('pointermove', { clientX: 160 })
  pointer('pointerup')
  shortcut()
  expect(onCamera).not.toHaveBeenCalled()
  expect(onSelect).not.toHaveBeenCalled()
})
it.each([{ metaKey: true }, { metaKey: false, ctrlKey: true }])(
  'fits once with %j+1 and cancels an active drag',
  (options) => {
    pointer('pointerdown', { shiftKey: true })
    const event = shortcut(options)
    shortcut({ ...options, repeat: true })
    pointer('pointermove', { clientX: 200 })
    pointer('pointerup')
    expect(event.defaultPrevented).toBe(true)
    expect(getFitMeshes).toHaveBeenCalledTimes(1)
    expect(onCamera).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
    expect(onCamera.mock.calls[0][0].target).not.toEqual(DEFAULT_CAMERA.target)
  }
)
it('preserves editable controls and ignores ambiguous, consumed and composing fit keys', () => {
  for (const tag of ['input', 'textarea', 'select']) {
    const input = document.createElement(tag)
    host.append(input)
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'Digit1',
      metaKey: true
    })
    input.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  }
  for (const options of [
    { shiftKey: true },
    { altKey: true },
    { ctrlKey: true },
    { metaKey: false },
    { isComposing: true }
  ])
    shortcut(options)
  const consumed = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    code: 'Digit1',
    metaKey: true
  })
  consumed.preventDefault()
  host.dispatchEvent(consumed)
  expect(onCamera).not.toHaveBeenCalled()
})
it('removes shortcuts and pointer capture on unmount', async () => {
  pointer('pointerdown', { shiftKey: true })
  await act(() => root.render(null))
  shortcut()
  pointer('pointermove', { clientX: 200 })
  expect(onCamera).not.toHaveBeenCalled()
  expect(host.hasPointerCapture(1)).toBe(false)
})

it.each([-10, 10])(
  'wheel zoom remains incremental after fitting a large scene (%i)',
  async (deltaY) => {
    await render({
      ...DEFAULT_CAMERA,
      position: [0, 0, 1000],
      target: [0, 0, 0],
      far: 3000
    })
    host.dispatchEvent(new WheelEvent('wheel', { deltaY, cancelable: true }))
    const next = onCamera.mock.calls[0][0]
    expect(next.position[2]).toBeCloseTo(1000 * Math.exp(deltaY * 0.002), 10)
    expect(next.target).toEqual([0, 0, 0])
    expect(next.far - next.position[2]).toBeGreaterThanOrEqual(2000 - 1e-8)
  }
)
