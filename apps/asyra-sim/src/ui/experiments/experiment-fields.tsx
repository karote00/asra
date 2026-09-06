import {
  EXPERIMENT_RESOURCE_PROFILE,
  type MethodDescriptor
} from '../../analysis/contracts'
import type { ExperimentDraft } from '../../common-apis/experiment'
import type { Workcell } from '../../domain/workcell'
import { useCommittedCallback } from '../shared/use-committed-callback'
import { AcceptanceFields } from './acceptance-fields'
import { MethodFields } from './method-fields'
import { ScopeFields } from './scope-fields'

export function ExperimentFields({
  draft,
  onChange,
  exclusions,
  onExclusions,
  workcell,
  methods
}: {
  draft: ExperimentDraft
  onChange: (draft: ExperimentDraft) => void
  exclusions: string
  onExclusions: (text: string) => void
  workcell: Workcell
  methods: readonly MethodDescriptor[]
}) {
  const onScopeChange = useCommittedCallback(
    (scope: ExperimentDraft['scope']) => onChange({ ...draft, scope })
  )

  const onExclusionsChange = useCommittedCallback(onExclusions)

  return (
    <>
      <MethodFields
        value={draft.method}
        methods={methods}
        onChange={(method) => onChange({ ...draft, method })}
      />

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
              onChange({
                ...draft,
                rule: {
                  ...draft.rule,
                  minimumClearance: Number(event.target.value) / 1000
                }
              })
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
              onChange({
                ...draft,
                budget: {
                  ...draft.budget,
                  maxDurationMs: Number(event.target.value)
                }
              })
            }
          />
        </label>
      </div>

      <AcceptanceFields
        value={draft.rule.acceptance}
        baseline={draft.rule.minimumClearance}
        onChange={(acceptance) => {
          const { acceptance: _previous, ...rule } = draft.rule

          onChange({
            ...draft,
            rule: { ...rule, ...(acceptance ? { acceptance } : {}) }
          })
        }}
      />

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
                const interval: [number, number] = [...draft.interval]

                interval[index] = Number(event.target.value)

                onChange({ ...draft, interval })
              }}
            />
          </label>
        ))}
      </div>

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
              onChange({
                ...draft,
                budget: {
                  ...draft.budget,
                  maxIntervals: Number(event.target.value)
                }
              })
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
              onChange({
                ...draft,
                method: {
                  ...draft.method,
                  settings: {
                    ...draft.method.settings,
                    distanceTolerance: Number(event.target.value)
                  }
                }
              })
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
              onChange({
                ...draft,
                method: {
                  ...draft.method,
                  settings: {
                    ...draft.method.settings,
                    timeTolerance: Number(event.target.value)
                  }
                }
              })
            }
          />
        </label>
      </details>

      <ScopeFields
        scope={draft.scope}
        onChange={onScopeChange}
        exclusions={exclusions}
        onExclusions={onExclusionsChange}
        workcell={workcell}
      />
    </>
  )
}
