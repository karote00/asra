import { useCallback, useEffect, useState } from 'react'
import { bootstrap, type SimRuntime } from '../init/bootstrap'
import { IDENTITY_POSE } from '../domain/math'
import type { Body, Workcell } from '../domain/workcell'
import type { SpatialCamera } from '../render-app/spatial-layer'
import { DEFAULT_CAMERA } from '../render-app/workcell-frame'
import { BodyEditor } from './body-editor'
import { ErrorNotice } from './fields'
import { useViewport, ViewportControls } from './viewport'

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
  const [runtime, setRuntime] = useState<SimRuntime | null>(null)
  const [revision, setRevision] = useState(0),
    [candidateId, setCandidateId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [camera, setCamera] = useState<SpatialCamera>(() =>
    structuredClone(DEFAULT_CAMERA)
  )
  const [grid, setGrid] = useState(true),
    [error, setError] = useState(''),
    [status, setStatus] = useState('Starting local runtime…')
  useEffect(() => {
    if (!host) return
    let active = true,
      loaded: SimRuntime | undefined,
      unsubscribe: (() => void) | undefined
    void bootstrap(host)
      .then((value) => {
        loaded = value
        if (!active) {
          void value.dispose()
          return
        }
        unsubscribe = value.subscribe(() => setRevision((value) => value + 1))
        setRuntime(value)
        setCandidateId(value.getCandidates()[0]?.id ?? null)
        setStatus('Local runtime ready')
      })
      .catch((reason) => {
        if (active) {
          setError(String(reason))
          setStatus('Startup failed. Reload after correcting the error.')
        }
      })
    return () => {
      active = false
      unsubscribe?.()
      void loaded?.dispose()
    }
  }, [host])
  let workcell: Workcell | null = null
  let modelError = ''
  const candidates = runtime?.getCandidates() ?? []
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
  const select = useCallback((id: string | null) => setSelectedId(id), [])
  useViewport(runtime, workcell, selectedId, camera, grid)
  const perform = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action()
      setError('')
      setStatus(message)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      setStatus('Action rejected; the model was not changed')
    }
  }
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
    void perform(async () => {
      await runtime.features.edit.upsert(candidateId, body)
      setSelectedId(body.id)
    }, 'Fixture added · one Undo action')
  }
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
        <span className="local-badge">
          <i />
          Private by default
        </span>
      </header>
      <div className="commandbar">
        <div className="breadcrumb">
          WORKSPACE <span>/</span> Workcell
        </div>
        <div className="commands">
          <button
            disabled={!runtime}
            onClick={() =>
              runtime &&
              void perform(
                () => runtime.features.history.undo(),
                'Undo applied'
              )
            }
          >
            ↶ Undo
          </button>
          <button
            disabled={!runtime}
            onClick={() =>
              runtime &&
              void perform(
                () => runtime.features.history.redo(),
                'Redo applied'
              )
            }
          >
            ↷ Redo
          </button>
          <span className="divider" />
          <button
            disabled={!runtime}
            onClick={() =>
              runtime &&
              void perform(async () => {
                const id = await runtime.features.edit.createCandidate(
                  'New workcell',
                  { version: 1, robotRootId: null, bodies: [] }
                )
                setCandidateId(id)
                setSelectedId(null)
              }, 'Blank workcell created')
            }
          >
            + New workcell
          </button>
          <button disabled={!runtime || !workcell} onClick={addBody}>
            + Add fixture
          </button>
        </div>
      </div>
      {error && <ErrorNotice message={error} onDismiss={() => setError('')} />}
      {modelError && (
        <div className="error-notice" role="alert">
          {modelError}. Correct the model or use Undo; analysis is unavailable.
        </div>
      )}
      <main className="work-area">
        <aside className="hierarchy-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">MODEL</span>
              <h2>Workcell hierarchy</h2>
            </div>
            <span className="count">{workcell?.bodies.length ?? 0}</span>
          </div>
          <div className="candidate-picker">
            <label>
              Candidate
              <select
                aria-label="Candidate"
                value={candidateId ?? ''}
                onChange={(event) => {
                  setCandidateId(event.target.value)
                  setSelectedId(null)
                }}
              >
                {candidates.length === 0 && (
                  <option value="">No workcell — create one or Redo</option>
                )}
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
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
                onChange={(event) => setGrid(event.target.checked)}
              />
              Grid
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
          />
          <div className="viewport-summary">
            <span>{selected?.name ?? 'Select an object to inspect'}</span>
            <span>
              {workcell?.bodies.reduce(
                (sum, body) => sum + body.colliders.length,
                0
              ) ?? 0}{' '}
              analysis shapes · meters
            </span>
          </div>
        </section>
        <aside className="properties-panel">
          {selected && workcell && runtime && candidateId ? (
            <BodyEditor
              key={`${candidateId}:${selected.id}:${revision}`}
              body={selected}
              workcell={workcell}
              onApply={(body) =>
                perform(
                  () => runtime.features.edit.upsert(candidateId, body),
                  'Properties applied · one Undo action'
                )
              }
              onRemove={() => {
                if (
                  window.confirm(
                    'Delete this object and all its descendants? You can Undo this action.'
                  )
                )
                  void perform(async () => {
                    await runtime.features.edit.remove(candidateId, selected.id)
                    setSelectedId(null)
                  }, 'Object removed')
              }}
            />
          ) : (
            <div className="empty-inspector">
              <span className="eyebrow">INSPECTOR</span>
              <div className="empty-icon">◇</div>
              <h2>A closer look.</h2>
              <p>
                Select a body in the scene or hierarchy to edit its mounting,
                joints, and analysis shapes.
              </p>
              <div className="scope-note">
                <strong>Geometry, not guarantees.</strong>
                <p>
                  This workbench executes experiments. Real equipment and safety
                  decisions require independent validation.
                </p>
              </div>
            </div>
          )}
        </aside>
      </main>
      <footer className="statusbar">
        <span>
          <i className={runtime ? 'ready-dot' : 'pending-dot'} />
          <span role="status">{status}</span>
        </span>
        <span>
          Machine-scale geometry <span className="footer-dot">·</span> CUSTOM
          renderer <span className="footer-dot">·</span> Not a released product
        </span>
      </footer>
    </div>
  )
}
