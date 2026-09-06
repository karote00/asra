import { Vector3 } from 'three'
import { BinaryAccess, readContainer } from './binary'
import { appearance, sceneNodes } from './scene'
import { GLB_LIMITS, integer, list, name, record } from './schema'

export interface VisualAsset {
  readonly format: 'restricted-glb-v0'
  readonly source: {
    readonly sha256: string
    readonly byteLength: number
    readonly lengthUnit: 'm'
  }
  readonly meshes: readonly {
    readonly name: string
    readonly sourceNode: number
    readonly positions: readonly number[]
    readonly indices: readonly number[]
    readonly color: number
    readonly opacity: number
  }[]
  readonly bounds: {
    readonly min: readonly [number, number, number]
    readonly max: readonly [number, number, number]
  }
}

/** Pure asset decoding: no network, canonical state, rendering, or analysis proxies. */
export async function decodeRestrictedGlb(
  input: Uint8Array
): Promise<VisualAsset> {
  if (input.byteLength > GLB_LIMITS.bytes)
    throw new Error('GLB byte limit exceeded')
  const bytes = new Uint8Array(input),
    { json, binary } = readContainer(bytes),
    access = new BinaryAccess(json, binary)
  const meshes = list(json.meshes, 'meshes', GLB_LIMITS.meshes, 1),
    materials = list(json.materials ?? [], 'materials', GLB_LIMITS.meshes).map(
      appearance
    )
  const output: VisualAsset['meshes'][number][] = [],
    usedMeshes = new Set<number>()
  const min: [number, number, number] = [Infinity, Infinity, Infinity],
    max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  let totalVertices = 0,
    totalIndices = 0
  for (const { node, matrix, index: nodeIndex } of sceneNodes(json)) {
    if (node.mesh === undefined) continue
    const meshIndex = integer(node.mesh, 'mesh index', meshes.length - 1),
      mesh = record(meshes[meshIndex], 'mesh')
    usedMeshes.add(meshIndex)
    for (const raw of list(
      mesh.primitives,
      'primitives',
      GLB_LIMITS.primitives,
      1
    )) {
      if (output.length >= GLB_LIMITS.primitives)
        throw new Error('Expanded primitive limit exceeded')
      const primitive = record(raw, 'primitive'),
        attributes = record(primitive.attributes, 'attributes')
      if (primitive.mode !== undefined && primitive.mode !== 4)
        throw new Error('Only triangle primitives are supported')
      const position = access.describe(attributes.POSITION, 3)
      const indexAccessor =
        primitive.indices === undefined
          ? undefined
          : access.describe(primitive.indices, 1, true)
      totalVertices += position.count
      totalIndices += indexAccessor?.count ?? position.count
      if (
        totalVertices > GLB_LIMITS.vertices ||
        totalIndices > GLB_LIMITS.indices
      )
        throw new Error('Expanded geometry limit exceeded')
      for (const [key, index] of Object.entries(attributes)) {
        if (key === 'POSITION') continue
        const components = (
          { NORMAL: 3, TANGENT: 4, TEXCOORD_0: 2 } as Record<string, number>
        )[key]
        if (!components) throw new Error(`Unsupported vertex attribute: ${key}`)
        const attribute = access.describe(index, components)
        if (attribute.count !== position.count)
          throw new Error('Inconsistent vertex attribute count')
        access.values(attribute)
      }
      const positions = access.values(position),
        indices = indexAccessor
          ? access.values(indexAccessor)
          : Array.from({ length: position.count }, (_, i) => i)
      if (
        indices.length < 3 ||
        indices.length % 3 !== 0 ||
        indices.some((index) => index >= position.count)
      )
        throw new Error('Invalid triangle indices')
      for (let index = 0; index < positions.length; index += 3) {
        const point = new Vector3(
          positions[index],
          positions[index + 1],
          positions[index + 2]
        ).applyMatrix4(matrix)
        const values = point.toArray()
        for (let axis = 0; axis < 3; axis++) {
          const value = values[axis]
          if (
            !Number.isFinite(value) ||
            Math.abs(value) > GLB_LIMITS.coordinate
          )
            throw new Error('Baked geometry exceeds the coordinate profile')
          positions[index + axis] = value
          min[axis] = Math.min(min[axis], value)
          max[axis] = Math.max(max[axis], value)
        }
      }
      const style =
        primitive.material === undefined
          ? appearance(undefined)
          : materials[
              integer(
                primitive.material,
                'material index',
                materials.length - 1
              )
            ]
      output.push(
        Object.freeze({
          name: name(node.name ?? mesh.name, `Mesh ${meshIndex + 1}`),
          sourceNode: nodeIndex,
          positions: Object.freeze(positions),
          indices: Object.freeze(indices),
          ...style
        })
      )
    }
  }
  if (!output.length || usedMeshes.size !== meshes.length)
    throw new Error('Empty or unused mesh content is unsupported')
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Object.freeze({
    format: 'restricted-glb-v0',
    source: Object.freeze({
      sha256: Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, '0')
      ).join(''),
      byteLength: bytes.byteLength,
      lengthUnit: 'm'
    }),
    meshes: Object.freeze(output),
    bounds: Object.freeze({ min: Object.freeze(min), max: Object.freeze(max) })
  })
}
