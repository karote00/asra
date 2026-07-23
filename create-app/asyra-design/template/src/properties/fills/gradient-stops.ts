import type { FillGradientStop } from '@asyra/utils'

export const sortGradientStopsForPreview = (
  stops: readonly FillGradientStop[]
) =>
  stops
    .map((stop, index) => ({ stop, index }))
    .sort((left, right) => left.stop.position - right.stop.position)
