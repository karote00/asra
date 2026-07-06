import type { StrokeAttrs } from '@asyra/utils'

export interface StrokeStyleIntent {
  kind: 'stroke-style-intent'
  routeId: 'feature-session-intent'
  ownerStage: 'Interaction'
  strokeId: string
  ownerElementId: string
  patch: {
    joinType: StrokeAttrs['joinType']
  }
}

export const createStrokeJoinTypeIntent = ({
  stroke,
  strokeId,
  ownerElementId,
  nextJoin
}: {
  stroke: StrokeAttrs | null
  strokeId: string
  ownerElementId: string | null
  nextJoin: StrokeAttrs['joinType']
}): StrokeStyleIntent | null => {
  if (!stroke || !strokeId || !ownerElementId || stroke.joinType === nextJoin) {
    return null
  }

  return {
    kind: 'stroke-style-intent',
    routeId: 'feature-session-intent',
    ownerStage: 'Interaction',
    strokeId,
    ownerElementId,
    patch: {
      joinType: nextJoin
    }
  }
}
