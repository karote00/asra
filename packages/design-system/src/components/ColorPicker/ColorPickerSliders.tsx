import React from 'react'
import type { HSVAColor, RGBAColor } from './color-utils'

interface ColorPickerSlidersProps {
  hsva: HSVAColor
  currentRgba: RGBAColor
  hueRef: React.RefObject<HTMLDivElement | null>
  alphaRef: React.RefObject<HTMLDivElement | null>
  onEyeDropper: () => void
  onSliderPointerDown: (
    type: 'hue' | 'alpha',
    event: React.PointerEvent<HTMLDivElement>
  ) => void
  'data-testid'?: string
}

const SLIDER_THUMB_SIZE = 16
const SLIDER_THUMB_RADIUS = SLIDER_THUMB_SIZE / 2
const CHECKERBOARD_BACKGROUND = {
  backgroundImage: 'conic-gradient(#333 0 25%, #444 0 50%, #333 0 75%, #444 0)',
  backgroundSize: '8px 8px'
}

export const ColorPickerSliders: React.FC<ColorPickerSlidersProps> = ({
  hsva,
  currentRgba,
  hueRef,
  alphaRef,
  onEyeDropper,
  onSliderPointerDown,
  'data-testid': dataTestId
}) => {
  return (
    <div className="flex items-center mb-3">
      <div className="mx-3 flex items-center justify-center shrink-0">
        <button
          type="button"
          onClick={onEyeDropper}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/[0.08] text-white transition-colors"
          title="Eye Dropper"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.5 1.5L9 5L2 12V14H4L11 7L14.5 3.5C15.2 2.8 15.2 1.7 14.5 1L14.5 1C13.8 0.3 12.7 0.3 12.5 1.5Z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5.5 8.5L7.5 10.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 pr-3 space-y-2">
        <div
          ref={hueRef}
          className="relative h-4 w-full cursor-ew-resize rounded-full border border-[#4B4B4B]"
          style={{
            background:
              'linear-gradient(90deg, #FF3B30 0%, #FFC700 17%, #34C759 34%, #00C7BE 51%, #0A84FF 68%, #AF52DE 85%, #FF3B30 100%)'
          }}
          onPointerDown={(event) => onSliderPointerDown('hue', event)}
          data-testid={dataTestId ? `${dataTestId}-hue` : undefined}
        >
          <div
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
            style={{
              left: `calc(${SLIDER_THUMB_RADIUS}px + ${hsva.h / 360} * (100% - ${SLIDER_THUMB_SIZE}px))`
            }}
          />
        </div>

        <div
          ref={alphaRef}
          className="relative h-4 w-full cursor-ew-resize rounded-full border border-[#4B4B4B]"
          style={CHECKERBOARD_BACKGROUND}
          onPointerDown={(event) => onSliderPointerDown('alpha', event)}
          data-testid={dataTestId ? `${dataTestId}-alpha` : undefined}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, rgba(${Math.round(
                currentRgba.r
              )}, ${Math.round(currentRgba.g)}, ${Math.round(
                currentRgba.b
              )}, 0) 0%, rgba(${Math.round(
                currentRgba.r
              )}, ${Math.round(currentRgba.g)}, ${Math.round(
                currentRgba.b
              )}, 1) 100%)`
            }}
          />
          <div
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
            style={{
              left: `calc(${SLIDER_THUMB_RADIUS}px + ${hsva.a} * (100% - ${SLIDER_THUMB_SIZE}px))`
            }}
          />
        </div>
      </div>
    </div>
  )
}
