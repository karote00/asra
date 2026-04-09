import { Container, Mesh, MeshGeometry, Texture, earcut } from 'pixi.js'

export interface GeometryPoint {
  x: number
  y: number
}

export interface GeometryModel {
  polygons: GeometryPoint[][]
  bounds?: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
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
  setVisible: (visible: boolean) => void
  dispose: () => void
}

export interface ProjectionMeshData {
  vertices: Float32Array
  indices: Uint32Array
  uvs: Float32Array
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
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

const triangulatePolygon = (
  polygon: GeometryPoint[],
  vertexOffset: number,
  vertices: number[],
  indices: number[]
) => {
  if (polygon.length < 3) {
    return
  }

  const flatPolygon: number[] = []
  polygon.forEach((point) => {
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

const createGeometry = (model: GeometryModel) => {
  const meshData = buildProjectionMeshData(model)
  if (!meshData) {
    return null
  }

  return new MeshGeometry({
    positions: meshData.vertices,
    indices: meshData.indices,
    uvs: meshData.uvs
  })
}

export const createMeshProjection = (
  options: CreateMeshProjectionOptions
): MeshProjection => {
  const initialGeometry = createGeometry(options.model)
  const root = new Container()
  const mesh = new Mesh({
    geometry:
      initialGeometry ??
      new MeshGeometry({
        positions: new Float32Array(0),
        indices: new Uint32Array(0),
        uvs: new Float32Array(0)
      }),
    texture: Texture.WHITE
  })
  root.addChild(mesh)

  const applyPaint = (paint: MeshProjectionPaint) => {
    const solid = paint as MeshProjectionPaintSolid
    mesh.tint = solid.color
    mesh.alpha = solid.alpha
  }

  const update = (next: CreateMeshProjectionOptions) => {
    const nextGeometry = createGeometry(next.model)
    const previousGeometry = mesh.geometry

    if (!nextGeometry) {
      root.visible = false
      applyPaint(next.paint)
      return
    }

    mesh.geometry = nextGeometry
    root.visible = true
    applyPaint(next.paint)

    if (previousGeometry !== nextGeometry) {
      previousGeometry.destroy()
    }
  }

  applyPaint(options.paint)
  root.visible = !!initialGeometry

  return {
    attach: (host: unknown) => {
      if (!(host instanceof Container)) {
        return false
      }

      if (root.parent !== host) {
        host.addChild(root)
      }

      return true
    },
    update,
    setVisible: (visible: boolean) => {
      root.visible = visible
    },
    dispose: () => {
      if (root.parent) {
        root.parent.removeChild(root)
      }
      root.destroy({
        texture: false,
        textureSource: false
      })
    }
  }
}
