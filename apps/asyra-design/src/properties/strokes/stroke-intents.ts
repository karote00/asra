import type { StrokeAttrs } from '@asyra/utils'

export type StrokeStyleIntentKey =
  | 'style'
  | 'position'
  | 'width'
  | 'dash'
  | 'gap'
  | 'capType'
  | 'joinType'
  | 'miterAngle'

export type StrokeStyleIntentPatch = Partial<
  Pick<StrokeAttrs, StrokeStyleIntentKey>
>

const STROKE_STYLE_INTENT_KEYS = new Set<StrokeStyleIntentKey>([
  'style',
  'position',
  'width',
  'dash',
  'gap',
  'capType',
  'joinType',
  'miterAngle'
])

export interface StrokeStyleIntent {
  kind: 'stroke-style-intent'
  routeId: 'feature-session-intent'
  ownerStage: 'Interaction'
  strokeId: string
  ownerElementId: string
  patch: StrokeStyleIntentPatch
}

export const createStrokeStyleIntent = ({
  stroke,
  strokeId,
  ownerElementId,
  patch
}: {
  stroke: StrokeAttrs | null
  strokeId: string
  ownerElementId: string | null
  patch: StrokeStyleIntentPatch
}): StrokeStyleIntent | null => {
  if (!stroke || !strokeId || !ownerElementId) {
    return null
  }

  const entries = Object.entries(patch).filter(
    (entry): entry is [StrokeStyleIntentKey, StrokeAttrs[StrokeStyleIntentKey]] =>
      entry[1] !== undefined
  )
  if (entries.length !== 1) {
    return null
  }

  const [key, nextValue] = entries[0]
  if (!STROKE_STYLE_INTENT_KEYS.has(key) || Object.is(stroke[key], nextValue)) {
    return null
  }

  return {
    kind: 'stroke-style-intent',
    routeId: 'feature-session-intent',
    ownerStage: 'Interaction',
    strokeId,
    ownerElementId,
    patch: {
      [key]: nextValue
    }
  }
}
