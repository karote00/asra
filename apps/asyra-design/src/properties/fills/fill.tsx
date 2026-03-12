import { type FillAttrs } from '@asyra/utils'
import { Input, PropertyControl } from '@asyra/design-system'
import { useFill } from '../../providers'
import FillColorControls from './fill-color-controls'
import { useFillInteractions } from './use-fill-interactions'
import { formatInputNumber } from '../number-input'

interface FillItemProps {
  index: number
  fillId: string
  ownerElementId: string | null
  onRemove: () => void
}

const EyeOpenIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1.5 7s2-4 5.5-4 5.5 4 5.5 4-2 4-5.5 4S1.5 7 1.5 7z" />
    <circle cx="7" cy="7" r="1.75" />
  </svg>
)

const EyeClosedIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 2l10 10" />
    <path d="M5.6 5.6a1.75 1.75 0 0 0 2.8 2.8" />
    <path d="M3.5 4.4C2.3 5.4 1.5 7 1.5 7s2 4 5.5 4c.8 0 1.6-.2 2.2-.5" />
    <path d="M9.8 8.9c1-1 1.7-2.4 1.7-2.4S9.5 3 7 3c-.4 0-.8 0-1.2.2" />
  </svg>
)

const MinusIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
  >
    <path d="M2 5h6" />
  </svg>
)

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
      <PropertyControl className="flex-1 gap-[1px]">
        {/* Swatch + Hex container */}
        <div className="flex-1 min-w-0">
          <FillColorControls
            index={index}
            fill={fill as unknown as FillAttrs}
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
          />
        </div>

        {/* Divider line for visual separation if needed */}
        <div className="w-[1px] h-3 bg-divider mx-[2px] opacity-50" />

        {/* Opacity container */}
        <div style={{ width: '48px' }}>
          <Input
            value={formatInputNumber(Math.round(fill.opacity * 100))}
            suffix="%"
            size="small"
            containerClassName="!bg-transparent !px-0"
            containerStyle={{
              border: 'none'
            }}
            noOutline
            onChange={handleOpacityChange}
            data-testid={`prop-fill-opacity-${index}`}
          />
        </div>
      </PropertyControl>

      {/* Visibility eye icon */}
      <button
        type="button"
        onClick={() => handleVisibleChange(!fill.visible)}
        className="flex items-center justify-center h-6 w-6 rounded hover:bg-panel-surface-hover text-text-secondary hover:text-text-primary transition-colors"
        data-testid={`prop-fill-visible-${index}`}
        title={fill.visible ? 'Hide fill' : 'Show fill'}
        style={{ width: '24px', height: '24px' }}
      >
        {fill.visible ? <EyeOpenIcon /> : <EyeClosedIcon />}
      </button>

      <button
        type="button"
        onClick={onRemove}
        className="flex items-center justify-center h-6 w-6 rounded hover:bg-panel-surface-hover text-text-secondary hover:text-text-primary transition-colors"
        data-testid={`prop-fill-remove-${index}`}
        title="Remove fill"
        style={{ width: '24px', height: '24px' }}
      >
        <MinusIcon />
      </button>
    </div>
  )
}

export default FillItem
