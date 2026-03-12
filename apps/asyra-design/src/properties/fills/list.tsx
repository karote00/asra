import type { FillRowAttrs } from '@asyra/utils'
import FillItem from './fill'

interface FillListProps {
  fills: FillRowAttrs[]
  ownerElementId: string | null
  mixed: boolean
  onAdd: () => void
  onRemoveFill: (index: number) => void
}

const PlusIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
  >
    <path d="M6 2v8M2 6h8" />
  </svg>
)

const FillList = ({
  fills,
  ownerElementId,
  mixed,
  onAdd,
  onRemoveFill
}: FillListProps) => {
  return (
    <div
      className="grid grid-cols-1 w-full pb-2"
      data-testid="prop-fills-section"
    >
      {/* Section header with add button */}
      <div className="group flex items-center justify-between h-10 pl-4 pr-2 text-[#ebebeb] hover:text-white">
        <span className="text-[11px] font-medium opacity-60 tracking-wider group-hover:text-white group-hover:opacity-100">
          Fill
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center justify-center w-5 h-5 rounded hover:bg-panel-surface-hover text-text-secondary group-hover:text-white transition-colors"
          data-testid="prop-fill-add"
          title="Add fill"
        >
          <PlusIcon />
        </button>
      </div>

      {mixed && (
        <div
          className="pl-4 pr-2 py-2 text-[11px] text-[#999]"
          data-testid="prop-fills-mixed"
        >
          Mixed fills across current selection.
        </div>
      )}

      {!fills.length && (
        <div
          className="pl-4 pr-2 py-3 text-[11px] text-[#666]"
          data-testid="prop-fills-empty"
        >
          No fills yet.
        </div>
      )}

      {fills.map((fill, index) => {
        const primaryFillId = fill.ids[0]
        if (!primaryFillId) {
          return null
        }

        return (
          <FillItem
            key={primaryFillId}
            index={index}
            fillId={primaryFillId}
            ownerElementId={ownerElementId}
            onRemove={() => onRemoveFill(index)}
          />
        )
      })}
    </div>
  )
}

export default FillList
