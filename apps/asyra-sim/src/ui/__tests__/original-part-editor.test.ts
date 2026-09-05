// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { BodyEditor } from '../body-editor'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { IDENTITY_POSE } from '../../domain/math'

it('commits mount rotation when its angle field is completed, without a second action', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const workcell = createSyntheticExample().workcell,
    body = workcell.bodies[0],
    host = document.createElement('div'),
    root = createRoot(host),
    apply = vi.fn()
  document.body.append(host)
  try {
    await act(() =>
      root.render(
        createElement(BodyEditor, {
          body,
          workcell,
          onChange: apply,
          onRemove: vi.fn()
        })
      )
    )
    const input = host.querySelector<HTMLInputElement>(
      '[aria-label="Rotation angle (deg)"]'
    )
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set
    if (!input || !setValue) throw new Error('Missing rotation input')
    await act(() => {
      input.focus()
      setValue.call(input, '90')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(() => input.blur())
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply.mock.calls[0][0].pose.rotation[1]).toBeCloseTo(Math.SQRT1_2)
    expect(host.textContent).not.toContain('Set mount rotation')
  } finally {
    await act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})

it('edits actual source placement and never offers its retired surrogate as analysis geometry', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const workcell = createSyntheticExample().workcell,
    body = workcell.bodies[0]
  body.visuals = [
    {
      version: 1,
      id: 'part',
      assetId: 'a'.repeat(64),
      pose: IDENTITY_POSE,
      scale: [1, 1, 1]
    }
  ]
  const host = document.createElement('div'),
    root = createRoot(host),
    apply = vi.fn()
  try {
    await act(() =>
      root.render(
        createElement(BodyEditor, {
          body,
          workcell,
          onChange: apply,
          onRemove: vi.fn()
        })
      )
    )
    expect(host.textContent).toContain('Original parts')
    expect(host.querySelector('[aria-label="Shape 1 type"]')).toBeNull()
    const remove = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'Remove original part 1'
    )
    expect(remove).toBeDefined()
    await act(() => remove?.click())
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ visuals: [], colliders: [] })
    )
  } finally {
    await act(() => root.unmount())
    vi.unstubAllGlobals()
  }
})
