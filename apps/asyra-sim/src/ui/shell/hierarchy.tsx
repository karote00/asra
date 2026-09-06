import { useViewValue } from '../shared/use-view-value'
import {
  useWorkbenchField,
  useWorkbenchValue,
  useWorkbenchView
} from './workbench-context'

function HierarchyRow({ id, depth }: { id: string; depth: number }) {
  const source = useWorkbenchView().body(id)

  const name = useViewValue(source, (body) => body.name)

  const role = useViewValue(source, (body) => body.role)

  const fixed = useViewValue(source, (body) => body.joint.kind === 'fixed')

  const visible = useViewValue(source, (body) => body.visible)

  const selected = useWorkbenchValue((state) => state.selectedId === id)

  const onSelect = useWorkbenchField('select')

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
}

export function Hierarchy() {
  useWorkbenchField('runtime')

  useWorkbenchField('candidateId')

  const membership = useWorkbenchValue((state) =>
    JSON.stringify(
      state.workcell?.bodies.map((body) => [body.id, body.parentId]) ?? []
    )
  )

  const entries = JSON.parse(membership) as [string, string | null][]

  const children = new Map<string | null, string[]>()

  for (const [id, parentId] of entries) {
    const siblings = children.get(parentId) ?? []

    siblings.push(id)

    children.set(parentId, siblings)
  }

  const rows = (parentId: string | null, depth: number): React.ReactNode =>
    (children.get(parentId) ?? []).map((id) => (
      <div key={id}>
        <HierarchyRow id={id} depth={depth} />

        {rows(id, depth + 1)}
      </div>
    ))

  return (
    <div role="tree" aria-label="Workcell hierarchy">
      {rows(null, 0)}
    </div>
  )
}
