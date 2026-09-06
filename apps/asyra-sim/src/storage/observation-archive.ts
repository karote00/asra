import {
  OBSERVATION_LIMITS,
  observationMediaType,
  validObservationAttachment,
  type ObservationAttachmentReference
} from '../common-apis/observation-contract'
import { hasExactOwnKeys } from '../domain/records'
import {
  assertObservationActive,
  encodeObservationBytes,
  observationDigest,
  observationSourceBytes,
  verifyObservationSources,
  type ObservationSourceRecord
} from './observation-source'

export interface ObservationFileInput {
  filename: string
  bytes: Uint8Array
}
export interface PreparedObservationAttachments {
  readonly attachments: readonly Readonly<ObservationAttachmentReference>[]
}

/** Validate before allocation; Feature dispatch and the archive each own detached bytes. */
export function detachObservationFiles(
  input: unknown
): readonly ObservationFileInput[] {
  if (
    !Array.isArray(input) ||
    input.length < 1 ||
    input.length > OBSERVATION_LIMITS.attachmentsPerNote
  )
    throw new Error('Observation file count limit exceeded')
  for (const file of input) {
    if (
      !hasExactOwnKeys(file, ['filename', 'bytes']) ||
      !observationMediaType(file.filename) ||
      !ArrayBuffer.isView(file.bytes) ||
      Object.prototype.toString.call(file.bytes) !== '[object Uint8Array]' ||
      !file.bytes.byteLength ||
      file.bytes.byteLength > OBSERVATION_LIMITS.fileBytes
    )
      throw new Error('Invalid observation filename or file byte limit')
  }
  return input.map((file: ObservationFileInput) => ({
    filename: file.filename,
    bytes: new Uint8Array(file.bytes)
  }))
}

/** Storage owns immutable bytes; canonical properties own only their references. */
export class ObservationAttachmentArchive {
  private readonly sources = new Map<string, ObservationSourceRecord>()
  private prepared?: {
    receipt: PreparedObservationAttachments
    sources: readonly ObservationSourceRecord[]
  }
  private preparing = false
  private closed = false

  static async hydrate(
    input: unknown,
    signal?: AbortSignal
  ): Promise<ObservationAttachmentArchive> {
    const sources = await verifyObservationSources(input, signal)
    assertObservationActive(signal)
    const archive = new ObservationAttachmentArchive()
    for (const source of sources) archive.sources.set(source.sourceId, source)
    return archive
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('Observation attachment archive is closed')
  }

  private admit(sources: readonly ObservationSourceRecord[]): void {
    let count = this.sources.size,
      bytes = [...this.sources.values()].reduce(
        (sum, source) => sum + source.byteLength,
        0
      )
    for (const source of sources) {
      const existing = this.sources.get(source.sourceId)
      if (existing) {
        if (
          existing.byteLength !== source.byteLength ||
          existing.base64 !== source.base64
        )
          throw new Error(
            'Observation source identity conflicts with different bytes'
          )
      } else {
        count++
        bytes += source.byteLength
      }
    }
    if (count > OBSERVATION_LIMITS.sourceCount)
      throw new Error('Observation archive source count limit exceeded')
    if (bytes > OBSERVATION_LIMITS.sourceBytes)
      throw new Error('Observation archive byte limit exceeded')
  }

  async prepare(
    input: unknown,
    signal?: AbortSignal
  ): Promise<PreparedObservationAttachments> {
    this.assertOpen()
    assertObservationActive(signal)
    if (this.preparing)
      throw new Error('Observation preparation is already active')
    this.prepared = undefined
    const files = detachObservationFiles(input)
    this.preparing = true
    try {
      const sources: ObservationSourceRecord[] = [],
        attachments: Readonly<ObservationAttachmentReference>[] = []
      const ids = new Set<string>()
      for (const file of files) {
        this.assertOpen()
        assertObservationActive(signal)
        const sourceId = await observationDigest(file.bytes)
        this.assertOpen()
        assertObservationActive(signal)
        if (ids.has(sourceId))
          throw new Error('Duplicate contents in observation attachments')
        ids.add(sourceId)
        sources.push(
          Object.freeze({
            version: 1,
            sourceId,
            byteLength: file.bytes.byteLength,
            base64: encodeObservationBytes(file.bytes)
          })
        )
        const mediaType = observationMediaType(file.filename)
        if (!mediaType) throw new Error('Invalid observation filename')
        attachments.push(
          Object.freeze({
            sourceId,
            filename: file.filename,
            mediaType,
            byteLength: file.bytes.byteLength
          })
        )
      }
      this.admit(sources)
      const receipt = Object.freeze({ attachments: Object.freeze(attachments) })
      this.prepared = { receipt, sources: Object.freeze(sources) }
      return receipt
    } finally {
      this.preparing = false
    }
  }

  accept(receipt: PreparedObservationAttachments): void {
    this.assertOpen()
    if (!this.prepared || this.prepared.receipt !== receipt)
      throw new Error('Observation receipt is foreign, retired or revoked')
    this.admit(this.prepared.sources)
    for (const source of this.prepared.sources)
      this.sources.set(source.sourceId, source)
  }

  discard(receipt: PreparedObservationAttachments): void {
    this.assertOpen()
    if (this.prepared?.receipt === receipt) this.prepared = undefined
  }

  resolve(references: readonly ObservationAttachmentReference[]): void {
    this.assertOpen()
    for (const reference of references) {
      if (!validObservationAttachment(reference))
        throw new Error('Invalid observation attachment reference')
      const source = this.sources.get(reference.sourceId)
      if (!source) throw new Error('Missing observation attachment source')
      if (source.byteLength !== reference.byteLength)
        throw new Error('Observation attachment byte length mismatch')
    }
  }

  capture(ids: readonly string[]): readonly ObservationSourceRecord[] {
    this.assertOpen()
    const sources = [...new Set(ids)].map((id) => {
      const source = this.sources.get(id)
      if (!source) throw new Error('Missing observation attachment source')
      return source
    })
    return Object.freeze(sources)
  }

  bytes(id: string): Uint8Array {
    this.assertOpen()
    const source = this.sources.get(id)
    if (!source) throw new Error('Missing observation attachment source')
    return observationSourceBytes(source)
  }

  dispose(): void {
    this.closed = true
    this.prepared = undefined
    this.sources.clear()
  }
}
