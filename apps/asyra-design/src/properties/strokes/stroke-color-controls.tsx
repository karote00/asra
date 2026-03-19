import { ColorPicker, Input } from '@asyra/design-system'
import type { StrokeAttrs, FillColorFormat } from '@asyra/utils'
import type { CSSProperties } from 'react'
import { ALLOWED_COLOR_FORMATS } from '../../constants'
import { COLOR_PICKER_FORMAT_DEFINITIONS } from '../fills/color-picker-config'

interface StrokeColorControlsProps {
  index: number
  stroke: StrokeAttrs
  displayColor: string
  previewSwatchStyle?: CSSProperties
  colorFormat: FillColorFormat
  onColorValueChange: (value: string) => boolean
  onColorPickerChange: (next: { color: string; opacity: number }) => void
  onColorPickerChangeStart: () => void
  onColorPickerChangeEnd: (next: { color: string; opacity: number }) => void
  onFormatChange: (nextFormat: FillColorFormat) => void
}

const StrokeColorControls = ({
  index,
  stroke,
  displayColor,
  previewSwatchStyle,
  colorFormat,
  onColorValueChange,
  onColorPickerChange,
  onColorPickerChangeStart,
  onColorPickerChangeEnd,
  onFormatChange
}: StrokeColorControlsProps) => {
  return (
    <div className="flex items-center flex-1 min-w-0 h-full">
      <div className="flex items-center flex-1 min-w-0 h-full">
        <ColorPicker
          color={stroke.color}
          opacity={stroke.opacity}
          onChange={onColorPickerChange}
          onChangeStart={onColorPickerChangeStart}
          onChangeEnd={onColorPickerChangeEnd}
          colorFormat={colorFormat}
          onFormatChange={(format: string) =>
            onFormatChange(format as FillColorFormat)
          }
          formatOptions={ALLOWED_COLOR_FORMATS}
          formatDefinitions={COLOR_PICKER_FORMAT_DEFINITIONS}
          showAlpha={true}
          swatchStyle={{
            position: 'static',
            width: '14px',
            height: '14px',
            borderRadius: '2px',
            ...previewSwatchStyle
          }}
          triggerClassName="group flex h-6 w-6 items-center justify-center flex-shrink-0 rounded-l-[3px] transition-all text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
          triggerStyle={{
            borderRadius: '3px 0 0 3px',
            borderRight: 'none'
          }}
          data-testid={`prop-stroke-color-picker-${index}`}
        />
        <div className="flex-1 min-w-0 h-full flex items-center">
          <Input
            value={displayColor}
            size="small"
            containerClassName=""
            containerStyle={{
              borderRadius: 0,
              background: 'transparent',
              border: 'none'
            }}
            noOutline
            inputClassName="!pl-[0.5em]"
            onChange={onColorValueChange}
            data-testid={`prop-stroke-color-${index}`}
          />
        </div>
      </div>
    </div>
  )
}

export default StrokeColorControls
