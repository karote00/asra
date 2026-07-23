import { Input, PropertyControl } from '@asyra/design-system'
import { FillKinds, type FillAttrs, type FillGradientStop } from '@asyra/utils'
import type React from 'react'
import { convertToHexUpper } from './color-format'
import { MinusIcon } from '../icons'
import FillColorRow from './fill-color-row'
import { formatInputNumber } from '../number-input'

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
    <div className="flex items-center justify-between h-8 px-3 mt-4">
      <span className="text-[10px] uppercase tracking-[0.08em] text-white font-bold">
        Stops
      </span>
      <button
        type="button"
        onClick={onAddStop}
        className="flex items-center justify-center w-5 h-5 rounded hover:bg-panel-surface-hover text-white transition-colors"
        data-testid={`prop-fill-gradient-add-stop-${index}`}
        aria-label="Add gradient stop"
        title="Add gradient stop"
      >
        <AddIcon />
      </button>
    </div>

    <div className="flex flex-col text-white">
      {orderedStops.map(({ stop, index: stopIndex }, orderIndex) => (
        <div
          key={stopIndex}
          className={`grid grid-cols-[54px_1fr_28px] items-center gap-2 h-8 min-h-8 px-3 transition-colors ${
            stopIndex === selectedStopIndex ? 'bg-[rgba(13,153,255,0.08)]' : ''
          }`}
          data-testid={`prop-fill-gradient-stop-row-${index}-${stopIndex}`}
          onPointerDown={(event) => onRowPointerDown(stopIndex, event)}
          onClick={() => onSelectStop(stopIndex)}
        >
          <PropertyControl className="w-[54px]">
            <Input
              value={formatInputNumber(Math.round(stop.position * 100))}
              suffix="%"
              size="small"
              onChange={(value: string) =>
                onStopPositionChange(stopIndex, value)
              }
              noOutline
              data-testid={`prop-fill-gradient-stop-position-${index}-${stopIndex}`}
            />
          </PropertyControl>
          <FillColorRow
            index={stopIndex}
            fill={
              {
                id: `gradient-stop-${index}-${stopIndex}`,
                type: 'fill',
                kind: FillKinds.SOLID,
                color: stop.color,
                opacity: stop.opacity,
                visible: true,
                colorFormat: fillColorFormat,
                defaultColorFormat: fillColorFormat,
                gradient: null
              } as FillAttrs
            }
            fillId={`gradient-stop-${index}-${stopIndex}`}
            ownerElementId={null}
            colorPickerTestId={`prop-fill-gradient-stop-color-picker-${index}-${stopIndex}`}
            colorPickerOpen={openStopIndex === stopIndex}
            displayColor={convertToHexUpper(stop.color)}
            gradientData={null}
            colorFormat={fillColorFormat}
            onKindChange={() => {
              /* stops are always solid */
            }}
            onColorValueChange={(value: string) =>
              onStopColorTextChange(stopIndex, value)
            }
            onColorPickerChange={(next: { color: string; opacity: number }) =>
              onStopColorChange(stopIndex, next)
            }
            onColorPickerChangeStart={onColorPickerStart}
            onColorPickerChangeEnd={(next: {
              color: string
              opacity: number
            }) => {
              onStopColorChange(stopIndex, next)
              onColorPickerEnd()
            }}
            onGradientEditorOpenChange={(open: boolean) =>
              onOpenStopChange(stopIndex, open)
            }
            onGradientFillChange={() => {
              /* stops don't have gradients */
            }}
            onStartInteraction={onColorPickerStart}
            onEndInteraction={onColorPickerEnd}
            onFormatChange={() => {
              /* stops follow main fill format */
            }}
            opacity={stop.opacity}
            onOpacityChange={(value: string) =>
              onStopOpacityChange(stopIndex, value)
            }
            opacityTestId={`prop-fill-gradient-stop-opacity-${index}-${stopIndex}`}
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onRemoveStop(stopIndex)
            }}
            disabled={totalStopCount <= 2}
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-panel-surface-hover text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-[14px]"
            data-testid={`prop-fill-gradient-stop-remove-${index}-${stopIndex}`}
            aria-label={`Remove gradient stop ${orderIndex + 1}`}
            title="Remove gradient stop"
          >
            <MinusIcon />
          </button>
        </div>
      ))}
    </div>
  </>
)

export default GradientStopsList
