import { type Workcell } from '../../domain/workcell'
import type { SimRuntime } from '../../init/bootstrap'
import type { RunRecord } from '../../storage/run-record'
import { GlbPreview } from '../imports/glb-preview'
import { TrajectoryImportPanel } from '../imports/trajectory-import-panel'
import { type VisualPreview } from '../imports/visual-preview'
import { RunProgress } from '../results/run-progress'
import { PlaybackControls } from '../viewport/playback-controls'
import { ExperimentFields } from './experiment-fields'
import { ExperimentResult } from './experiment-result'
import { PlaybackView } from './playback-view'
import { PreflightView } from './preflight-view'
import { useExperimentController } from './use-experiment-controller'

type Perform = (
  action: (assertCurrent: () => void) => Promise<unknown>,
  message: string
) => Promise<void>

export function ExperimentPanel({
  runtime,
  candidateId,
  workcell,
  revision,
  perform,
  onPlayback,
  runs,
  retainedIds,
  onRun,
  onOpenRuns,
  onVisualPreview,
  isCurrent,
  visualImportActive,
  previewActive = true
}: {
  runtime: SimRuntime
  candidateId: string
  workcell: Workcell
  revision: number
  perform: Perform
  onPlayback: (value: PlaybackView | null) => void
  runs: readonly RunRecord[]
  retainedIds: ReadonlySet<string>
  onRun: (run: RunRecord) => void
  onOpenRuns: () => void
  onVisualPreview: (preview: VisualPreview | null) => void
  isCurrent: (runtime: SimRuntime) => boolean
  visualImportActive: boolean
  previewActive?: boolean
}) {
  const {
    methods,
    canonicalDraft,
    experiments,
    experimentId,
    setExperimentId,
    canonical,
    name,
    setName,
    draft,
    exclusions,
    setExclusions,
    preflight,
    setPreflight,
    warnings,
    setWarnings,
    running,
    runningInput,
    error,
    setError,
    active,
    canonicalKey,
    changed,
    dirty,
    fail,
    save,
    freshDraft,
    inspect,
    replayCurrent,
    replayRun,
    run,
    selectedRun,
    retainSelectedRun
  } = useExperimentController({
    runtime,
    candidateId,
    workcell,
    revision,
    perform,
    onPlayback,
    runs,
    onRun
  })

  return (
    <div
      className="experiment-panel h-full flex flex-col [&_>_.panel-heading]:flex-none
        [&_>_.panel-heading]:border-b [&_>_.panel-heading]:border-b-sim-divider
        [&_>_.panel-heading]:pt-[19px]"
    >
      <div
        className="panel-heading flex items-center justify-between pt-[23px] px-5 pb-[17px]
          gap-[10px] [&_h2]:mt-[6px]"
      >
        <div>
          <span className="eyebrow text-[9px] tracking-[1.3px] text-sim-muted font-bold">
            EXPERIMENT
          </span>

          <h2>Collision & clearance</h2>
        </div>

        <span className="count text-[10px] bg-sim-subtle text-sim-secondary py-1 px-[7px] rounded-[4px]">
          {experiments.length}
        </span>
      </div>

      <div
        className="experiment-scroll overflow-auto p-[18px] flex flex-col gap-[17px]
          min-h-0 [&_>_*]:shrink-0 [&_button]:text-[11px] [&_textarea]:resize-y
          [&_textarea]:text-[11px] [&_textarea]:leading-[1.6] [&_summary]:flex
          [&_summary]:flex-wrap [&_summary]:justify-between
          [&_summary]:items-baseline [&_summary]:[gap:5px_8px]
          [&_summary_>_span]:float-none [&_summary_>_span]:text-right
          overflow-x-hidden [&_label]:wrap-anywhere [&_button]:wrap-anywhere
          [&_summary]:wrap-anywhere [&_.section-heading]:flex-wrap
          [&_.section-heading]:gap-2 [&_.preview-time]:tabular-nums"
      >
        <div
          className="experiment-picker flex items-end gap-2 [&_label]:flex-1
            [&_label]:min-w-0 [&_button]:flex-none [&_button]:whitespace-nowrap"
        >
          <label>
            Experiment
            <select
              aria-label="Experiment"
              value={canonical?.id ?? ''}
              onChange={(event) =>
                event.target.value
                  ? setExperimentId(event.target.value)
                  : freshDraft()
              }
            >
              <option value="">New draft</option>

              {experiments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - r{item.definition.revision}
                </option>
              ))}
            </select>
          </label>

          <button onClick={freshDraft}>New experiment</button>
        </div>

        {!canonical && (
          <label>
            Name
            <input
              aria-label="Experiment name"
              value={name}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        )}

        {canonical && !dirty && (
          <PlaybackControls
            key={`${experimentId}:${canonicalKey}:${revision}`}
            interval={canonical.definition.interval}
            active={previewActive && !running}
            onSample={replayCurrent}
            onReset={() => onPlayback(null)}
          />
        )}

        <ExperimentFields
          draft={draft}
          onChange={changed}
          exclusions={exclusions}
          onExclusions={(value) => {
            setExclusions(value)

            setPreflight(null)
          }}
          workcell={workcell}
          methods={methods}
        />

        <TrajectoryImportPanel
          key={`${canonical?.id ?? 'new'}:${canonical?.definition.revision ?? 0}`}
          workcell={workcell}
          trajectory={draft.trajectory}
          onAccept={(value) => {
            const first = value.trajectory.keyframes[0]

            const last = value.trajectory.keyframes.at(-1)

            if (!first || !last)
              throw new Error('Accepted trajectory has no keyframes')

            changed({
              ...draft,
              trajectory: value.trajectory,
              sourceUnits: value.sourceUnits,
              interval: [first.time, last.time]
            })
          }}
        />

        <GlbPreview
          runtime={runtime}
          candidateId={candidateId}
          workcell={workcell}
          onPreview={onVisualPreview}
          isCurrent={isCurrent}
          active={visualImportActive}
        />

        <div
          className="draft-actions flex items-center justify-between gap-[10px] py-3 px-0
            border-t border-t-sim-divider border-b border-b-sim-divider
            [&_span]:text-[10px] [&_span]:text-sim-muted"
        >
          <span>
            {dirty ? 'Unsaved experiment draft' : 'Experiment unchanged'}
          </span>

          <button
            className="primary bg-sim-accent text-[#fff] border-sim-accent [&:hover]:bg-sim-accent-hover"
            disabled={!dirty}
            onClick={() => void save()}
          >
            {canonical ? 'Save experiment' : 'Create experiment'}
          </button>
        </div>

        <button
          className="wide w-full"
          disabled={!canonical || dirty || running}
          onClick={() => {
            try {
              inspect()

              setError('')
            } catch (reason) {
              fail(reason)
            }
          }}
        >
          Run preflight
        </button>

        {runningInput && (
          <RunProgress
            analysis={runtime.features.analysis}
            snapshotId={runningInput.snapshotId}
            budget={runningInput.budget}
            onCancel={() => active.current?.abort()}
          />
        )}

        <PreflightView
          draft={draft}
          preflight={preflight}
          warnings={warnings}
          setWarnings={setWarnings}
          changed={changed}
        />

        <div className="run-actions flex gap-2 [&_>_.primary]:flex-1">
          <button
            className="primary bg-sim-accent text-[#fff] border-sim-accent [&:hover]:bg-sim-accent-hover"
            disabled={!canonical || dirty || running}
            onClick={() => void run()}
          >
            {running ? 'Formal analysis running…' : 'Run formal analysis'}
          </button>
        </div>

        {error && (
          <p
            className="inline-error text-sim-error-text bg-sim-error p-[11px] rounded-[5px]
              text-[11px] leading-[1.6] wrap-anywhere"
            role="alert"
          >
            {error}
          </p>
        )}

        <ExperimentResult
          canonicalDraft={canonicalDraft}
          replayRun={replayRun}
          selectedRun={selectedRun}
          retainSelectedRun={retainSelectedRun}
          retainedIds={retainedIds}
          workcell={workcell}
          onOpenRuns={onOpenRuns}
        />
      </div>
    </div>
  )
}
