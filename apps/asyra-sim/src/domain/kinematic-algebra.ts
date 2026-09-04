import {
  iadd,
  idiv,
  imul,
  ineg,
  interval,
  isinCos,
  isqrt,
  isquare,
  isub,
  type Interval
} from './interval'
import type { Pose, Quaternion, Vec3 } from './math'
import type { Trajectory, Workcell } from './workcell'

export type Vector<S> = readonly [S, S, S]
export type Rotation<S> = readonly [S, S, S, S]
export interface AlgebraPose<S> {
  position: Vector<S>
  rotation: Rotation<S>
}
export interface Algebra<S> {
  scalar(value: number): S
  add(a: S, b: S): S
  sub(a: S, b: S): S
  mul(a: S, b: S): S
  div(a: S, b: S): S
  neg(a: S): S
  square(a: S): S
  sqrtNonnegative(a: S): S
  sinCos(a: S): readonly [S, S]
}
export const numberAlgebra: Algebra<number> = {
  scalar: (value) => value,
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  div: (a, b) => a / b,
  neg: (a) => -a,
  square: (a) => a * a,
  sqrtNonnegative: Math.sqrt,
  sinCos: (a) => [Math.sin(a), Math.cos(a)]
}
export const intervalAlgebra: Algebra<Interval> = {
  scalar: interval,
  add: iadd,
  sub: isub,
  mul: imul,
  div: idiv,
  neg: ineg,
  square: isquare,
  sqrtNonnegative: (value) => isqrt(interval(Math.max(0, value[0]), value[1])),
  sinCos: isinCos
}

/** One transform/interpolation definition; numerical backends cannot change axes or order. */
export function poseOperations<S>(a: Algebra<S>) {
  const scalar = a.scalar
  const vector = (v: Vec3): Vector<S> => [
    scalar(v[0]),
    scalar(v[1]),
    scalar(v[2])
  ]
  const add = (u: Vector<S>, v: Vector<S>): Vector<S> => [
    a.add(u[0], v[0]),
    a.add(u[1], v[1]),
    a.add(u[2], v[2])
  ]
  const sub = (u: Vector<S>, v: Vector<S>): Vector<S> => [
    a.sub(u[0], v[0]),
    a.sub(u[1], v[1]),
    a.sub(u[2], v[2])
  ]
  const scale = (u: Vector<S>, s: S): Vector<S> => [
    a.mul(u[0], s),
    a.mul(u[1], s),
    a.mul(u[2], s)
  ]
  const dot = (u: Vector<S>, v: Vector<S>): S =>
    a.add(a.add(a.mul(u[0], v[0]), a.mul(u[1], v[1])), a.mul(u[2], v[2]))
  const norm = (u: readonly S[]): S =>
    a.sqrtNonnegative(u.reduce((sum, x) => a.add(sum, a.square(x)), scalar(0)))
  const cross = (u: Vector<S>, v: Vector<S>): Vector<S> => [
    a.sub(a.mul(u[1], v[2]), a.mul(u[2], v[1])),
    a.sub(a.mul(u[2], v[0]), a.mul(u[0], v[2])),
    a.sub(a.mul(u[0], v[1]), a.mul(u[1], v[0]))
  ]
  const normalize = (v: Vector<S>): Vector<S> =>
    scale(v, a.div(scalar(1), norm(v)))
  const normalizeRotation = (q: Rotation<S>): Rotation<S> => {
    const length = norm(q)
    return [
      a.div(q[0], length),
      a.div(q[1], length),
      a.div(q[2], length),
      a.div(q[3], length)
    ]
  }
  const rotation = (q: Quaternion): Rotation<S> =>
    normalizeRotation([scalar(q[0]), scalar(q[1]), scalar(q[2]), scalar(q[3])])
  const rotate = (q: Rotation<S>, v: Vector<S>): Vector<S> => {
    const u: Vector<S> = [q[0], q[1], q[2]],
      t = scale(cross(u, v), scalar(2))
    return add(v, add(scale(t, q[3]), cross(u, t)))
  }
  // Both operands denote unit rotations. Renormalizing interval products would
  // discard this dependency and can introduce a spurious zero denominator.
  const multiply = (p: Rotation<S>, q: Rotation<S>): Rotation<S> => [
    a.sub(
      a.add(a.add(a.mul(p[3], q[0]), a.mul(p[0], q[3])), a.mul(p[1], q[2])),
      a.mul(p[2], q[1])
    ),
    a.add(
      a.add(a.sub(a.mul(p[3], q[1]), a.mul(p[0], q[2])), a.mul(p[1], q[3])),
      a.mul(p[2], q[0])
    ),
    a.add(
      a.sub(a.add(a.mul(p[3], q[2]), a.mul(p[0], q[1])), a.mul(p[1], q[0])),
      a.mul(p[2], q[3])
    ),
    a.sub(
      a.sub(a.sub(a.mul(p[3], q[3]), a.mul(p[0], q[0])), a.mul(p[1], q[1])),
      a.mul(p[2], q[2])
    )
  ]
  const identity = (): AlgebraPose<S> => ({
    position: vector([0, 0, 0]),
    rotation: rotation([0, 0, 0, 1])
  })
  const fromPose = (pose: Pose): AlgebraPose<S> => ({
    position: vector(pose.position),
    rotation: rotation(pose.rotation)
  })
  const compose = (
    parent: AlgebraPose<S>,
    local: AlgebraPose<S>
  ): AlgebraPose<S> => ({
    position: add(parent.position, rotate(parent.rotation, local.position)),
    rotation: multiply(parent.rotation, local.rotation)
  })
  const axisAngle = (axis: Vec3, angle: S): Rotation<S> => {
    const unit = normalize(vector(axis)),
      [sin, cos] = a.sinCos(a.div(angle, scalar(2)))
    return [a.mul(unit[0], sin), a.mul(unit[1], sin), a.mul(unit[2], sin), cos]
  }
  return {
    vector,
    add,
    sub,
    scale,
    dot,
    norm,
    cross,
    normalize,
    rotate,
    rotation,
    multiply,
    identity,
    fromPose,
    compose,
    axisAngle
  }
}

export function evaluateKinematics<S>(
  workcell: Workcell,
  values: Readonly<Record<string, S>>,
  a: Algebra<S>
): ReadonlyMap<string, AlgebraPose<S>> {
  const ops = poseOperations(a),
    bodies = new Map(workcell.bodies.map((body) => [body.id, body])),
    poses = new Map<string, AlgebraPose<S>>()
  const visiting = new Set<string>()
  const evaluate = (id: string): AlgebraPose<S> => {
    const completed = poses.get(id)
    if (completed) return completed
    const body = bodies.get(id)
    if (!body || visiting.has(id)) throw new Error('Invalid pose hierarchy')
    visiting.add(id)
    const parent =
      body.parentId === null ? ops.identity() : evaluate(body.parentId)
    const value = values[id] ?? a.scalar(body.joint.value)
    let motion = ops.identity()
    if (body.joint.kind === 'revolute')
      motion = {
        position: motion.position,
        rotation: ops.axisAngle(body.joint.axis, value)
      }
    if (body.joint.kind === 'prismatic')
      motion = {
        position: ops.scale(ops.normalize(ops.vector(body.joint.axis)), value),
        rotation: motion.rotation
      }
    const pose = ops.compose(
      ops.compose(parent, ops.fromPose(body.pose)),
      motion
    )
    poses.set(id, pose)
    visiting.delete(id)
    return pose
  }
  workcell.bodies.forEach((body) => evaluate(body.id))
  return poses
}

/** Caller selects a complete keyframe segment; time is a point or a contained interval. */
export function interpolateSegment<S>(
  trajectory: Trajectory,
  index: number,
  time: S,
  a: Algebra<S>
): Readonly<Record<string, S>> {
  const left = trajectory.keyframes[index],
    right = trajectory.keyframes[index + 1]
  if (!left) throw new Error('Missing trajectory segment')
  if (!right)
    return Object.fromEntries(
      Object.entries(left.joints).map(([id, value]) => [id, a.scalar(value)])
    )
  const fraction = a.div(
    a.sub(time, a.scalar(left.time)),
    a.sub(a.scalar(right.time), a.scalar(left.time))
  )
  return Object.fromEntries(
    Object.keys(left.joints).map((id) => [
      id,
      a.add(
        a.scalar(left.joints[id]),
        a.mul(
          a.sub(a.scalar(right.joints[id]), a.scalar(left.joints[id])),
          fraction
        )
      )
    ])
  )
}
