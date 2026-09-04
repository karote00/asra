import { magnitude, type Pose, type Vec3 } from './math'
import {
  evaluateKinematics,
  interpolateSegment,
  numberAlgebra
} from './kinematic-algebra'
import { hasExactOwnKeys } from './records'

export type Geometry =
  | { kind: 'box'; size: Vec3 }
  | { kind: 'sphere'; radius: number }
  | { kind: 'capsule'; radius: number; length: number }
export interface Collider {
  id: string
  geometry: Geometry
  pose: Pose
}
export interface Joint {
  kind: 'fixed' | 'revolute' | 'prismatic'
  axis: Vec3
  value: number
  min: number
  max: number
}
export interface Body {
  id: string
  parentId: string | null
  name: string
  role: 'robot' | 'link' | 'tool' | 'workpiece' | 'fixture' | 'group'
  pose: Pose
  joint: Joint
  colliders: readonly Collider[]
  visible: boolean
  color: number
}
export type BodyParameters = Omit<Body, 'id' | 'parentId' | 'name' | 'visible'>
/** Detached analysis/pose input. Editable parent membership remains Scene Tree-owned. */
export interface Workcell {
  version: 1
  robotRootId: string | null
  bodies: readonly Body[]
}
export interface Keyframe {
  time: number
  joints: Readonly<Record<string, number>>
}
export interface Trajectory {
  version: 1
  keyframes: readonly Keyframe[]
}

export const GEOMETRY_PROFILE = Object.freeze({
  id: 'machine-scale-v0',
  minDimension: 0.0001,
  maxDimension: 20,
  maxOffset: 1000,
  maxBodies: 64,
  maxJoints: 12,
  maxAngle: 100,
  maxTime: 3600,
  minSegmentDuration: 0.000001
})

const finiteVector = (v: unknown, n: number): v is number[] =>
  Array.isArray(v) && v.length === n && v.every(Number.isFinite)
export function validPose(pose: unknown): pose is Pose {
  if (!pose || typeof pose !== 'object') return false
  const p = pose as Pose
  return (
    finiteVector(p.position, 3) &&
    p.position.every((v) => Math.abs(v) <= GEOMETRY_PROFILE.maxOffset) &&
    finiteVector(p.rotation, 4) &&
    Math.abs(Math.hypot(...p.rotation) - 1) < 1e-8
  )
}
export function validGeometry(geometry: unknown): geometry is Geometry {
  if (!geometry || typeof geometry !== 'object') return false
  const g = geometry as Geometry
  const size = (n: number) =>
    Number.isFinite(n) &&
    n >= GEOMETRY_PROFILE.minDimension &&
    n <= GEOMETRY_PROFILE.maxDimension
  if (g.kind === 'sphere') return size(g.radius)
  if (g.kind === 'capsule')
    return (
      size(g.radius) &&
      Number.isFinite(g.length) &&
      g.length >= 0 &&
      g.length <= GEOMETRY_PROFILE.maxDimension
    )
  if (g.kind === 'box') return finiteVector(g.size, 3) && g.size.every(size)
  return false
}
export const validIdentifier = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-zA-Z0-9_.:-]{1,96}$/.test(value) &&
  !['__proto__', 'prototype', 'constructor'].includes(value)
export function validJoint(input: unknown): input is Joint {
  if (!input || typeof input !== 'object') return false
  const joint = input as Joint
  if (
    !['fixed', 'revolute', 'prismatic'].includes(joint.kind) ||
    !finiteVector(joint.axis, 3) ||
    magnitude(joint.axis) < 1e-12 ||
    ![joint.value, joint.min, joint.max].every(Number.isFinite) ||
    joint.min > joint.max ||
    joint.value < joint.min ||
    joint.value > joint.max
  )
    return false
  if (
    joint.kind === 'revolute' &&
    Math.max(Math.abs(joint.min), Math.abs(joint.max)) >
      GEOMETRY_PROFILE.maxAngle
  )
    return false
  if (
    joint.kind === 'prismatic' &&
    Math.max(Math.abs(joint.min), Math.abs(joint.max)) >
      GEOMETRY_PROFILE.maxDimension
  )
    return false
  return true
}
export function validBodyParameters(input: unknown): input is BodyParameters {
  if (!input || typeof input !== 'object') return false
  const body = input as BodyParameters
  if (
    !['robot', 'link', 'tool', 'workpiece', 'fixture', 'group'].includes(
      body.role
    ) ||
    !validPose(body.pose) ||
    !validJoint(body.joint) ||
    !Array.isArray(body.colliders) ||
    !Number.isInteger(body.color) ||
    body.color < 0 ||
    body.color > 0xffffff
  )
    return false
  const ids = new Set<string>()
  for (const collider of body.colliders) {
    if (
      !collider ||
      !validIdentifier(collider.id) ||
      ids.has(collider.id) ||
      !validPose(collider.pose) ||
      !validGeometry(collider.geometry)
    )
      return false
    ids.add(collider.id)
  }
  return true
}
export function validateWorkcell(input: unknown): asserts input is Workcell {
  if (!input || typeof input !== 'object')
    throw new Error('Invalid workcell data')
  const workcell = input as Workcell
  if (
    workcell.version !== 1 ||
    !Array.isArray(workcell.bodies) ||
    workcell.bodies.length > GEOMETRY_PROFILE.maxBodies
  )
    throw new Error('Unsupported workcell version or body count')
  for (const body of workcell.bodies) {
    if (
      !body ||
      !validIdentifier(body.id) ||
      !(body.parentId === null || validIdentifier(body.parentId)) ||
      typeof body.name !== 'string' ||
      body.name.length > 200 ||
      typeof body.visible !== 'boolean' ||
      !validBodyParameters(body)
    )
      throw new Error('Invalid body or joint data')
  }
  const bodies = new Map(workcell.bodies.map((b) => [b.id, b]))
  if (bodies.size !== workcell.bodies.length)
    throw new Error('Duplicate body identity')
  if (workcell.robotRootId !== null && !bodies.has(workcell.robotRootId))
    throw new Error('Missing robot root')
  const actuated: Body[] = []
  for (const body of workcell.bodies) {
    if (body.joint.kind !== 'fixed') actuated.push(body)
    const visited = new Set([body.id])
    let parentId = body.parentId
    while (parentId !== null) {
      if (visited.has(parentId)) throw new Error('Workcell hierarchy cycle')
      visited.add(parentId)
      const parent = bodies.get(parentId)
      if (!parent) throw new Error(`Missing parent ${parentId}`)
      parentId = parent.parentId
    }
  }
  if (actuated.length > GEOMETRY_PROFILE.maxJoints)
    throw new Error('Too many actuated joints')
  const ancestors = (body: Body): Set<string> => {
    const ids = new Set<string>()
    let current: Body | undefined = body
    while (current) {
      ids.add(current.id)
      current =
        current.parentId === null ? undefined : bodies.get(current.parentId)
    }
    return ids
  }
  for (const a of actuated) {
    if (!workcell.robotRootId || !ancestors(a).has(workcell.robotRootId))
      throw new Error('Every moving joint must belong to the selected robot')
    for (const b of actuated)
      if (!ancestors(a).has(b.id) && !ancestors(b).has(a.id))
        throw new Error('Only one serial moving chain is supported')
  }
  if (
    workcell.robotRootId &&
    bodies.get(workcell.robotRootId)?.joint.kind !== 'fixed'
  )
    throw new Error('The robot base must be fixed')
}

export function validateTrajectory(
  workcell: Workcell,
  trajectory: Trajectory
): void {
  if (
    trajectory.version !== 1 ||
    !Array.isArray(trajectory.keyframes) ||
    !trajectory.keyframes.length ||
    trajectory.keyframes.length > 2000
  )
    throw new Error('Trajectory must contain 1 to 2000 keyframes')
  const joints = workcell.bodies.filter((b) => b.joint.kind !== 'fixed')
  let previous = -Infinity
  for (const frame of trajectory.keyframes) {
    if (
      !Number.isFinite(frame.time) ||
      frame.time < 0 ||
      frame.time > GEOMETRY_PROFILE.maxTime ||
      frame.time - previous < GEOMETRY_PROFILE.minSegmentDuration
    )
      throw new Error(
        'Keyframe times must be finite and strictly increasing within the supported envelope'
      )
    if (
      !hasExactOwnKeys(
        frame.joints,
        joints.map((body) => body.id)
      )
    )
      throw new Error('Every actuated joint must have an explicit value')
    for (const body of joints) {
      const value = frame.joints[body.id]
      if (
        !Number.isFinite(value) ||
        value < body.joint.min ||
        value > body.joint.max
      )
        throw new Error(`Missing or out-of-limit joint ${body.id}`)
    }
    previous = frame.time
  }
}

export function jointValuesAt(
  trajectory: Trajectory,
  time: number
): Readonly<Record<string, number>> {
  const frames = trajectory.keyframes,
    first = frames[0],
    last = frames.at(-1)
  if (
    !first ||
    !last ||
    !Number.isFinite(time) ||
    time < first.time ||
    time > last.time
  )
    throw new Error('Trajectory does not cover the requested time')
  if (frames.length === 1 || time === last.time) return { ...last.joints }
  const upper = frames.findIndex((frame) => frame.time > time)
  return interpolateSegment(trajectory, upper - 1, time, numberAlgebra)
}

export function forwardKinematics(
  workcell: Workcell,
  values: Readonly<Record<string, number>> = {}
): ReadonlyMap<string, Pose> {
  for (const body of workcell.bodies) {
    const value = values[body.id] ?? body.joint.value
    if (
      !Number.isFinite(value) ||
      value < body.joint.min ||
      value > body.joint.max
    )
      throw new Error('Joint value outside its limits')
  }
  return evaluateKinematics(workcell, values, numberAlgebra)
}
