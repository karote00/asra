import { IDENTITY_POSE, compose, type Vec3 } from '../domain/math'
import { forwardKinematics, type Body, type Workcell } from '../domain/workcell'
import type { SpatialCamera, SpatialFrame, SpatialMesh } from './spatial-layer'

export interface WorkcellView {
  camera: SpatialCamera
  selectedId: string | null
  joints?: Readonly<Record<string, number>>
  grid: boolean
}
export const DEFAULT_CAMERA: SpatialCamera = {
  kind: 'camera',
  position: [3.2, 2.4, 3.6],
  target: [0, 0.9, 0],
  fov: 46,
  near: 0.005,
  far: 200
}

export function createWorkcellFrame(
  workcell: Workcell,
  view: WorkcellView
): SpatialFrame {
  const poses = forwardKinematics(workcell, view.joints),
    meshes: SpatialFrame['meshes'][number][] = []
  const bodies = new Map(workcell.bodies.map((body) => [body.id, body]))
  const visible = (body: Body): boolean => {
    let current: Body | undefined = body
    while (current) {
      if (!current.visible) return false
      current =
        current.parentId === null ? undefined : bodies.get(current.parentId)
    }
    return true
  }
  if (view.grid) {
    const decoration = (
      id: string,
      position: Vec3,
      size: Vec3,
      color: number
    ): void => {
      meshes.push({
        id,
        visible: true,
        descriptor: {
          kind: 'mesh',
          position,
          rotation: IDENTITY_POSE.rotation,
          shape: { kind: 'box', size },
          color,
          opacity: 1,
          wireframe: false,
          selectable: false
        }
      })
    }
    decoration('workspace:floor', [0, -0.018, 0], [6, 0.02, 6], 0x1b2b37)
    for (let index = -6; index <= 6; index++) {
      decoration(
        `workspace:grid-x:${index}`,
        [index / 2, -0.006, 0],
        [0.003, 0.001, 6],
        index === 0 ? 0x677b8a : 0x2c414e
      )
      decoration(
        `workspace:grid-z:${index}`,
        [0, -0.006, index / 2],
        [6, 0.001, 0.003],
        index === 0 ? 0x677b8a : 0x2c414e
      )
    }
  }
  for (const body of workcell.bodies) {
    const bodyPose = poses.get(body.id)
    if (!bodyPose) throw new Error('Missing domain pose for projection')
    for (const collider of body.colliders) {
      const pose = compose(bodyPose, collider.pose)
      const descriptor: SpatialMesh = {
        kind: 'mesh',
        position: pose.position,
        rotation: pose.rotation,
        shape: collider.geometry,
        color: body.id === view.selectedId ? 0x62e6c1 : body.color,
        opacity: 1,
        wireframe: false,
        selectable: true
      }
      meshes.push({
        id: `${body.id}/${collider.id}`,
        elementId: body.id,
        descriptor,
        visible: visible(body)
      })
    }
  }
  return { camera: structuredClone(view.camera), meshes }
}
