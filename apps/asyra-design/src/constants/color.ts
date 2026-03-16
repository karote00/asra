import { FillColorFormats, type FillColorFormat } from '@asyra/utils'

export const ALLOWED_COLOR_FORMATS: readonly FillColorFormat[] = [
  FillColorFormats.HEX,
  FillColorFormats.RGB,
  FillColorFormats.HSL,
  FillColorFormats.HWB,
  FillColorFormats.OKLCH,
  FillColorFormats.HSB,
  FillColorFormats.CSS
]
