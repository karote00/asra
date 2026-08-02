import { decodeCompactBinary } from './compact-binary'
import { decodeCompactJson } from './compact-json'

export interface ProfiledWebSocketFrame {
  readonly value: unknown
  readonly wireByteLength: number
}

export interface ProfiledWebSocketFrameInput {
  readonly opcode: number
  readonly payloadData: string
}

const textEncoder = new TextEncoder()

const decodeBase64 = (value: string): Uint8Array => {
  let decoded: string
  try {
    decoded = atob(value)
  } catch (error) {
    throw new TypeError(
      '[collaboration] invalid profiled binary WebSocket frame',
      { cause: error }
    )
  }
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }
  return bytes
}

export const decodeProfiledWebSocketFrame = ({
  opcode,
  payloadData
}: ProfiledWebSocketFrameInput): ProfiledWebSocketFrame | null => {
  if (opcode === 1) {
    return {
      value: decodeCompactJson(payloadData),
      wireByteLength: textEncoder.encode(payloadData).byteLength
    }
  }
  if (opcode !== 2) return null
  const bytes = decodeBase64(payloadData)
  return {
    value: decodeCompactBinary(bytes),
    wireByteLength: bytes.byteLength
  }
}
