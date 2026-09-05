// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { BodyEditor } from '../body-editor'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { IDENTITY_POSE } from '../../domain/math'

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
          onApply: apply,
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
    const form = host.querySelector('form')
    if (!form) throw new Error('Missing editor form')
    await act(() =>
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      )
    )
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ visuals: [], colliders: [] })
    )
  } finally {
    await act(() => root.unmount())
    vi.unstubAllGlobals()
  }
})
