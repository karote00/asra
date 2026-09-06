import { useEffect, useRef, useState } from 'react'
import type { ExperimentSnapshot } from '../analysis/contracts'
import type { RunRecord } from '../storage/run-record'
import { compareRuns, type RunComparison } from '../storage/run-comparison'
import {
  exportRunCsv,
  exportRunHtml,
  exportRunJson
} from '../storage/run-reports'
import { AnalysisResultView } from './analysis-result-view'
import { downloadText } from './download-project'
import { FieldObservations, type ObservationAccess } from './field-observations'
import './run-library.css'

export function RunLibrary({
  runs,
  retainedIds,
  candidateIds,
  onRetain,
  onReplay,
  onCandidate,
  isStale,
  runtime,
  isCurrent,
  onClose
}: {
  runs: readonly RunRecord[]
  retainedIds: ReadonlySet<string>
  candidateIds: ReadonlySet<string>
  onRetain: (run: RunRecord) => Promise<void>
  onReplay: (
    snapshot: ExperimentSnapshot,
    time: number,
    bodyIds: readonly string[]
  ) => void
  onCandidate: (id: string) => void
  isStale: (run: RunRecord) => boolean
  runtime: ObservationAccess
  isCurrent: () => boolean
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [selectedId, setSelectedId] = useState(runs.at(-1)?.result.runId ?? '')
  const [comparisonIds, setComparisonIds] = useState<string[]>([])
  const [comparison, setComparison] = useState<RunComparison | null>(null)
  const [error, setError] = useState(''),
    [saving, setSaving] = useState(false)
  const [page, setPage] = useState(0)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  const selected = runs.find((run) => run.result.runId === selectedId)
  const pages = Math.max(1, Math.ceil(runs.length / 30)),
    currentPage = Math.min(page, pages - 1)
  const exportReport = (format: 'json' | 'csv' | 'html') => {
    if (!selected) return
    try {
      const text = {
        json: exportRunJson,
        csv: exportRunCsv,
        html: exportRunHtml
      }[format](selected)
      downloadText(
        `sim-${selected.result.runId}.${format}`,
        text,
        {
          json: 'application/json',
          csv: 'text/csv;charset=utf-8',
          html: 'text/html;charset=utf-8'
        }[format]
      )
      setError('')
    } catch (reason) {
      setError(message(reason))
    }
  }
  return (
    <dialog
      ref={dialog}
      className="run-dialog"
      aria-label="Runs and comparison"
      onCancel={onClose}
    >
      <header className="project-dialog-heading">
        <div>
          <span className="eyebrow">IMMUTABLE EXPERIMENT EVIDENCE</span>
          <h2>Runs &amp; compare</h2>
        </div>
        <button onClick={onClose}>Close runs</button>
      </header>
      <p className="hint">
        Retain a result explicitly, then save the project. Comparisons do not
        select a winner or approve equipment operation.
      </p>
      {runs.length === 0 && (
        <p>No runs yet. Configure an experiment and run formal analysis.</p>
      )}
      <div className="run-library-grid">
        <section aria-label="Run history" className="run-history">
          <h3>{runs.length} results</h3>
          {[...runs]
            .reverse()
            .slice(currentPage * 30, (currentPage + 1) * 30)
            .map((run) => (
              <article key={run.result.runId}>
                <button
                  aria-pressed={selectedId === run.result.runId}
                  onClick={() => setSelectedId(run.result.runId)}
                >
                  <strong>{run.name}</strong>
                  <span>
                    {run.result.execution} - {run.result.coverage}
                  </span>
                  <small>{run.result.runId}</small>
                </button>
                <span className="run-retention-label">
                  {retainedIds.has(run.result.runId)
                    ? 'Retained in project'
                    : 'Temporary - not saved'}
                </span>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    aria-label={`Compare ${run.result.runId}`}
                    checked={comparisonIds.includes(run.result.runId)}
                    disabled={
                      comparisonIds.length >= 3 &&
                      !comparisonIds.includes(run.result.runId)
                    }
                    onChange={(event) => {
                      setComparisonIds((current) =>
                        event.target.checked
                          ? [...current, run.result.runId]
                          : current.filter((id) => id !== run.result.runId)
                      )
                      setComparison(null)
                    }}
                  />
                  Include in comparison
                </label>
              </article>
            ))}
          {pages > 1 && (
            <div className="pagination">
              <button
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous runs
              </button>
              <span>
                {currentPage + 1}/{pages}
              </span>
              <button
                disabled={currentPage + 1 === pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next runs
              </button>
            </div>
          )}
          <button
            className="primary"
            disabled={comparisonIds.length < 2}
            onClick={() => {
              try {
                setComparison(
                  compareRuns(
                    runs.filter((run) =>
                      comparisonIds.includes(run.result.runId)
                    )
                  )
                )
                setError('')
              } catch (reason) {
                setError(message(reason))
              }
            }}
          >
            Compare selected runs ({comparisonIds.length}/3)
          </button>
        </section>
        <section className="run-detail" aria-label="Selected run">
          {selected && (
            <>
              <div className="section-heading">
                <h3>{selected.name}</h3>
                <span className="run-retention-label">
                  {retainedIds.has(selected.result.runId)
                    ? 'Retained in project'
                    : 'Temporary result'}
                </span>
              </div>
              <div className="run-detail-actions">
                <button
                  disabled={
                    saving ||
                    retainedIds.has(selected.result.runId) ||
                    !candidateIds.has(selected.snapshot.source.candidateId)
                  }
                  onClick={async () => {
                    setSaving(true)
                    try {
                      await onRetain(selected)
                      setError('')
                    } catch (reason) {
                      setError(message(reason))
                    } finally {
                      setSaving(false)
                    }
                  }}
                >
                  Retain selected result
                </button>
                <button
                  disabled={
                    !candidateIds.has(selected.snapshot.source.candidateId)
                  }
                  onClick={() => {
                    onCandidate(selected.snapshot.source.candidateId)
                    onClose()
                  }}
                >
                  Select source candidate
                </button>
                {(['json', 'csv', 'html'] as const).map((format) => (
                  <button key={format} onClick={() => exportReport(format)}>
                    Export {format.toUpperCase()}
                  </button>
                ))}
              </div>
              {!candidateIds.has(selected.snapshot.source.candidateId) && (
                <p className="stale-notice">
                  Source candidate is absent. Historical reports and replay
                  remain available; Undo may restore the source.
                </p>
              )}
              <p className="method-line">
                Asyra Sim {selected.environment.appVersion} -{' '}
                {selected.environment.hardwareConcurrency} logical processors
                reported by browser
                <br />
                {selected.environment.userAgent}
              </p>
              <AnalysisResultView
                key={selected.result.runId}
                run={selected}
                stale={isStale(selected)}
                onReplay={(snapshot, time, bodyIds) => {
                  onReplay(snapshot, time, bodyIds)
                  onClose()
                }}
              />
              <FieldObservations
                key={`${selected.result.runId}:${retainedIds.has(selected.result.runId)}`}
                runtime={runtime}
                runId={selected.result.runId}
                retained={retainedIds.has(selected.result.runId)}
                isCurrent={isCurrent}
              />
            </>
          )}
        </section>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {comparison && <RunComparisonView comparison={comparison} />}
    </dialog>
  )
}

export function RunComparisonView({
  comparison
}: {
  comparison: RunComparison
}) {
  return (
    <section className="run-comparison" aria-label="Run comparison">
      <h3>
        {comparison.directlyComparable
          ? 'Matching method, scope, rule and interval'
          : 'Not directly comparable'}
      </h3>
      <p className="hint">
        Read differences and unresolved evidence before making your own
        selection. Matching comparison conditions do not prove real-world
        feasibility.
      </p>
      <p className="hint">
        Body correspondence uses explicit candidate lineage where available,
        otherwise original canonical identities. Names do not establish
        correspondence. Raw identities remain in each report.
      </p>
      {comparison.incompatibilities.length > 0 && (
        <ul className="diagnostic-list">
          {comparison.incompatibilities.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      <div className="comparison-columns">
        {comparison.runs.map((run, index) => (
          <article key={run.result.runId}>
            <h4>
              {String.fromCharCode(65 + index)} - {run.name}
            </h4>
            <p>
              {run.result.execution} - {run.result.coverage} -{' '}
              {run.result.verdict}
            </p>
            <p>
              {run.result.findingPairCount} finding pairs -{' '}
              {run.result.unresolvedPairCount +
                run.result.totalPairCount -
                run.result.coveredPairCount}{' '}
              unresolved/missing pairs
            </p>
            <p>
              {run.snapshot.method.id}@{run.snapshot.method.version}
            </p>
            <p>
              Threshold {run.snapshot.rule.minimumClearance * 1000} mm -{' '}
              {run.snapshot.pairs.length} pairs - interval{' '}
              {run.snapshot.interval.join('–')} s
            </p>
          </article>
        ))}
      </div>
      <h4>{comparison.differences.length} input differences</h4>
      {comparison.differences.length === 0 && (
        <p className="hint">
          No modeled input differences. Source identities and execution
          timestamps are not ranked.
        </p>
      )}
      {comparison.differences.map((difference) => (
        <details key={difference.path}>
          <summary>{difference.path}</summary>
          <div className="comparison-columns">
            {difference.values.map((value, index) => {
              const text = JSON.stringify(value, null, 2) ?? '(absent)'
              return (
                <div key={index}>
                  <strong>{String.fromCharCode(65 + index)}</strong>
                  <pre>{text.slice(0, 8000)}</pre>
                  {text.length > 8000 && (
                    <p className="hint">
                      Preview limited to 8,000 characters. Export the run JSON
                      for the complete value.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </details>
      ))}
    </section>
  )
}
const message = (reason: unknown) =>
  reason instanceof Error ? reason.message : String(reason)
