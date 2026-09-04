import { angleInRadians, lengthInMeters } from './math'
import { hasExactOwnKeys } from './records'
import {
  GEOMETRY_PROFILE,
  validateTrajectory,
  validateWorkcell,
  type Trajectory,
  type Workcell
} from './workcell'

export type TrajectoryTimeUnit = 'ms' | 's'
export type RevoluteJointUnit = 'deg' | 'rad'
export type PrismaticJointUnit = 'mm' | 'm'
export type TrajectoryJointUnit = RevoluteJointUnit | PrismaticJointUnit

export interface TrajectorySourceKeyframe {
  time: number
  joints: Readonly<Record<string, number>>
}

export interface TrajectorySource {
  version: 1
  timeUnit: TrajectoryTimeUnit
  jointUnits: Readonly<Record<string, TrajectoryJointUnit>>
  keyframes: readonly TrajectorySourceKeyframe[]
}

export interface TrajectorySourceUnits {
  time: TrajectoryTimeUnit
  joints: Readonly<Record<string, TrajectoryJointUnit>>
}

export interface NormalizedTrajectorySource {
  trajectory: Trajectory
  sourceUnits: TrajectorySourceUnits
}

const sourceFields = ['version', 'timeUnit', 'jointUnits', 'keyframes'] as const
const frameFields = ['time', 'joints'] as const

function timeInSeconds(value: number, unit: TrajectoryTimeUnit): number {
  if (!Number.isFinite(value)) throw new Error('Time must be finite')
  return unit === 'ms' ? value / 1000 : value
}

export function normalizeTrajectorySource(
  workcell: Workcell,
  input: unknown
): NormalizedTrajectorySource {
  validateWorkcell(workcell)
  if (!hasExactOwnKeys(input, sourceFields) || input.version !== 1)
    throw new Error('Invalid trajectory source data or unit declaration')
  const timeUnit = input.timeUnit
  if (timeUnit !== 'ms' && timeUnit !== 's')
    throw new Error('An explicit supported time unit is required')
  if (!Array.isArray(input.keyframes))
    throw new Error('Trajectory keyframes must be an array')
  if (
    !input.keyframes.length ||
    input.keyframes.length > GEOMETRY_PROFILE.maxKeyframes
  )
    throw new Error(
      `Trajectory must contain 1 to ${GEOMETRY_PROFILE.maxKeyframes} keyframes`
    )

  const actuated = workcell.bodies.filter((body) => body.joint.kind !== 'fixed')
  const jointIds = actuated.map((body) => body.id)
  if (!hasExactOwnKeys(input.jointUnits, jointIds))
    throw new Error('Every actuated joint requires one explicit unit')

  const units: Record<string, TrajectoryJointUnit> = {}
  for (const body of actuated) {
    const unit = input.jointUnits[body.id]
    if (body.joint.kind === 'revolute') {
      if (unit !== 'deg' && unit !== 'rad')
        throw new Error(`Invalid unit for joint ${body.id}`)
      units[body.id] = unit
    } else if (body.joint.kind === 'prismatic') {
      if (unit !== 'mm' && unit !== 'm')
        throw new Error(`Invalid unit for joint ${body.id}`)
      units[body.id] = unit
    } else throw new Error(`Invalid actuated joint ${body.id}`)
  }

  const keyframes = input.keyframes.map((unknownFrame) => {
    if (!hasExactOwnKeys(unknownFrame, frameFields))
      throw new Error('Invalid trajectory keyframe data')
    if (!hasExactOwnKeys(unknownFrame.joints, jointIds))
      throw new Error('Every actuated joint column must be explicit')

    const joints: Record<string, number> = {}
    for (const body of actuated) {
      const value = unknownFrame.joints[body.id]
      const unit = units[body.id]
      if (typeof value !== 'number' || !unit)
        throw new Error(`Missing joint value ${body.id}`)
      joints[body.id] =
        body.joint.kind === 'revolute'
          ? angleInRadians(value, unit as RevoluteJointUnit)
          : lengthInMeters(value, unit as PrismaticJointUnit)
    }
    return {
      time: timeInSeconds(unknownFrame.time as number, timeUnit),
      joints
    }
  })

  const trajectory: Trajectory = { version: 1, keyframes }
  validateTrajectory(workcell, trajectory)
  return {
    trajectory,
    sourceUnits: { time: timeUnit, joints: { ...units } }
  }
}
