import { FillGradientTypes, type FillGradientData } from '@asyra/utils'
import { toCssColorWithOpacity } from './color-format'

const clampUnit = (value: number) => Math.max(0, Math.min(1, value))

const sortStopsForPreview = (stops: FillGradientData['gradientStops']) =>
  stops
    .map((stop, index) => ({ stop, index }))
    .sort((a, b) => a.stop.position - b.stop.position)

export const toGradientPreviewCss = (gradient: FillGradientData): string => {
  const stops = sortStopsForPreview(gradient.gradientStops)
    .map(
      ({ stop }) =>
        `${toCssColorWithOpacity(stop.color, stop.opacity)} ${Math.round(
          clampUnit(stop.position) * 100
        )}%`
    )
    .join(', ')

  if (gradient.gradientType === FillGradientTypes.RADIAL) {
    return `radial-gradient(circle at center, ${stops})`
  }

  if (gradient.gradientType === FillGradientTypes.ANGULAR) {
    return `conic-gradient(from 90deg at 50% 50%, ${stops})`
  }

  if (gradient.gradientType === FillGradientTypes.DIAMOND) {
    return `radial-gradient(circle at center, ${stops})`
  }

  return `linear-gradient(90deg, ${stops})`
}
