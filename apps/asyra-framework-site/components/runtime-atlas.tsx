'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ATLAS_CASES,
  type AtlasCaseDefinition
} from '@/lib/runtime-atlas/case-definitions.mjs'
import type { AtlasRunSnapshot } from '@/lib/runtime-atlas/runtime.mjs'
import { RuntimeAtlasProjection } from './runtime-atlas-projection'

type WorkerResponse =
  | Readonly<{ type: 'snapshot'; snapshot: AtlasRunSnapshot }>
  | Readonly<{ type: 'failure'; error: string }>
  | Readonly<{ type: 'disposed' }>

const terminalStatuses = new Set(['succeeded', 'rejected', 'failed'])

const routeStages = [
  ['Intent', 'Person, automation, or AI asks'],
  ['Feature', 'App policy accepts and routes'],
  ['Transaction', 'Factory groups the action'],
  ['Canonical owner', 'One owner changes verifiable state'],
  ['Projection', 'App surfaces render returned evidence']
] as const

const atlasGuideTitles: Readonly<Record<string, string>> = Object.freeze({
  'learn/information-models': 'Information models come before output',
  'build/custom-schema': 'Build a custom component and schema',
  'build/feature-session': 'Build a transaction-safe Feature session',
  'build/collaboration': 'Build opt-in collaboration',
  'build/ai-actions': 'Build registered AI actions',
  'build/app-retrieval-action': 'Build app-owned AI retrieval and action'
})

const getAtlasGuideTitle = (guideId: string) => {
  const title = atlasGuideTitles[guideId]
  if (!title) {
    throw new Error(`Runtime Atlas guide title is missing for "${guideId}".`)
  }
  return title
}

const progressStage = (snapshot: AtlasRunSnapshot | undefined) => {
  if (!snapshot || snapshot.actionCount === 0) return 0
  return Math.min(
    routeStages.length - 1,
    Math.floor(
      (snapshot.actionIndex / snapshot.actionCount) * routeStages.length
    )
  )
}

export function RuntimeAtlas() {
  const [selectedId, setSelectedId] = useState(ATLAS_CASES[0]?.id ?? '')
  const [snapshot, setSnapshot] = useState<AtlasRunSnapshot>()
  const [runtimeError, setRuntimeError] = useState('')
  const [completedRuns, setCompletedRuns] = useState<AtlasRunSnapshot[]>([])
  const studioFrameRef = useRef<HTMLDivElement | null>(null)
  const studioRef = useRef<HTMLDivElement | null>(null)
  const workerRef = useRef<Worker | undefined>(undefined)
  const autoRunRef = useRef(false)
  const reducedMotionRef = useRef(false)
  const timerRef = useRef<number | undefined>(undefined)

  const selectedCase =
    ATLAS_CASES.find(({ id }) => id === selectedId) ?? ATLAS_CASES[0]

  const stopTimer = () => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)
    timerRef.current = undefined
  }

  const terminateWorker = useCallback(() => {
    stopTimer()
    autoRunRef.current = false
    workerRef.current?.terminate()
    workerRef.current = undefined
  }, [])

  const startWorker = useCallback(
    (caseId: string, runAutomatically = false) => {
      terminateWorker()
      setRuntimeError('')
      setSnapshot(undefined)
      autoRunRef.current = runAutomatically

      if (typeof Worker === 'undefined') {
        setRuntimeError(
          'This browser cannot create the isolated worker required for Runtime Atlas.'
        )
        return
      }

      const worker = new Worker(
        new URL('../workers/runtime-atlas.worker.ts', import.meta.url),
        { type: 'module' }
      )
      workerRef.current = worker

      const requestNext = (nextSnapshot: AtlasRunSnapshot) => {
        if (
          !autoRunRef.current ||
          terminalStatuses.has(nextSnapshot.status) ||
          workerRef.current !== worker
        ) {
          return
        }
        timerRef.current = window.setTimeout(
          () => worker.postMessage({ type: 'step' }),
          reducedMotionRef.current ? 0 : 520
        )
      }

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (workerRef.current !== worker) return
        if (event.data.type === 'failure') {
          autoRunRef.current = false
          setRuntimeError(event.data.error)
          return
        }
        if (event.data.type !== 'snapshot') return

        const nextSnapshot = event.data.snapshot
        setSnapshot(nextSnapshot)
        if (terminalStatuses.has(nextSnapshot.status)) {
          autoRunRef.current = false
          setCompletedRuns((current) =>
            current.some(({ runId }) => runId === nextSnapshot.runId)
              ? current
              : [...current, nextSnapshot].slice(-2)
          )
        }
        requestNext(nextSnapshot)
      }
      worker.onerror = (event) => {
        autoRunRef.current = false
        setRuntimeError(
          event.message || 'The isolated runtime stopped unexpectedly.'
        )
      }
      worker.postMessage({ type: 'initialize', caseId })
    },
    [terminateWorker]
  )

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    startWorker(selectedId)
    return terminateWorker
  }, [selectedId, startWorker, terminateWorker])

  useEffect(() => {
    const frame = studioFrameRef.current
    const studio = studioRef.current
    if (!frame || !studio || typeof ResizeObserver === 'undefined') return

    const motionPreference = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    )
    let animationFrame: number | undefined

    const updateFrameHeight = () => {
      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame)
      }

      const nextHeight = studio.getBoundingClientRect().height
      if (motionPreference.matches) {
        frame.style.height = 'auto'
        return
      }

      if (!frame.style.height) {
        frame.style.height = `${nextHeight}px`
        return
      }

      const currentHeight = frame.getBoundingClientRect().height
      if (Math.abs(currentHeight - nextHeight) < 0.5) return

      frame.style.height = `${currentHeight}px`
      animationFrame = window.requestAnimationFrame(() => {
        frame.style.height = `${nextHeight}px`
      })
    }

    const observer = new ResizeObserver(updateFrameHeight)
    observer.observe(studio)
    motionPreference.addEventListener('change', updateFrameHeight)
    updateFrameHeight()

    return () => {
      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame)
      }
      motionPreference.removeEventListener('change', updateFrameHeight)
      observer.disconnect()
    }
  }, [])

  const selectCase = (caseDefinition: AtlasCaseDefinition) => {
    setSelectedId(caseDefinition.id)
  }

  const runRemaining = () => {
    autoRunRef.current = true
    workerRef.current?.postMessage({ type: 'step' })
  }

  const pause = () => {
    autoRunRef.current = false
    stopTimer()
  }

  const step = () => {
    pause()
    workerRef.current?.postMessage({ type: 'step' })
  }

  const stage = progressStage(snapshot)
  const canAdvance = snapshot ? !terminalStatuses.has(snapshot.status) : false

  return (
    <section aria-label="Interactive Runtime Atlas" className="atlas-shell">
      <aside className="atlas-case-picker">
        <div>
          <p>Six executable cases</p>
          <h2>Choose one path.</h2>
        </div>
        <div className="atlas-case-picker__list" role="list">
          {ATLAS_CASES.map((caseDefinition, index) => (
            <button
              aria-pressed={caseDefinition.id === selectedId}
              key={caseDefinition.id}
              onClick={() => selectCase(caseDefinition)}
              type="button"
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{caseDefinition.title}</strong>
            </button>
          ))}
        </div>
      </aside>

      <div className="atlas-studio-frame" ref={studioFrameRef}>
        <div className="atlas-studio" ref={studioRef}>
          <header className="atlas-case-intro">
            <div>
              <p>{selectedCase?.eyebrow}</p>
              <h2>{selectedCase?.title}</h2>
            </div>
            <div>
              <p>{selectedCase?.purpose}</p>
              <p className="atlas-expected">
                <strong>Expected</strong> {selectedCase?.expectedResult}
              </p>
            </div>
          </header>

          <div className="atlas-controls" aria-label="Runtime controls">
            <button disabled={!canAdvance} onClick={runRemaining} type="button">
              Run remaining
            </button>
            <button disabled={!canAdvance} onClick={pause} type="button">
              Pause
            </button>
            <button disabled={!canAdvance} onClick={step} type="button">
              Step
            </button>
            <button onClick={() => startWorker(selectedId, true)} type="button">
              Replay
            </button>
            <button onClick={() => startWorker(selectedId)} type="button">
              Reset
            </button>
            <p aria-live="polite">
              {runtimeError
                ? `Runtime unavailable: ${runtimeError}`
                : `Status: ${snapshot?.status ?? 'starting'} · ${snapshot?.actionIndex ?? 0}/${snapshot?.actionCount ?? selectedCase?.actions.length ?? 0}`}
            </p>
          </div>

          <ol className="atlas-route-map" aria-label="Canonical action route">
            {routeStages.map(([label, description], index) => (
              <li
                className={index <= stage ? 'is-reached' : undefined}
                key={label}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{label}</strong>
                <p>{description}</p>
              </li>
            ))}
          </ol>

          <div className="atlas-observation-grid">
            <section
              aria-labelledby="evidence-title"
              className="atlas-evidence"
            >
              <header>
                <p>Worker evidence ledger</p>
                <h3 id="evidence-title">What actually ran</h3>
              </header>
              {snapshot?.evidence.length ? (
                <ol>
                  {snapshot.evidence.map((entry) => (
                    <li key={`${entry.runId}-${entry.sequence}`}>
                      <div>
                        <span>{String(entry.sequence).padStart(2, '0')}</span>
                        <strong>{entry.label}</strong>
                        <em data-status={entry.lifecycleStatus}>
                          {entry.lifecycleStatus}
                        </em>
                      </div>
                      <p>{entry.description}</p>
                      <dl>
                        <div>
                          <dt>Owner</dt>
                          <dd>{entry.owner}</dd>
                        </div>
                        <div>
                          <dt>Output</dt>
                          <dd>
                            <code>{JSON.stringify(entry.output)}</code>
                          </dd>
                        </div>
                      </dl>
                      {entry.failure ? (
                        <p role="alert">{entry.failure}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="atlas-evidence__empty">
                  The worker is ready. Step once or run the remaining actions.
                </p>
              )}
            </section>
            <RuntimeAtlasProjection snapshot={snapshot} />
          </div>

          {completedRuns.length === 2 ? (
            <section className="atlas-comparison">
              <header>
                <p>Two completed real runs</p>
                <h3>Compare outcomes</h3>
              </header>
              <div>
                {completedRuns.map((run) => (
                  <article key={run.runId}>
                    <p>{run.caseId.replaceAll('-', ' ')}</p>
                    <strong>{run.status}</strong>
                    <span>{run.sequence} evidence steps</span>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <footer className="atlas-case-footer">
            <div>
              <p>Public packages in this path</p>
              <ul>
                {selectedCase?.packages.map((packageName) => (
                  <li key={packageName}>{packageName}</li>
                ))}
              </ul>
            </div>
            <div>
              <p>Build the same flow</p>
              <ul>
                {selectedCase?.guideIds.map((guideId) => (
                  <li key={guideId}>
                    <a href={`/docs/${guideId}`}>
                      {getAtlasGuideTitle(guideId)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </footer>
        </div>
      </div>
    </section>
  )
}
