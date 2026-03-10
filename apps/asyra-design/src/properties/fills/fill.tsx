import { type FillAttrs } from '@asyra/utils'
import { useFill } from '../../providers'
import FillColorControls from './fill-color-controls'
import FillFormatSelect from './fill-format-select'
import FillVisibilityOpacityRow from './fill-visibility-opacity-row'
import { useFillInteractions } from './use-fill-interactions'

interface FillItemProps {
  index: number
  fillId: string
  ownerElementId: string | null
  onRemove: () => void
}

const FillItem = ({
  index,
  fillId,
  ownerElementId,
  onRemove
}: FillItemProps) => {
  const fill = useFill(fillId)
  const {
    displayColor,
    gradientData,
    previewSwatchStyle,
    handleKindChange,
    handleVisibleChange,
    handleOpacityChange,
    handleFormatChange,
    handleColorValueChange,
    handleColorPickerChange,
    handleColorPickerChangeStart,
    handleColorPickerChangeEnd,
    handleGradientFillChange,
    handleGradientEditorOpenChange,
    startFillInteractionTransaction,
    endFillInteractionTransaction
  } = useFillInteractions({
    fill: fill as FillAttrs | null,
    fillId,
    ownerElementId
  })

  if (!fill) {
    return null
  }

  return (
    <div
      className="w-full px-3 py-2 border-b border-border-dark flex flex-col gap-2"
      data-testid={`prop-fill-${index}`}
    >
      <div className="flex items-center justify-end gap-2 w-full">
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-gray-300 hover:text-white border border-border-dark rounded px-2 py-1"
          data-testid={`prop-fill-remove-${index}`}
        >
          Remove
        </button>
      </div>

      <FillVisibilityOpacityRow
        index={index}
        visible={fill.visible}
        opacity={fill.opacity}
        onVisibleChange={handleVisibleChange}
        onOpacityChange={handleOpacityChange}
      />

      <FillColorControls
        index={index}
        fill={fill as FillAttrs}
        displayColor={displayColor}
        gradientData={gradientData}
        previewSwatchStyle={previewSwatchStyle}
        onKindChange={handleKindChange}
        onColorValueChange={handleColorValueChange}
        onColorPickerChange={handleColorPickerChange}
        onColorPickerChangeStart={handleColorPickerChangeStart}
        onColorPickerChangeEnd={handleColorPickerChangeEnd}
        onGradientEditorOpenChange={handleGradientEditorOpenChange}
        onGradientFillChange={handleGradientFillChange}
        onStartInteraction={startFillInteractionTransaction}
        onEndInteraction={endFillInteractionTransaction}
      />

      <FillFormatSelect
        index={index}
        value={fill.colorFormat}
        onChange={handleFormatChange}
      />
    </div>
  )
}

export default FillItem
