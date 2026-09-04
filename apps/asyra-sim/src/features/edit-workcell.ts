import {
  getSessionManager,
  redoWithRenderPolicy,
  undoWithRenderPolicy,
  type Core
} from '@asyra/core'
import { FeatureNames } from '../constants'
import * as model from '../common-apis/workcell'
import {
  captureCanonicalDocument,
  loadCanonicalDocument
} from '../common-apis/document'
import type { Body, Workcell } from '../domain/workcell'
import {
  createExperiment,
  removeExperiment,
  updateExperiment,
  type ExperimentDraft
} from '../common-apis/experiment'
import {
  attachRunReference,
  type ArchivedRunIdentity
} from '../common-apis/run-reference'

export function installEditingFeatures(
  core: Core,
  artifacts?: { readRun(runId: string): ArchivedRunIdentity | undefined }
) {
  const execute = <T>(operation: () => T): Promise<T> =>
    getSessionManager().runAfterCancellingActiveSessions(
      () => core.getSystemContextSnapshot(),
      operation,
      FeatureNames.EDIT_WORKCELL
    )
  const api = {
    attachRun: (runId: string) =>
      execute(() => {
        const run = artifacts?.readRun(runId)
        if (!run || run.runId !== runId)
          throw new Error('Validated run evidence is unavailable')
        return attachRunReference(core, run)
      }),
    captureDocument: () => execute(() => captureCanonicalDocument(core)),
    applyDocument: (data: unknown, assertCurrent: () => void) => {
      const input = structuredClone(data)
      return execute(() => {
        assertCurrent()
        return loadCanonicalDocument(core, input)
      })
    },
    createCandidate: (name: string, workcell: Workcell) => {
      const input = structuredClone(workcell)
      return execute(() => model.createCandidate(core, name, input))
    },
    replace: (candidateId: string, workcell: Workcell) => {
      const input = structuredClone(workcell)
      return execute(() => model.replaceWorkcell(core, candidateId, input))
    },
    upsert: (candidateId: string, body: Body, robotRootId?: string | null) => {
      const input = structuredClone(body)
      return execute(() =>
        model.upsertBody(core, candidateId, input, robotRootId)
      )
    },
    remove: (candidateId: string, bodyId: string) =>
      execute(() => model.removeBody(core, candidateId, bodyId)),
    createExperiment: (
      candidateId: string,
      name: string,
      draft: ExperimentDraft
    ) => {
      const input = structuredClone(draft)
      return execute(() => createExperiment(core, candidateId, name, input))
    },
    updateExperiment: (
      experimentId: string,
      expectedRevision: number,
      draft: ExperimentDraft
    ) => {
      const input = structuredClone(draft)
      return execute(() =>
        updateExperiment(core, experimentId, expectedRevision, input)
      )
    },
    removeExperiment: (experimentId: string) =>
      execute(() => removeExperiment(core, experimentId))
  }
  const edit = core.defineFeature(FeatureNames.EDIT_WORKCELL, undefined, {
    priority: 100,
    exclusive: true,
    api
  })
  const history = core.defineFeature(FeatureNames.HISTORY, undefined, {
    priority: 100,
    exclusive: true,
    api: {
      undo: () =>
        getSessionManager().runAfterCancellingActiveSessions(
          () => core.getSystemContextSnapshot(),
          () => undoWithRenderPolicy({ mode: 'atomic' }),
          FeatureNames.HISTORY
        ),
      redo: () =>
        getSessionManager().runAfterCancellingActiveSessions(
          () => core.getSystemContextSnapshot(),
          () => redoWithRenderPolicy({ mode: 'atomic' }),
          FeatureNames.HISTORY
        )
    }
  })
  return { edit: edit.api, history: history.api }
}
