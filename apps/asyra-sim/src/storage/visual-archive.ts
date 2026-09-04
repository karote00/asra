import type { VisualAsset } from '../engine/glb/decode'
import { validateWorkcell, type Workcell } from '../domain/workcell'
import { RestrictedGlbPreviewWorker } from '../engine/glb/preview-worker'
import {
  encodeVisualBytes,
  validateVisualSources,
  visualSourceBytes,
  validVisualFilename,
  VISUAL_SOURCE_PROFILE,
  type VisualSourceRecord
} from './visual-source'

export interface VisualDecoder {
  decode(bytes: Uint8Array, signal?: AbortSignal): Promise<VisualAsset>
  dispose(): void
}
export interface PreparedVisualImport {
  readonly source: VisualSourceRecord
  readonly asset: VisualAsset
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
function checkSignal(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw new DOMException('Visual import was cancelled', 'AbortError')
}

function addGeometry(
  total: { vertices: number; indices: number },
  asset: VisualAsset
): void {
  for (const mesh of asset.meshes) {
    total.vertices += mesh.positions.length / 3
    total.indices += mesh.indices.length
  }
  if (
    total.vertices > VISUAL_SOURCE_PROFILE.maxVertices ||
    total.indices > VISUAL_SOURCE_PROFILE.maxIndices
  )
    throw new Error(
      'Expanded visual geometry exceeds the vertex or index limit'
    )
}

/** Immutable runtime-owned sources. Canonical binding and durable save are separate. */
export class VisualAssetArchive {
  private closed = false
  private byteLength = 0
  private geometry = { vertices: 0, indices: 0 }
  private readonly records = new Map<string, PreparedVisualImport>()
  private receipts = new WeakMap<
    PreparedVisualImport,
    { signal?: AbortSignal }
  >()

  constructor(
    private readonly decoder: VisualDecoder = new RestrictedGlbPreviewWorker()
  ) {}

  private assertLive(): void {
    if (this.closed) throw new Error('Visual archive is closed')
  }

  async prepare(
    input: Uint8Array,
    filename: string,
    signal?: AbortSignal
  ): Promise<PreparedVisualImport> {
    this.assertLive()
    checkSignal(signal)
    if (!input.byteLength || input.byteLength > VISUAL_SOURCE_PROFILE.maxBytes)
      throw new Error('Visual source byte limit exceeded')
    if (!validVisualFilename(filename))
      throw new Error('Invalid visual source filename')
    const bytes = new Uint8Array(input)
    const [decoded, digest] = await Promise.all([
      this.decoder.decode(bytes, signal),
      crypto.subtle.digest('SHA-256', bytes)
    ])
    this.assertLive()
    checkSignal(signal)
    const assetId = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    if (
      decoded.source.sha256 !== assetId ||
      decoded.source.byteLength !== bytes.byteLength
    )
      throw new Error('Visual decoder source digest or byte length mismatch')
    const source: VisualSourceRecord = Object.freeze({
      version: 1,
      assetId,
      filename,
      byteLength: bytes.byteLength,
      base64: encodeVisualBytes(bytes)
    })
    const prepared = Object.freeze({
      source,
      asset: freeze(structuredClone(decoded))
    })
    this.receipts.set(prepared, { signal })
    return prepared
  }

  private assertReceipt(prepared: PreparedVisualImport): void {
    this.assertLive()
    const receipt = this.receipts.get(prepared)
    if (!receipt)
      throw new Error('Visual acceptance requires an original archive receipt')
    checkSignal(receipt.signal)
  }

  accept(prepared: PreparedVisualImport): VisualSourceRecord {
    this.assertReceipt(prepared)
    const existing = this.records.get(prepared.source.assetId)
    if (existing) {
      if (existing.source.base64 !== prepared.source.base64)
        throw new Error('Conflicting visual source bytes for one digest')
      return existing.source
    }
    if (
      this.records.size >= VISUAL_SOURCE_PROFILE.maxSources ||
      this.byteLength + prepared.source.byteLength >
        VISUAL_SOURCE_PROFILE.maxArchiveBytes
    )
      throw new Error(
        'Visual archive source count or byte limit exceeded; export referenced sources and reopen to release unused undo data'
      )
    const geometry = { ...this.geometry }
    addGeometry(geometry, prepared.asset)
    this.records.set(prepared.source.assetId, prepared)
    this.geometry = geometry
    this.byteLength += prepared.source.byteLength
    return prepared.source
  }

  get(assetId: string): VisualAsset | undefined {
    this.assertLive()
    return this.records.get(assetId)?.asset
  }

  discard(prepared: PreparedVisualImport): void {
    this.assertLive()
    this.receipts.delete(prepared)
  }

  /** Resolve every declared reference; repeated instances count toward projection admission. */
  resolveWorkcell(
    workcell: Workcell,
    pending?: PreparedVisualImport
  ): ReadonlyMap<string, VisualAsset> {
    this.assertLive()
    if (pending) this.assertReceipt(pending)
    validateWorkcell(workcell)
    const resolved = new Map<string, VisualAsset>(),
      geometry = { vertices: 0, indices: 0 }
    for (const body of workcell.bodies)
      for (const binding of body.visuals ?? []) {
        const asset =
          this.records.get(binding.assetId)?.asset ??
          (pending?.source.assetId === binding.assetId
            ? pending.asset
            : undefined)
        if (!asset) throw new Error(`Missing visual source ${binding.assetId}`)
        addGeometry(geometry, asset)
        resolved.set(binding.assetId, asset)
      }
    return resolved
  }

  capture(assetIds: readonly string[]): readonly VisualSourceRecord[] {
    this.assertLive()
    const ids = new Set(assetIds)
    if (ids.size > VISUAL_SOURCE_PROFILE.maxSources)
      throw new Error('Visual capture source count exceeded')
    return Object.freeze(
      [...ids].map((id) => {
        const record = this.records.get(id)
        if (!record) throw new Error(`Missing visual source ${id}`)
        return record.source
      })
    )
  }

  static async fromSources(
    input: unknown,
    decoder: VisualDecoder = new RestrictedGlbPreviewWorker(),
    signal?: AbortSignal
  ): Promise<VisualAssetArchive> {
    const archive = new VisualAssetArchive(decoder)
    try {
      checkSignal(signal)
      const sources = validateVisualSources(input)
      for (const source of sources) {
        const prepared = await archive.prepare(
          visualSourceBytes(source),
          source.filename,
          signal
        )
        if (prepared.source.assetId !== source.assetId)
          throw new Error(
            'Retained visual source digest does not match original bytes'
          )
        archive.accept(prepared)
      }
      checkSignal(signal)
      return archive
    } catch (error) {
      archive.dispose()
      throw error
    }
  }

  dispose(): void {
    if (this.closed) return
    this.closed = true
    this.records.clear()
    this.receipts = new WeakMap()
    this.byteLength = 0
    this.geometry = { vertices: 0, indices: 0 }
    this.decoder.dispose()
  }
}
