import type { FillRowAttrs } from '@asyra/utils'
import FillItem from './fill'

interface FillListProps {
  fills: FillRowAttrs[]
  ownerElementId: string | null
  mixed: boolean
  onAdd: () => void
  onRemoveFill: (index: number) => void
}

const FillList = ({
  fills,
  ownerElementId,
  mixed,
  onAdd,
  onRemoveFill
}: FillListProps) => {
  return (
    <div className="w-full" data-testid="prop-fills-section">
      <div className="w-full px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">Fills</span>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs text-gray-300 hover:text-white border border-border-dark rounded px-2 py-1"
          data-testid="prop-fill-add"
        >
          Add Fill
        </button>
      </div>

      {mixed && (
        <div
          className="px-3 py-2 text-xs text-gray-400"
          data-testid="prop-fills-mixed"
        >
          Mixed fills across current selection.
        </div>
      )}

      {!fills.length && (
        <div
          className="px-3 py-2 text-xs text-gray-500"
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
