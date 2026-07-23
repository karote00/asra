import { type FillAttrs } from '@asyra/utils'
import { useFill } from '../../providers'
import { EyeClosedIcon, EyeOpenIcon, MinusIcon } from '../icons'
import FillColorRow from './fill-color-row'
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
    fill: fill as unknown as FillAttrs | null,
    fillId,
    ownerElementId
  })

  if (!fill) {
    return null
  }

  return (
    <div
      className="grid grid-cols-[1fr_24px_24px] items-center gap-2 pl-4 pr-2 h-8 min-h-8"
      data-testid={`prop-fill-${index}`}
    >
      {/* Group: Swatch/Hex + Opacity */}
      <FillColorRow
        index={index}
        fill={fill as unknown as FillAttrs}
        fillId={fillId}
        ownerElementId={ownerElementId}
        displayColor={displayColor}
        gradientData={gradientData}
        previewSwatchStyle={previewSwatchStyle}
        colorFormat={fill.colorFormat}
        onKindChange={handleKindChange}
        onColorValueChange={handleColorValueChange}
        onColorPickerChange={handleColorPickerChange}
        onColorPickerChangeStart={handleColorPickerChangeStart}
        onColorPickerChangeEnd={handleColorPickerChangeEnd}
        onGradientEditorOpenChange={handleGradientEditorOpenChange}
        onGradientFillChange={handleGradientFillChange}
        onStartInteraction={startFillInteractionTransaction}
        onEndInteraction={endFillInteractionTransaction}
        onFormatChange={handleFormatChange}
        opacity={fill.opacity}
        onOpacityChange={handleOpacityChange}
        opacityTestId={`prop-fill-opacity-${index}`}
      />

      {/* Visibility eye icon */}
      <button
        type="button"
        onClick={() => handleVisibleChange(!fill.visible)}
        className="flex items-center justify-center h-6 w-6 rounded hover:bg-panel-surface-hover text-white/60 hover:text-white transition-colors"
        data-testid={`prop-fill-visible-${index}`}
        title={fill.visible ? 'Hide fill' : 'Show fill'}
        style={{ width: '24px', height: '24px' }}
      >
        {fill.visible ? <EyeOpenIcon /> : <EyeClosedIcon />}
      </button>

      <button
        type="button"
        onClick={onRemove}
        className="flex items-center justify-center h-6 w-6 rounded hover:bg-panel-surface-hover text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        data-testid={`prop-fill-remove-${index}`}
        title="Remove fill"
        aria-label="Remove fill"
      >
        <MinusIcon />
      </button>
    </div>
  )
}

export default FillItem
