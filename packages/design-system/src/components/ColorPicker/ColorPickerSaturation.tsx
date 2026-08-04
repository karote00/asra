import React from 'react'
import type { HSVAColor } from './color-utils.js'

interface ColorPickerSaturationProps {
  hsva: HSVAColor
  hueColor: string
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  saturationRef: React.RefObject<HTMLDivElement | null>
  'data-testid'?: string
}

export const ColorPickerSaturation: React.FC<ColorPickerSaturationProps> = ({
  hsva,
  hueColor,
  onPointerDown,
  saturationRef,
  'data-testid': dataTestId
}) => {
  return (
    <div className="px-3 mb-3">
      <div
        ref={saturationRef}
        className="relative h-40 w-full cursor-crosshair rounded-lg border border-[#4B4B4B]"
        style={{
          backgroundColor: hueColor,
          backgroundImage:
            'linear-gradient(to top, #000, transparent), linear-gradient(to right, #FFF, transparent)',
          overflow: 'clip'
        }}
        onPointerDown={onPointerDown}
        data-testid={dataTestId}
      >
        <div
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
          style={{
            left: `${hsva.s * 100}%`,
            top: `${(1 - hsva.v) * 100}%`
          }}
        />
      </div>
    </div>
  )
}
