import { useViewValue } from '../shared/use-view-value'
import type { ExperimentFieldsView } from './experiment-fields-view'
import { ScopeBodyRow } from './scope-body-row'

interface Props {
  source: ExperimentFieldsView
}

export function ScopeFields({ source }: Props) {
  return (
    <details>
      <ScopeSummary source={source} />

      <ScopeFlags source={source} />

      <ScopeBodies source={source} />

      <ScopeNote source={source} />

      <ScopeExclusions source={source} />
    </details>
  )
}

function ScopeSummary({ source }: Props) {
  const primary = useViewValue(
    source.scope,
    (value) => value.scope.primaryBodyIds.length
  )

  const influencing = useViewValue(
    source.scope,
    (value) => value.scope.influencingBodyIds.length
  )

  return (
    <summary>
      Analysis scope{' '}
      <span>
        {primary} primary - {influencing} influencing
      </span>
    </summary>
  )
}

function ScopeFlags({ source }: Props) {
  useViewValue(source.scope, (value) => value.scope.selfCollision)

  useViewValue(source.scope, (value) => value.scope.externalCollision)

  const scope = source.scope.getSnapshot().scope

  return (
    <div className="scope-flags grid gap-[10px] mb-[14px]">
      <label className="checkbox flex-row items-center gap-[6px] [&_span]:text-sim-muted [&_span]:font-normal">
        <input
          type="checkbox"
          checked={scope.selfCollision}
          onChange={(event) =>
            source.changeScope({ selfCollision: event.target.checked })
          }
        />
        Self-collision between primary bodies
      </label>

      <label className="checkbox flex-row items-center gap-[6px] [&_span]:text-sim-muted [&_span]:font-normal">
        <input
          type="checkbox"
          checked={scope.externalCollision}
          onChange={(event) =>
            source.changeScope({
              externalCollision: event.target.checked
            })
          }
        />
        Primary-to-influencing collision
      </label>
    </div>
  )
}

function ScopeBodies({ source }: Props) {
  const membership = useViewValue(source.scope, (value) =>
    JSON.stringify(value.ids)
  )

  const ids = JSON.parse(membership) as string[]

  return (
    <div
      className="body-scope-list grid gap-[7px] mb-[14px] [&_>_label]:grid
            [&_>_label]:grid-cols-[minmax(0,_1fr)_115px] [&_>_label]:items-center
            [&_>_label]:gap-[10px] [&_small]:block [&_small]:text-sim-muted
            [&_small]:text-[9px] [&_small]:wrap-anywhere [&_small]:mt-[3px]
            [&_small]:font-normal [&_select]:text-[10px] [&_select]:p-[6px]"
    >
      {ids.map((id) => (
        <ScopeBodyRow key={id} id={id} source={source} />
      ))}
    </div>
  )
}

function ScopeNote({ source }: Props) {
  const note = useViewValue(source.scope, (value) => value.scope.backgroundNote)

  return (
    <label>
      Scope note
      <textarea
        aria-label="Scope note"
        rows={2}
        maxLength={2000}
        value={note}
        onChange={(event) =>
          source.changeScope({ backgroundNote: event.target.value })
        }
      />
    </label>
  )
}

function ScopeExclusions({ source }: Props) {
  const exclusions = useViewValue(source.scope, (value) => value.exclusions)

  return (
    <label>
      Excluded pairs (body-a TAB body-b TAB reason)
      <textarea
        aria-label="Excluded pairs"
        rows={4}
        value={exclusions}
        spellCheck={false}
        onChange={(event) => source.changeExclusions(event.target.value)}
      />
    </label>
  )
}
