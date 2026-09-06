import * as THREE from 'three'
import { expect, it } from 'vitest'
import type {
  SpatialCamera,
  SpatialFrame,
  SpatialMesh
} from '../../../render-app/spatial-layer'
import { DEFAULT_CAMERA } from '../../../render-app/workcell-frame'
import {
  fitCameraToMeshes,
  panCamera,
  VIEWPORT_PADDING
} from '../viewport-camera'

function project(
  camera: SpatialCamera,
  point: readonly number[],
  width: number,
  height: number
) {
  const view = new THREE.PerspectiveCamera(
    camera.fov,
    width / height,
    camera.near,
    camera.far
  )

  view.position.set(...camera.position)

  view.lookAt(new THREE.Vector3(...camera.target))

  view.updateMatrixWorld()

  const p = new THREE.Vector3(point[0], point[1], point[2]).project(view)

  return [((p.x + 1) * width) / 2, ((1 - p.y) * height) / 2, p.z]
}

function mesh(
  shape: SpatialMesh['shape'],
  position: SpatialMesh['position'] = [0, 0, 0]
): SpatialFrame['meshes'][number] {
  return {
    id: 'part',
    visible: true,
    elementId: 'body',
    descriptor: {
      kind: 'mesh',
      shape,
      position,
      rotation: [0, 0, 0, 1],
      color: 0xffffff,
      opacity: 1,
      wireframe: false,
      selectable: true
    }
  }
}

it.each([300, 600, 1200])(
  'pans by exact CSS pixels at height %i without changing view direction or scale',
  (height) => {
    const camera = structuredClone(DEFAULT_CAMERA)

    const next = panCamera(camera, 83, -51, height)

    const p = project(next, camera.target, 800, height)

    expect(p[0]).toBeCloseTo(400 + 83, 9)

    expect(p[1]).toBeCloseTo(height / 2 - 51, 9)

    expect(next.fov).toBe(camera.fov)

    next.position.forEach((v, i) =>
      expect(v - next.target[i]).toBeCloseTo(
        camera.position[i] - camera.target[i],
        12
      )
    )

    expect(camera).toEqual(DEFAULT_CAMERA)
  }
)

it.each([
  [300, 900],
  [1400, 500],
  [800, 800]
])(
  'fits rotated original triangles with padding inside %j',
  (width, height) => {
    const part = mesh(
      {
        kind: 'triangles',
        positions: [-2, -1, -3, 4, 1, -1, 0, 6, 5, 1e5, 1e5, 1e5],
        indices: [0, 1, 2]
      },
      [18, 7, -9]
    )

    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      0.7
    )

    part.descriptor.rotation = [q.x, q.y, q.z, q.w]

    const ignored = mesh({ kind: 'box', size: [1e4, 1e4, 1e4] })

    ignored.descriptor.selectable = false

    const hidden = mesh({ kind: 'sphere', radius: 1e4 })

    hidden.visible = false

    const next = fitCameraToMeshes(
      DEFAULT_CAMERA,
      [part, ignored, hidden],
      width,
      height
    )

    expect(next).not.toBe(DEFAULT_CAMERA)

    const positions = (
      part.descriptor.shape as Extract<
        SpatialMesh['shape'],
        { kind: 'triangles' }
      >
    ).positions

    const projected = [0, 1, 2].map((i) => {
      const world = new THREE.Vector3(...positions.slice(i * 3, i * 3 + 3))
        .applyQuaternion(q)
        .add(new THREE.Vector3(...part.descriptor.position))

      return project(next, world.toArray(), width, height)
    })

    for (const [x, y, depth] of projected) {
      expect(x).toBeGreaterThanOrEqual(VIEWPORT_PADDING - 1e-8)

      expect(x).toBeLessThanOrEqual(width - VIEWPORT_PADDING + 1e-8)

      expect(y).toBeGreaterThanOrEqual(VIEWPORT_PADDING - 1e-8)

      expect(y).toBeLessThanOrEqual(height - VIEWPORT_PADDING + 1e-8)

      expect(depth).toBeGreaterThan(-1)

      expect(depth).toBeLessThan(1)
    }

    expect(
      new THREE.Vector3(...next.position).distanceTo(
        new THREE.Vector3(...next.target)
      )
    ).toBeLessThan(100)

    const direction = new THREE.Vector3(...next.position)
      .sub(new THREE.Vector3(...next.target))
      .normalize()

    const original = new THREE.Vector3(...DEFAULT_CAMERA.position)
      .sub(new THREE.Vector3(...DEFAULT_CAMERA.target))
      .normalize()

    expect(direction.distanceTo(original)).toBeLessThan(1e-12)
  }
)

it.each(['box', 'sphere', 'capsule'] as const)(
  'fits complete native %s extents and adjusts clipping for large parts',
  (kind) => {
    let shape: SpatialMesh['shape'] = { kind: 'box', size: [1000, 3000, 500] }

    if (kind === 'sphere') shape = { kind, radius: 1500 }

    if (kind === 'capsule') shape = { kind, radius: 500, length: 2000 }

    const part = mesh(shape)

    const next = fitCameraToMeshes(DEFAULT_CAMERA, [part], 800, 600)

    expect(next.far).toBeGreaterThan(DEFAULT_CAMERA.far)

    expect(project(next, [0, 1500, 0], 800, 600)[1]).toBeGreaterThanOrEqual(
      VIEWPORT_PADDING - 1e-8
    )

    expect(project(next, [0, -1500, 0], 800, 600)[1]).toBeLessThanOrEqual(
      600 - VIEWPORT_PADDING + 1e-8
    )
  }
)

it('leaves empty and unusably small viewports unchanged', () => {
  const part = mesh({ kind: 'sphere', radius: 1 })

  expect(fitCameraToMeshes(DEFAULT_CAMERA, [], 800, 600)).toBe(DEFAULT_CAMERA)

  expect(fitCameraToMeshes(DEFAULT_CAMERA, [part], 0, 600)).toBe(DEFAULT_CAMERA)

  expect(
    fitCameraToMeshes(DEFAULT_CAMERA, [part], 800, 2 * VIEWPORT_PADDING)
  ).toBe(DEFAULT_CAMERA)

  expect(panCamera(DEFAULT_CAMERA, 10, 20, 0)).toBe(DEFAULT_CAMERA)
})
