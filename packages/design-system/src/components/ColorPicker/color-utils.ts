import {
  clampColorByte,
  clampOpacity,
  parseColor as parseSharedColor,
  rgbaToHex as rgbaToSharedHex,
  type RGBAColor
} from '@asyra/utils'

interface HSVAColor {
  h: number
  s: number
  v: number
  a: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export const rgbaToHsva = ({ r, g, b, a }: RGBAColor): HSVAColor => {
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
  }

  h *= 60
  if (h < 0) {
    h += 360
  }

  const s = max === 0 ? 0 : delta / max
  const v = max

  return {
    h,
    s,
    v,
    a
  }
}

export const hsvaToRgba = ({ h, s, v, a }: HSVAColor): RGBAColor => {
  const hue = ((h % 360) + 360) % 360
  const chroma = v * s
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = v - chroma

  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (hue < 60) {
    r1 = chroma
    g1 = x
  } else if (hue < 120) {
    r1 = x
    g1 = chroma
  } else if (hue < 180) {
    g1 = chroma
    b1 = x
  } else if (hue < 240) {
    g1 = x
    b1 = chroma
  } else if (hue < 300) {
    r1 = x
    b1 = chroma
  } else {
    r1 = chroma
    b1 = x
  }

  return {
    r: clampColorByte((r1 + m) * 255),
    g: clampColorByte((g1 + m) * 255),
    b: clampColorByte((b1 + m) * 255),
    a: clampOpacity(a)
  }
}

export const formatHexValue = (value: string) =>
  value.replace('#', '').slice(0, 8).toUpperCase()

export const createHsvaColor = (color: string, opacity = 1): HSVAColor => {
  const parsed = parseColor(color) ?? {
    r: 0,
    g: 0,
    b: 0,
    a: 1
  }

  const hsva = rgbaToHsva(parsed)
  return {
    ...hsva,
    a: clamp(opacity, 0, 1)
  }
}

export const clampUnit = (value: number) => clamp(value, 0, 1)

export const rgbaToHex = (color: RGBAColor) =>
  rgbaToSharedHex(color, { uppercase: true })

export const parseColor = (value: string) =>
  parseSharedColor(value, { allowBrowser: true })

export type { HSVAColor, RGBAColor }
