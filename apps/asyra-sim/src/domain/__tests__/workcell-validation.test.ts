import { describe, expect, it } from 'vitest'
import { IDENTITY_POSE } from '../math'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import {
  forwardKinematics,
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
  const visual = (id = 'reference') => ({
    version: 1,
    id,
    assetId: 'a'.repeat(64),
    pose: IDENTITY_POSE,
    scale: [1, 1, 1]
  })
  it('does not let visual placement or scale alter body kinematics or colliders', () => {
    const original = createSyntheticExample().workcell
    const attached = structuredClone(original)
    attached.bodies[1].visuals = [
      {
        version: 1,
        id: 'mesh',
        assetId: 'b'.repeat(64),
        pose: { position: [2, 3, 4], rotation: [0, 0, 0, 1] },
        scale: [0.001, 2, 3]
      }
    ]
    validateWorkcell(attached)
    expect(forwardKinematics(attached)).toEqual(forwardKinematics(original))
    expect(attached.bodies.map((body) => body.colliders)).toEqual(
      original.bodies.map((body) => body.colliders)
    )
  })
  it('validates optional visual metadata without creating colliders', () => {
    const body = { ...parameters, visuals: [visual()] }
    expect(validBodyParameters(body)).toBe(true)
    expect(body.colliders).toEqual([])
    expect(validBodyParameters({ ...parameters, visuals: [] })).toBe(true)
    for (const binding of [
      { ...visual(), version: 2 },
      { ...visual(), assetId: 'A'.repeat(64) },
      { ...visual(), assetId: 'https://example.test/file.glb' },
      { ...visual(), id: '__proto__' },
      { ...visual(), extra: true },
      { ...visual(), pose: { ...IDENTITY_POSE, rotation: [0, 0, 0, 2] } },
      ...[0, -1, NaN, Infinity, 0.0000001, 1001].map((value) => ({
        ...visual(),
        scale: [value, 1, 1]
      }))
    ])
      expect(validBodyParameters({ ...parameters, visuals: [binding] })).toBe(
        false
      )
    for (const visuals of [null, {}, [visual(), visual()]])
      expect(validBodyParameters({ ...parameters, visuals })).toBe(false)
    expect(
      validBodyParameters({
        ...parameters,
        visuals: [{ ...visual(), scale: [0.000001, 1000, 1] }]
      })
    ).toBe(true)
  })
  it('enforces body and workcell visual-reference limits without truncation', () => {
    const visuals = Array.from({ length: 16 }, (_, i) => visual(`v${i}`))
    expect(validBodyParameters({ ...parameters, visuals })).toBe(true)
    expect(
      validBodyParameters({
        ...parameters,
        visuals: [...visuals, visual('excess')]
      })
    ).toBe(false)
    const bodies = Array.from({ length: 16 }, (_, i) => ({
      ...parameters,
      id: `body${i}`,
      parentId: null,
      name: 'Body',
      visible: true,
      visuals
    }))
    const workcell = { version: 1, robotRootId: null, bodies }
    expect(() => validateWorkcell(workcell)).not.toThrow()
    expect(() =>
      validateWorkcell({
        ...workcell,
        bodies: [...bodies, { ...bodies[0], id: 'excess', visuals: [visual()] }]
      })
    ).toThrow('visual')
  })
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
