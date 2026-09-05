/** Original sample asset authoring in meters. No renderer or collision semantics. */
export type Point = readonly [number, number, number]
interface Geometry {
  positions: number[]
  indices: number[]
  color: number
}
export class MechanicalMesh {
  private readonly groups = new Map<number, Geometry>()

  private append(color: number, positions: number[], indices: number[]) {
    let group = this.groups.get(color)
    if (!group) {
      group = { color, positions: [], indices: [] }
      this.groups.set(color, group)
    }
    const offset = group.positions.length / 3
    group.positions.push(...positions)
    group.indices.push(...indices.map((index) => index + offset))
  }

  /** Revolve a closed radial/axial profile, including bevels and open bores. */
  lathe(
    color: number,
    center: Point,
    profile: readonly (readonly [number, number])[],
    axis: 'y' | 'z' = 'y',
    segments = 32
  ) {
    const positions: number[] = [],
      indices: number[] = []
    for (const [radius, height] of profile)
      for (let i = 0; i < segments; i++) {
        const angle = (i * Math.PI * 2) / segments
        const x = radius * Math.cos(angle),
          z = radius * Math.sin(angle)
        positions.push(
          center[0] + x,
          center[1] + (axis === 'y' ? height : -z),
          center[2] + (axis === 'y' ? z : height)
        )
      }
    for (let row = 0; row < profile.length - 1; row++)
      for (let i = 0; i < segments; i++) {
        const a = row * segments + i,
          b = row * segments + ((i + 1) % segments)
        // A pole is a triangle fan, not a ring of zero-area quads.
        if (profile[row][0] !== 0) indices.push(a, a + segments, b)
        if (profile[row + 1][0] !== 0)
          indices.push(b, a + segments, b + segments)
      }
    this.append(color, positions, indices)
  }

  cylinder(
    color: number,
    center: Point,
    radius: number,
    depth: number,
    axis: 'y' | 'z' = 'y',
    segments = 32
  ) {
    const bevel = Math.min(depth * 0.12, radius * 0.12, 0.004)
    this.lathe(
      color,
      center,
      [
        [0, -depth / 2],
        [radius - bevel, -depth / 2],
        [radius, -depth / 2 + bevel],
        [radius, depth / 2 - bevel],
        [radius - bevel, depth / 2],
        [0, depth / 2]
      ],
      axis,
      segments
    )
  }

  /** Rounded rectangular cross-sections with an independent taper at each Y station. */
  shell(
    color: number,
    center: Point,
    stations: readonly (readonly [number, number, number])[],
    bevel = 0.01
  ) {
    const positions: number[] = [],
      indices: number[] = [],
      count = 16
    for (const [y, width, depth] of stations) {
      const r = Math.min(bevel, width / 3, depth / 3)
      for (let corner = 0; corner < 4; corner++)
        for (let i = 0; i < 4; i++) {
          const angle = ((corner + i / 3) * Math.PI) / 2
          const cx = (corner === 0 || corner === 3 ? 1 : -1) * (width / 2 - r)
          const cz = (corner < 2 ? 1 : -1) * (depth / 2 - r)
          positions.push(
            center[0] + cx + r * Math.cos(angle),
            center[1] + y,
            center[2] + cz + r * Math.sin(angle)
          )
        }
    }
    for (let row = 0; row < stations.length - 1; row++)
      for (let i = 0; i < count; i++) {
        const a = row * count + i,
          b = row * count + ((i + 1) % count)
        indices.push(a, a + count, b, b, a + count, b + count)
      }
    for (let i = 1; i < count - 1; i++) {
      indices.push(0, i, i + 1)
      const top = (stations.length - 1) * count
      indices.push(top, top + i + 1, top + i)
    }
    this.append(color, positions, indices)
  }

  block(color: number, center: Point, size: Point, bevel = 0.005) {
    const [w, h, d] = size,
      b = Math.min(bevel, h / 4, w / 4, d / 4)
    this.shell(
      color,
      center,
      [
        [-h / 2, w - b, d - b],
        [-h / 2 + b, w, d],
        [h / 2 - b, w, d],
        [h / 2, w - b, d - b]
      ],
      b
    )
  }

  bolts(
    center: Point,
    radius: number,
    count: number,
    axis: 'y' | 'z' = 'y',
    size = 0.008
  ) {
    for (let i = 0; i < count; i++) {
      const angle = (i * 2 * Math.PI) / count
      const point: Point = [
        center[0] + radius * Math.cos(angle),
        center[1] + (axis === 'z' ? radius * Math.sin(angle) : 0),
        center[2] + (axis === 'y' ? radius * Math.sin(angle) : 0)
      ]
      this.cylinder(0x9da9b4, point, size, 0.006, axis, 12)
      this.cylinder(
        0x19232e,
        [
          point[0],
          point[1] + (axis === 'y' ? 0.0035 : 0),
          point[2] + (axis === 'z' ? 0.0035 : 0)
        ],
        size * 0.48,
        0.001,
        axis,
        6
      )
    }
  }

  toGlb(name: string): Uint8Array {
    const groups = [...this.groups.values()],
      bufferViews: object[] = [],
      accessors: object[] = []
    const chunks: Uint8Array[] = []
    let length = 0
    for (const group of groups) {
      for (const [values, positions] of [
        [group.positions, true],
        [group.indices, false]
      ] as const) {
        const bytes = new Uint8Array(values.length * 4),
          view = new DataView(bytes.buffer)
        values.forEach((value, index) =>
          positions
            ? view.setFloat32(index * 4, value, true)
            : view.setUint32(index * 4, value, true)
        )
        bufferViews.push({
          buffer: 0,
          byteOffset: length,
          byteLength: bytes.length
        })
        accessors.push({
          bufferView: bufferViews.length - 1,
          componentType: positions ? 5126 : 5125,
          count: values.length / (positions ? 3 : 1),
          type: positions ? 'VEC3' : 'SCALAR'
        })
        chunks.push(bytes)
        length += bytes.length
      }
    }
    const linear = (value: number) =>
      value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
    const json = {
      asset: {
        version: '2.0',
        generator: 'Asyra Sim - original mechanical sample v2'
      },
      buffers: [{ byteLength: length }],
      bufferViews,
      accessors,
      materials: groups.map(({ color }) => ({
        pbrMetallicRoughness: {
          baseColorFactor: [
            ...[16, 8, 0].map((shift) =>
              linear(((color >> shift) & 255) / 255)
            ),
            1
          ]
        }
      })),
      meshes: groups.map((_, index) => ({
        name: `${name} - finish ${index + 1}`,
        primitives: [
          {
            attributes: { POSITION: index * 2 },
            indices: index * 2 + 1,
            material: index
          }
        ]
      })),
      nodes: groups.map((_, mesh) => ({ mesh })),
      scenes: [{ nodes: groups.map((_, index) => index) }],
      scene: 0
    }
    const source = new TextEncoder().encode(JSON.stringify(json)),
      jsonLength = Math.ceil(source.length / 4) * 4
    const result = new Uint8Array(28 + jsonLength + length),
      header = new DataView(result.buffer)
    header.setUint32(0, 0x46546c67, true)
    header.setUint32(4, 2, true)
    header.setUint32(8, result.length, true)
    header.setUint32(12, jsonLength, true)
    header.setUint32(16, 0x4e4f534a, true)
    result.fill(32, 20, 20 + jsonLength)
    result.set(source, 20)
    header.setUint32(20 + jsonLength, length, true)
    header.setUint32(24 + jsonLength, 0x004e4942, true)
    let offset = 28 + jsonLength
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return result
  }
}
