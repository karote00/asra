import type { Core } from '@asyra/core'
import { FeatureNames } from '../constants'
import { RunArchive, type RunRecord } from '../storage/run-record'

/** Prepare immutable evidence, then accept its reference through the editing owner. */
export function installRunStorageFeature(
  core: Core,
  archive: RunArchive,
  attachRun: (runId: string) => Promise<string>
) {
  return core.defineFeature(FeatureNames.RETAIN_RUN, undefined, {
    priority: 100,
    exclusive: true,
    api: {
      retain: async (input: RunRecord): Promise<string> => {
        const record = archive.add(input)
        return attachRun(record.result.runId)
      }
    }
  }).api
}
