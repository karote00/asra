import { EXPERIMENT_RESOURCE_PROFILE } from '../../analysis/contracts'
import { useViewValue } from '../shared/use-view-value'
import type { ExperimentFieldsView } from './experiment-fields-view'

interface Props {
  source: ExperimentFieldsView
}

export function ThresholdFields({ source }: Props) {
  useViewValue(source, (value) => value.draft.rule.minimumClearance)

  useViewValue(source, (value) => value.draft.budget.maxDurationMs)

  const draft = source.getSnapshot().draft

  return (
    <div className="field-pair grid grid-cols-[1fr_1fr] gap-[10px]">
      <label>
        Minimum clearance (mm)
        <input
          aria-label="Minimum clearance (mm)"
          type="number"
          min="0"
          max="20000"
          step="0.001"
          value={draft.rule.minimumClearance * 1000}
          onChange={(event) =>
            source.changeDraft((draft) => ({
              ...draft,
              rule: {
                ...draft.rule,
                minimumClearance: Number(event.target.value) / 1000
              }
            }))
          }
        />
      </label>

      <label>
        Wall-time budget (ms)
        <input
          aria-label="Wall-time budget (ms)"
          type="number"
          min={EXPERIMENT_RESOURCE_PROFILE.minDurationMs}
          max={EXPERIMENT_RESOURCE_PROFILE.maxDurationMs}
          value={draft.budget.maxDurationMs}
          onChange={(event) =>
            source.changeDraft((draft) => ({
              ...draft,
              budget: {
                ...draft.budget,
                maxDurationMs: Number(event.target.value)
              }
            }))
          }
        />
      </label>
    </div>
  )
}

export function IntervalFields({ source }: Props) {
  useViewValue(source, (value) => value.draft.interval[0])

  useViewValue(source, (value) => value.draft.interval[1])

  const draft = source.getSnapshot().draft

  return (
    <div className="field-pair grid grid-cols-[1fr_1fr] gap-[10px]">
      {(['Start', 'End'] as const).map((label, index) => (
        <label key={label}>
          {label} time (s)
          <input
            aria-label={`${label} time (s)`}
            type="number"
            min="0"
            step="any"
            value={draft.interval[index]}
            onChange={(event) => {
              const interval: [number, number] = [
                ...source.getSnapshot().draft.interval
              ]

              interval[index] = Number(event.target.value)

              source.changeDraft((draft) => ({ ...draft, interval }))
            }}
          />
        </label>
      ))}
    </div>
  )
}

export function NumericalFields({ source }: Props) {
  useViewValue(source, (value) => value.draft.budget.maxIntervals)

  useViewValue(source, (value) => value.draft.method.settings.distanceTolerance)

  useViewValue(source, (value) => value.draft.method.settings.timeTolerance)

  const draft = source.getSnapshot().draft

  return (
    <details>
      <summary>
        Numerical settings <span>explicit tolerances and budget</span>
      </summary>

      <label>
        Global interval budget
        <input
          aria-label="Global interval budget"
          type="number"
          min="1"
          max={EXPERIMENT_RESOURCE_PROFILE.maxIntervals}
          value={draft.budget.maxIntervals}
          onChange={(event) =>
            source.changeDraft((draft) => ({
              ...draft,
              budget: {
                ...draft.budget,
                maxIntervals: Number(event.target.value)
              }
            }))
          }
        />
      </label>

      <label>
        Distance tolerance (m)
        <input
          type="number"
          min="0.000000001"
          max="1"
          step="any"
          value={draft.method.settings.distanceTolerance}
          onChange={(event) =>
            source.changeDraft((draft) => ({
              ...draft,
              method: {
                ...draft.method,
                settings: {
                  ...draft.method.settings,
                  distanceTolerance: Number(event.target.value)
                }
              }
            }))
          }
        />
      </label>

      <label>
        Time tolerance (s)
        <input
          type="number"
          min="0.000000001"
          max="1"
          step="any"
          value={draft.method.settings.timeTolerance}
          onChange={(event) =>
            source.changeDraft((draft) => ({
              ...draft,
              method: {
                ...draft.method,
                settings: {
                  ...draft.method.settings,
                  timeTolerance: Number(event.target.value)
                }
              }
            }))
          }
        />
      </label>
    </details>
  )
}
