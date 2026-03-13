import { ColorPicker, Input } from '@asyra/design-system'
import { type FillAttrs, type FillGradientStop } from '@asyra/utils'
import type React from 'react'
import { convertStoredColorToFormat } from './color-format'
import { formatInputNumber } from '../number-input'

const clampUnit = (value: number) => Math.max(0, Math.min(1, value))

const AddIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    className="h-3.5 w-3.5"
    fill="none"
  >
    <path
      d="M8 3.25v9.5M3.25 8h9.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

const RemoveIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    className="h-3.5 w-3.5"
    fill="none"
  >
    <path
      d="M4 4l8 8M12 4l-8 8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

interface OrderedStop {
  stop: FillGradientStop
  index: number
}

interface GradientStopsListProps {
  index: number
  orderedStops: OrderedStop[]
  selectedStopIndex: number
  openStopIndex: number | null
  fillColorFormat: FillAttrs['colorFormat']
  totalStopCount: number
  onAddStop: () => void
  onSelectStop: (stopIndex: number) => void
  onRowPointerDown: (stopIndex: number, event: React.PointerEvent) => void
  onStopPositionChange: (stopIndex: number, value: string) => boolean
  onStopColorChange: (
    stopIndex: number,
    next: { color: string; opacity: number }
  ) => void
  onStopColorTextChange: (stopIndex: number, value: string) => boolean
  onStopOpacityChange: (stopIndex: number, value: string) => boolean
  onRemoveStop: (stopIndex: number) => void
  onOpenStopChange: (stopIndex: number, open: boolean) => void
  onColorPickerStart: () => void
  onColorPickerEnd: () => void
}

const GradientStopsList = ({
  index,
  orderedStops,
  selectedStopIndex,
  openStopIndex,
  fillColorFormat,
  totalStopCount,
  onAddStop,
  onSelectStop,
  onRowPointerDown,
  onStopPositionChange,
  onStopColorChange,
  onStopColorTextChange,
  onStopOpacityChange,
  onRemoveStop,
  onOpenStopChange,
  onColorPickerStart,
  onColorPickerEnd
}: GradientStopsListProps) => (
  <>
    <div className="flex items-center justify-between h-8 pl-4 pr-2 mt-4">
      <span className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary font-bold">
        Stops
      </span>
      <button
        type="button"
        onClick={onAddStop}
        className="flex items-center justify-center w-5 h-5 rounded hover:bg-panel-surface-hover text-text-secondary hover:text-text-primary transition-colors"
        data-testid={`prop-fill-gradient-add-stop-${index}`}
        aria-label="Add gradient stop"
        title="Add gradient stop"
      >
        <AddIcon />
      </button>
    </div>

    <div className="flex flex-col">
      {orderedStops.map(({ stop, index: stopIndex }, orderIndex) => (
        <div
          key={stopIndex}
          className={`grid grid-cols-[60px_1fr_60px_28px] items-center gap-2 pl-4 pr-2 h-8 min-h-8 transition-colors ${
            stopIndex === selectedStopIndex
              ? 'bg-[rgba(13,153,255,0.08)]'
              : 'hover:bg-panel-surface-hover'
          }`}
          data-testid={`prop-fill-gradient-stop-row-${index}-${stopIndex}`}
          onPointerDown={(event) => onRowPointerDown(stopIndex, event)}
          onClick={() => onSelectStop(stopIndex)}
        >
          <div className="flex-1 min-w-0 h-6 bg-panel-surface rounded transition-all hover:ring-1 hover:ring-white/10 focus-within:ring-1 focus-within:ring-border-focus">
            <Input
              value={formatInputNumber(Math.round(stop.position * 100))}
              suffix="%"
              size="small"
              onChange={(value) => onStopPositionChange(stopIndex, value)}
              containerClassName="rounded !bg-transparent"
              data-testid={`prop-fill-gradient-stop-position-${index}-${stopIndex}`}
            />
          </div>
          <div className="flex items-center gap-1 h-6 min-w-0">
            <ColorPicker
              color={stop.color}
              opacity={stop.opacity}
              open={openStopIndex === stopIndex}
              onOpenChange={(nextOpen) => onOpenStopChange(stopIndex, nextOpen)}
              onChange={(next) => onStopColorChange(stopIndex, next)}
              onChangeStart={onColorPickerStart}
              onChangeEnd={onColorPickerEnd}
              data-testid={`prop-fill-gradient-stop-color-picker-${index}-${stopIndex}`}
              triggerStyle={{
                width: '22px',
                height: '22px',
                borderRadius: '3px'
              }}
            />
            <div className="flex-1 h-6 min-w-0 bg-panel-surface rounded transition-all hover:ring-1 hover:ring-white/10 focus-within:ring-1 focus-within:ring-border-focus">
              <Input
                value={convertStoredColorToFormat(stop.color, fillColorFormat)}
                onChange={(value) => onStopColorTextChange(stopIndex, value)}
                containerClassName="rounded !bg-transparent"
                data-testid={`prop-fill-gradient-stop-color-${index}-${stopIndex}`}
              />
            </div>
          </div>
          <div className="h-6 min-w-0 bg-panel-surface rounded transition-all hover:ring-1 hover:ring-white/10 focus-within:ring-1 focus-within:ring-border-focus">
            <Input
              value={formatInputNumber(
                Math.round(clampUnit(stop.opacity) * 100)
              )}
              suffix="%"
              onChange={(value) => onStopOpacityChange(stopIndex, value)}
              containerClassName="rounded !bg-transparent"
              data-testid={`prop-fill-gradient-stop-opacity-${index}-${stopIndex}`}
            />
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onRemoveStop(stopIndex)
            }}
            disabled={totalStopCount <= 2}
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-panel-surface-hover text-text-secondary hover:text-text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            data-testid={`prop-fill-gradient-stop-remove-${index}-${stopIndex}`}
            aria-label={`Remove gradient stop ${orderIndex + 1}`}
            title="Remove gradient stop"
          >
            <RemoveIcon />
          </button>
        </div>
      ))}
    </div>
  </>
)

export default GradientStopsList
