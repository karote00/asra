import {
  RenderContainer,
  RenderMesh,
  type RenderLayerRegistration
} from '@asyra/render'
import {
  SPATIAL_PROPERTY,
  readSpatialDescriptor,
  type SpatialDescriptor
} from '../engine/spatial-contract'

export const SPATIAL_LAYER_NAME = 'asyra-sim.spatial-layer'
export type SpatialCamera = Extract<SpatialDescriptor, { kind: 'camera' }>
export type SpatialMesh = Extract<SpatialDescriptor, { kind: 'mesh' }>
export interface SpatialFrame {
  camera: SpatialCamera
  meshes: readonly {
    id: string
    elementId?: string
    descriptor: SpatialMesh
    visible: boolean
  }[]
}

class CameraProjection extends RenderContainer {
  constructor(private descriptor: SpatialCamera) {
    super()
  }
  override getEngineProperties() {
    return {
      ...super.getEngineProperties(),
      [SPATIAL_PROPERTY]: this.descriptor
    }
  }
  update(descriptor: SpatialCamera): void {
    this.descriptor = descriptor
    this.updateEngineProperties({ [SPATIAL_PROPERTY]: descriptor })
  }
}

/** Derived output only. Callers own the canonical model and shared pose evaluation. */
export class SpatialLayer {
  readonly registration: RenderLayerRegistration
  private readonly layer = new RenderContainer()
  private readonly meshes = new Map<string, RenderMesh>()
  private camera: CameraProjection | null = null
  private pending: SpatialFrame | null = null
  private destroyed = false

  constructor(private readonly invalidate: () => void) {
    this.layer.label = SPATIAL_LAYER_NAME
    this.registration = {
      name: SPATIAL_LAYER_NAME,
      layer: this.layer,
      zIndex: 0,
      shouldUpdate: () => this.pending !== null,
      update: () => this.flush()
    }
  }

  submit(frame: SpatialFrame): void {
    if (this.destroyed) throw new Error('Spatial layer is disposed')
    const camera = readSpatialDescriptor(frame.camera)
    if (camera.kind !== 'camera') throw new Error('Expected a camera')
    const ids = new Set<string>()
    const meshes = frame.meshes.map((item) => {
      if (!item.id || ids.has(item.id))
        throw new Error('Spatial identities must be nonempty and unique')
      if (
        item.elementId !== undefined &&
        (typeof item.elementId !== 'string' || !item.elementId)
      )
        throw new Error('Invalid projected element identity')
      ids.add(item.id)
      const descriptor = readSpatialDescriptor(item.descriptor)
      if (descriptor.kind !== 'mesh' || typeof item.visible !== 'boolean')
        throw new Error('Expected a mesh projection')
      return {
        id: item.id,
        elementId: item.elementId,
        descriptor,
        visible: item.visible
      }
    })
    this.pending = { camera, meshes }
    this.invalidate()
  }

  dispose(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.pending = null
    this.meshes.forEach((mesh) => mesh.destroy())
    this.meshes.clear()
    this.camera?.destroy()
    this.camera = null
    this.layer.destroy()
  }

  private flush(): boolean {
    const frame = this.pending
    if (!frame || this.destroyed) return false
    if (!this.camera) {
      this.camera = new CameraProjection(frame.camera)
      this.layer.addChild(this.camera)
    } else this.camera.update(frame.camera)
    const ids = new Set(frame.meshes.map((mesh) => mesh.id))
    for (const [id, mesh] of this.meshes) {
      if (!ids.has(id)) {
        mesh.destroy()
        this.meshes.delete(id)
      }
    }
    for (const item of frame.meshes) {
      let mesh = this.meshes.get(item.id)
      if (!mesh) {
        mesh = new RenderMesh({ [SPATIAL_PROPERTY]: item.descriptor })
        mesh.label = item.elementId ?? item.id
        this.layer.addChild(mesh)
        this.meshes.set(item.id, mesh)
      } else mesh.update({ [SPATIAL_PROPERTY]: item.descriptor })
      mesh.label = item.elementId ?? item.id
      mesh.visible = item.visible
    }
    this.pending = null
    return true
  }
}
