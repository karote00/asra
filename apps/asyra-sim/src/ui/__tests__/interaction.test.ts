// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NumberField } from '../fields'
import { useViewport, ViewportControls } from '../viewport'
import { DEFAULT_CAMERA } from '../../render-app/workcell-frame'
import type { SimRuntime } from '../../init/bootstrap'
import type { Workcell } from '../../domain/workcell'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'

beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true))
afterEach(() => vi.unstubAllGlobals())

it('canonical replay discards superseded input text even when Redo returns to its previous value', async () => {
  const host = document.createElement('div'),
    root = createRoot(host),
    onChange = vi.fn()
  document.body.append(host)
  const render = (value: number) =>
    act(() =>
      root.render(
        createElement(NumberField, {
          label: 'Dimension',
          value,
          onChange
        })
      )
    )
  try {
    await render(2)
    const input = host.querySelector('input')
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set
    if (!input || !setValue) throw new Error('Missing numeric input')
    await act(() => {
      input.focus()
      setValue.call(input, '9')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await render(3)
    expect(input.value).toBe('3')
    await render(2)
    expect(input.value).toBe('2')
    await act(() => input.blur())
    expect(onChange).not.toHaveBeenCalled()
  } finally {
    await act(() => root.unmount())
    host.remove()
  }
})

it('Escape abandons a numeric draft without emitting a property edit', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host),
    onChange = vi.fn()
  await act(() =>
    root.render(
      createElement(NumberField, { label: 'Dimension', value: 2, onChange })
    )
  )
  const input = host.querySelector('input')
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set
  if (!input || !setValue) throw new Error('Missing numeric input')
  await act(() => {
    input.focus()
    setValue.call(input, '9')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(input.value).toBe('9')
  await act(() =>
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )
  )
  expect(onChange).not.toHaveBeenCalled()
  expect(input.value).toBe('2')
  await act(() => root.unmount())
  host.remove()
})

it('removing the active canonical model removes its old visible projection', async () => {
  const host = document.createElement('div'),
    root = createRoot(host)
  const setFrame = vi.fn(),
    runtime = {
      setFrame,
      getVisualAssets: () => new Map()
    } as unknown as SimRuntime
  const View = ({ workcell }: { workcell: Workcell | null }) => {
    useViewport(runtime, workcell, null, DEFAULT_CAMERA, false, () => true)
    return null
  }
  await act(() =>
    root.render(
      createElement(View, { workcell: createSyntheticExample().workcell })
    )
  )
  expect(setFrame.mock.lastCall?.[0].meshes).toHaveLength(
    createSyntheticExample().workcell.bodies.reduce(
      (count, body) => count + body.colliders.length,
      0
    )
  )
  await act(() => root.render(createElement(View, { workcell: null })))
  expect(setFrame.mock.lastCall?.[0].meshes.length).toBe(0)
  expect(setFrame.mock.lastCall?.[0].camera).toEqual(DEFAULT_CAMERA)
  await act(() => root.unmount())
})

it('does not submit a retained viewport effect after its document lifetime ended', async () => {
  const host = document.createElement('div'),
    root = createRoot(host)
  const setFrame = vi.fn(),
    runtime = { setFrame } as unknown as SimRuntime
  const View = () => {
    useViewport(
      runtime,
      createSyntheticExample().workcell,
      null,
      DEFAULT_CAMERA,
      true,
      () => false
    )
    return null
  }
  await act(() => root.render(createElement(View)))
  expect(setFrame).not.toHaveBeenCalled()
  await act(() => root.unmount())
})

it('ignores retained pointer, wheel and reset-view input from a retired document', async () => {
  const host = document.createElement('div'),
    surface = document.createElement('div'),
    root = createRoot(host)
  surface.setPointerCapture = vi.fn()
  surface.hasPointerCapture = vi.fn(() => false)
  const pick = vi.fn(() => 'old-body'),
    runtime = { pick } as unknown as SimRuntime
  const onCamera = vi.fn(),
    onSelect = vi.fn()
  let current = true
  await act(() =>
    root.render(
      createElement(ViewportControls, {
        host: surface,
        runtime,
        camera: DEFAULT_CAMERA,
        onCamera,
        onSelect,
        isCurrent: () => current,
        getFitMeshes: () => []
      })
    )
  )
  surface.dispatchEvent(
    Object.assign(
      new MouseEvent('pointerdown', { button: 0, clientX: 10, clientY: 10 }),
      { pointerId: 1 }
    )
  )
  current = false
  await act(() => {
    surface.dispatchEvent(new WheelEvent('wheel', { deltaY: 80 }))
    surface.dispatchEvent(
      Object.assign(
        new MouseEvent('pointerup', { button: 0, clientX: 10, clientY: 10 }),
        { pointerId: 1 }
      )
    )
    host.querySelectorAll('button').forEach((button) => button.click())
  })
  expect(pick).not.toHaveBeenCalled()
  expect(onCamera).not.toHaveBeenCalled()
  expect(onSelect).not.toHaveBeenCalled()
  await act(() => root.unmount())
})
