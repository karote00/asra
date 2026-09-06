import { expect, it } from 'vitest'
import type { VisualBinding } from '../../../domain/workcell'
import { equalBindings, equalJoint, equalPose } from '../equal-fields'

it('compares every displayed placement dimension without inspecting source geometry', () => {
  const binding: VisualBinding = {
    version: 1,
    id: 'part',
    assetId: 'a'.repeat(64),
    pose: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
    scale: [1, 1, 1]
  }

  expect(equalBindings([binding], structuredClone([binding]))).toBe(true)

  expect(equalBindings(undefined, [])).toBe(true)

  expect(equalBindings([binding], [])).toBe(false)

  for (const field of ['id', 'assetId'] as const) {
    expect(equalBindings([binding], [{ ...binding, [field]: 'changed' }])).toBe(
      false
    )
  }

  for (const field of ['position', 'rotation'] as const) {
    for (let index = 0; index < binding.pose[field].length; index++) {
      const next = structuredClone(binding)

      const values = [...next.pose[field]]

      values[index] += 0.1

      next.pose = { ...next.pose, [field]: values }

      expect(equalPose(binding.pose, next.pose)).toBe(false)

      expect(equalBindings([binding], [next])).toBe(false)
    }
  }

  for (let index = 0; index < 3; index++) {
    const next = structuredClone(binding)

    next.scale = next.scale.map((value, i) =>
      i === index ? 2 : value
    ) as unknown as VisualBinding['scale']

    expect(equalBindings([binding], [next])).toBe(false)
  }
})

it('compares each editable joint value and axis component', () => {
  const joint = {
    kind: 'revolute',
    axis: [0, 1, 0],
    min: -1,
    value: 0,
    max: 1
  } as const

  expect(equalJoint(joint, structuredClone(joint))).toBe(true)

  expect(equalJoint(joint, { ...joint, kind: 'fixed' })).toBe(false)

  for (const field of ['min', 'value', 'max'] as const) {
    expect(equalJoint(joint, { ...joint, [field]: 0.25 })).toBe(false)
  }

  expect(equalJoint(joint, { ...joint, axis: [1, 0, 0] })).toBe(false)
})
