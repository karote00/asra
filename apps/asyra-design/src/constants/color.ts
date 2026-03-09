import { FillColorFormats, type FillColorFormat } from '@asyra/utils'

export const ALLOWED_COLOR_FORMATS: readonly FillColorFormat[] = [
  FillColorFormats.HEX,
  FillColorFormats.RGB,
  FillColorFormats.RGBA,
  FillColorFormats.HSL,
  FillColorFormats.HSLA,
  FillColorFormats.HWB,
  FillColorFormats.OKLCH
]
