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
  const colliders = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: `shape-${index}`,
      geometry: { kind: 'sphere', radius: 0.1 },
      pose: IDENTITY_POSE
    }))
  it('enforces the sixteen-collider body limit without dropping geometry', () => {
    expect(
      validBodyParameters({ ...parameters, colliders: colliders(16) })
    ).toBe(true)
    expect(
      validBodyParameters({ ...parameters, colliders: colliders(17) })
    ).toBe(false)
  })
  it('admits exactly 256 workcell colliders and rejects excess aggregate geometry', () => {
    const bodies = Array.from({ length: 16 }, (_, index) => ({
      ...parameters,
      id: `body-${index}`,
      parentId: null,
      name: `Body ${index}`,
      visible: true,
      colliders: colliders(16)
    }))
    const workcell = { version: 1, robotRootId: null, bodies }
    expect(() => validateWorkcell(workcell)).not.toThrow()
    expect(() =>
      validateWorkcell({
        ...workcell,
        bodies: [
          ...bodies,
          { ...bodies[0], id: 'extra', colliders: colliders(1) }
        ]
      })
    ).toThrow('collider')
    expect(
      workcell.bodies.reduce((sum, body) => sum + body.colliders.length, 0)
    ).toBe(256)
  })
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
