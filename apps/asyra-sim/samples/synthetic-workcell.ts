import { IDENTITY_POSE, type Vec3 } from '../src/domain/math'
import {
  validIdentifier,
  validateTrajectory,
  validateWorkcell,
  type Body,
  type Collider,
  type Trajectory,
  type Workcell
} from '../src/domain/workcell'

export interface SyntheticExample {
  workcell: Workcell
  trajectory: Trajectory
  excludedPairs: readonly { a: string; b: string; reason: string }[]
  source: {
    kind: 'synthetic'
    version: '2'
    lengthUnit: 'm'
    angleUnit: 'rad'
    timeUnit: 's'
  }
}

/** Public, invented geometry. Not a vendor model or a controller path. */
export function createSyntheticExample(
  namespace = 'example'
): SyntheticExample {
  if (!validIdentifier(namespace) || namespace.length > 60)
    throw new Error('Invalid example namespace')
  const id = (name: string) => `${namespace}:${name}`
  const box = (size: Vec3): Collider => ({
    id: 'shape',
    pose: IDENTITY_POSE,
    geometry: { kind: 'box', size }
  })
  const fixed = (
    name: string,
    role: Body['role'],
    position: Vec3,
    colliders: Collider[],
    parent: string | null = null
  ): Body => ({
    id: id(name),
    name: name.replaceAll('-', ' '),
    role,
    parentId: parent,
    pose: { ...IDENTITY_POSE, position },
    joint: { kind: 'fixed', axis: [0, 1, 0], value: 0, min: 0, max: 0 },
    colliders,
    visible: true,
    color: 0x78969c
  })
  const base = fixed('base', 'robot', [0, 0.12, 0], [box([0.46, 0.24, 0.46])])
  base.color = 0x243c4d
  const lengths = [0.5, 0.65, 0.5, 0.18, 0.14, 0.1],
    axes: Vec3[] = [
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, 1],
      [0, 1, 0],
      [0, 0, 1],
      [0, 1, 0]
    ],
    initial = [0, -1.05, 1.55, 0, 0.6, 0]
  const links: Body[] = lengths.map((length, index) => ({
    ...fixed(
      `joint-${index + 1}`,
      'link',
      [0, index === 0 ? 0.12 : lengths[index - 1], 0],
      [
        {
          id: 'shape',
          pose: { ...IDENTITY_POSE, position: [0, length / 2, 0] },
          geometry: {
            kind: 'capsule',
            radius: Math.min(index < 3 ? 0.085 : 0.055, length / 2),
            length: Math.max(0, length - 2 * (index < 3 ? 0.085 : 0.055))
          }
        }
      ],
      index === 0 ? base.id : id(`joint-${index}`)
    ),
    name: `J${index + 1} - ${['Base yaw', 'Shoulder', 'Elbow', 'Wrist roll', 'Wrist bend', 'Tool roll'][index]}`,
    joint: {
      kind: 'revolute',
      axis: axes[index],
      value: initial[index],
      min: -Math.PI * 2,
      max: Math.PI * 2
    },
    color: index % 2 === 0 ? 0xef9d40 : 0xc8792d
  }))
  const tool = fixed(
    'gripper',
    'tool',
    [0, 0.1, 0],
    [
      {
        ...box([0.18, 0.06, 0.1]),
        id: 'palm',
        pose: { ...IDENTITY_POSE, position: [0, 0.03, 0] }
      },
      ...[-1, 1].map((side) => ({
        ...box([0.027, 0.12, 0.07]),
        id: side < 0 ? 'left-finger' : 'right-finger',
        pose: { ...IDENTITY_POSE, position: [side * 0.072, 0.12, 0] as Vec3 }
      }))
    ],
    links[5].id
  )
  tool.color = 0x3f7883
  const workpiece = fixed(
    'workpiece',
    'workpiece',
    [0, 0.13, 0],
    [box([0.11, 0.075, 0.08])],
    tool.id
  )
  workpiece.color = 0x3bc3b1
  const table = fixed(
    'fixture-table',
    'fixture',
    [0.9, 0.55, 0],
    [box([0.75, 0.12, 0.6])]
  )
  const post = fixed(
    'fixture-post',
    'fixture',
    [-0.75, 0.65, 0.45],
    [box([0.14, 1.3, 0.14])]
  )
  post.color = 0xa8b5ba
  const workcell: Workcell = {
    version: 1,
    robotRootId: base.id,
    bodies: [base, ...links, tool, workpiece, table, post]
  }
  const trajectory: Trajectory = {
    version: 1,
    keyframes: [
      {
        time: 0,
        joints: Object.fromEntries(
          links.map((body) => [body.id, body.joint.value])
        )
      },
      {
        time: 4,
        joints: Object.fromEntries(
          links.map((body, index) => [
            body.id,
            index === 0 ? 1.1 : body.joint.value
          ])
        )
      },
      {
        time: 8,
        joints: Object.fromEntries(
          links.map((body, index) => [
            body.id,
            index === 0 ? -0.8 : body.joint.value
          ])
        )
      }
    ]
  }
  validateWorkcell(workcell)
  validateTrajectory(workcell, trajectory)
  const attached = [base, ...links, tool, workpiece]
  return {
    workcell,
    trajectory,
    excludedPairs: attached.slice(1).map((body, index) => ({
      a: attached[index].id,
      b: body.id,
      reason:
        'Synthetic adjacent mounting interface; explicitly excluded, not certified safe.'
    })),
    source: {
      kind: 'synthetic',
      version: '2',
      lengthUnit: 'm',
      angleUnit: 'rad',
      timeUnit: 's'
    }
  }
}
