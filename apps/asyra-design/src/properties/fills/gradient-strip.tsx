import { type FillGradientData } from '@asyra/utils'
import type React from 'react'
import { toGradientPreviewCss } from './gradient-preview'

const clampUnit = (value: number) => Math.max(0, Math.min(1, value))

interface GradientStripProps {
  index: number
  gradient: FillGradientData
  selectedStopIndex: number
  openStopIndex: number | null
  stripRef: React.RefObject<HTMLDivElement | null>
  onAddStopFromStrip: (clientX: number) => void
  onSelectStop: (stopIndex: number) => void
  onStopPointerDown: (
    stopIndex: number,
    event: React.PointerEvent<HTMLButtonElement>
  ) => void
}

const GradientStrip = ({
  index,
  gradient,
  selectedStopIndex,
  openStopIndex,
  stripRef,
  onAddStopFromStrip,
  onSelectStop,
  onStopPointerDown
}: GradientStripProps) => (
  <div className="mt-2">
    <div
      ref={stripRef}
      onClick={(event) => onAddStopFromStrip(event.clientX)}
      className="relative h-6 w-full rounded-md border border-border-dark"
      style={{ background: toGradientPreviewCss(gradient) }}
      data-testid={`prop-fill-gradient-strip-${index}`}
    >
      {gradient.gradientStops.map((stop, stopIndex) => (
        <button
          key={stopIndex}
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onSelectStop(stopIndex)
          }}
          onPointerDown={(event) => onStopPointerDown(stopIndex, event)}
          className={`absolute top-full mt-1 h-4 w-4 -translate-x-1/2 rounded-sm border-2 ${
            stopIndex === selectedStopIndex
              ? 'border-white shadow-[0_0_0_1px_rgba(10,10,10,0.55)]'
              : 'border-[#d0d3d6]'
          }`}
          style={{
            left: `${clampUnit(stop.position) * 100}%`,
            backgroundColor: stop.color,
            opacity: stop.opacity
          }}
          data-testid={`prop-fill-gradient-stop-${index}-${stopIndex}`}
          aria-pressed={openStopIndex === stopIndex}
        />
      ))}
    </div>
  </div>
)

export default GradientStrip
