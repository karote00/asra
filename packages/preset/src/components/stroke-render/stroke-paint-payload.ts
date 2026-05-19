import type { Bounds } from './stroke-final-face'
import type { StrokeRegionPacket } from './stroke-region-packet'

export interface StrokePaintPayload {
  kind?: 'solid' | 'gradient'
  color: number
  alpha: number
  gradientStyle?: unknown | null
  paintKey?: string
  paintBounds?: Bounds
  paintTransform?: unknown
}

export interface AttachedStrokePaintPayload extends StrokePaintPayload {
  geometryId: string
  paintKey: string
  paintBounds: Bounds
}

export interface PaintAttachedStrokeRegion extends StrokeRegionPacket {
  paint: AttachedStrokePaintPayload
  paintKey: string
}

const copyBounds = (bounds: Bounds): Bounds => ({
  minX: bounds.minX,
  minY: bounds.minY,
  maxX: bounds.maxX,
  maxY: bounds.maxY
})

const buildPaintKey = (region: StrokeRegionPacket, paint: StrokePaintPayload) =>
  paint.paintKey ??
  [
    'stroke-paint',
    region.regionId,
    paint.kind ?? 'solid',
    paint.color,
    paint.alpha
  ].join(':')

export const attachStrokePaintPayload = (
  regions: readonly StrokeRegionPacket[],
  paint: StrokePaintPayload
): PaintAttachedStrokeRegion[] =>
  regions.map((region) => {
    const paintKey = buildPaintKey(region, paint)
    return {
      ...region,
      paintKey,
      paint: {
        ...paint,
        geometryId: region.regionId,
        paintKey,
        paintBounds: copyBounds(paint.paintBounds ?? region.bounds)
      }
    }
  })
