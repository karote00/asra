import { Input } from '@asyra/design-system'

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
  <div className="flex items-center gap-2 w-full">
    <label
      className="text-xs text-gray-400 w-11"
      htmlFor={`fill-visible-${index}`}
    >
      Visible
    </label>
    <input
      id={`fill-visible-${index}`}
      type="checkbox"
      checked={visible}
      onChange={(event) => onVisibleChange(event.target.checked)}
      className="h-4 w-4"
      data-testid={`prop-fill-visible-${index}`}
    />
    <div className="flex-1">
      <Input
        value={Math.round(opacity * 100)}
        prefix="O"
        suffix="%"
        onChange={onOpacityChange}
        data-testid={`prop-fill-opacity-${index}`}
      />
    </div>
  </div>
)

export default FillVisibilityOpacityRow
