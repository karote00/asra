import { cancelFeatureTask, invokeFeatureTask, type Core } from '@asyra/core'
import { FeatureNames } from '../constants'
import { isPlainRecord } from '../domain/records'
import type { VisualBinding } from '../domain/workcell'
import { VISUAL_SOURCE_PROFILE } from '../storage/visual-source'
import type {
  PreparedVisualImport,
  VisualAssetArchive
} from '../storage/visual-archive'

export type VisualPlacement = Omit<VisualBinding, 'assetId'>
export type VisualStorageApi = Record<string, unknown> & {
  prepare(
    bytes: Uint8Array,
    filename: string,
    options?: { signal?: AbortSignal }
  ): Promise<PreparedVisualImport>
  cancel(): boolean
  discard(prepared: PreparedVisualImport): void
  retain(
    prepared: PreparedVisualImport,
    candidateId: string,
    bodyId: string,
    placement: VisualPlacement
  ): Promise<string>
}

/** Noncanonical preparation and retention precede the separate editing transaction. */
export function installVisualStorageFeatures(
  core: Core,
  archive: VisualAssetArchive,
  upsertVisual: (
    candidateId: string,
    bodyId: string,
    binding: VisualBinding
  ) => Promise<void>
): VisualStorageApi {
  const api: VisualStorageApi = {
    prepare: (bytes, filename, options) => {
      if (
        !bytes.byteLength ||
        bytes.byteLength > VISUAL_SOURCE_PROFILE.maxBytes
      )
        return Promise.reject(new Error('Visual source byte limit exceeded'))
      return invokeFeatureTask(
        FeatureNames.PREPARE_VISUAL,
        {
          bytes: new Uint8Array(bytes),
          filename
        },
        options
      )
    },
    cancel: () => cancelFeatureTask(FeatureNames.PREPARE_VISUAL),
    discard: (prepared) => archive.discard(prepared),
    retain: async (prepared, candidateId, bodyId, placement) => {
      const input = structuredClone(placement)
      const source = archive.accept(prepared)
      await upsertVisual(candidateId, bodyId, {
        ...input,
        assetId: source.assetId
      })
      archive.discard(prepared)
      return source.assetId
    }
  }
  core.defineFeature(FeatureNames.PREPARE_VISUAL, undefined, {
    priority: 90,
    exclusive: true,
    api: { prepare: api.prepare, cancel: api.cancel, discard: api.discard },
    task: (input: unknown, { signal }) => {
      if (
        !isPlainRecord(input) ||
        !(input.bytes instanceof Uint8Array) ||
        typeof input.filename !== 'string'
      )
        throw new Error('Invalid visual preparation Feature input')
      return archive.prepare(input.bytes, input.filename, signal)
    }
  })
  core.defineFeature(FeatureNames.RETAIN_VISUAL, undefined, {
    priority: 100,
    exclusive: true,
    api: { retain: api.retain }
  })
  core.registerRuntimeCleanup(FeatureNames.PREPARE_VISUAL, () =>
    archive.dispose()
  )
  return api
}
