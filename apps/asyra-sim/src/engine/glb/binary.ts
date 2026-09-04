import {
  GLB_LIMITS,
  inspectJson,
  integer,
  list,
  record,
  type JsonRecord
} from './schema'

export function readContainer(bytes: Uint8Array): {
  json: JsonRecord
  binary: DataView
} {
  if (bytes.byteLength < 28 || bytes.byteLength > GLB_LIMITS.bytes)
    throw new Error('GLB byte limit or header size is invalid')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.byteLength
  )
    throw new Error('Invalid GLB header or version')
  const jsonLength = view.getUint32(12, true)
  if (
    view.getUint32(16, true) !== 0x4e4f534a ||
    jsonLength % 4 !== 0 ||
    jsonLength > GLB_LIMITS.jsonBytes ||
    20 + jsonLength + 8 > bytes.byteLength
  )
    throw new Error('Invalid GLB JSON chunk')
  const binaryHeader = 20 + jsonLength,
    binaryLength = view.getUint32(binaryHeader, true)
  if (
    view.getUint32(binaryHeader + 4, true) !== 0x004e4942 ||
    binaryLength % 4 !== 0 ||
    binaryHeader + 8 + binaryLength !== bytes.byteLength
  )
    throw new Error('Invalid GLB binary chunk')
  const json = record(
    JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        bytes.subarray(20, binaryHeader)
      )
    ),
    'GLB document'
  )
  inspectJson(json)
  const asset = record(json.asset, 'asset')
  if (
    asset.version !== '2.0' ||
    (asset.minVersion !== undefined && asset.minVersion !== '2.0')
  )
    throw new Error('Unsupported glTF asset version')
  const buffer = record(
    list(json.buffers, 'embedded buffer', 1, 1)[0],
    'buffer'
  )
  const declared = integer(
    buffer.byteLength,
    'buffer byteLength',
    binaryLength,
    1
  )
  if (binaryLength - declared > 3) throw new Error('Invalid GLB binary padding')
  return {
    json,
    binary: new DataView(
      bytes.buffer,
      bytes.byteOffset + binaryHeader + 8,
      declared
    )
  }
}

export interface Accessor {
  count: number
  components: number
  offset: number
  stride: number
  componentType: number
  componentBytes: number
}
export class BinaryAccess {
  private readonly accessors: unknown[]
  private readonly views: unknown[]
  constructor(
    json: JsonRecord,
    private readonly binary: DataView
  ) {
    this.accessors = list(json.accessors, 'accessors', 512, 1)
    this.views = list(json.bufferViews, 'buffer views', 512, 1)
    for (const raw of this.views) {
      const view = record(raw, 'buffer view')
      if (view.buffer !== 0)
        throw new Error('Only embedded buffer zero is supported')
      const offset = integer(
        view.byteOffset ?? 0,
        'buffer view offset',
        binary.byteLength
      )
      integer(
        view.byteLength,
        'buffer view length',
        binary.byteLength - offset,
        1
      )
      if (view.byteStride !== undefined)
        integer(view.byteStride, 'buffer stride', 252, 4)
    }
  }
  describe(index: unknown, components: number, indexData = false): Accessor {
    const accessor = record(
      this.accessors[
        integer(index, 'accessor index', this.accessors.length - 1)
      ],
      'accessor'
    )
    const types: Record<number, string> = {
      1: 'SCALAR',
      2: 'VEC2',
      3: 'VEC3',
      4: 'VEC4'
    }
    if (
      accessor.type !== types[components] ||
      (accessor.normalized !== undefined && accessor.normalized !== false)
    )
      throw new Error('Unsupported accessor type or normalization')
    const componentType = integer(
      accessor.componentType,
      'component type',
      5126
    )
    if (
      indexData
        ? ![5121, 5123, 5125].includes(componentType)
        : componentType !== 5126
    )
      throw new Error('Unsupported accessor component type')
    const componentBytes = (
      { 5121: 1, 5123: 2, 5125: 4, 5126: 4 } as Record<number, number>
    )[componentType]
    const count = integer(
      accessor.count,
      'accessor count',
      indexData ? GLB_LIMITS.indices : GLB_LIMITS.vertices,
      1
    )
    const raw = record(
      this.views[
        integer(
          accessor.bufferView,
          'accessor buffer view',
          this.views.length - 1
        )
      ],
      'accessor buffer view'
    )
    const viewOffset = integer(
      raw.byteOffset ?? 0,
      'buffer view offset',
      this.binary.byteLength
    )
    const viewLength = integer(
      raw.byteLength,
      'buffer view length',
      this.binary.byteLength - viewOffset,
      1
    )
    const localOffset = integer(
      accessor.byteOffset ?? 0,
      'accessor offset',
      viewLength
    )
    const stride = integer(
      raw.byteStride ?? components * componentBytes,
      'accessor stride',
      252,
      components * componentBytes
    )
    if (
      (viewOffset + localOffset) % componentBytes ||
      localOffset % componentBytes ||
      stride % componentBytes ||
      (indexData && raw.byteStride !== undefined) ||
      (!indexData && stride % 4) ||
      localOffset + (count - 1) * stride + components * componentBytes >
        viewLength
    )
      throw new Error('Invalid accessor alignment or range')
    return {
      count,
      components,
      offset: viewOffset + localOffset,
      stride,
      componentType,
      componentBytes
    }
  }
  values(accessor: Accessor): number[] {
    const values: number[] = []
    for (let item = 0; item < accessor.count; item++)
      for (let channel = 0; channel < accessor.components; channel++) {
        const offset =
          accessor.offset +
          item * accessor.stride +
          channel * accessor.componentBytes
        let value: number
        switch (accessor.componentType) {
          case 5121:
            value = this.binary.getUint8(offset)
            break
          case 5123:
            value = this.binary.getUint16(offset, true)
            break
          case 5125:
            value = this.binary.getUint32(offset, true)
            break
          default:
            value = this.binary.getFloat32(offset, true)
        }
        if (!Number.isFinite(value))
          throw new Error('Nonfinite binary geometry')
        values.push(value)
      }
    return values
  }
}
