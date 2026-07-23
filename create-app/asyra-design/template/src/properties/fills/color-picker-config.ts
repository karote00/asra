import {
  type ColorFormatDefinition,
  formatHexValue,
  hslaToHsva,
  hsvaToHsla,
  hsvaToHwb,
  hsvaToOklch,
  hsvaToRgba,
  hwbToHsva,
  oklchToHsva,
  parseColor,
  rgbaToCssColor,
  rgbaToHex,
  rgbaToHsva
} from '@asyra/design-system'

const parseNumeric = (val: string) =>
  Math.round(Number.parseFloat(val.replace(/\D/g, '')) || 0)

export const COLOR_PICKER_FORMAT_DEFINITIONS: ColorFormatDefinition[] = [
  {
    id: 'hex',
    label: 'HEX',
    toValues: (hsva) => [
      rgbaToHex({ ...hsvaToRgba(hsva), a: 1 }).replace('#', '')
    ],
    fromValues: (values) => {
      const parsed = parseColor(`#${formatHexValue(values[0])}`)
      return parsed ? rgbaToHsva(parsed) : null
    },
    formatInput: (val) => formatHexValue(val)
  },
  {
    id: 'rgb',
    label: 'RGB',
    toValues: (hsva) => {
      const { r, g, b } = hsvaToRgba(hsva)
      return [
        String(Math.round(r)),
        String(Math.round(g)),
        String(Math.round(b))
      ]
    },
    fromValues: (values, current) => {
      const r = parseNumeric(values[0])
      const g = parseNumeric(values[1])
      const b = parseNumeric(values[2])
      return { ...rgbaToHsva({ r, g, b, a: current.a }), a: current.a }
    },
    formatInput: (val) => val.replace(/\D/g, '')
  },
  {
    id: 'hsl',
    label: 'HSL',
    toValues: (hsva) => {
      const { h, s, l } = hsvaToHsla(hsva)
      return [
        String(Math.round(h)),
        String(Math.round(s * 100)),
        String(Math.round(l * 100))
      ]
    },
    fromValues: (values, current) => {
      const h = parseNumeric(values[0])
      const s = parseNumeric(values[1]) / 100
      const l = parseNumeric(values[2]) / 100
      return hslaToHsva({ h, s, l, a: current.a })
    },
    formatInput: (val) => val.replace(/\D/g, '')
  },
  {
    id: 'hsb',
    label: 'HSB',
    toValues: (hsva) => [
      String(Math.round(hsva.h)),
      String(Math.round(hsva.s * 100)),
      String(Math.round(hsva.v * 100))
    ],
    fromValues: (values, current) => {
      const h = parseNumeric(values[0])
      const s = parseNumeric(values[1]) / 100
      const v = parseNumeric(values[2]) / 100
      return { h, s, v, a: current.a }
    },
    formatInput: (val) => val.replace(/\D/g, '')
  },
  {
    id: 'hwb',
    label: 'HWB',
    toValues: (hsva) => {
      const { h, w, b } = hsvaToHwb(hsva)
      return [
        String(Math.round(h)),
        String(Math.round(w * 100)),
        String(Math.round(b * 100))
      ]
    },
    fromValues: (values, current) => {
      const h = parseNumeric(values[0])
      const w = parseNumeric(values[1]) / 100
      const b = parseNumeric(values[2]) / 100
      return hwbToHsva(h, w, b, current.a)
    },
    formatInput: (val) => val.replace(/\D/g, '')
  },
  {
    id: 'oklch',
    label: 'OKLCH',
    toValues: (hsva) => {
      const { l, c, h } = hsvaToOklch(hsva)
      return [
        String(Math.round(l * 100)),
        String(Math.round(c * 100)),
        String(Math.round(h))
      ]
    },
    fromValues: (values, current) => {
      const l = parseNumeric(values[0]) / 100
      const c = parseNumeric(values[1]) / 100
      const h = parseNumeric(values[2])
      return oklchToHsva(l, c, h, current.a)
    },
    formatInput: (val) => val.replace(/\D/g, '')
  },
  {
    id: 'css',
    label: 'CSS',
    toValues: (hsva) => [rgbaToCssColor(hsvaToRgba(hsva), hsva.a)],
    fromValues: (values) => {
      const parsed = parseColor(values[0])
      return parsed ? rgbaToHsva(parsed) : null
    }
  }
]
