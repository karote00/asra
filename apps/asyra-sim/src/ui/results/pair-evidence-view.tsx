import { useState } from 'react'
import type { ExperimentSnapshot } from '../../analysis/contracts'
import type { OfficialPairEvidence } from '../../analysis/methods/official-method'
import { formatDistance } from './format-distance'

export function PairEvidenceView({
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
  const [expanded, setExpanded] = useState(false)

  const [page, setPage] = useState(0)

  const leaves = pair.evidence.leaves

  const finding = leaves.find((leaf) => leaf.state === 'finding')

  const unknown = leaves.find((leaf) => leaf.state === 'unresolved')

  const leaf = finding ?? unknown ?? leaves[0]

  const pages = Math.max(1, Math.ceil(leaves.length / 20))

  const bodyIds = [source.a.bodyId, source.b.bodyId]

  const bodyA = snapshot.workcell.bodies.find(
    (body) => body.id === source.a.bodyId
  )

  const bodyB = snapshot.workcell.bodies.find(
    (body) => body.id === source.b.bodyId
  )

  if (!bodyA || !bodyB)
    throw new Error('Frozen pair body is missing from the snapshot')

  return (
    <details
      className="evidence-pair p-[10px] bg-sim-raised rounded-[5px] wrap-anywhere
        [&_summary]:text-[10px] [&_button]:mt-2"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        {bodyA.name} - {bodyB.name}
        <span>{pair.evidence.coverage}</span>
      </summary>

      <p className="method-line text-[9px] text-sim-muted wrap-anywhere leading-[1.7]">
        {source.a.bodyId} / {source.b.bodyId}
      </p>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        Lower {formatDistance(pair.evidence.lower)} - upper{' '}
        {formatDistance(pair.evidence.upper)} - {leaves.length} intervals
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
            <div
              className="interval-evidence grid gap-[5px] pt-3 text-[10px] text-sim-muted [&_button]:justify-self-start"
              key={page * 20 + index}
            >
              <strong>
                {interval.state} - {interval.start.toFixed(6)}–
                {interval.end.toFixed(6)} s
              </strong>

              <span>
                {formatDistance(interval.lower)} ≤ minimum ≤{' '}
                {formatDistance(interval.upper)}
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
            <div className="pagination flex items-center justify-between gap-2 my-[10px] mx-0 text-[10px]">
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
