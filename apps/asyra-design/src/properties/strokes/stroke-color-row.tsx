import { Input, PropertyControl } from '@asyra/design-system'
import type { StrokeAttrs, FillColorFormat } from '@asyra/utils'
import { formatInputNumber } from '../number-input'
import StrokeColorControls from './stroke-color-controls'

interface StrokeColorRowProps {
  index: number
  stroke: StrokeAttrs
  displayColor: string
  colorFormat: FillColorFormat
  onColorValueChange: (value: string) => boolean
  onColorPickerChange: (next: { color: string; opacity: number }) => void
  onColorPickerChangeStart: () => void
  onColorPickerChangeEnd: (next: { color: string; opacity: number }) => void
  onFormatChange: (nextFormat: FillColorFormat) => void
  opacity: number
  onOpacityChange: (value: string) => boolean
  opacityTestId?: string
}

const StrokeColorRow = ({
  index,
  stroke,
  displayColor,
  colorFormat,
  onColorValueChange,
  onColorPickerChange,
  onColorPickerChangeStart,
  onColorPickerChangeEnd,
  onFormatChange,
  opacity,
  onOpacityChange,
  opacityTestId
}: StrokeColorRowProps) => {
  return (
    <PropertyControl className="flex-1 gap-[1px]">
      <div className="flex-1 min-w-0">
        <StrokeColorControls
          index={index}
          stroke={stroke}
          displayColor={displayColor}
          colorFormat={colorFormat}
          onColorValueChange={onColorValueChange}
          onColorPickerChange={onColorPickerChange}
          onColorPickerChangeStart={onColorPickerChangeStart}
          onColorPickerChangeEnd={onColorPickerChangeEnd}
          onFormatChange={onFormatChange}
        />
      </div>

      <div className="w-[1px] h-3 bg-divider mx-[2px] opacity-50" />

      <div style={{ width: '48px' }}>
        <Input
          value={formatInputNumber(Math.round(opacity * 100))}
          suffix="%"
          size="small"
          containerClassName="!bg-transparent !px-0"
          containerStyle={{
            border: 'none'
          }}
          noOutline
          inputClassName="!pl-[0.5em]"
          onChange={onOpacityChange}
          data-testid={opacityTestId}
        />
      </div>
    </PropertyControl>
  )
}

export default StrokeColorRow
