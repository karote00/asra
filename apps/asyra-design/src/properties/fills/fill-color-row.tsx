import { Input, PropertyControl } from '@asyra/design-system'
import {
  type EVENT_OPTIONS,
  type FillAttrs,
  type FillColorFormat
} from '@asyra/utils'
import { type CSSProperties } from 'react'
import type { FillPatch } from '../../common-apis'
import { formatInputNumber } from '../number-input'
import FillColorControls from './fill-color-controls'

interface FillColorRowProps {
  index: number
  fill: FillAttrs
  fillId: string
  ownerElementId: string | null
  colorPickerTestId?: string
  colorPickerOpen?: boolean
  displayColor: string
  gradientData: FillAttrs['gradient']
  previewSwatchStyle?: CSSProperties
  colorFormat: FillColorFormat
  onKindChange: (nextKind: FillAttrs['kind']) => void
  onColorValueChange: (value: string) => boolean
  onColorPickerChange: (next: { color: string; opacity: number }) => void
  onColorPickerChangeStart: () => void
  onColorPickerChangeEnd: (next: { color: string; opacity: number }) => void
  onGradientEditorOpenChange: (open: boolean) => void
  onGradientFillChange: (
    patch: FillPatch,
    options?: EVENT_OPTIONS,
    sourceFill?: FillAttrs
  ) => void
  onStartInteraction: () => void
  onEndInteraction: () => void
  onFormatChange: (nextFormat: FillColorFormat) => void
  // Opacity props
  opacity: number
  onOpacityChange: (value: string) => boolean
  opacityTestId?: string
}

const FillColorRow = ({
  index,
  fill,
  fillId,
  ownerElementId,
  colorPickerTestId,
  colorPickerOpen,
  displayColor,
  gradientData,
  previewSwatchStyle,
  colorFormat,
  onKindChange,
  onColorValueChange,
  onColorPickerChange,
  onColorPickerChangeStart,
  onColorPickerChangeEnd,
  onGradientEditorOpenChange,
  onGradientFillChange,
  onStartInteraction,
  onEndInteraction,
  onFormatChange,
  opacity,
  onOpacityChange,
  opacityTestId
}: FillColorRowProps) => {
  return (
    <PropertyControl className="flex-1 gap-[1px]">
      <div className="flex-1 min-w-0">
        <FillColorControls
          index={index}
          fill={fill}
          fillId={fillId}
          ownerElementId={ownerElementId}
          colorPickerTestId={colorPickerTestId}
          colorPickerOpen={colorPickerOpen}
          displayColor={displayColor}
          gradientData={gradientData}
          previewSwatchStyle={previewSwatchStyle}
          colorFormat={colorFormat}
          onKindChange={onKindChange}
          onColorValueChange={onColorValueChange}
          onColorPickerChange={onColorPickerChange}
          onColorPickerChangeStart={onColorPickerChangeStart}
          onColorPickerChangeEnd={onColorPickerChangeEnd}
          onGradientEditorOpenChange={onGradientEditorOpenChange}
          onGradientFillChange={onGradientFillChange}
          onStartInteraction={onStartInteraction}
          onEndInteraction={onEndInteraction}
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
          inputClassName="!pl-0"
          onChange={onOpacityChange}
          data-testid={opacityTestId}
        />
      </div>
    </PropertyControl>
  )
}

export default FillColorRow
