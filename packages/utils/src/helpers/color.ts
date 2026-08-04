import { clampUnit } from '../number.js'

export interface RGBAColor extends Record<string, unknown> {
  r: number
  g: number
  b: number
  a: number
}

interface ParseColorOptions {
  allowBrowser?: boolean
}

export const clampColorByte = (value: number) =>
  Math.max(0, Math.min(255, value))

export const clampOpacity = (value: number): number => clampUnit(value)

const toHexPair = (value: number, uppercase = false) => {
  const hex = clampColorByte(Math.round(value)).toString(16).padStart(2, '0')
  return uppercase ? hex.toUpperCase() : hex
}

export const parseHexColor = (value: string): RGBAColor | null => {
  const normalized = value.trim().replace('#', '')
  if (normalized.length === 3 || normalized.length === 4) {
    const r = Number.parseInt(normalized[0] + normalized[0], 16)
    const g = Number.parseInt(normalized[1] + normalized[1], 16)
    const b = Number.parseInt(normalized[2] + normalized[2], 16)
    const alphaPair =
      normalized.length === 4
        ? Number.parseInt(normalized[3] + normalized[3], 16)
        : 255

    if ([r, g, b, alphaPair].some((channel) => Number.isNaN(channel))) {
      return null
    }

    return { r, g, b, a: alphaPair / 255 }
  }

  if (normalized.length === 6 || normalized.length === 8) {
    const r = Number.parseInt(normalized.slice(0, 2), 16)
    const g = Number.parseInt(normalized.slice(2, 4), 16)
    const b = Number.parseInt(normalized.slice(4, 6), 16)
    const alphaPair =
      normalized.length === 8
        ? Number.parseInt(normalized.slice(6, 8), 16)
        : 255

    if ([r, g, b, alphaPair].some((channel) => Number.isNaN(channel))) {
      return null
    }

    return { r, g, b, a: alphaPair / 255 }
  }

  return null
}

export const parseCssRgbColor = (value: string): RGBAColor | null => {
  const match = value
    .trim()
    .match(
      /^rgba?\(\s*([0-9.]+)\s*[,\s]\s*([0-9.]+)\s*[,\s]\s*([0-9.]+)(?:\s*[/,]\s*([0-9.]+))?\s*\)$/i
    )

  if (!match) {
    return null
  }

  const r = Number.parseFloat(match[1])
  const g = Number.parseFloat(match[2])
  const b = Number.parseFloat(match[3])
  const a = match[4] === undefined ? 1 : Number.parseFloat(match[4])

  if ([r, g, b, a].some((channel) => Number.isNaN(channel))) {
    return null
  }

  return {
    r: clampColorByte(r),
    g: clampColorByte(g),
    b: clampColorByte(b),
    a: clampOpacity(a)
  }
}

const parseColorWithBrowser = (value: string): RGBAColor | null => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null
  }

  const element = document.createElement('span')
  element.style.color = ''
  element.style.color = value
  if (!element.style.color) {
    return null
  }

  element.style.display = 'none'
  document.body.appendChild(element)
  const resolved = window.getComputedStyle(element).color
  element.remove()

  return parseCssRgbColor(resolved)
}

export const parseColor = (
  value: string,
  options: ParseColorOptions = {}
): RGBAColor | null =>
  parseHexColor(value) ??
  parseCssRgbColor(value) ??
  (options.allowBrowser ? parseColorWithBrowser(value) : null)

export const rgbaToHex = (
  { r, g, b }: RGBAColor,
  options: { uppercase?: boolean } = {}
) =>
  `#${toHexPair(r, options.uppercase)}${toHexPair(g, options.uppercase)}${toHexPair(b, options.uppercase)}`

export const rgbaToColorInt = (rgba: RGBAColor): number => {
  return (
    (clampColorByte(rgba.r) << 16) |
    (clampColorByte(rgba.g) << 8) |
    clampColorByte(rgba.b)
  )
}

export const rgbaToCssColor = (rgba: RGBAColor, opacity = rgba.a): string =>
  `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)}, ${clampOpacity(opacity)})`
