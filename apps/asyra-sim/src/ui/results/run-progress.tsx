import { useEffect, useState } from 'react'
import {
  EXPERIMENT_RESOURCE_PROFILE,
  type ExperimentBudget
} from '../../analysis/contracts'
import type { AnalysisProgress } from '../../analysis/runner'
import type { AnalysisFeatureApi } from '../../features/analysis'

export function RunProgress({
  analysis,
  snapshotId,
  budget,
  onCancel
}: {
  analysis: Pick<AnalysisFeatureApi, 'getProgress'>
  snapshotId: string
  budget: ExperimentBudget
  onCancel: () => void
}) {
  const [progress, setProgress] = useState<AnalysisProgress | null>(null)

  const [error, setError] = useState('')

  useEffect(() => {
    const read = () => {
      try {
        const next = analysis.getProgress()

        setProgress(next?.snapshotId === snapshotId ? next : null)
      } catch (reason) {
        setProgress(null)

        setError(reason instanceof Error ? reason.message : String(reason))

        clearInterval(timer)
      }
    }

    setError('')

    const timer = setInterval(
      read,
      EXPERIMENT_RESOURCE_PROFILE.progressIntervalMs
    )

    read()

    return () => clearInterval(timer)
  }, [analysis, snapshotId])

  return (
    <section
      className="preflight-card grid gap-[10px] p-[13px] rounded-[7px] border
        border-sim-border bg-sim-raised [&_progress]:w-full [&_progress]:h-[7px]
        [&_progress]:accent-sim-focus"
      aria-label="Analysis progress"
      data-testid="analysis-progress"
      data-snapshot-id={snapshotId}
      data-run-id={progress?.runId}
    >
      <div className="section-heading flex items-center justify-between [&_>_span]:text-[10px] [&_>_span]:text-sim-muted">
        <h3>Frozen experiment - {progress?.state ?? 'starting'}</h3>

        <button onClick={onCancel}>Cancel analysis</button>
      </div>

      {error ? (
        <p role="alert">Progress unavailable: {error}</p>
      ) : (
        <>
          {progress ? (
            <>
              <p>
                {progress.receivedPairCount} of {progress.totalPairCount} pair
                records received
              </p>

              <progress
                aria-label="Received pair records"
                value={progress.receivedPairCount}
                max={progress.totalPairCount}
              />

              <p>
                Evaluated intervals: {progress.evaluations} /{' '}
                {budget.maxIntervals}
                <br />
                Retained evidence leaves: {progress.evidenceLeafCount}
              </p>
            </>
          ) : (
            <p>Waiting for the analysis worker…</p>
          )}
        </>
      )}

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        Wall-time budget: {budget.maxDurationMs / 1000} s. Received records are
        not a clearance conclusion. No reliable time estimate is available.
      </p>
    </section>
  )
}
