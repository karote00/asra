import { ColorPicker, Input } from '@asyra/design-system'
import {
  FillKinds,
  type EVENT_OPTIONS,
  type FillAttrs,
  type FillColorFormat
} from '@asyra/utils'
import type { CSSProperties, ReactNode } from 'react'
import type { FillPatch } from '../../common-apis'
import { ALLOWED_COLOR_FORMATS } from '../../constants'
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
    className={`inline-flex h-6 w-6 items-center justify-center rounded transition-colors ${active
      ? 'bg-accent text-white'
      : 'bg-transparent text-text-secondary hover:bg-panel-surface-hover hover:text-text-primary'
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
}

const FillColorControls = ({
  index,
  fill,
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
  onFormatChange
}: FillColorControlsProps) => {
  const shouldIgnoreOutsidePointerDown = (target: Node) =>
    fill.kind === FillKinds.GRADIENT && target instanceof HTMLCanvasElement

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

  // Format selector that goes inside the color picker popup (footer)
  const pickerFooter: ReactNode = (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-[10px] text-text-tertiary">Format</span>
      <select
        value={colorFormat}
        onChange={(event) =>
          onFormatChange(event.target.value as FillColorFormat)
        }
        className="flex-1 rounded border border-border-input bg-transparent px-2 py-1 text-[11px] text-text-primary outline-none transition-colors hover:border-border-subtle focus:border-border-focus"
        data-testid={`prop-fill-format-${index}`}
      >
        {ALLOWED_COLOR_FORMATS.map((format) => (
          <option key={format} value={format}>
            {format}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="flex items-center flex-1 min-w-0 h-full">
      {/* Group: swatch + hex input (left-rounded) */}
      <div className="flex items-center flex-1 min-w-0 h-full">
        <ColorPicker
          color={fill.color}
          opacity={fill.opacity}
          onChange={onColorPickerChange}
          onChangeStart={onColorPickerChangeStart}
          onChangeEnd={onColorPickerChangeEnd}
          onOpenChange={onGradientEditorOpenChange}
          shouldIgnoreOutsidePointerDown={shouldIgnoreOutsidePointerDown}
          header={pickerHeader}
          footer={pickerFooter}
          hideDefaultPanel={fill.kind === FillKinds.GRADIENT}
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
        <div className="flex-1 min-w-0 h-full flex items-center">
          {gradientData ? (
            <div
              className="flex h-full items-center px-1.5 text-[11px] text-text-secondary truncate"
              style={{
                background: 'transparent',
                borderRadius: 0
              }}
              data-testid={`prop-fill-gradient-summary-${index}`}
            >
              {gradientData.gradientType}
            </div>
          ) : (
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
              onChange={onColorValueChange}
              data-testid={`prop-fill-color-${index}`}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default FillColorControls
