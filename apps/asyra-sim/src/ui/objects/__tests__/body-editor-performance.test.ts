// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createSyntheticExample } from '../../../../samples/synthetic-workcell'
import { BodyEditor } from '../body-editor'
import { RotationFields } from '../rotation-fields'

vi.mock('../rotation-fields', async (original) => {
  const actual = await original<typeof import('../rotation-fields')>()

  return { RotationFields: vi.fn(actual.RotationFields) }
})

it('name edits retain unchanged mount controls, but pose changes refresh them', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

  const workcell = createSyntheticExample().workcell

  let body = workcell.bodies[0]

  body = {
    ...body,
    visuals: [
      {
        version: 1,
        id: 'original-part',
        assetId: 'a'.repeat(64),
        pose: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
        scale: [1, 1, 1]
      }
    ]
  }

  const host = document.createElement('div')

  const root = createRoot(host)

  const onChange = vi.fn()

  const onRemove = vi.fn()

  const render = () =>
    act(() =>
      root.render(
        createElement(BodyEditor, {
          body,
          workcell,
          onChange,
          onRemove
        })
      )
    )

  try {
    await render()

    const retainedMountChange = vi
      .mocked(RotationFields)
      .mock.calls.find(
        ([props]) => props.axisLabel === 'Rotation axis'
      )?.[0].onChange

    if (!retainedMountChange) throw new Error('Missing mount rotation control')

    vi.mocked(RotationFields).mockClear()

    body = { ...structuredClone(body), name: 'Renamed mount' }

    await render()

    expect(host.querySelector('h2')?.textContent).toBe('Renamed mount')

    expect(RotationFields).not.toHaveBeenCalled()

    await act(() => retainedMountChange([0, 1, 0, 0]))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Renamed mount' })
    )

    body = { ...body, pose: { ...body.pose, rotation: [0, 1, 0, 0] } }

    await render()

    expect(RotationFields).toHaveBeenCalledTimes(1)

    expect(vi.mocked(RotationFields).mock.calls[0][0].value).toEqual([
      0, 1, 0, 0
    ])
  } finally {
    await act(() => root.unmount())

    vi.unstubAllGlobals()
  }
})
