import type { ExperimentSnapshot } from '../analysis/contracts'
import type { AnalysisResult } from '../analysis/result'
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
    leaves = result.pairEvidence.flatMap((pair) =>
      pair.evidence.leaves.map((leaf) => ({ pairId: pair.pairId, leaf }))
    ),
    finiteUpper = leaves.flatMap(({ leaf }) =>
      leaf.upper === null ? [] : [leaf.upper]
    ),
    lower =
      missing || !leaves.length
        ? 0
        : Math.min(...leaves.map(({ leaf }) => leaf.lower)),
    upper = finiteUpper.length ? Math.min(...finiteUpper) : null
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
          {result.pairEvidence.map((pair) => {
            const source = snapshot.pairs.find(
              (item) => item.id === pair.pairId
            )
            if (!source)
              throw new Error('Result pair is missing from its frozen snapshot')
            const finding = pair.evidence.leaves.find(
              (leaf) => leaf.state === 'finding'
            )
            const unknown = pair.evidence.leaves.find(
              (leaf) => leaf.state === 'unresolved'
            )
            const leaf = finding ?? unknown ?? pair.evidence.leaves[0]
            return (
              <details className="evidence-pair" key={pair.pairId}>
                <summary>
                  {source.a.bodyId} / {source.b.bodyId}
                  <span>{pair.evidence.coverage}</span>
                </summary>
                <p className="hint">
                  Lower {distance(pair.evidence.lower)} · upper{' '}
                  {distance(pair.evidence.upper)}
                </p>
                <button
                  onClick={() =>
                    onReplay(snapshot, leaf.witnessTime ?? leaf.start, [
                      source.a.bodyId,
                      source.b.bodyId
                    ])
                  }
                >
                  Replay pair
                </button>
                {pair.evidence.leaves.map((interval, index) => (
                  <div className="interval-evidence" key={index}>
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
                          [source.a.bodyId, source.b.bodyId]
                        )
                      }
                    >
                      Replay{' '}
                      {interval.witnessTime === null
                        ? 'interval start'
                        : 'witness'}
                    </button>
                  </div>
                ))}
              </details>
            )
          })}
        </div>
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
