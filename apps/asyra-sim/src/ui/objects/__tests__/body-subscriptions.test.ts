// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createSyntheticExample } from '../../../../samples/synthetic-workcell'
import type { Body } from '../../../domain/workcell'
import { ViewSource } from '../../shared/view-source'
import {
  useBodyJoint,
  useBodyPose,
  useOriginalBinding,
  useDisplayUnits,
  type DisplayUnits
} from '../body-subscriptions'

function fixture(): Body {
  return {
    ...createSyntheticExample().workcell.bodies[0],
    joint: { kind: 'revolute', axis: [0, 1, 0], min: -1, value: 0, max: 1 },
    visuals: [
      {
        version: 1,
        id: 'part',
        assetId: 'a'.repeat(64),
        pose: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
        scale: [1, 1, 1]
      }
    ]
  }
}

function visualsOf(body: Body) {
  if (!body.visuals) throw new Error('Missing test original-part bindings')

  return body.visuals
}

it('observes every displayed mount, joint and original-placement scalar without props comparisons', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

  const initial = fixture()

  const source = new ViewSource(initial)

  const root = createRoot(document.createElement('div'))

  const counts = { pose: 0, joint: 0, original: 0 }

  function Mount() {
    useBodyPose(source)

    counts.pose++

    return null
  }

  function Joint() {
    useBodyJoint(source)

    counts.joint++

    return null
  }

  function Original() {
    useOriginalBinding(source, 'part')

    counts.original++

    return null
  }

  const publish = async (next: Body) => {
    counts.pose = counts.joint = counts.original = 0

    await act(() => source.publish(next))
  }

  const verify = async (
    owner: keyof typeof counts,
    mutate: (body: Body) => Body
  ) => {
    await publish(structuredClone(initial))

    await publish(mutate(structuredClone(initial)))

    expect(counts).toEqual({
      pose: Number(owner === 'pose'),
      joint: Number(owner === 'joint'),
      original: Number(owner === 'original')
    })
  }

  try {
    await act(() =>
      root.render([
        createElement(Mount, { key: 'mount' }),
        createElement(Joint, { key: 'joint' }),
        createElement(Original, { key: 'original' })
      ])
    )

    await publish({ ...structuredClone(initial), name: 'Renamed' })

    expect(counts).toEqual({ pose: 0, joint: 0, original: 0 })

    for (const field of ['position', 'rotation'] as const) {
      for (let index = 0; index < initial.pose[field].length; index++) {
        await verify('pose', (body) => ({
          ...body,
          pose: {
            ...body.pose,
            [field]: body.pose[field].map(
              (value, i) => value + Number(i === index) * 0.1
            )
          }
        }))

        await verify('original', (body) => ({
          ...body,
          visuals: visualsOf(body).map((binding) => ({
            ...binding,
            pose: {
              ...binding.pose,
              [field]: binding.pose[field].map(
                (value, i) => value + Number(i === index) * 0.1
              )
            }
          }))
        }))
      }
    }

    for (const field of ['id', 'assetId'] as const) {
      await verify('original', (body) => ({
        ...body,
        visuals: visualsOf(body).map((binding) => ({
          ...binding,
          [field]: 'changed'
        }))
      }))
    }

    for (let index = 0; index < 3; index++) {
      await verify('original', (body) => ({
        ...body,
        visuals: visualsOf(body).map((binding) => ({
          ...binding,
          scale: binding.scale.map(
            (value, i) => value + Number(i === index)
          ) as unknown as typeof binding.scale
        }))
      }))

      await verify('joint', (body) => ({
        ...body,
        joint: {
          ...body.joint,
          axis: body.joint.axis.map(
            (value, i) => value + Number(i === index)
          ) as unknown as typeof body.joint.axis
        }
      }))
    }

    for (const field of ['min', 'value', 'max'] as const) {
      await verify('joint', (body) => ({
        ...body,
        joint: { ...body.joint, [field]: 0.25 }
      }))
    }

    await verify('joint', (body) => ({
      ...body,
      joint: { ...body.joint, kind: 'fixed' }
    }))

    await verify('original', (body) => ({ ...body, visuals: [] }))
  } finally {
    await act(() => root.unmount())

    await publish(initial)

    expect(counts).toEqual({ pose: 0, joint: 0, original: 0 })

    vi.unstubAllGlobals()
  }
})

it('refreshes presentation units independently of canonical body edits', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

  const source = new ViewSource<DisplayUnits>({
    lengthUnit: 'm',
    angleUnit: 'deg'
  })

  const root = createRoot(document.createElement('div'))

  const values = vi.fn()

  function Units() {
    values(useDisplayUnits(source))

    return null
  }

  try {
    await act(() => root.render(createElement(Units)))

    values.mockClear()

    await act(() => source.publish({ lengthUnit: 'm', angleUnit: 'deg' }))

    expect(values).not.toHaveBeenCalled()

    await act(() => source.publish({ lengthUnit: 'mm', angleUnit: 'rad' }))

    expect(values).toHaveBeenCalledExactlyOnceWith({
      lengthUnit: 'mm',
      angleUnit: 'rad',
      lengthScale: 1000,
      angleScale: 1
    })
  } finally {
    await act(() => root.unmount())

    vi.unstubAllGlobals()
  }
})
