import type { StrokeAttrs } from '@asyra/utils'
import { getRenderableStrokes } from './renderable-stroke'
import {
  buildConstrainedSolidLegalityDomain,
  type ConstrainedSolidLegalityDomain
} from './constrained-solid-legality-domain'
import { supportsConstrainedSolidStroke } from './constrained-solid-stroke-geometry'
import type { SolidCenterStrokeResolvedPacket } from './solid-center-stroke-packets'

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface Vec2 {
  x: number
  y: number
}

export interface ConstrainedSolidLegalityDomainDiagnostic {
  strokeId: string
  geometryId: string | null
  mode: 'inside' | 'outside'
  fillRule: 'nonzero'
  canonicalPolygonForm: 'simple-closed-polygon'
  orientation: 'cw' | 'ccw'
  boundaryPolygon: Vec2[]
  bounds: Bounds
}

export interface ConstrainedSolidLegalityDiagnostics {
  domains: ConstrainedSolidLegalityDomainDiagnostic[]
  acceptedGeometryIds: string[]
}

export interface ConstrainedSolidLegalityDiagnosticsRuntimeGraphic {
  __asyraConstrainedSolidLegalityDiagnostics?: ConstrainedSolidLegalityDiagnostics
}

export interface ConstrainedSolidLegalitySourceGroup {
  points: Vec2[]
  closed: boolean
}

const getBounds = (polygon: Vec2[]): Bounds => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  polygon.forEach((point) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  })

  return { minX, minY, maxX, maxY }
}

const toDiagnostic = (
  domain: ConstrainedSolidLegalityDomain,
  strokeId: string,
  geometryId: string | null
): ConstrainedSolidLegalityDomainDiagnostic => ({
  strokeId,
  geometryId,
  mode: domain.mode,
  fillRule: domain.fillRule,
  canonicalPolygonForm: domain.canonicalPolygonForm,
  orientation: domain.orientation,
  boundaryPolygon: domain.boundaryPolygon,
  bounds: getBounds(domain.boundaryPolygon)
})

export const buildConstrainedSolidLegalityDiagnostics = (
  sources: ConstrainedSolidLegalitySourceGroup[],
  strokes: StrokeAttrs[] | undefined,
  packets: SolidCenterStrokeResolvedPacket[]
): ConstrainedSolidLegalityDiagnostics => {
  const packetGeometryIds = packets.map((packet) => packet.geometry.geometryId)
  const renderableStrokes = getRenderableStrokes(strokes)
  let packetIndex = 0

  const domains = sources.flatMap((source) =>
    renderableStrokes.flatMap((stroke, index) => {
      if (!supportsConstrainedSolidStroke(stroke, source.closed)) {
        return []
      }

      const domain = buildConstrainedSolidLegalityDomain(
        source.points,
        source.closed,
        stroke.position as 'inside' | 'outside'
      )

      if (!domain) {
        return []
      }

      return [
        toDiagnostic(
          domain,
          `stroke:${index}`,
          packetGeometryIds[packetIndex++] ?? null
        )
      ]
    })
  )

  return {
    domains,
    acceptedGeometryIds: packetGeometryIds
  }
}

export const applyConstrainedSolidLegalityDiagnostics = <T extends object>(
  graphic: T,
  sources: ConstrainedSolidLegalitySourceGroup[],
  strokes: StrokeAttrs[] | undefined,
  packets: SolidCenterStrokeResolvedPacket[]
) => {
  ;(
    graphic as T & ConstrainedSolidLegalityDiagnosticsRuntimeGraphic
  ).__asyraConstrainedSolidLegalityDiagnostics =
    buildConstrainedSolidLegalityDiagnostics(sources, strokes, packets)
}

export const setConstrainedSolidLegalityDiagnostics = <T extends object>(
  graphic: T,
  diagnostics: ConstrainedSolidLegalityDiagnostics
) => {
  ;(
    graphic as T & ConstrainedSolidLegalityDiagnosticsRuntimeGraphic
  ).__asyraConstrainedSolidLegalityDiagnostics = diagnostics
}
