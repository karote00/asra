import {
  getSessionManager,
  redoWithRenderPolicy,
  undoWithRenderPolicy,
  type Core
} from '@asyra/core'
import { FeatureNames } from '../constants'
import * as model from '../common-apis/workcell'
import { duplicateCandidate } from '../common-apis/duplicate-candidate'
import {
  addFieldObservation,
  updateFieldObservation,
  removeFieldObservation
} from '../common-apis/field-observation'
import type {
  ObservationDraft,
  ObservationAttachmentAdmission
} from '../common-apis/observation-contract'
import {
  captureCanonicalDocument,
  loadCanonicalDocument
} from '../common-apis/document'
import type { Body, VisualBinding, Workcell } from '../domain/workcell'
import {
  setBodyVisuals,
  upsertVisualBinding
} from '../common-apis/visual-reference'
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
  artifacts?: {
    readRun?(runId: string): ArchivedRunIdentity | undefined
    validateVisuals?: model.WorkcellResourceAdmission
    validateObservationAttachments?: ObservationAttachmentAdmission
  }
) {
  const execute = <T>(operation: () => T): Promise<T> =>
    getSessionManager().runAfterCancellingActiveSessions(
      () => core.getSystemContextSnapshot(),
      operation,
      FeatureNames.EDIT_WORKCELL
    )
  const api = {
    addObservation: (runId: string, draft: ObservationDraft) => {
      const input = structuredClone(draft)
      return execute(() =>
        addFieldObservation(
          core,
          runId,
          input,
          artifacts?.validateObservationAttachments
        )
      )
    },
    updateObservation: (
      runId: string,
      id: string,
      expectedRevision: number,
      draft: ObservationDraft
    ) => {
      const input = structuredClone(draft)
      return execute(() =>
        updateFieldObservation(
          core,
          runId,
          id,
          expectedRevision,
          input,
          artifacts?.validateObservationAttachments
        )
      )
    },
    removeObservation: (runId: string, id: string, expectedRevision: number) =>
      execute(() => removeFieldObservation(core, runId, id, expectedRevision)),
    attachRun: (runId: string) =>
      execute(() => {
        const run = artifacts?.readRun?.(runId)
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
      return execute(() =>
        model.createCandidate(core, name, input, artifacts?.validateVisuals)
      )
    },
    duplicateCandidate: (sourceId: string, name: string) =>
      execute(() =>
        duplicateCandidate(core, sourceId, name, artifacts?.validateVisuals)
      ),
    replace: (candidateId: string, workcell: Workcell) => {
      const input = structuredClone(workcell)
      return execute(() =>
        model.replaceWorkcell(
          core,
          candidateId,
          input,
          artifacts?.validateVisuals
        )
      )
    },
    upsert: (candidateId: string, body: Body, robotRootId?: string | null) => {
      const input = structuredClone(body)
      return execute(() =>
        model.upsertBody(
          core,
          candidateId,
          input,
          robotRootId,
          artifacts?.validateVisuals
        )
      )
    },
    setVisuals: (
      candidateId: string,
      bodyId: string,
      visuals: readonly VisualBinding[]
    ) => {
      const input = structuredClone(visuals)
      return execute(() =>
        setBodyVisuals(
          core,
          candidateId,
          bodyId,
          input,
          artifacts?.validateVisuals
        )
      )
    },
    upsertVisual: (
      candidateId: string,
      bodyId: string,
      binding: VisualBinding
    ) => {
      const input = structuredClone(binding)
      return execute(() =>
        upsertVisualBinding(
          core,
          candidateId,
          bodyId,
          input,
          artifacts?.validateVisuals
        )
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
