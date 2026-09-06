import { cancelFeatureTask, invokeFeatureTask, type Core } from '@asyra/core'
import type { ExperimentSnapshot } from '../analysis/contracts'
import type { AnalysisResult } from '../analysis/result'
import type { AnalysisProgress } from '../analysis/runner'
import { FeatureNames } from '../constants'

export interface AnalysisService {
  run(
    snapshot: ExperimentSnapshot,
    signal: AbortSignal
  ): Promise<AnalysisResult>
  isRunning(): boolean
  getProgress(): AnalysisProgress | null
  dispose(): Promise<void>
}

export type AnalysisFeatureApi = Record<string, unknown> & {
  run(
    snapshot: ExperimentSnapshot,
    options?: { signal?: AbortSignal }
  ): Promise<AnalysisResult>
  cancel(): boolean
  isRunning(): boolean
  getProgress(): AnalysisProgress | null
}

export function installAnalysisFeature(
  core: Core,
  service: AnalysisService
): AnalysisFeatureApi {
  const api: AnalysisFeatureApi = {
    run: (snapshot, options) => {
      const input = structuredClone(snapshot)
      return invokeFeatureTask<
        { snapshot: ExperimentSnapshot },
        AnalysisResult
      >(FeatureNames.ANALYZE_EXPERIMENT, { snapshot: input }, options)
    },
    cancel: () => cancelFeatureTask(FeatureNames.ANALYZE_EXPERIMENT),
    isRunning: () => service.isRunning(),
    getProgress: () => service.getProgress()
  }
  core.defineFeature(FeatureNames.ANALYZE_EXPERIMENT, undefined, {
    priority: 90,
    exclusive: true,
    api,
    task: (input: unknown, { signal }) => {
      if (!input || typeof input !== 'object' || !('snapshot' in input))
        throw new Error('Invalid analysis Feature input')
      return service.run(
        (input as { snapshot: ExperimentSnapshot }).snapshot,
        signal
      )
    }
  })
  core.registerRuntimeCleanup(FeatureNames.ANALYZE_EXPERIMENT, () =>
    service.dispose()
  )
  return api
}
