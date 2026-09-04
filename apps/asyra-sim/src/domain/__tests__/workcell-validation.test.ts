import { describe, expect, it } from 'vitest'
import { IDENTITY_POSE } from '../math'
import {
  validBodyParameters,
  validIdentifier,
  validateWorkcell
} from '../workcell'

const parameters = {
  role: 'fixture',
  pose: IDENTITY_POSE,
  joint: { kind: 'fixed', axis: [0, 1, 0], value: 0, min: 0, max: 0 },
  colliders: [],
  color: 0
}
describe('shared body/load validation', () => {
  it('validates parameters without inventing a parent hierarchy', () => {
    expect(validBodyParameters(parameters)).toBe(true)
    expect(
      validBodyParameters({
        ...parameters,
        joint: { kind: 'revolute', axis: [1, 0, 0], value: 0, min: -1, max: 1 }
      })
    ).toBe(true)
    expect(
      validBodyParameters({
        ...parameters,
        joint: { kind: 'revolute', axis: [0, 0, 0], value: 0, min: -1, max: 1 }
      })
    ).toBe(false)
  })
  it('rejects corrupt import structures and unsafe map identifiers explicitly', () => {
    for (const value of [
      null,
      [],
      0,
      undefined,
      { version: 1, bodies: [null], robotRootId: null }
    ])
      expect(() => validateWorkcell(value)).toThrow()
    for (const id of ['__proto__', 'constructor', 'prototype', '', false])
      expect(validIdentifier(id)).toBe(false)
    for (const value of [
      null,
      { ...parameters, colliders: [null] },
      { ...parameters, color: Infinity },
      { ...parameters, pose: { ...IDENTITY_POSE, position: [NaN, 0, 0] } }
    ])
      expect(validBodyParameters(value)).toBe(false)
  })
})
