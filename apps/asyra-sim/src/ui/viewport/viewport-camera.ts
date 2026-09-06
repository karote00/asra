import {
  add,
  cross,
  dot,
  magnitude,
  normalize,
  scale,
  subtract,
  transformPoint,
  type Vec3
} from '../../domain/math'
import type {
  SpatialCamera,
  SpatialFrame
} from '../../render-app/spatial-layer'

export const VIEWPORT_PADDING = 32

const WHEEL_LINE_PIXELS = 16

/** Two-finger scroll, mouse wheel and Chromium pinch share target-centered zoom. */
export function wheelCamera(
  camera: SpatialCamera,
  event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode'>,
  height: number
): SpatialCamera {
  if (
    !Number.isFinite(height) ||
    height <= 0 ||
    ![event.deltaX, event.deltaY].every(Number.isFinite)
  )
    return camera

  let dy = event.deltaY

  if (event.deltaMode === 1) {
    dy *= WHEEL_LINE_PIXELS
  } else if (event.deltaMode === 2) {
    dy *= height
  }

  if (!dy) return camera

  const offset = subtract(camera.position, camera.target)

  const radius = magnitude(offset)

  const next = Math.max(
    0.15,
    radius * Math.exp(Math.max(-100, Math.min(100, dy)) * 0.002)
  )

  return {
    ...camera,
    far: camera.far + Math.max(0, next - radius),
    position: add(camera.target, scale(offset, next / radius))
  }
}

function basis(camera: SpatialCamera) {
  const back = normalize(subtract(camera.position, camera.target))

  const right = normalize(cross([0, 1, 0], back))

  return { back, right, up: cross(back, right) }
}

/** Translate the eye and target together in the target's screen plane. */
export function panCamera(
  camera: SpatialCamera,
  dx: number,
  dy: number,
  height: number
): SpatialCamera {
  if (!Number.isFinite(height) || height <= 0) return camera

  const { right, up } = basis(camera)

  const pixelSize =
    (2 *
      magnitude(subtract(camera.position, camera.target)) *
      Math.tan((camera.fov * Math.PI) / 360)) /
    height

  const offset = add(scale(right, -dx * pixelSize), scale(up, dy * pixelSize))

  return {
    ...camera,
    position: add(camera.position, offset),
    target: add(camera.target, offset)
  }
}

/** Display framing only: these bounds never enter the collision method. */
export function fitCameraToMeshes(
  camera: SpatialCamera,
  meshes: SpatialFrame['meshes'],
  width: number,
  height: number
): SpatialCamera {
  if (
    ![width, height].every(
      (value) => Number.isFinite(value) && value > 2 * VIEWPORT_PADDING
    )
  )
    return camera

  const { right, up, back } = basis(camera)

  const min = [Infinity, Infinity, Infinity]

  const max = [-Infinity, -Infinity, -Infinity]

  let points = 0

  for (const { visible, descriptor } of meshes) {
    if (!visible || !descriptor.selectable) continue

    const include = (local: Vec3) => {
      const world = transformPoint(descriptor, local)

      const p = [dot(world, right), dot(world, up), dot(world, back)]

      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], p[i])

        max[i] = Math.max(max[i], p[i])
      }

      points++
    }

    const shape = descriptor.shape

    if (shape.kind === 'triangles') {
      for (const index of shape.indices) {
        const offset = index * 3

        include([
          shape.positions[offset],
          shape.positions[offset + 1],
          shape.positions[offset + 2]
        ])
      }
    } else {
      let half: Vec3

      if (shape.kind === 'box') half = scale(shape.size, 0.5)
      else if (shape.kind === 'capsule')
        half = [shape.radius, shape.length / 2 + shape.radius, shape.radius]
      else half = [shape.radius, shape.radius, shape.radius]

      for (const x of [-half[0], half[0]])
        for (const y of [-half[1], half[1]])
          for (const z of [-half[2], half[2]]) include([x, y, z])
    }
  }

  if (!points) return camera

  const middle = min.map((v, i) => v + (max[i] - v) / 2)

  const half = min.map((v, i) => (max[i] - v) / 2)

  const target = add(
    add(scale(right, middle[0]), scale(up, middle[1])),
    scale(back, middle[2])
  )

  const tanY = Math.tan((camera.fov * Math.PI) / 360)

  const distance =
    half[2] +
    Math.max(
      0.15,
      half[0] /
        (((tanY * width) / height) * (1 - (2 * VIEWPORT_PADDING) / width)),
      half[1] / (tanY * (1 - (2 * VIEWPORT_PADDING) / height))
    )

  return {
    ...camera,
    target,
    position: add(target, scale(back, distance)),
    near: Math.min(camera.near, (distance - half[2]) / 2),
    far: Math.max(camera.far, distance + half[2] + Math.max(1, distance * 0.01))
  }
}
