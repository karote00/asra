/** Byte-level fixture authoring, independent of the production decoder. */
export function encodeGlb(
  json: Record<string, unknown>,
  binary: Uint8Array
): Uint8Array {
  const source = new TextEncoder().encode(JSON.stringify(json)),
    jsonLength = Math.ceil(source.length / 4) * 4,
    binLength = Math.ceil(binary.length / 4) * 4
  const bytes = new Uint8Array(28 + jsonLength + binLength),
    view = new DataView(bytes.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, bytes.length, true)
  view.setUint32(12, jsonLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  bytes.fill(32, 20, 20 + jsonLength)
  bytes.set(source, 20)
  view.setUint32(20 + jsonLength, binLength, true)
  view.setUint32(24 + jsonLength, 0x004e4942, true)
  bytes.set(binary, 28 + jsonLength)
  return bytes
}
export function triangleFixture() {
  const binary = new Uint8Array(36),
    view = new DataView(binary.buffer)
  ;[0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((v, index) =>
    view.setFloat32(index * 4, v, true)
  )
  const json = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0]
      }
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0
  }
  return { json, binary }
}
