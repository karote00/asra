import { useSyncExternalStore } from 'react'
import { LIVE_LIMITS } from '../../analysis/live/protocol'
import { useExperimentField } from './experiment-context'

/** Only accepted evidence changes notify this section; animation frames do not. */
export function LiveObservations({ identity }: { identity: string }) {
  const runtime = useExperimentField('runtime')

  const api = runtime.features.live

  const records = useSyncExternalStore(api.subscribe, () =>
    api.getRecords(identity)
  )

  if (!records.length) return null

  return (
    <details
      data-testid="live-observations"
      className="border-y border-sim-divider py-3 text-[11px]"
    >
      <summary className="cursor-pointer text-sim-secondary">
        <strong>Playback observations</strong>

        <span>{records.length} checked poses</span>
      </summary>

      <p className="my-2 text-[10px] leading-relaxed text-sim-muted">
        Shared analysis evidence, not a full-path report. Reused on Play while
        inputs match. Up to {LIVE_LIMITS.maxRecordedSamples} recent poses;
        cleared when inputs change.
      </p>

      <ol className="max-h-40 overflow-auto grid gap-2">
        {records.map((sample) => {
          const findings = sample.pairs.filter((pair) =>
            pair.evidence.leaves.some((leaf) => leaf.state === 'finding')
          )

          let outcome = sample.complete
            ? 'No issue in checked scope'
            : 'Unknown'

          if (findings.length) outcome = `${findings.length} issue pairs`

          return (
            <li
              key={sample.time}
              className="flex justify-between gap-3 tabular-nums text-[10px]"
            >
              <span>{sample.time.toFixed(4)} s</span>

              <span>
                {outcome}
                {!sample.complete && findings.length > 0 && ' - incomplete'}
              </span>
            </li>
          )
        })}
      </ol>
    </details>
  )
}
