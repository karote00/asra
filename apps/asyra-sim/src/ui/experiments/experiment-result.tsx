import { type Workcell } from '../../domain/workcell'
import { AnalysisResultView } from '../results/analysis-result-view'
import { isPresentedRunStale } from '../results/run-freshness'
import { useExperimentController } from './use-experiment-controller'

type Props = Pick<
  ReturnType<typeof useExperimentController>,
  'canonicalDraft' | 'replayRun' | 'selectedRun' | 'retainSelectedRun'
> & {
  retainedIds: ReadonlySet<string>
  workcell: Workcell
  onOpenRuns: () => void
}

export function ExperimentResult({
  canonicalDraft,
  replayRun,
  selectedRun,
  retainSelectedRun,
  retainedIds,
  workcell,
  onOpenRuns
}: Props) {
  return (
    <>
      {selectedRun && canonicalDraft && (
        <>
          <div className="retention-actions flex flex-wrap gap-2 my-3 mx-0 [&_>_p]:basis-full">
            <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
              {retainedIds.has(selectedRun.result.runId)
                ? 'Retained in this project. Save the project for durable storage.'
                : 'Temporary result. Explicitly retain it before saving or replacing this project.'}
            </p>

            <button
              disabled={retainedIds.has(selectedRun.result.runId)}
              onClick={retainSelectedRun}
            >
              Retain result
            </button>

            <button onClick={onOpenRuns}>Browse runs &amp; compare</button>
          </div>

          <AnalysisResultView
            key={selectedRun.result.runId}
            run={selectedRun}
            stale={isPresentedRunStale(selectedRun, workcell, canonicalDraft)}
            onReplay={replayRun}
          />
        </>
      )}
    </>
  )
}
