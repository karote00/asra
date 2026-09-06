import { useMemo } from 'react'
import type { Workcell } from '../../domain/workcell'
import type { SimRuntime } from '../../init/bootstrap'
import type { RunRecord } from '../../storage/run-record'

/** Read-only UI projection; canonical notifications own invalidation. */
export function useWorkbenchData(
  runtime: SimRuntime | null,
  candidateId: string | null,
  revision: number
) {
  return useMemo(() => {
    const candidates = runtime?.getCandidates() ?? []

    const loadIssues = runtime?.getLoadIssues() ?? []

    const historyDepth = runtime?.getHistoryDepth() ?? 0

    let retainedRuns: readonly RunRecord[] = []

    let runError = ''

    let workcell: Workcell | null = null

    let modelError = ''

    try {
      retainedRuns = runtime?.getRuns() ?? []
    } catch (reason) {
      runError = `Cannot read retained runs: ${reason instanceof Error ? reason.message : String(reason)}`
    }

    try {
      if (
        runtime &&
        candidateId &&
        candidates.some((candidate) => candidate.id === candidateId)
      )
        workcell = runtime.getWorkcell(candidateId)
    } catch (reason) {
      modelError = `Cannot project this candidate: ${reason instanceof Error ? reason.message : String(reason)}`
    }

    return {
      candidates,
      loadIssues,
      historyDepth,
      retainedRuns,
      runError,
      workcell,
      modelError
    }
  }, [runtime, candidateId, revision])
}
