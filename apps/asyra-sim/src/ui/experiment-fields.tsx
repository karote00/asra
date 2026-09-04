import type { ExperimentDraft } from '../common-apis/experiment'
import {
  EXPERIMENT_RESOURCE_PROFILE,
  type MethodDescriptor
} from '../analysis/contracts'
import type { Workcell } from '../domain/workcell'

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
  const setScope = (bodyId: string, role: string) => {
    const primaryBodyIds = draft.scope.primaryBodyIds
      .filter((id) => id !== bodyId)
      .concat(role === 'primary' ? [bodyId] : [])
    const influencingBodyIds = draft.scope.influencingBodyIds
      .filter((id) => id !== bodyId)
      .concat(role === 'influencing' ? [bodyId] : [])
    onChange({
      ...draft,
      scope: {
        ...draft.scope,
        primaryBodyIds,
        influencingBodyIds,
        acknowledgedExcludedVisibleBodyIds:
          draft.scope.acknowledgedExcludedVisibleBodyIds.filter(
            (id) =>
              !primaryBodyIds.includes(id) && !influencingBodyIds.includes(id)
          )
      }
    })
  }
  return (
    <>
      <label>
        Method
        <select
          aria-label="Analysis method"
          value={`${draft.method.id}@${draft.method.version}`}
          onChange={(event) => {
            const method = methods.find(
              (item) => `${item.id}@${item.version}` === event.target.value
            )
            if (method)
              onChange({
                ...draft,
                method: {
                  ...draft.method,
                  id: method.id,
                  version: method.version
                }
              })
          }}
        >
          {!methods.some(
            (item) =>
              item.id === draft.method.id &&
              item.version === draft.method.version
          ) && (
            <option value={`${draft.method.id}@${draft.method.version}`}>
              {draft.method.id}@{draft.method.version} (unavailable)
            </option>
          )}
          {methods.map((item) => (
            <option
              key={`${item.id}@${item.version}`}
              value={`${item.id}@${item.version}`}
            >
              {item.id}@{item.version}
            </option>
          ))}
        </select>
      </label>
      <div className="field-pair">
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
      <div className="field-pair">
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
      <details>
        <summary>
          Analysis scope{' '}
          <span>
            {draft.scope.primaryBodyIds.length} primary ·{' '}
            {draft.scope.influencingBodyIds.length} influencing
          </span>
        </summary>
        <div className="scope-flags">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={draft.scope.selfCollision}
              onChange={(event) =>
                onChange({
                  ...draft,
                  scope: { ...draft.scope, selfCollision: event.target.checked }
                })
              }
            />
            Self-collision between primary bodies
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={draft.scope.externalCollision}
              onChange={(event) =>
                onChange({
                  ...draft,
                  scope: {
                    ...draft.scope,
                    externalCollision: event.target.checked
                  }
                })
              }
            />
            Primary-to-influencing collision
          </label>
        </div>
        <div className="body-scope-list">
          {workcell.bodies.map((body) => {
            let role = 'outside'
            if (draft.scope.primaryBodyIds.includes(body.id)) role = 'primary'
            else if (draft.scope.influencingBodyIds.includes(body.id))
              role = 'influencing'
            return (
              <label key={body.id}>
                <span>
                  {body.name}
                  <small>{body.id}</small>
                </span>
                <select
                  aria-label={`${body.name} analysis role`}
                  value={role}
                  onChange={(event) => setScope(body.id, event.target.value)}
                >
                  <option value="primary">Primary</option>
                  <option value="influencing">Influencing</option>
                  <option value="outside">Outside scope</option>
                </select>
              </label>
            )
          })}
        </div>
        <label>
          Scope note
          <textarea
            aria-label="Scope note"
            rows={2}
            maxLength={2000}
            value={draft.scope.backgroundNote}
            onChange={(event) =>
              onChange({
                ...draft,
                scope: { ...draft.scope, backgroundNote: event.target.value }
              })
            }
          />
        </label>
        <label>
          Excluded pairs (body-a TAB body-b TAB reason)
          <textarea
            aria-label="Excluded pairs"
            rows={4}
            value={exclusions}
            spellCheck={false}
            onChange={(event) => onExclusions(event.target.value)}
          />
        </label>
      </details>
    </>
  )
}
