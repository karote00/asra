// Framework-first: Use string type instead of enum for extensibility
export type PropertyType = string

// Export common types as constants (not enum)
export const PropertyTypes = {
  POSITION: 'position',
  DIMENSION: 'dimension',
  CUSTOM: 'custom',
  FILL: 'fill',
  FILLS: 'fills',
  STROKE: 'stroke',
  STROKES: 'strokes',
  ANCHOR_POINT: 'anchorPoint',
  ANCHOR_POINTS: 'anchorPoints',
  VECTOR_POINT: 'vectorPoint',
  VECTOR_POINTS: 'vectorPoints',
  VECTOR_SEGMENT: 'vectorSegment',
  VECTOR_SEGMENTS: 'vectorSegments',
  VECTOR_NETWORK: 'vectorNetwork',
  VECTOR_NETWORKS: 'vectorNetworks'
} as const
