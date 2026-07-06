import { expect } from 'vitest'
import type { Vec2 } from '../../components/stroke-render/solid-stroke-geometry-core'

export const distanceBetween = (first: Vec2, second: Vec2) =>
  Math.hypot(first.x - second.x, first.y - second.y)

export const polygonArea = (polygon: readonly Vec2[]) =>
  polygon.reduce((area, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return area + (point.x * next.y - next.x * point.y)
  }, 0) / 2

export const maxDistanceFromPoint = (
  origin: Vec2,
  points: readonly Vec2[]
) => Math.max(0, ...points.map((point) => distanceBetween(origin, point)))

export const minDistanceToPolygon = (
  point: Vec2,
  polygon: readonly Vec2[]
) => Math.min(...polygon.map((candidate) => distanceBetween(point, candidate)))

export const assertFinitePolygon = (
  polygon: readonly Vec2[],
  label: string
) => {
  expect(polygon.length, `${label}: point count`).toBeGreaterThanOrEqual(3)
  for (const point of polygon) {
    expect(Number.isFinite(point.x), `${label}: point.x`).toBe(true)
    expect(Number.isFinite(point.y), `${label}: point.y`).toBe(true)
  }
  expect(Math.abs(polygonArea(polygon)), `${label}: area`).toBeGreaterThan(0)
}

export const assertFinitePolygons = (
  polygons: readonly (readonly Vec2[])[],
  label: string
) => {
  expect(polygons.length, `${label}: polygon count`).toBeGreaterThan(0)
  polygons.forEach((polygon, index) =>
    assertFinitePolygon(polygon, `${label}:${index}`)
  )
}

export const assertPolygonTouchesPoint = (
  polygon: readonly Vec2[],
  point: Vec2,
  tolerance: number,
  label: string
) => {
  expect(
    minDistanceToPolygon(point, polygon),
    `${label}: distance to protected seam point`
  ).toBeLessThanOrEqual(tolerance)
}

export const assertNoForbiddenContributorTokens = (
  product: unknown,
  forbiddenContributors: readonly string[],
  label: string
) => {
  const serialized = JSON.stringify(product)
  for (const contributor of forbiddenContributors) {
    expect(serialized, `${label}: ${contributor}`).not.toContain(contributor)
  }
}

export const assertOwnerStage = (
  product: { ownerStage?: string },
  ownerStage: string,
  label: string
) => {
  expect(product.ownerStage, `${label}: ownerStage`).toBe(ownerStage)
}
