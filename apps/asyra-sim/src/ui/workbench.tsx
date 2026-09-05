import { useCallback, useEffect, useState } from 'react'
import { ThemeToggle } from './theme-toggle'
import type { SimRuntime } from '../init/bootstrap'
import { IDENTITY_POSE } from '../domain/math'
import { jointValuesAt, type Body, type Workcell } from '../domain/workcell'
import type { SpatialCamera } from '../render-app/spatial-layer'
import {
  createWorkcellFrame,
  DEFAULT_CAMERA
} from '../render-app/workcell-frame'
import { BodyEditor } from './body-editor'
import { ErrorNotice } from './fields'
import { useHistoryShortcuts, type HistoryDirection } from './history-shortcuts'
import { useViewport, ViewportControls } from './viewport'
import { useProjectRuntime } from './use-project-runtime'
import { ProjectControls } from './project-controls'
import { downloadRecovery } from './download-project'
import { ExperimentPanel, type PlaybackView } from './experiment-panel'
import type { RunRecord } from '../storage/run-record'
import { RunLibrary } from './run-library'
import { isPresentedRunStale } from './analysis-result-view'
import { definitionToDraft } from './experiment-draft'
import type { VisualPreview } from './glb-preview'

function Hierarchy({
  workcell,
  selected,
  onSelect
}: {
  workcell: Workcell
  selected: string | null
  onSelect: (id: string) => void
}) {
  const rows = (parent: string | null, depth: number): React.ReactNode =>
    workcell.bodies
      .filter((body) => body.parentId === parent)
      .map((body) => (
        <div key={body.id}>
          <button
            role="treeitem"
            data-object-id={body.id}
            aria-selected={selected === body.id}
            className={`tree-row ${selected === body.id ? 'selected' : ''}`}
            style={{ paddingLeft: 16 + depth * 13 }}
            onClick={() => onSelect(body.id)}
          >
            <span className={`object-symbol ${body.role}`}>
              {body.joint.kind === 'fixed' ? '◇' : '◉'}
            </span>
            <span>{body.name}</span>
            {!body.visible && <span className="muted">hidden</span>}
          </button>
          {rows(body.id, depth + 1)}
        </div>
      ))
  return (
    <div role="tree" aria-label="Workcell hierarchy">
      {rows(null, 0)}
    </div>
  )
}

export function Workbench() {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [candidateId, setCandidateId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hierarchyOpen, setHierarchyOpen] = useState(false)
  const [inspector, setInspector] = useState<'object' | 'experiment'>('object')
  const [playback, setPlayback] = useState<PlaybackView | null>(null)
  const [visualPreview, setVisualPreview] = useState<VisualPreview | null>(null)
  const [wireframe, setWireframe] = useState(false)
  const onVisualPreview = useCallback((value: VisualPreview | null) => {
    setVisualPreview(value)
    if (value) {
      setPlayback(null)
      setWireframe(false)
    }
  }, [])
  const [pendingRuns, setPendingRuns] = useState<RunRecord[]>([])
  const [showRuns, setShowRuns] = useState(false)
  const [camera, setCamera] = useState<SpatialCamera>(() =>
    structuredClone(DEFAULT_CAMERA)
  )
  const [grid, setGrid] = useState(true),
    [error, setError] = useState(''),
    [status, setStatus] = useState('Starting local runtime…')
  const onRuntime = useCallback((value: SimRuntime | null) => {
    setCandidateId(value?.getCandidates()[0]?.id ?? null)
    setSelectedId(null)
    setHierarchyOpen(false)
    setInspector('object')
    setPlayback(null)
    setVisualPreview(null)
    setWireframe(false)
    if (value) setPendingRuns([])
    setShowRuns(false)
    setCamera(structuredClone(DEFAULT_CAMERA))
    setGrid(true)
    setError('')
    setStatus(value ? 'Local runtime ready' : 'Replacing document…')
  }, [])
  const { resources, lifecycle, revision } = useProjectRuntime(host, onRuntime)
  const runtime = lifecycle.runtime,
    ready = lifecycle.status === 'ready'
  const isCurrent = useCallback(
    (value: SimRuntime) => {
      const state = resources?.controller.getState()
      return state?.status === 'ready' && state.runtime === value
    },
    [resources]
  )
  let workcell: Workcell | null = null
  let modelError = ''
  const candidates = runtime?.getCandidates() ?? []
  const hasSelectedCandidate = candidates.some(
    (candidate) => candidate.id === candidateId
  )
  const loadIssues = runtime?.getLoadIssues() ?? []
  let retainedRuns: readonly RunRecord[] = [],
    runError = ''
  try {
    retainedRuns = runtime?.getRuns() ?? []
  } catch (reason) {
    runError = `Cannot read retained runs: ${reason instanceof Error ? reason.message : String(reason)}`
  }
  const retainedIds = new Set(retainedRuns.map((run) => run.result.runId))
  const runs = [
    ...new Map(
      [...pendingRuns, ...retainedRuns].map((run) => [run.result.runId, run])
    ).values()
  ]
  const unsavedRunCount = pendingRuns.filter(
    (run) => !retainedIds.has(run.result.runId)
  ).length
  useEffect(() => {
    if (!unsavedRunCount) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [unsavedRunCount])
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
  const selected = workcell?.bodies.find((body) => body.id === selectedId)
  const select = useCallback(
    (id: string | null) => {
      if (runtime && isCurrent(runtime)) {
        setSelectedId(id)
        setHierarchyOpen(false)
        setInspector('object')
        setPlayback(null)
      }
    },
    [runtime, isCurrent]
  )
  useViewport(
    runtime,
    visualPreview?.workcell ?? playback?.workcell ?? workcell,
    playback?.bodyIds[0] ?? selectedId,
    camera,
    grid,
    isCurrent,
    playback?.joints,
    wireframe,
    visualPreview?.prepared
  )
  const perform = useCallback(
    async (
      action: (assertCurrent: () => void) => Promise<unknown>,
      message: string
    ) => {
      const assertCurrent = () => {
        if (!runtime || !isCurrent(runtime))
          throw new Error('The document is no longer active')
      }
      try {
        assertCurrent()
        await action(assertCurrent)
        assertCurrent()
        setError('')
        setStatus(message)
      } catch (reason) {
        if (!runtime || !isCurrent(runtime)) return
        setError(reason instanceof Error ? reason.message : String(reason))
        setStatus('Action rejected; the model was not changed')
      }
    },
    [runtime, isCurrent]
  )
  const performHistory = useCallback(
    (direction: HistoryDirection) => {
      if (!runtime) return
      void perform(
        () => runtime.features.history[direction](),
        direction === 'undo' ? 'Undo applied' : 'Redo applied'
      )
    },
    [runtime, perform]
  )
  useHistoryShortcuts(ready, performHistory)
  const addBody = () => {
    if (!runtime || !candidateId) return
    const body: Body = {
      id: crypto.randomUUID(),
      name: 'New fixture',
      parentId: null,
      role: 'fixture',
      pose: { ...IDENTITY_POSE, position: [1, 0.25, 1] },
      joint: { kind: 'fixed', axis: [0, 1, 0], value: 0, min: 0, max: 0 },
      colliders: [
        {
          id: 'shape',
          pose: IDENTITY_POSE,
          geometry: { kind: 'box', size: [0.5, 0.5, 0.5] }
        }
      ],
      visible: true,
      color: 0x8ba6b4
    }
    void perform(async (assertCurrent) => {
      await runtime.features.edit.upsert(candidateId, body)
      assertCurrent()
      setSelectedId(body.id)
    }, 'Fixture added · one Undo action')
  }
  let runtimeStatus = status
  if (lifecycle.status === 'failed') runtimeStatus = 'Runtime unavailable'
  else if (lifecycle.status === 'replacing')
    runtimeStatus = 'Replacing document…'
  return (
    <div className="workbench">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            a<span>·</span>
          </span>
          <strong>
            asyra<span>sim</span>
          </strong>
          <span className="build-label">DEVELOPMENT</span>
        </div>
        <div className="project-title">
          Robot workcell experiments<span>Local workspace</span>
        </div>
        {resources && (
          <ProjectControls
            session={resources.session}
            ready={ready}
            unsavedRunCount={unsavedRunCount}
          />
        )}
        <ThemeToggle />
        <span className="local-badge">
          <i />
          Private by default
        </span>
      </header>
      <div className="commandbar">
        <div className="commands">
          <button
            className="model-toggle"
            aria-expanded={hierarchyOpen}
            onClick={() => setHierarchyOpen((value) => !value)}
          >
            Model
          </button>
          <button
            disabled={!ready}
            onClick={() => performHistory('undo')}
            aria-keyshortcuts="Meta+Z Control+Z"
            title="Undo (⌘Z / Ctrl+Z)"
          >
            Undo
          </button>
          <button
            disabled={!ready}
            onClick={() => performHistory('redo')}
            aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
            title="Redo (⌘⇧Z / Ctrl+Shift+Z)"
          >
            Redo
          </button>
          <span className="divider" />
          <button
            disabled={!ready || !workcell}
            aria-pressed={inspector === 'experiment'}
            onClick={() => setInspector('experiment')}
          >
            Experiments
          </button>
          <button
            disabled={!ready || !!runError}
            aria-label="Runs & compare"
            onClick={() => setShowRuns(true)}
          >
            Results
          </button>
          <button
            disabled={!ready}
            aria-pressed={inspector === 'object'}
            onClick={() => {
              setInspector('object')
              setPlayback(null)
            }}
          >
            Object
          </button>
        </div>
      </div>
      {error && <ErrorNotice message={error} onDismiss={() => setError('')} />}
      {runError && (
        <div className="error-notice" role="alert">
          {runError}
        </div>
      )}
      {lifecycle.error && (
        <div className="lifecycle-notice" role="alert">
          <span>
            {lifecycle.error}
            {lifecycle.status === 'failed'
              ? ' No editable runtime is available. Correct the cause before reloading.'
              : ''}
          </span>
          {lifecycle.recoveryAvailable && (
            <button
              onClick={() => {
                try {
                  const snapshot = resources?.controller.getRecovery()
                  if (snapshot) downloadRecovery(snapshot)
                } catch (reason) {
                  setError(String(reason))
                }
              }}
            >
              Download recovery
            </button>
          )}
        </div>
      )}
      {modelError && (
        <div className="error-notice" role="alert">
          {modelError}. Correct the model or use Undo; analysis is unavailable.
        </div>
      )}
      {loadIssues.length > 0 && (
        <details
          className="load-diagnostics"
          data-testid="load-diagnostics"
          key={lifecycle.generation}
        >
          <summary>
            {loadIssues.length} load review requirement
            {loadIssues.length === 1 ? '' : 's'} · source diagnostics retained
          </summary>
          <p>
            Recovered fields are not proof of the original input. Formal
            analysis must remain blocked until these requirements are resolved.
          </p>
          <ul>
            {loadIssues.slice(0, 20).map((issue, index) => (
              <li key={index}>
                <code>{issue.path}</code>: {issue.message}
              </li>
            ))}
          </ul>
          {loadIssues.length > 20 && (
            <p>
              Showing the first 20 requirements; all are retained in saved data.
            </p>
          )}
        </details>
      )}
      <main className="work-area">
        <aside className={`hierarchy-panel ${hierarchyOpen ? 'is-open' : ''}`}>
          <div className="panel-heading">
            <div>
              <span className="eyebrow">MODEL</span>
              <h2>Workcell hierarchy</h2>
            </div>
            <span className="count">{workcell?.bodies.length ?? 0}</span>
          </div>
          <div className="candidate-picker">
            <div className="model-actions">
              <button
                disabled={!ready}
                onClick={() =>
                  runtime &&
                  void perform(async (assertCurrent) => {
                    const id = await runtime.features.edit.createCandidate(
                      'New workcell',
                      { version: 1, robotRootId: null, bodies: [] }
                    )
                    assertCurrent()
                    setCandidateId(id)
                    setSelectedId(null)
                    setPlayback(null)
                  }, 'Blank workcell created')
                }
              >
                New workcell
              </button>
              <button disabled={!ready || !workcell} onClick={addBody}>
                Add fixture
              </button>
            </div>
            <label>
              Candidate
              <select
                aria-label="Candidate"
                disabled={!ready}
                value={hasSelectedCandidate ? (candidateId ?? '') : ''}
                onChange={(event) => {
                  setCandidateId(event.target.value)
                  setSelectedId(null)
                  setPlayback(null)
                }}
              >
                {candidates.length === 0 && (
                  <option value="">
                    {ready
                      ? 'No workcell — create one or Redo'
                      : 'No active document'}
                  </option>
                )}
                {candidates.length > 0 && !hasSelectedCandidate && (
                  <option value="">
                    No active candidate — select one or Redo
                  </option>
                )}
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="duplicate-candidate"
              disabled={!ready || !workcell}
              onClick={() => {
                if (!runtime || !candidateId) return
                const name = window.prompt(
                  'Name the independent candidate. Copies committed model and experiment inputs only; unsaved drafts and historical runs are not copied.',
                  'New candidate'
                )
                if (name === null) return
                void perform(async (assertCurrent) => {
                  const id = await runtime.features.edit.duplicateCandidate(
                    candidateId,
                    name
                  )
                  assertCurrent()
                  setCandidateId(id)
                  setSelectedId(null)
                  setPlayback(null)
                }, 'Candidate duplicated · one Undo action')
              }}
            >
              Duplicate candidate
            </button>
          </div>
          {workcell && (
            <Hierarchy
              workcell={workcell}
              selected={selectedId}
              onSelect={select}
            />
          )}
          <div className="hierarchy-note">
            <span className="eyebrow">MODEL NOTES</span>
            <p>
              Synthetic six-axis example.
              <br />
              Not a vendor-calibrated model.
            </p>
            <p>
              Visibility does not determine which objects enter an analysis.
            </p>
          </div>
        </aside>
        <section className="viewport-panel" aria-label="3D workcell">
          <div className="viewport-top">
            <span>
              <i />
              PERSPECTIVE <b>Y ↑</b>
            </span>
            <label>
              <input
                type="checkbox"
                checked={grid}
                disabled={!ready}
                onChange={(event) => setGrid(event.target.checked)}
              />
              Grid
            </label>
            <label>
              <input
                type="checkbox"
                checked={wireframe}
                disabled={!ready}
                onChange={(event) => setWireframe(event.target.checked)}
              />
              Wireframe
            </label>
          </div>
          <div
            className="canvas-host"
            ref={setHost}
            data-testid="workcell-canvas"
          />
          <ViewportControls
            host={host}
            runtime={runtime}
            camera={camera}
            onCamera={setCamera}
            onSelect={select}
            isCurrent={isCurrent}
            getFitMeshes={() => {
              const displayed =
                visualPreview?.workcell ?? playback?.workcell ?? workcell
              if (!runtime || !displayed || !isCurrent(runtime)) return []
              return createWorkcellFrame(
                displayed,
                {
                  camera,
                  selectedId,
                  grid: false,
                  joints: playback?.joints,
                  wireframe
                },
                runtime.getVisualAssets(displayed, visualPreview?.prepared)
              ).meshes
            }}
          />
          <div className="viewport-summary">
            {visualPreview && <strong>Visual preview · not accepted</strong>}
            <span>
              {playback
                ? `${playback.historical ? 'Historical run replay' : 'Sampled preview'} · ${playback.time.toFixed(4)} s`
                : (selected?.name ?? 'Select an object to inspect')}
            </span>
            <span>
              {workcell?.bodies.reduce(
                (sum, body) =>
                  sum + (body.visuals?.length || body.colliders.length),
                0
              ) ?? 0}{' '}
              analysis parts · meters
            </span>
          </div>
        </section>
        <aside className="properties-panel">
          {ready && runtime && candidateId && workcell && (
            <div
              className="inspector-content"
              hidden={inspector !== 'experiment'}
            >
              <ExperimentPanel
                key={`${lifecycle.generation}:${candidateId}`}
                runtime={runtime}
                candidateId={candidateId}
                workcell={workcell}
                revision={revision}
                perform={perform}
                onPlayback={setPlayback}
                onVisualPreview={onVisualPreview}
                isCurrent={isCurrent}
                visualImportActive={inspector === 'experiment' && !playback}
                previewActive={
                  inspector === 'experiment' &&
                  !showRuns &&
                  !visualPreview &&
                  !playback?.historical
                }
                runs={runs}
                retainedIds={retainedIds}
                onRun={(run) => {
                  if (isCurrent(runtime))
                    setPendingRuns((current) => [...current, run])
                }}
                onOpenRuns={() => setShowRuns(true)}
              />
            </div>
          )}
          <div className="inspector-content" hidden={inspector !== 'object'}>
            {ready && selected && workcell && runtime && candidateId ? (
              <BodyEditor
                key={`${lifecycle.generation}:${candidateId}:${selected.id}`}
                body={selected}
                workcell={workcell}
                onChange={(body) =>
                  perform(
                    () => runtime.features.edit.upsert(candidateId, body),
                    'Property updated - one Undo action'
                  )
                }
                onRemove={() => {
                  if (
                    window.confirm(
                      'Delete this object and all its descendants? You can Undo this action.'
                    )
                  )
                    void perform(async (assertCurrent) => {
                      await runtime.features.edit.remove(
                        candidateId,
                        selected.id
                      )
                      assertCurrent()
                      setSelectedId(null)
                    }, 'Object removed')
                }}
              />
            ) : (
              <div className="empty-inspector">
                <span className="eyebrow">INSPECTOR</span>
                <div className="empty-icon">◇</div>
                <h2>
                  {lifecycle.status === 'failed'
                    ? 'Runtime unavailable.'
                    : 'A closer look.'}
                </h2>
                <p>
                  {lifecycle.status === 'failed'
                    ? 'Download available recovery data before reloading. No model is currently editable.'
                    : 'Select a body in the scene or hierarchy to edit its mounting, joints, and analysis shapes.'}
                </p>
                <div className="scope-note">
                  <strong>Geometry, not guarantees.</strong>
                  <p>
                    This workbench executes experiments. Real equipment and
                    safety decisions require independent validation.
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>
      {showRuns && ready && runtime && (
        <RunLibrary
          key={lifecycle.generation}
          runtime={runtime}
          isCurrent={() => isCurrent(runtime)}
          runs={runs}
          retainedIds={retainedIds}
          candidateIds={new Set(candidates.map((candidate) => candidate.id))}
          isStale={(run) => {
            try {
              const experiment = runtime.getExperiment(
                run.snapshot.source.experimentId
              )
              return (
                !experiment ||
                isPresentedRunStale(
                  run,
                  runtime.getWorkcell(run.snapshot.source.candidateId),
                  definitionToDraft(experiment.definition)
                )
              )
            } catch {
              return true
            }
          }}
          onRetain={async (run) => {
            if (!isCurrent(runtime))
              throw new Error('The document is no longer active')
            await runtime.features.storage.retain(run)
            if (isCurrent(runtime))
              setStatus(
                'Result retained · save the project for durable storage'
              )
          }}
          onReplay={(snapshot, time, bodyIds) => {
            if (isCurrent(runtime))
              setPlayback({
                workcell: snapshot.workcell,
                joints: jointValuesAt(snapshot.trajectory, time),
                time,
                historical: true,
                bodyIds
              })
          }}
          onCandidate={(id) => {
            setCandidateId(id)
            setSelectedId(null)
            setPlayback(null)
          }}
          onClose={() => setShowRuns(false)}
        />
      )}
      <footer className="statusbar">
        <span>
          <i className={runtime ? 'ready-dot' : 'pending-dot'} />
          <span role="status">{runtimeStatus}</span>
        </span>
        <span data-testid="history-depth">
          Undo steps: {runtime?.getHistoryDepth() ?? 0}
        </span>
        <span>
          Machine-scale geometry <span className="footer-dot">·</span> CUSTOM
          renderer <span className="footer-dot">·</span> Not a released product
        </span>
      </footer>
    </div>
  )
}
