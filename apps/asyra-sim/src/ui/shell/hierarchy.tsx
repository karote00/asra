import { memo } from 'react'
import type { Body, Workcell } from '../../domain/workcell'

const HierarchyRow = memo(function HierarchyRow({
  id,
  name,
  role,
  fixed,
  visible,
  depth,
  selected,
  onSelect
}: {
  id: string
  name: string
  role: Body['role']
  fixed: boolean
  visible: boolean
  depth: number
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      role="treeitem"
      aria-selected={selected}
      className={`tree-row w-full border-0 rounded-none flex items-center gap-2 text-left
        pt-[9px] pb-[9px] text-[11px] bg-transparent whitespace-nowrap
        [&_>_span:nth-child(2)]:overflow-hidden
        [&_>_span:nth-child(2)]:text-ellipsis [&.selected]:bg-sim-selected
        [&.selected]:text-sim-selected-text
        [&.selected]:shadow-[inset_3px_0_#219985] hover:bg-sim-hover ${selected ? 'selected' : ''}`}
      style={{ paddingLeft: 16 + depth * 13 }}
      onClick={() => onSelect(id)}
      data-object-id={id}
    >
      <span
        className={`object-symbol text-sim-muted text-[15px] [&.link]:text-[#c28b49]
          [&.tool]:text-[#48a99c] [&.workpiece]:text-[#48a99c] ${role}`}
      >
        {fixed ? '◇' : '◉'}
      </span>

      <span>{name}</span>

      {!visible && (
        <span className="muted text-sim-muted text-[9px]">hidden</span>
      )}
    </button>
  )
})

export const Hierarchy = memo(function Hierarchy({
  workcell,
  selected,
  onSelect
}: {
  workcell: Workcell
  selected: string | null
  onSelect: (id: string) => void
}) {
  const children = new Map<string | null, Body[]>()

  for (const body of workcell.bodies) {
    const siblings = children.get(body.parentId) ?? []

    siblings.push(body)

    children.set(body.parentId, siblings)
  }

  const rows = (parentId: string | null, depth: number): React.ReactNode =>
    (children.get(parentId) ?? []).map((body) => (
      <div key={body.id}>
        <HierarchyRow
          id={body.id}
          name={body.name}
          role={body.role}
          fixed={body.joint.kind === 'fixed'}
          visible={body.visible}
          depth={depth}
          selected={body.id === selected}
          onSelect={onSelect}
        />

        {rows(body.id, depth + 1)}
      </div>
    ))

  return (
    <div role="tree" aria-label="Workcell hierarchy">
      {rows(null, 0)}
    </div>
  )
})
