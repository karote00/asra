import earcut from 'earcut'
import {
  getPointDistanceSquared,
  type Bounds,
  type PositionData
} from '@asyra/utils'
import { RenderContainer, RenderMesh } from '../types/render-object'

export type GeometryPoint = PositionData

export interface GeometryModel {
  polygons: GeometryPoint[][]
  bounds?: Bounds
}

export interface MeshProjectionPaintSolid {
  kind: 'solid'
  color: number
  alpha: number
}

export type MeshProjectionPaint = MeshProjectionPaintSolid

export interface CreateMeshProjectionOptions {
  model: GeometryModel
  paint: MeshProjectionPaint
}

export interface MeshProjection {
  attach: (host: unknown) => boolean
  update: (options: CreateMeshProjectionOptions) => void
  updatePaint: (paint: MeshProjectionPaint) => void
  setVisible: (visible: boolean) => void
  dispose: () => void
}

export interface ProjectionMeshData {
  vertices: Float32Array
  indices: Uint32Array
  uvs: Float32Array
  bounds: Bounds
}

const EMPTY_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: 0,
  maxY: 0
}

const getModelBounds = (model: GeometryModel) => {
  if (model.bounds) {
    return model.bounds
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  model.polygons.forEach((polygon) =>
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  )

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return EMPTY_BOUNDS
  }

  return {
    minX,
    minY,
    maxX,
    maxY
  }
}

const DEDUPE_DISTANCE_EPSILON_SQUARED = 1e-12

const normalizePolygon = (polygon: GeometryPoint[]) => {
  const deduped: GeometryPoint[] = []
  polygon.forEach((point) => {
    const previous = deduped[deduped.length - 1]
    if (
      !previous ||
      getPointDistanceSquared(previous, point) > DEDUPE_DISTANCE_EPSILON_SQUARED
    ) {
      deduped.push(point)
    }
  })

  if (
    deduped.length > 2 &&
    getPointDistanceSquared(deduped[0], deduped[deduped.length - 1]) <=
      DEDUPE_DISTANCE_EPSILON_SQUARED
  ) {
    deduped.pop()
  }

  return deduped
}

const getCrossProduct = (
  a: GeometryPoint,
  b: GeometryPoint,
  c: GeometryPoint
) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)

const isConvexPolygon = (polygon: GeometryPoint[]) => {
  if (polygon.length < 3) {
    return false
  }

  let sign = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const cross = getCrossProduct(
      polygon[index],
      polygon[(index + 1) % polygon.length],
      polygon[(index + 2) % polygon.length]
    )
    if (Math.abs(cross) <= 1e-8) {
      continue
    }
    const currentSign = Math.sign(cross)
    if (sign === 0) {
      sign = currentSign
      continue
    }
    if (sign !== currentSign) {
      return false
    }
  }

  return sign !== 0
}

const appendConvexFanTriangulation = (
  polygon: GeometryPoint[],
  vertexOffset: number,
  indices: number[]
) => {
  for (let index = 1; index < polygon.length - 1; index += 1) {
    indices.push(vertexOffset, vertexOffset + index, vertexOffset + index + 1)
  }
}

const triangulatePolygon = (
  polygon: GeometryPoint[],
  vertexOffset: number,
  vertices: number[],
  indices: number[]
) => {
  const normalizedPolygon = normalizePolygon(polygon)
  if (normalizedPolygon.length < 3) {
    return
  }

  if (isConvexPolygon(normalizedPolygon)) {
    normalizedPolygon.forEach((point) => {
      vertices.push(point.x, point.y)
    })
    appendConvexFanTriangulation(normalizedPolygon, vertexOffset, indices)
    return
  }

  const flatPolygon: number[] = []
  normalizedPolygon.forEach((point) => {
    flatPolygon.push(point.x, point.y)
  })

  const polygonIndices = earcut(flatPolygon)
  if (polygonIndices.length < 3) {
    return
  }

  vertices.push(...flatPolygon)
  polygonIndices.forEach((index) => {
    indices.push(vertexOffset + index)
  })
}

export const buildProjectionMeshData = (
  model: GeometryModel
): ProjectionMeshData | null => {
  const vertices: number[] = []
  const indices: number[] = []

  model.polygons.forEach((polygon) => {
    const vertexOffset = vertices.length / 2
    triangulatePolygon(polygon, vertexOffset, vertices, indices)
  })

  if (vertices.length === 0 || indices.length === 0) {
    return null
  }

  const bounds = getModelBounds(model)
  const width = Math.max(1e-6, bounds.maxX - bounds.minX)
  const height = Math.max(1e-6, bounds.maxY - bounds.minY)
  const uvs = new Float32Array(vertices.length)

  for (let i = 0; i < vertices.length; i += 2) {
    uvs[i] = (vertices[i] - bounds.minX) / width
    uvs[i + 1] = (vertices[i + 1] - bounds.minY) / height
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    uvs,
    bounds
  }
}

const toRenderMeshGeometry = (meshData: ProjectionMeshData) => ({
  positions: meshData.vertices,
  indices: meshData.indices,
  uvs: meshData.uvs
})

export const createMeshProjection = (
  options: CreateMeshProjectionOptions
): MeshProjection => {
  const initialGeometry = buildProjectionMeshData(options.model)
  const root = new RenderContainer()
  const mesh = new RenderMesh({
    geometry: initialGeometry
      ? toRenderMeshGeometry(initialGeometry)
      : {
          positions: new Float32Array(0),
          indices: new Uint32Array(0),
          uvs: new Float32Array(0)
        }
  })
  root.addChild(mesh)

  const applyPaint = (paint: MeshProjectionPaint) => {
    mesh.update({
      tint: paint.color,
      alpha: paint.alpha
    })
  }

  const update = (next: CreateMeshProjectionOptions) => {
    const geometry = buildProjectionMeshData(next.model)
    if (!geometry) {
      root.visible = false
      applyPaint(next.paint)
      return
    }

    root.visible = true
    mesh.update({
      geometry: toRenderMeshGeometry(geometry),
      tint: next.paint.color,
      alpha: next.paint.alpha
    })
  }

  applyPaint(options.paint)
  root.visible = !!initialGeometry

  return {
    attach: (host: unknown) => {
      if (!(host instanceof RenderContainer)) {
        return false
      }

      if (root.parent !== host) {
        host.addChild(root)
      }

      return true
    },
    update,
    updatePaint: applyPaint,
    setVisible: (visible: boolean) => {
      root.visible = visible
    },
    dispose: () => {
      if (root.parent) {
        root.parent.removeChild(root)
      }
      root.visible = false
      root.destroy()
    }
  }
}
