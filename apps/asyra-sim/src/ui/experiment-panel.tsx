import { useEffect, useRef, useState } from 'react'
import type { ExperimentSnapshot, PreflightReport } from '../analysis/contracts'
import type { ExperimentDraft } from '../common-apis/experiment'
import { jointValuesAt, type Workcell } from '../domain/workcell'
import type { SimRuntime } from '../init/bootstrap'
import {
  createDefaultExperimentDraft,
  definitionToDraft,
  formatExclusions,
  parseExclusions
} from './experiment-draft'
import { ExperimentFields } from './experiment-fields'
import { AnalysisResultView, isPresentedRunStale } from './analysis-result-view'
import { TrajectoryImportPanel } from './trajectory-import-panel'
import { GlbPreview, type VisualPreview } from './glb-preview'
import { RunProgress } from './run-progress'
import { PlaybackControls } from './playback-controls'
import type { RunRecord } from '../storage/run-record'
import { version as appVersion } from '../../package.json'

export interface PlaybackView {
  workcell: Workcell
  joints: Readonly<Record<string, number>>
  time: number
  historical: boolean
  bodyIds: readonly string[]
}
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
  const experiments = runtime.getExperiments(candidateId)
  const [experimentId, setExperimentId] = useState(experiments[0]?.id ?? '')
  const canonical = experiments.find((item) => item.id === experimentId) ?? null
  const [name, setName] = useState('New clearance study')
  const [draft, setDraft] = useState<ExperimentDraft>(() =>
    canonical
      ? definitionToDraft(canonical.definition)
      : createDefaultExperimentDraft(workcell)
  )
  const [exclusions, setExclusions] = useState(() =>
    formatExclusions(draft.scope.excludedPairs)
  )
  const [preflight, setPreflight] = useState<PreflightReport | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [runningInput, setRunningInput] = useState<ExperimentSnapshot | null>(
    null
  )
  const [error, setError] = useState('')
  const live = useRef(true),
    active = useRef<AbortController | null>(null)
  const canonicalDraft = canonical
    ? definitionToDraft(canonical.definition)
    : null
  const canonicalKey = JSON.stringify(canonicalDraft)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
      active.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (canonical) {
      setDraft(definitionToDraft(canonical.definition))
      setExclusions(formatExclusions(canonical.definition.scope.excludedPairs))
    }
    setPreflight(null)
    setWarnings([])
    setError('')
    onPlayback(null)
  }, [experimentId, canonicalKey, onPlayback])
  useEffect(() => {
    setPreflight(null)
    setWarnings([])
    onPlayback(null)
  }, [revision, onPlayback])

  const changed = (next: ExperimentDraft) => {
    setDraft(next)
    setPreflight(null)
    setWarnings([])
    onPlayback(null)
  }
  let dirty = !canonical
  try {
    dirty ||=
      JSON.stringify({
        ...draft,
        scope: { ...draft.scope, excludedPairs: parseExclusions(exclusions) }
      }) !== canonicalKey
  } catch {
    dirty = true
  }
  const fail = (reason: unknown) => {
    if (live.current)
      setError(reason instanceof Error ? reason.message : String(reason))
  }
  const save = async () => {
    try {
      const next = {
        ...draft,
        scope: { ...draft.scope, excludedPairs: parseExclusions(exclusions) }
      }
      await perform(async (assertCurrent) => {
        if (canonical)
          await runtime.features.edit.updateExperiment(
            canonical.id,
            canonical.definition.revision,
            next
          )
        else {
          const id = await runtime.features.edit.createExperiment(
            candidateId,
            name,
            next
          )
          assertCurrent()
          if (live.current) setExperimentId(id)
        }
        assertCurrent()
      }, 'Experiment saved - one Undo action')
      if (live.current) setError('')
    } catch (reason) {
      fail(reason)
    }
  }
  const freshDraft = () => {
    setExperimentId('')
    const next = createDefaultExperimentDraft(workcell)
    setDraft(next)
    setExclusions('')
    setName('New clearance study')
    setPreflight(null)
  }
  const inspect = () => {
    if (!canonical || dirty)
      throw new Error('Save the experiment draft before preflight.')
    const report = runtime.preflightExperiment(canonical.id)
    setPreflight(report)
    return report
  }
  const replayCurrent = (value: number) => {
    if (!canonical) return
    try {
      const joints = jointValuesAt(canonical.definition.trajectory, value)
      onPlayback({
        workcell,
        joints,
        time: value,
        historical: false,
        bodyIds: []
      })
    } catch (reason) {
      fail(reason)
    }
  }
  const replayRun = (
    snapshot: ExperimentSnapshot,
    value: number,
    bodyIds: readonly string[]
  ) => {
    onPlayback({
      workcell: snapshot.workcell,
      joints: jointValuesAt(snapshot.trajectory, value),
      time: value,
      historical: true,
      bodyIds
    })
  }
  const run = async () => {
    try {
      inspect()
      if (!canonical) return
      const snapshot = runtime.createExperimentSnapshot(canonical.id, warnings)
      const lineage = runtime.getCandidateLineage(candidateId)
      const candidateName =
        runtime
          .getCandidates()
          .find((candidate) => candidate.id === candidateId)?.name ??
        candidateId
      const runName = `${candidateName.slice(0, 60)} - ${canonical.name.slice(0, 90)} - r${canonical.definition.revision}`
      const controller = new AbortController()
      const environment = {
        appVersion,
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency
      }
      active.current = controller
      setRunning(true)
      setRunningInput(snapshot)
      setError('')
      const result = await runtime.features.analysis.run(snapshot, {
        signal: controller.signal
      })
      if (live.current)
        onRun({
          version: 1,
          name: runName,
          retainedAt: new Date().toISOString(),
          environment,
          snapshot,
          result,
          ...(lineage ? { lineage } : {})
        })
    } catch (reason) {
      fail(reason)
    } finally {
      if (live.current) {
        setRunning(false)
        setRunningInput(null)
      }
      active.current = null
    }
  }
  const selectedRun = [...runs]
    .reverse()
    .find((item) => item.snapshot.source.experimentId === experimentId)
  return (
    <div className="experiment-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">EXPERIMENT</span>
          <h2>Collision & clearance</h2>
        </div>
        <span className="count">{experiments.length}</span>
      </div>
      <div className="experiment-scroll">
        <div className="experiment-picker">
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
          methods={runtime.getMethodDescriptors()}
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
        <div className="draft-actions">
          <span>
            {dirty ? 'Unsaved experiment draft' : 'Experiment unchanged'}
          </span>
          <button
            className="primary"
            disabled={!dirty}
            onClick={() => void save()}
          >
            {canonical ? 'Save experiment' : 'Create experiment'}
          </button>
        </div>
        <button
          className="wide"
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
        {preflight && (
          <section className="preflight-card" data-testid="preflight-report">
            <div className="section-heading">
              <h3>Preflight</h3>
              <span>
                {preflight.estimate.pairCount} pairs -{' '}
                {preflight.estimate.workUnits} work units
              </span>
            </div>
            <p className="hint">No reliable time estimate yet.</p>
            {preflight.blockers.map((issue, index) => (
              <p className="issue blocker" key={index}>
                <strong>Blocked - {issue.code}</strong>
                {issue.message}
              </p>
            ))}
            {preflight.assumptions.map((issue, index) => (
              <div className="issue assumption" key={index}>
                <strong>Assumption</strong>
                <span>{issue.message}</span>
                {issue.bodyIds && (
                  <button
                    onClick={() =>
                      changed({
                        ...draft,
                        scope: {
                          ...draft.scope,
                          acknowledgedExcludedVisibleBodyIds: [
                            ...new Set([
                              ...draft.scope.acknowledgedExcludedVisibleBodyIds,
                              ...(issue.bodyIds ?? [])
                            ])
                          ]
                        }
                      })
                    }
                  >
                    Acknowledge in draft
                  </button>
                )}
              </div>
            ))}
            {preflight.resourceWarnings.map((issue) => (
              <label className="issue warning checkbox" key={issue.code}>
                <input
                  type="checkbox"
                  checked={warnings.includes(issue.code)}
                  onChange={(event) =>
                    setWarnings((current) =>
                      event.target.checked
                        ? [...new Set([...current, issue.code])]
                        : current.filter((code) => code !== issue.code)
                    )
                  }
                />
                <span>{issue.message}</span>
              </label>
            ))}
            {!preflight.blockers.length &&
              !preflight.assumptions.length &&
              !preflight.resourceWarnings.length && (
                <p className="issue ready">Ready for formal local analysis.</p>
              )}
          </section>
        )}
        <div className="run-actions">
          <button
            className="primary"
            disabled={!canonical || dirty || running}
            onClick={() => void run()}
          >
            {running ? 'Formal analysis running…' : 'Run formal analysis'}
          </button>
        </div>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        {selectedRun && canonicalDraft && (
          <>
            <div className="retention-actions">
              <p className="hint">
                {retainedIds.has(selectedRun.result.runId)
                  ? 'Retained in this project. Save the project for durable storage.'
                  : 'Temporary result. Explicitly retain it before saving or replacing this project.'}
              </p>
              <button
                disabled={retainedIds.has(selectedRun.result.runId)}
                onClick={() =>
                  void perform(
                    () => runtime.features.storage.retain(selectedRun),
                    'Result retained - save the project for durable storage'
                  )
                }
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
      </div>
    </div>
  )
}
