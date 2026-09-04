import {
  Color,
  LinearSRGBColorSpace,
  Matrix4,
  Quaternion,
  Vector3
} from 'three'
import {
  GLB_LIMITS,
  integer,
  list,
  record,
  tuple,
  type JsonRecord
} from './schema'

export function nodeTransform(node: JsonRecord): Matrix4 {
  const matrix = new Matrix4()
  if (node.matrix !== undefined) {
    if (
      node.translation !== undefined ||
      node.rotation !== undefined ||
      node.scale !== undefined
    )
      throw new Error('Node cannot combine matrix and TRS')
    const m = tuple(node.matrix, 16, 'node matrix')
    if (m[3] !== 0 || m[7] !== 0 || m[11] !== 0 || m[15] !== 1)
      throw new Error('Unsupported projective node matrix')
    const columns = [
      new Vector3(...m.slice(0, 3)),
      new Vector3(...m.slice(4, 7)),
      new Vector3(...m.slice(8, 11))
    ]
    if (columns.some((column) => column.length() < 1e-9))
      throw new Error('Singular node transform')
    const unit = columns.map((column) => column.clone().normalize())
    if (
      Math.abs(unit[0].dot(unit[1])) > 1e-8 ||
      Math.abs(unit[0].dot(unit[2])) > 1e-8 ||
      Math.abs(unit[1].dot(unit[2])) > 1e-8
    )
      throw new Error('Unsupported sheared node matrix')
    matrix.fromArray(m)
  } else {
    const t = tuple(node.translation ?? [0, 0, 0], 3, 'node translation'),
      r = tuple(node.rotation ?? [0, 0, 0, 1], 4, 'node rotation'),
      s = tuple(node.scale ?? [1, 1, 1], 3, 'node scale')
    if (s.some((value) => value <= 0) || Math.abs(Math.hypot(...r) - 1) > 1e-8)
      throw new Error('Invalid node scale or rotation')
    matrix.compose(
      new Vector3(...t),
      new Quaternion(...r).normalize(),
      new Vector3(...s)
    )
  }
  if (!Number.isFinite(matrix.determinant()) || matrix.determinant() <= 0)
    throw new Error('Negative or singular node transform')
  return matrix
}

export function sceneNodes(
  json: JsonRecord
): { node: JsonRecord; matrix: Matrix4; index: number }[] {
  const nodes = list(json.nodes, 'nodes', GLB_LIMITS.nodes, 1),
    scene = record(list(json.scenes, 'scenes', 1, 1)[0], 'scene')
  if (json.scene !== undefined && json.scene !== 0)
    throw new Error('Only one explicit scene is supported')
  const roots = list(scene.nodes, 'scene roots', GLB_LIMITS.nodes, 1)
  const visited = new Set<number>(),
    result: { node: JsonRecord; matrix: Matrix4; index: number }[] = []
  const visit = (input: unknown, parent: Matrix4) => {
    const index = integer(input, 'node index', nodes.length - 1)
    if (visited.has(index)) throw new Error('Node cycle or multiple parents')
    visited.add(index)
    const node = record(nodes[index], 'node'),
      matrix = parent.clone().multiply(nodeTransform(node))
    result.push({ node, matrix, index })
    for (const child of list(
      node.children ?? [],
      'node children',
      GLB_LIMITS.nodes
    ))
      visit(child, matrix)
  }
  roots.forEach((root) => visit(root, new Matrix4()))
  if (visited.size !== nodes.length)
    throw new Error('Unused nodes are outside the restricted scene profile')
  return result
}

export function appearance(value: unknown): { color: number; opacity: number } {
  const material = record(value ?? {}, 'material'),
    pbr = record(material.pbrMetallicRoughness ?? {}, 'PBR material')
  const factor = tuple(pbr.baseColorFactor ?? [1, 1, 1, 1], 4, 'base color')
  if (factor.some((v) => v < 0 || v > 1)) throw new Error('Invalid base color')
  for (const key of ['metallicFactor', 'roughnessFactor'])
    if (
      pbr[key] !== undefined &&
      (typeof pbr[key] !== 'number' ||
        !Number.isFinite(pbr[key]) ||
        pbr[key] < 0 ||
        pbr[key] > 1)
    )
      throw new Error('Invalid PBR scalar')
  if (
    material.emissiveFactor !== undefined &&
    tuple(material.emissiveFactor, 3, 'emissive factor').some((v) => v !== 0)
  )
    throw new Error('Unsupported emissive material')
  if (
    material.alphaMode !== undefined &&
    !['OPAQUE', 'BLEND'].includes(String(material.alphaMode))
  )
    throw new Error('Unsupported alpha mode')
  return {
    color: new Color()
      .setRGB(factor[0], factor[1], factor[2], LinearSRGBColorSpace)
      .getHex(),
    opacity: material.alphaMode === 'BLEND' ? factor[3] : 1
  }
}
