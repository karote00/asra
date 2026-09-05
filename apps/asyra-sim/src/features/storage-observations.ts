import { cancelFeatureTask, invokeFeatureTask, type Core } from '@asyra/core'
import { FeatureNames } from '../constants'
import { hasExactOwnKeys, isPlainRecord } from '../domain/records'
import { validIdentifier } from '../domain/workcell'
import {
  validObservationDraft,
  type ObservationDraft
} from '../common-apis/observation-contract'
import {
  detachObservationFiles,
  type ObservationAttachmentArchive,
  type ObservationFileInput,
  type PreparedObservationAttachments
} from '../storage/observation-archive'

export interface ObservationWriteIntent {
  runId: string
  draft: ObservationDraft
  edit?: { id: string; expectedRevision: number }
}
export type ObservationStorageApi = Record<string, unknown> & {
  prepare(
    files: readonly ObservationFileInput[],
    options?: { signal?: AbortSignal }
  ): Promise<PreparedObservationAttachments>
  cancel(): boolean
  discard(receipt: PreparedObservationAttachments): void
  retain(
    receipt: PreparedObservationAttachments,
    intent: ObservationWriteIntent
  ): Promise<string>
}
interface ObservationEditing {
  addObservation(runId: string, draft: ObservationDraft): Promise<string>
  updateObservation(
    runId: string,
    id: string,
    expectedRevision: number,
    draft: ObservationDraft
  ): Promise<void>
}

function validateIntent(input: ObservationWriteIntent): void {
  if (
    !isPlainRecord(input) ||
    !hasExactOwnKeys(input, [
      'runId',
      'draft',
      ...(Object.hasOwn(input, 'edit') ? ['edit'] : [])
    ]) ||
    !validIdentifier(input.runId) ||
    !validObservationDraft(input.draft) ||
    (Object.hasOwn(input, 'edit') &&
      (!hasExactOwnKeys(input.edit, ['id', 'expectedRevision']) ||
        !validIdentifier(input.edit.id) ||
        typeof input.edit.expectedRevision !== 'number' ||
        !Number.isSafeInteger(input.edit.expectedRevision) ||
        input.edit.expectedRevision < 1))
  )
    throw new Error('Invalid field observation acceptance intent')
}

/** Accept bytes first; the existing editing owner alone commits canonical metadata. */
export function installObservationStorageFeatures(
  core: Core,
  archive: ObservationAttachmentArchive,
  editing: ObservationEditing
): ObservationStorageApi {
  const api: ObservationStorageApi = {
    prepare: async (files, options) =>
      invokeFeatureTask(
        FeatureNames.PREPARE_OBSERVATION,
        detachObservationFiles(files),
        options
      ),
    cancel: () => cancelFeatureTask(FeatureNames.PREPARE_OBSERVATION),
    discard: (receipt) => archive.discard(receipt),
    retain: async (receipt, intent) => {
      const input = structuredClone(intent)
      validateIntent(input)
      if (
        !receipt?.attachments?.length ||
        !receipt.attachments.every((prepared) =>
          input.draft.attachments.some(
            (reference) =>
              reference.sourceId === prepared.sourceId &&
              reference.filename === prepared.filename &&
              reference.mediaType === prepared.mediaType &&
              reference.byteLength === prepared.byteLength
          )
        )
      )
        throw new Error(
          'Observation metadata must include every prepared attachment'
        )
      archive.accept(receipt)
      archive.resolve(input.draft.attachments)
      let id: string
      if (input.edit) {
        await editing.updateObservation(
          input.runId,
          input.edit.id,
          input.edit.expectedRevision,
          input.draft
        )
        id = input.edit.id
      } else id = await editing.addObservation(input.runId, input.draft)
      archive.discard(receipt)
      return id
    }
  }
  core.defineFeature(FeatureNames.PREPARE_OBSERVATION, undefined, {
    priority: 90,
    exclusive: true,
    api: { prepare: api.prepare, cancel: api.cancel, discard: api.discard },
    task: (input: unknown, { signal }) => archive.prepare(input, signal)
  })
  core.defineFeature(FeatureNames.RETAIN_OBSERVATION, undefined, {
    priority: 100,
    exclusive: true,
    api: { retain: api.retain }
  })
  core.registerRuntimeCleanup(FeatureNames.PREPARE_OBSERVATION, () =>
    archive.dispose()
  )
  return api
}
