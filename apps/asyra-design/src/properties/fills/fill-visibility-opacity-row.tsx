import { Input, PropertyControl } from '@asyra/design-system'
import { formatInputNumber } from '../number-input'

interface FillVisibilityOpacityRowProps {
  index: number
  visible: boolean
  opacity: number
  onVisibleChange: (nextVisible: boolean) => void
  onOpacityChange: (value: string) => boolean
}

const FillVisibilityOpacityRow = ({
  index,
  visible,
  opacity,
  onVisibleChange,
  onOpacityChange
}: FillVisibilityOpacityRowProps) => (
  <div className="grid grid-cols-[16px_1fr] items-center gap-[0.5em] pl-[1rem] pr-[0.5em] h-8 min-h-8">
    <input
      id={`fill-visible-${index}`}
      type="checkbox"
      checked={visible}
      onChange={(event) => onVisibleChange(event.target.checked)}
      className="w-3 h-3 rounded border-border-input bg-transparent accent-accent"
      data-testid={`prop-fill-visible-${index}`}
      title="Toggle visibility"
    />
    <PropertyControl style={{ width: '54px' }}>
      <Input
        value={formatInputNumber(Math.round(opacity * 100))}
        prefix="O"
        suffix="%"
        size="small"
        onChange={onOpacityChange}
        noOutline
        data-testid={`prop-fill-opacity-${index}`}
      />
    </PropertyControl>
  </div>
)

export default FillVisibilityOpacityRow
