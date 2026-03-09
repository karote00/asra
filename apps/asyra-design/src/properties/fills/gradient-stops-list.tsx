import { ColorPicker, Input } from '@asyra/design-system'
import { type FillAttrs, type FillGradientStop } from '@asyra/utils'
import type React from 'react'
import { convertStoredColorToFormat } from './color-format'

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
    <div className="mt-8 flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-[0.08em] text-gray-400">
        Stops
      </span>
      <button
        type="button"
        onClick={onAddStop}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#434445] bg-[#1d1e1f] text-[#c7ccd1] transition-colors hover:border-[#626467] hover:text-white"
        data-testid={`prop-fill-gradient-add-stop-${index}`}
        aria-label="Add gradient stop"
        title="Add gradient stop"
      >
        <AddIcon />
      </button>
    </div>

    <div className="mt-2 flex flex-col gap-2">
      {orderedStops.map(({ stop, index: stopIndex }, orderIndex) => (
        <div
          key={stopIndex}
          className={`flex items-center gap-2 rounded-md border px-2 py-2 ${
            stopIndex === selectedStopIndex
              ? 'border-[#4c95ff] bg-[#1f2733]'
              : 'border-[#343536] bg-[#1d1e1f]'
          }`}
          data-testid={`prop-fill-gradient-stop-row-${index}-${stopIndex}`}
          onPointerDown={(event) => onRowPointerDown(stopIndex, event)}
          onClick={() => onSelectStop(stopIndex)}
        >
          <div className="w-20">
            <Input
              value={Math.round(clampUnit(stop.position) * 100)}
              suffix="%"
              onChange={(value) => onStopPositionChange(stopIndex, value)}
              data-testid={`prop-fill-gradient-stop-position-${index}-${stopIndex}`}
            />
          </div>
          <div className="flex flex-1 items-center gap-2">
            <ColorPicker
              color={stop.color}
              opacity={stop.opacity}
              open={openStopIndex === stopIndex}
              onOpenChange={(nextOpen) => onOpenStopChange(stopIndex, nextOpen)}
              onChange={(next) => onStopColorChange(stopIndex, next)}
              onChangeStart={onColorPickerStart}
              onChangeEnd={onColorPickerEnd}
              data-testid={`prop-fill-gradient-stop-color-picker-${index}-${stopIndex}`}
            />
            <div className="flex-1">
              <Input
                value={convertStoredColorToFormat(stop.color, fillColorFormat)}
                onChange={(value) => onStopColorTextChange(stopIndex, value)}
                data-testid={`prop-fill-gradient-stop-color-${index}-${stopIndex}`}
              />
            </div>
          </div>
          <div className="w-20">
            <Input
              value={Math.round(clampUnit(stop.opacity) * 100)}
              suffix="%"
              onChange={(value) => onStopOpacityChange(stopIndex, value)}
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
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#434445] bg-[#1d1e1f] text-[#c7ccd1] transition-colors hover:border-[#626467] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
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
