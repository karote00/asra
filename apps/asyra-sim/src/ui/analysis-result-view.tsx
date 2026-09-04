import type { ExperimentSnapshot } from '../analysis/contracts'
import type { AnalysisResult } from '../analysis/result'
import { useState } from 'react'
import type { OfficialPairEvidence } from '../analysis/methods/official-method'
import type { ExperimentDraft } from '../common-apis/experiment'
import type { Workcell } from '../domain/workcell'
import { definitionToDraft } from './experiment-draft'

export interface PresentedRun {
  snapshot: ExperimentSnapshot
  result: AnalysisResult
}

function geometryIdentity(workcell: Workcell) {
  return JSON.stringify({
    robotRootId: workcell.robotRootId,
    bodies: workcell.bodies.map(({ id, parentId, pose, joint, colliders }) => ({
      id,
      parentId,
      pose,
      joint,
      colliders
    }))
  })
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    return Object.fromEntries(
      Object.keys(item)
        .sort()
        .map((key) => [key, item[key]])
    )
  })
}

export function isPresentedRunStale(
  run: PresentedRun,
  workcell: Workcell,
  draft: ExperimentDraft
): boolean {
  const { snapshot } = run
  return (
    geometryIdentity(snapshot.workcell) !== geometryIdentity(workcell) ||
    stableJson(
      definitionToDraft({
        version: 1,
        revision: 1,
        trajectory: snapshot.trajectory,
        sourceUnits: snapshot.sourceUnits,
        scope: snapshot.scope,
        interval: snapshot.interval,
        method: snapshot.method,
        rule: snapshot.rule,
        budget: snapshot.budget
      })
    ) !== stableJson(draft)
  )
}

const distance = (value: number | null) =>
  value === null ? 'unknown' : `${(value * 1000).toFixed(3)} mm`
const summaryLabels = {
  'issue-found': 'Issue found',
  'no-issue-within-scope': 'No issue found within scope',
  'cannot-determine': 'Cannot determine'
}

export function AnalysisResultView({
  run,
  stale,
  onReplay
}: {
  run: PresentedRun
  stale: boolean
  onReplay: (
    snapshot: ExperimentSnapshot,
    time: number,
    bodyIds: readonly string[]
  ) => void
}) {
  const { result, snapshot } = run,
    missing = result.totalPairCount - result.coveredPairCount,
    lower =
      missing || !result.pairEvidence.length
        ? 0
        : result.pairEvidence.reduce(
            (minimum, pair) => Math.min(minimum, pair.evidence.lower),
            Infinity
          ),
    upper = result.pairEvidence.reduce<number | null>(
      (minimum, pair) =>
        pair.evidence.upper === null
          ? minimum
          : Math.min(minimum ?? Infinity, pair.evidence.upper),
      null
    )
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(result.pairEvidence.length / 20)),
    currentPage = Math.min(page, pageCount - 1)
  return (
    <section className="result-card" data-testid="analysis-result">
      <div className="result-title">
        <div>
          <span className="eyebrow">FORMAL RESULT</span>
          <h3>{summaryLabels[result.summary]}</h3>
        </div>
        <span className={`result-state ${result.verdict}`}>
          {result.verdict.replaceAll('-', ' ')}
        </span>
      </div>
      {stale && (
        <p className="stale-notice">
          Historical inputs differ from the current model or experiment. Replay
          uses this run&apos;s frozen inputs.
        </p>
      )}
      <dl className="result-grid">
        <div>
          <dt>Execution</dt>
          <dd>{result.execution}</dd>
        </div>
        <div>
          <dt>Coverage</dt>
          <dd>{result.coverage}</dd>
        </div>
        <div>
          <dt>Pairs with evidence</dt>
          <dd>
            {result.coveredPairCount}/{result.totalPairCount}
          </dd>
        </div>
        <div>
          <dt>Finding / unresolved pairs</dt>
          <dd>
            {result.findingPairCount} / {result.unresolvedPairCount + missing}
          </dd>
        </div>
        <div>
          <dt>Minimum lower bound</dt>
          <dd>{distance(lower)}</dd>
        </div>
        <div>
          <dt>Witness upper bound</dt>
          <dd>{distance(upper)}</dd>
        </div>
      </dl>
      <p className="hint">
        Bounds describe modeled geometry over the selected interval. Unknown
        regions remain unresolved. Analysis runtime is not robot cycle time.
      </p>
      <p className="method-line">
        {result.method.id}@{result.method.version} · experiment r
        {result.source.experimentRevision} · rule r{result.rule.revision}
      </p>
      <details>
        <summary>
          Scope and assumptions <span>{snapshot.pairs.length} pairs</span>
        </summary>
        <p className="hint">{snapshot.scope.backgroundNote}</p>
        <p className="hint">
          {snapshot.scope.excludedPairs.length} excluded body pairs ·{' '}
          {snapshot.scope.acknowledgedExcludedVisibleBodyIds.length}{' '}
          acknowledged background bodies
        </p>
        {snapshot.scope.excludedPairs.map((pair) => (
          <p className="method-line" key={`${pair.a}/${pair.b}`}>
            {pair.a} / {pair.b}: {pair.reason}
          </p>
        ))}
      </details>
      <details open>
        <summary>
          Pair evidence and replay{' '}
          <span>{result.pairEvidence.length} records</span>
        </summary>
        <div className="evidence-list">
          {result.pairEvidence
            .slice(currentPage * 20, (currentPage + 1) * 20)
            .map((pair) => {
              const source = snapshot.pairs.find(
                (item) => item.id === pair.pairId
              )
              if (!source)
                throw new Error(
                  'Result pair is missing from its frozen snapshot'
                )
              return (
                <PairEvidenceView
                  key={pair.pairId}
                  pair={pair}
                  snapshot={snapshot}
                  source={source}
                  onReplay={onReplay}
                />
              )
            })}
        </div>
        {pageCount > 1 && (
          <div className="pagination">
            <button
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous pairs
            </button>
            <span>
              Pair page {currentPage + 1}/{pageCount} · all records retained
            </span>
            <button
              disabled={currentPage + 1 === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Next pairs
            </button>
          </div>
        )}
      </details>
      {missing > 0 && (
        <p className="inline-error">
          {missing} pairs have no retained evidence.
        </p>
      )}
      {result.errors.map((error, index) => (
        <p className="inline-error" key={index}>
          {error}
        </p>
      ))}
    </section>
  )
}

function PairEvidenceView({
  pair,
  snapshot,
  source,
  onReplay
}: {
  pair: OfficialPairEvidence
  snapshot: ExperimentSnapshot
  source: ExperimentSnapshot['pairs'][number]
  onReplay: (
    snapshot: ExperimentSnapshot,
    time: number,
    bodyIds: readonly string[]
  ) => void
}) {
  const [expanded, setExpanded] = useState(false),
    [page, setPage] = useState(0)
  const leaves = pair.evidence.leaves,
    finding = leaves.find((leaf) => leaf.state === 'finding'),
    unknown = leaves.find((leaf) => leaf.state === 'unresolved'),
    leaf = finding ?? unknown ?? leaves[0],
    pages = Math.max(1, Math.ceil(leaves.length / 20)),
    bodyIds = [source.a.bodyId, source.b.bodyId]
  return (
    <details
      className="evidence-pair"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        {source.a.bodyId} / {source.b.bodyId}
        <span>{pair.evidence.coverage}</span>
      </summary>
      <p className="hint">
        Lower {distance(pair.evidence.lower)} · upper{' '}
        {distance(pair.evidence.upper)} · {leaves.length} intervals
      </p>
      <button
        onClick={() =>
          onReplay(snapshot, leaf.witnessTime ?? leaf.start, bodyIds)
        }
      >
        Replay pair
      </button>
      {expanded && (
        <>
          {leaves.slice(page * 20, (page + 1) * 20).map((interval, index) => (
            <div className="interval-evidence" key={page * 20 + index}>
              <strong>
                {interval.state} · {interval.start.toFixed(6)}–
                {interval.end.toFixed(6)} s
              </strong>
              <span>
                {distance(interval.lower)} ≤ minimum ≤{' '}
                {distance(interval.upper)}
              </span>
              <span>{interval.reason}</span>
              <button
                onClick={() =>
                  onReplay(
                    snapshot,
                    interval.witnessTime ?? interval.start,
                    bodyIds
                  )
                }
              >
                Replay{' '}
                {interval.witnessTime === null ? 'interval start' : 'witness'}
              </button>
            </div>
          ))}
          {pages > 1 && (
            <div className="pagination">
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous intervals
              </button>
              <span>
                Interval page {page + 1}/{pages}
              </span>
              <button
                disabled={page + 1 === pages}
                onClick={() => setPage(page + 1)}
              >
                Next intervals
              </button>
            </div>
          )}
        </>
      )}
    </details>
  )
}
