import { memo } from 'react'
import type { ExperimentDraft } from '../../common-apis/experiment'
import type { Workcell } from '../../domain/workcell'
import { useCommittedCallback } from '../shared/use-committed-callback'
import { ScopeBodyRow } from './scope-body-row'
import { scopeWithBodyRole } from './scope-draft'

export const ScopeFields = memo(function ScopeFields({
  scope,
  onChange,
  exclusions,
  onExclusions,
  workcell
}: {
  scope: ExperimentDraft['scope']
  onChange: (scope: ExperimentDraft['scope']) => void
  exclusions: string
  onExclusions: (text: string) => void
  workcell: Workcell
}) {
  const setScope = useCommittedCallback((bodyId: string, role: string) =>
    onChange(scopeWithBodyRole(scope, bodyId, role))
  )

  return (
    <details>
      <summary>
        Analysis scope{' '}
        <span>
          {scope.primaryBodyIds.length} primary -{' '}
          {scope.influencingBodyIds.length} influencing
        </span>
      </summary>

      <div className="scope-flags grid gap-[10px] mb-[14px]">
        <label className="checkbox flex-row items-center gap-[6px] [&_span]:text-sim-muted [&_span]:font-normal">
          <input
            type="checkbox"
            checked={scope.selfCollision}
            onChange={(event) =>
              onChange({ ...scope, selfCollision: event.target.checked })
            }
          />
          Self-collision between primary bodies
        </label>

        <label className="checkbox flex-row items-center gap-[6px] [&_span]:text-sim-muted [&_span]:font-normal">
          <input
            type="checkbox"
            checked={scope.externalCollision}
            onChange={(event) =>
              onChange({
                ...scope,
                externalCollision: event.target.checked
              })
            }
          />
          Primary-to-influencing collision
        </label>
      </div>

      <div
        className="body-scope-list grid gap-[7px] mb-[14px] [&_>_label]:grid
            [&_>_label]:grid-cols-[minmax(0,_1fr)_115px] [&_>_label]:items-center
            [&_>_label]:gap-[10px] [&_small]:block [&_small]:text-sim-muted
            [&_small]:text-[9px] [&_small]:wrap-anywhere [&_small]:mt-[3px]
            [&_small]:font-normal [&_select]:text-[10px] [&_select]:p-[6px]"
      >
        {workcell.bodies.map((body) => {
          let role = 'outside'

          if (scope.primaryBodyIds.includes(body.id)) role = 'primary'
          else if (scope.influencingBodyIds.includes(body.id))
            role = 'influencing'

          return (
            <ScopeBodyRow
              key={body.id}
              id={body.id}
              name={body.name}
              role={role}
              onChange={setScope}
            />
          )
        })}
      </div>

      <label>
        Scope note
        <textarea
          aria-label="Scope note"
          rows={2}
          maxLength={2000}
          value={scope.backgroundNote}
          onChange={(event) =>
            onChange({ ...scope, backgroundNote: event.target.value })
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
  )
})
