import {
  FillColorFormats,
  clampOpacity,
  parseColor,
  rgbaToCssColor,
  rgbaToHex,
  type FillColorFormat,
  type RGBAColor
} from '@asyra/utils'

const roundTo = (value: number, decimals: number) =>
  Number(value.toFixed(decimals))

const rgbToHsl = ({
  r,
  g,
  b
}: Pick<RGBAColor, 'r' | 'g' | 'b'>): { h: number; s: number; l: number } => {
  const r1 = r / 255
  const g1 = g / 255
  const b1 = b / 255

  const max = Math.max(r1, g1, b1)
  const min = Math.min(r1, g1, b1)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === r1) {
      h = ((g1 - b1) / delta) % 6
    } else if (max === g1) {
      h = (b1 - r1) / delta + 2
    } else {
      h = (r1 - g1) / delta + 4
    }
    h *= 60
  }

  if (h < 0) {
    h += 360
  }

  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  return {
    h: roundTo(h, 1),
    s: roundTo(s * 100, 1),
    l: roundTo(l * 100, 1)
  }
}

const rgbaToFormat = (color: RGBAColor, format: FillColorFormat): string => {
  switch (format) {
    case FillColorFormats.HEX:
      return rgbaToHex(color)
    case FillColorFormats.RGB:
      return `rgb(${Math.round(color.r)} ${Math.round(color.g)} ${Math.round(color.b)})`
    case FillColorFormats.RGBA:
      return `rgba(${Math.round(color.r)} ${Math.round(color.g)} ${Math.round(color.b)} / ${roundTo(color.a, 3)})`
    case FillColorFormats.HSL: {
      const hsl = rgbToHsl(color)
      return `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`
    }
    case FillColorFormats.HSLA: {
      const hsl = rgbToHsl(color)
      return `hsla(${hsl.h} ${hsl.s}% ${hsl.l}% / ${roundTo(color.a, 3)})`
    }
    case FillColorFormats.HWB:
    case FillColorFormats.OKLCH:
    default:
      return rgbaToHex(color)
  }
}

export const convertStoredColorToFormat = (
  color: string,
  format: FillColorFormat
): string => {
  const parsed = parseColor(color, { allowBrowser: true })
  if (!parsed) {
    return color
  }

  return rgbaToFormat(parsed, format)
}

export const convertUserColorToDefault = (
  value: string,
  defaultFormat: FillColorFormat,
  fallback: string
): string => {
  const parsed = parseColor(value, { allowBrowser: true })
  if (!parsed) {
    return fallback
  }

  return rgbaToFormat(parsed, defaultFormat)
}

export const toCssColorWithOpacity = (
  value: string,
  opacity = 1,
  fallback = 'rgba(0, 0, 0, 1)'
): string => {
  const parsed = parseColor(value, { allowBrowser: true })
  if (!parsed) {
    return fallback
  }

  return rgbaToCssColor(parsed, clampOpacity(opacity))
}

export const toColorPickerHex = (value: string): string => {
  const parsed = parseColor(value, { allowBrowser: true })
  if (!parsed) {
    return '#000000'
  }

  return rgbaToHex(parsed)
}
