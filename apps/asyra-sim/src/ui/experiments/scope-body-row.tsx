import { memo } from 'react'

export const ScopeBodyRow = memo(function ScopeBodyRow({
  id,
  name,
  role,
  onChange
}: {
  id: string
  name: string
  role: string
  onChange: (id: string, role: string) => void
}) {
  return (
    <label>
      <span>
        {name}
        <small>{id}</small>
      </span>

      <select
        aria-label={`${name} analysis role`}
        value={role}
        onChange={(event) => onChange(id, event.target.value)}
      >
        <option value="primary">Primary</option>

        <option value="influencing">Influencing</option>

        <option value="outside">Outside scope</option>
      </select>
    </label>
  )
})
