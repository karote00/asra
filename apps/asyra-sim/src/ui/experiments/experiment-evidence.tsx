import { useExperimentField, useExperimentView } from './experiment-context'
import { RunProgress } from '../results/run-progress'
import { ExperimentResult } from './experiment-result'
import { PreflightView } from './preflight-view'

export function ExperimentProgress() {
  const view = useExperimentView()

  const runningInput = useExperimentField('runningInput')

  const runtime = useExperimentField('runtime')

  return (
    <>
      {runningInput && (
        <RunProgress
          analysis={runtime.features.analysis}
          snapshotId={runningInput.snapshotId}
          budget={runningInput.budget}
          onCancel={() => view.getSnapshot().active.current?.abort()}
        />
      )}
    </>
  )
}

export function ExperimentPreflight() {
  const view = useExperimentView()

  const draft = useExperimentField('draft')

  const preflight = useExperimentField('preflight')

  const warnings = useExperimentField('warnings')

  return (
    <>
      <PreflightView
        draft={draft}
        preflight={preflight}
        warnings={warnings}
        setWarnings={(...args) => view.getSnapshot().setWarnings(...args)}
        changed={(...args) => view.getSnapshot().changed(...args)}
      />
    </>
  )
}

export function ExperimentError() {
  const error = useExperimentField('error')

  return (
    <>
      {error && (
        <p
          className="inline-error text-sim-error-text bg-sim-error p-[11px] rounded-[5px]
              text-[11px] leading-[1.6] wrap-anywhere"
          role="alert"
        >
          {error}
        </p>
      )}
    </>
  )
}

export function ExperimentEvidence() {
  const view = useExperimentView()

  const canonicalDraft = useExperimentField('canonicalDraft')

  const selectedRun = useExperimentField('selectedRun')

  const retainedIds = useExperimentField('retainedIds')

  const workcell = useExperimentField('workcell')

  return (
    <>
      <ExperimentResult
        canonicalDraft={canonicalDraft}
        replayRun={(...args) => view.getSnapshot().replayRun(...args)}
        selectedRun={selectedRun}
        retainSelectedRun={(...args) =>
          view.getSnapshot().retainSelectedRun(...args)
        }
        retainedIds={retainedIds}
        workcell={workcell}
        onOpenRuns={(...args) => view.getSnapshot().onOpenRuns(...args)}
      />
    </>
  )
}
