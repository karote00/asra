import {
  clampColorByte,
  clampOpacity,
  parseColor as parseSharedColor,
  rgbaToHex as rgbaToSharedHex,
  rgbaToCssColor,
  type RGBAColor
} from '@asyra/utils'

export { rgbaToCssColor }

export interface HSVAColor {
  h: number
  s: number
  v: number
  a: number
}

export const clamp = (value: number, min: number, max: number) =>
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

export interface HSLAColor {
  h: number
  s: number
  l: number
  a: number
}

export const hsvaToHsla = ({ h, s, v, a }: HSVAColor): HSLAColor => {
  const l = v * (1 - s / 2)
  const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l)
  return {
    h,
    s: sl,
    l,
    a
  }
}

export const rgbaToHsla = (rgba: RGBAColor): HSLAColor =>
  hsvaToHsla(rgbaToHsva(rgba))

export const hslaToHsva = ({ h, s, l, a }: HSLAColor): HSVAColor => {
  const v = l + s * Math.min(l, 1 - l)
  const sv = v === 0 ? 0 : 2 * (1 - l / v)
  return {
    h,
    s: sv,
    v,
    a
  }
}

export const hsvaToHwb = ({ h, s, v }: HSVAColor) => {
  return {
    h,
    w: (1 - s) * v,
    b: 1 - v
  }
}

export const hwbToHsva = (
  h: number,
  w: number,
  b: number,
  a: number
): HSVAColor => {
  if (w + b >= 1) {
    return { h: h % 360, s: 0, v: w / (w + b), a }
  }
  return {
    h: h % 360,
    s: 1 - w / (1 - b),
    v: 1 - b,
    a
  }
}

export const hsvaToOklch = ({ h, s, v }: HSVAColor) => {
  // Very simplified placeholder: L = V, C = S, H = H
  return {
    l: v,
    c: s,
    h
  }
}

export const oklchToHsva = (
  l: number,
  c: number,
  h: number,
  a: number
): HSVAColor => {
  return {
    h: h % 360,
    s: clampUnit(c),
    v: clampUnit(l),
    a
  }
}

export const createPortalRoot = () => {
  const root = document.createElement('div')
  root.id = 'color-picker-root'
  root.style.position = 'relative'
  root.style.zIndex = '999'
  document.body.appendChild(root)
  return root
}

export const formatColor = (
  rgba: RGBAColor,
  hsla: HSLAColor,
  format?: string
) => {
  const f = format?.toLowerCase()
  if (f === 'rgb') {
    return `rgb(${Math.round(rgba.r)} ${Math.round(rgba.g)} ${Math.round(rgba.b)})`
  }
  if (f === 'hsl') {
    return `hsl(${Math.round(hsla.h)} ${Math.round(hsla.s * 100)}% ${Math.round(hsla.l * 100)}%)`
  }
  if (f === 'css') {
    return rgbaToCssColor(rgba, 1)
  }
  // Default to HEX for all others (HEX, HSB, HWB, OKLCH)
  return rgbaToHex({ ...rgba, a: 1 })
}

export type { RGBAColor }
