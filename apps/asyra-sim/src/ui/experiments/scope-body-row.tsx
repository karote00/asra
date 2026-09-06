import { useViewValue } from '../shared/use-view-value'
import type { ExperimentFieldsView } from './experiment-fields-view'

export function ScopeBodyRow({
  id,
  source
}: {
  id: string
  source: ExperimentFieldsView
}) {
  const name = useViewValue(source.scope, (value) => value.names.get(id))

  const role = useViewValue(
    source.scope,
    (value) => value.roles.get(id) ?? 'outside'
  )

  return (
    <label>
      <span>
        {name}

        <small>{id}</small>
      </span>

      <select
        aria-label={`${name} analysis role`}
        value={role}
        onChange={(event) => source.changeRole(id, event.target.value)}
      >
        <option value="primary">Primary</option>

        <option value="influencing">Influencing</option>

        <option value="outside">Outside scope</option>
      </select>
    </label>
  )
}
