'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Braces,
  CircleCheck,
  CircleX,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  StepForward
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ATLAS_CASES,
  getAtlasCase,
  type AtlasCaseDefinition
} from '@/lib/runtime-atlas/case-definitions.mjs'
import { RuntimeAtlasProjection } from './runtime-atlas-projection'

type EvidenceStatus = 'completed' | 'rejected' | 'failed'

interface EvidenceEntry {
  actionId: string
  caseId: string
  failure?: { message: string; name: string }
  input: Record<string, unknown>
  label: string
  output?: unknown
  owner: string
  runId: string
  sequence: number
  status: EvidenceStatus
}

interface RuntimeSnapshot {
  actionIndex: number
  caseId: string
  complete: boolean
  definition: AtlasCaseDefinition
  disposed: boolean
  evidence: EvidenceEntry[]
  runId: string
  sequence: number
  terminal: boolean
}

type WorkerResponse =
  | { id: number; ok: true; snapshot?: RuntimeSnapshot }
  | { id: number; ok: false; error: { message: string; name: string } }

interface PendingRequest {
  reject: (error: Error) => void
  resolve: (snapshot: RuntimeSnapshot | undefined) => void
}

const wait = (duration: number) =>
  new Promise((resolve) => globalThis.setTimeout(resolve, duration))

const WORKER_RESET_MESSAGE = 'Runtime Atlas worker was reset'

const latestOutput = (snapshot: RuntimeSnapshot | null) =>
  snapshot?.evidence.at(-1)?.output

const outputPreview = (snapshot: RuntimeSnapshot | undefined) => {
  if (!snapshot?.terminal) return 'Run this case to create comparable evidence.'
  const final = snapshot.evidence.at(-1)
  return JSON.stringify(
    {
      action: final?.label,
      output: final?.output,
      owner: final?.owner,
      status: final?.status
    },
    null,
    2
  )
}

const statusFor = (snapshot: RuntimeSnapshot | null) => {
  const final = snapshot?.evidence.at(-1)
  if (!final) return { label: 'READY', tone: 'resting' }
  if (final.status === 'failed') return { label: 'FAILED', tone: 'failure' }
  if (final.status === 'rejected') {
    return { label: 'REJECTED · NO CHANGE', tone: 'rejected' }
  }
  if (snapshot?.terminal) return { label: 'ACCEPTED', tone: 'accepted' }
  return { label: 'RUNNING', tone: 'active' }
}

export function RuntimeAtlas() {
  const [selectedCaseId, setSelectedCaseId] = useState(ATLAS_CASES[0].id)
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null)
  const [completedRuns, setCompletedRuns] = useState<
    Record<string, RuntimeSnapshot>
  >({})
  const [compareCaseId, setCompareCaseId] = useState(ATLAS_CASES[1].id)
  const [technical, setTechnical] = useState(false)
  const [autoRunning, setAutoRunning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const snapshotRef = useRef<RuntimeSnapshot | null>(null)
  const pendingRef = useRef(new Map<number, PendingRequest>())
  const requestIdRef = useRef(0)
  const runGenerationRef = useRef(0)
  const activeRunRef = useRef<number | null>(null)

  const definition = useMemo(
    () => getAtlasCase(selectedCaseId),
    [selectedCaseId]
  )

  const commitSnapshot = useCallback((next: RuntimeSnapshot) => {
    snapshotRef.current = next
    setSnapshot(next)
    if (next.complete) {
      setCompletedRuns((current) => ({ ...current, [next.caseId]: next }))
    }
  }, [])

  const terminateWorker = useCallback(() => {
    pendingRef.current.forEach(({ reject }) =>
      reject(new Error(WORKER_RESET_MESSAGE))
    )
    pendingRef.current.clear()
    workerRef.current?.terminate()
    workerRef.current = null
  }, [])

  const send = useCallback(
    (
      worker: Worker,
      message: { type: 'start'; caseId: string } | { type: 'advance' }
    ) => {
      requestIdRef.current += 1
      const id = requestIdRef.current
      return new Promise<RuntimeSnapshot | undefined>((resolve, reject) => {
        pendingRef.current.set(id, { reject, resolve })
        worker.postMessage({ ...message, id })
      })
    },
    []
  )

  const createFreshWorker = useCallback(
    async (caseId: string) => {
      terminateWorker()
      setRuntimeError(null)
      const worker = new Worker(
        new URL('../workers/runtime-atlas.worker.ts', import.meta.url),
        { type: 'module' }
      )
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data
        const pending = pendingRef.current.get(response.id)
        if (!pending) return
        pendingRef.current.delete(response.id)
        if (response.ok) {
          pending.resolve(response.snapshot)
          return
        }
        pending.reject(
          new Error(`${response.error.name}: ${response.error.message}`)
        )
      }
      worker.onerror = (event) => {
        const message = event.message || 'Runtime Atlas worker failed to load.'
        pendingRef.current.forEach(({ reject }) => reject(new Error(message)))
        pendingRef.current.clear()
        setRuntimeError(message)
      }
      workerRef.current = worker
      const initial = await send(worker, { type: 'start', caseId })
      if (!initial)
        throw new Error('Runtime Atlas worker returned no initial state')
      commitSnapshot(initial)
      return initial
    },
    [commitSnapshot, send, terminateWorker]
  )

  const resetRuntime = useCallback(() => {
    runGenerationRef.current += 1
    activeRunRef.current = null
    setAutoRunning(false)
    setBusy(false)
    setRuntimeError(null)
    terminateWorker()
    snapshotRef.current = null
    setSnapshot(null)
  }, [terminateWorker])

  const advanceOnce = useCallback(async () => {
    setBusy(true)
    setRuntimeError(null)
    try {
      let current = snapshotRef.current
      if (!workerRef.current || !current || current.caseId !== selectedCaseId) {
        current = await createFreshWorker(selectedCaseId)
      }
      if (current.terminal) return current
      const worker = workerRef.current
      if (!worker) throw new Error('Runtime Atlas worker is unavailable')
      const next = await send(worker, { type: 'advance' })
      if (!next) throw new Error('Runtime Atlas worker returned no evidence')
      commitSnapshot(next)
      return next
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message !== WORKER_RESET_MESSAGE) setRuntimeError(message)
      return null
    } finally {
      setBusy(false)
    }
  }, [commitSnapshot, createFreshWorker, selectedCaseId, send])

  const pause = useCallback(() => {
    runGenerationRef.current += 1
    setAutoRunning(false)
  }, [])

  const runRemaining = useCallback(
    async (fresh = false) => {
      const generation = runGenerationRef.current + 1
      runGenerationRef.current = generation
      activeRunRef.current = generation
      setAutoRunning(true)
      setBusy(true)
      setRuntimeError(null)
      try {
        let current = snapshotRef.current
        if (
          fresh ||
          !workerRef.current ||
          !current ||
          current.caseId !== selectedCaseId
        ) {
          current = await createFreshWorker(selectedCaseId)
        }
        while (!current.terminal && runGenerationRef.current === generation) {
          const next = await send(workerRef.current as Worker, {
            type: 'advance'
          })
          if (!next)
            throw new Error('Runtime Atlas worker returned no evidence')
          current = next
          commitSnapshot(current)
          if (!current.terminal && !reducedMotion) await wait(280)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (
          runGenerationRef.current === generation &&
          message !== WORKER_RESET_MESSAGE
        ) {
          setRuntimeError(message)
        }
      } finally {
        if (activeRunRef.current === generation) {
          activeRunRef.current = null
          setAutoRunning(false)
          setBusy(false)
        }
      }
    },
    [commitSnapshot, createFreshWorker, reducedMotion, selectedCaseId, send]
  )

  useEffect(() => {
    const query = globalThis.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        autoRunning &&
        !snapshotRef.current?.terminal
      ) {
        resetRuntime()
      }
    }
    globalThis.addEventListener('keydown', onKeyDown)
    return () => globalThis.removeEventListener('keydown', onKeyDown)
  }, [autoRunning, resetRuntime])

  useEffect(() => () => terminateWorker(), [terminateWorker])

  const selectCase = (caseId: string) => {
    if (caseId === selectedCaseId) return
    resetRuntime()
    setSelectedCaseId(caseId)
    if (compareCaseId === caseId) {
      setCompareCaseId(
        ATLAS_CASES.find(({ id }) => id !== caseId)?.id ?? caseId
      )
    }
  }

  const status = statusFor(snapshot)
  const projectionOutput =
    selectedCaseId === 'canonical-projection-fanout'
      ? latestOutput(snapshot)
      : undefined
  const completedComparison = completedRuns[compareCaseId]

  return (
    <main className="atlas-page">
      <section className="atlas-intro" aria-labelledby="atlas-title">
        <div className="atlas-intro__coordinate" aria-hidden="true">
          07 / RUNTIME ATLAS
        </div>
        <div className="atlas-intro__copy">
          <p className="technical-label">OPERATE THE PUBLIC RUNTIME</p>
          <h1 id="atlas-title">See what changed. See who owned it.</h1>
          <p>
            Choose a real case and run it in your browser. Asyra will show each
            accepted action, the owner responsible for it, and the evidence that
            remains. You do not need to read code first.
          </p>
        </div>
        <div className="atlas-intro__promise" aria-label="Runtime promise">
          <span>DESCRIBE</span>
          <ArrowRight aria-hidden="true" size={18} />
          <span>ACT</span>
          <ArrowRight aria-hidden="true" size={18} />
          <span>VERIFY</span>
        </div>
      </section>

      <section
        className="atlas-workbench"
        aria-label="Interactive Runtime Atlas"
      >
        <aside className="atlas-case-rail">
          <div className="atlas-case-rail__heading">
            <p className="technical-label">START WITH AN OUTCOME</p>
            <h2>Six real cases</h2>
            <p>Each one starts fresh. Nothing leaks into the next run.</p>
          </div>
          <div className="atlas-case-list" role="list">
            {ATLAS_CASES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="atlas-case-button"
                data-atlas-case={item.id}
                aria-pressed={item.id === selectedCaseId}
                onClick={() => selectCase(item.id)}
              >
                <span>{item.coordinate}</span>
                <strong>{item.title}</strong>
                <small>{item.plainLanguage}</small>
              </button>
            ))}
          </div>
          <Link className="atlas-roadmap-link" href="/roadmap">
            Future machine-facing runtime
            <span>Roadmap, not current support</span>
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </aside>

        <div className="atlas-lab">
          <header className="atlas-lab__header">
            <div>
              <p className="technical-label">CASE {definition.coordinate}</p>
              <h2>{definition.title}</h2>
              <p>{definition.plainLanguage}</p>
            </div>
            <div className="atlas-view-toggle" aria-label="Explanation depth">
              <button
                type="button"
                aria-pressed={!technical}
                onClick={() => setTechnical(false)}
              >
                Plain explanation
              </button>
              <button
                type="button"
                aria-pressed={technical}
                onClick={() => setTechnical(true)}
              >
                Technical evidence
              </button>
            </div>
          </header>

          <div className="atlas-case-contract">
            <div>
              <p className="technical-label">EXPECTED RESULT</p>
              <p>{definition.expected}</p>
            </div>
            {technical ? (
              <div>
                <p className="technical-label">PUBLIC PATH</p>
                <code>{definition.technicalSummary}</code>
              </div>
            ) : (
              <div>
                <p className="technical-label">WHY IT MATTERS</p>
                <p>
                  You can inspect a decision without trusting a hidden process.
                </p>
              </div>
            )}
          </div>

          <div className="atlas-control-bar" aria-label="Runtime controls">
            <button
              type="button"
              className="atlas-control atlas-control--primary"
              data-atlas-action="run"
              disabled={busy}
              onClick={() => void runRemaining(false)}
            >
              <Play aria-hidden="true" size={18} />
              Run
            </button>
            <button
              type="button"
              className="atlas-control"
              data-atlas-action="pause"
              disabled={!autoRunning}
              onClick={pause}
            >
              <Pause aria-hidden="true" size={18} />
              Pause
            </button>
            <button
              type="button"
              className="atlas-control"
              data-atlas-action="step"
              disabled={busy || snapshot?.terminal}
              onClick={() => void advanceOnce()}
            >
              <StepForward aria-hidden="true" size={18} />
              Step
            </button>
            <button
              type="button"
              className="atlas-control"
              data-atlas-action="replay"
              disabled={busy}
              onClick={() => void runRemaining(true)}
            >
              <RefreshCw aria-hidden="true" size={18} />
              Replay
            </button>
            <button
              type="button"
              className="atlas-control"
              data-atlas-action="reset"
              onClick={resetRuntime}
            >
              <RotateCcw aria-hidden="true" size={18} />
              Reset
            </button>
            <div
              className={`atlas-runtime-status atlas-runtime-status--${status.tone}`}
              role="status"
              aria-live="polite"
              data-atlas-status={status.tone}
            >
              {status.tone === 'accepted' ? (
                <CircleCheck aria-hidden="true" size={18} />
              ) : null}
              {status.tone === 'failure' || status.tone === 'rejected' ? (
                <CircleX aria-hidden="true" size={18} />
              ) : null}
              {status.tone !== 'accepted' &&
              status.tone !== 'failure' &&
              status.tone !== 'rejected' ? (
                <span aria-hidden="true">◇</span>
              ) : null}
              {status.label}
            </div>
          </div>

          {runtimeError ? (
            <div className="atlas-runtime-error" role="alert">
              <CircleX aria-hidden="true" size={20} />
              <div>
                <strong>Browser runtime failed.</strong>
                <p>{runtimeError}</p>
                <p>No replacement success result was created.</p>
              </div>
            </div>
          ) : null}

          <ol className="atlas-route" aria-label="Ordered case actions">
            {definition.actions.map((action, index) => {
              const entry = snapshot?.evidence[index]
              const isCurrent =
                snapshot?.actionIndex === index && !snapshot.terminal
              return (
                <li
                  key={action.id}
                  className="atlas-route-step"
                  data-state={
                    entry?.status ?? (isCurrent ? 'current' : 'waiting')
                  }
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{action.label}</strong>
                  <small>{action.owner}</small>
                </li>
              )
            })}
          </ol>

          <section
            className="atlas-ledger"
            aria-labelledby="atlas-ledger-title"
          >
            <header>
              <div>
                <p className="technical-label">LIVE EVIDENCE</p>
                <h3 id="atlas-ledger-title">What the runtime returned</h3>
              </div>
              <span>{snapshot?.evidence.length ?? 0} events</span>
            </header>
            {snapshot?.evidence.length ? (
              <div className="atlas-ledger__scroll" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Step</th>
                      <th scope="col">Action</th>
                      <th scope="col">Owner</th>
                      <th scope="col">Result</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.evidence.map((entry) => (
                      <tr key={`${entry.runId}-${entry.sequence}`}>
                        <td>{String(entry.sequence).padStart(2, '0')}</td>
                        <td>{entry.label}</td>
                        <td>{entry.owner}</td>
                        <td>
                          <code>
                            {JSON.stringify(entry.output ?? entry.failure)}
                          </code>
                        </td>
                        <td data-status={entry.status}>{entry.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="atlas-ledger__empty">
                <Braces aria-hidden="true" size={24} />
                <p>No events yet. Run or step this case to create evidence.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="atlas-owner-rail">
          <section>
            <p className="technical-label">WHO OWNS IT</p>
            <ol>
              {definition.owners.map((owner, index) => (
                <li key={owner}>
                  <span>{index + 1}</span>
                  {owner}
                </li>
              ))}
            </ol>
          </section>
          <section>
            <p className="technical-label">CONDITIONS</p>
            <ul>
              {definition.conditions.map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
          </section>
          <section className="atlas-owner-rail__bypass">
            <p className="technical-label">BOUNDARY / BYPASS</p>
            <ul>
              {definition.bypasses.map((bypass) => (
                <li key={bypass}>{bypass}</li>
              ))}
            </ul>
          </section>
          <section>
            <p className="technical-label">SOURCE EXAMPLES</p>
            <ul>
              {definition.exampleIds.map((exampleId) => (
                <li key={exampleId}>
                  <Link href="/examples">{exampleId}</Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </section>

      {projectionOutput ? (
        <RuntimeAtlasProjection output={projectionOutput} />
      ) : null}

      <section
        className="atlas-comparison"
        aria-labelledby="atlas-comparison-title"
      >
        <div className="atlas-section-heading">
          <p className="technical-label">COMPARE COMPLETED EVIDENCE</p>
          <h2 id="atlas-comparison-title">
            Different intent. Same ownership discipline.
          </h2>
          <p>
            Comparison appears only after a real run completes. Expected text is
            never substituted for runtime output.
          </p>
        </div>
        <div className="atlas-comparison__controls">
          <label htmlFor="atlas-compare-case">Compare with</label>
          <select
            id="atlas-compare-case"
            value={compareCaseId}
            onChange={(event) => setCompareCaseId(event.target.value)}
          >
            {ATLAS_CASES.filter(({ id }) => id !== selectedCaseId).map(
              (item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              )
            )}
          </select>
        </div>
        <div className="atlas-comparison__grid">
          <article>
            <p className="technical-label">CURRENT / {definition.coordinate}</p>
            <h3>{definition.title}</h3>
            <pre>{outputPreview(completedRuns[selectedCaseId])}</pre>
          </article>
          <article>
            <p className="technical-label">
              COMPARE / {getAtlasCase(compareCaseId).coordinate}
            </p>
            <h3>{getAtlasCase(compareCaseId).title}</h3>
            <pre>{outputPreview(completedComparison)}</pre>
          </article>
        </div>
      </section>

      <section className="atlas-closure">
        <div>
          <p className="technical-label">CURRENT SUPPORT</p>
          <h2>Visual and machine consumers share one accepted model.</h2>
          <p>
            Today, these cases run in the supported browser composition. Your
            App still owns its schema, rules, search, permissions, engines, and
            domain knowledge.
          </p>
        </div>
        <div className="atlas-closure__roadmap">
          <p className="technical-label">FUTURE DIRECTION</p>
          <h3>Non-visible products for AI and services</h3>
          <p>
            Headless Core and Core Kernel remain Roadmap work until their public
            lifecycle and dependency contracts exist.
          </p>
          <Link href="/roadmap">
            Read the verified Roadmap
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>
      </section>
    </main>
  )
}
