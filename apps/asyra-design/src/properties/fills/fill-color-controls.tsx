import { ColorPicker, Input } from '@asyra/design-system'
import { FillKinds, type EVENT_OPTIONS, type FillAttrs } from '@asyra/utils'
import type { CSSProperties, ReactNode } from 'react'
import type { FillPatch } from '../../common-apis'
import GradientEditor from './gradient-editor'

const FillModeIcon = ({ kind }: { kind: FillAttrs['kind'] }) => {
  if (kind === FillKinds.GRADIENT) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-4 w-4"
        fill="none"
      >
        <rect x="2" y="4" width="12" height="8" rx="4" fill="#ffffff" />
        <path d="M8 4h2a4 4 0 0 1 0 8H8V4Z" fill="#111111" />
        <rect
          x="2.5"
          y="4.5"
          width="11"
          height="7"
          rx="3.5"
          stroke="currentColor"
        />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <circle cx="8" cy="8" r="4.5" fill="currentColor" />
    </svg>
  )
}

interface FillModeButtonProps {
  active: boolean
  kind: FillAttrs['kind']
  label: string
  testId: string
  onClick: () => void
}

const FillModeButton = ({
  active,
  kind,
  label,
  testId,
  onClick
}: FillModeButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
      active
        ? 'border-[#4c95ff] bg-[#224c88] text-white'
        : 'border-[#434445] bg-[#1d1e1f] text-[#c7ccd1] hover:border-[#626467] hover:text-white'
    }`}
    data-testid={testId}
    aria-label={label}
    title={label}
  >
    <FillModeIcon kind={kind} />
  </button>
)

interface FillColorControlsProps {
  index: number
  fill: FillAttrs
  displayColor: string
  gradientData: FillAttrs['gradient']
  previewSwatchStyle?: CSSProperties
  onKindChange: (nextKind: FillAttrs['kind']) => void
  onColorValueChange: (value: string) => boolean
  onColorPickerChange: (next: { color: string; opacity: number }) => void
  onColorPickerChangeStart: () => void
  onColorPickerChangeEnd: (next: { color: string; opacity: number }) => void
  onGradientFillChange: (
    patch: FillPatch,
    options?: EVENT_OPTIONS,
    sourceFill?: FillAttrs
  ) => void
  onStartInteraction: () => void
  onEndInteraction: () => void
}

const FillColorControls = ({
  index,
  fill,
  displayColor,
  gradientData,
  previewSwatchStyle,
  onKindChange,
  onColorValueChange,
  onColorPickerChange,
  onColorPickerChangeStart,
  onColorPickerChangeEnd,
  onGradientFillChange,
  onStartInteraction,
  onEndInteraction
}: FillColorControlsProps) => {
  const pickerHeader: ReactNode = (
    <div className="flex items-center gap-2">
      <FillModeButton
        active={fill.kind === FillKinds.SOLID}
        kind={FillKinds.SOLID}
        label="Solid fill"
        testId={`prop-fill-mode-solid-${index}`}
        onClick={() => onKindChange(FillKinds.SOLID)}
      />
      <FillModeButton
        active={fill.kind === FillKinds.GRADIENT}
        kind={FillKinds.GRADIENT}
        label="Gradient fill"
        testId={`prop-fill-mode-gradient-${index}`}
        onClick={() => onKindChange(FillKinds.GRADIENT)}
      />
    </div>
  )

  return (
    <div className="flex items-center gap-2 w-full">
      <ColorPicker
        color={fill.color}
        opacity={fill.opacity}
        onChange={onColorPickerChange}
        onChangeStart={onColorPickerChangeStart}
        onChangeEnd={onColorPickerChangeEnd}
        header={pickerHeader}
        hideDefaultPanel={fill.kind === FillKinds.GRADIENT}
        swatchStyle={previewSwatchStyle}
        data-testid={`prop-fill-color-picker-${index}`}
      >
        {gradientData ? (
          <GradientEditor
            index={index}
            fill={fill}
            gradient={gradientData}
            onChangeFill={onGradientFillChange}
            onStartInteraction={onStartInteraction}
            onEndInteraction={onEndInteraction}
            embedded
          />
        ) : null}
      </ColorPicker>
      <div className="flex-1">
        {gradientData ? (
          <div
            className="flex h-8 items-center justify-between rounded-md border border-border-dark bg-[#1d1e1f] px-3 text-[11px] uppercase tracking-[0.08em] text-gray-300"
            data-testid={`prop-fill-gradient-summary-${index}`}
          >
            <span>{gradientData.gradientType}</span>
            <span className="text-gray-500">
              {gradientData.gradientStops.length} stops
            </span>
          </div>
        ) : (
          <Input
            value={displayColor}
            onChange={onColorValueChange}
            data-testid={`prop-fill-color-${index}`}
          />
        )}
      </div>
    </div>
  )
}

export default FillColorControls
