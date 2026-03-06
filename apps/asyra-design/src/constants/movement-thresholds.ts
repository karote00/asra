// Feature-level movement thresholds in client pixels.
// Keep these app-owned and tune per feature behavior.
export const FEATURE_MOVEMENT_THRESHOLD = {
  createElement: 3,
  moveElement: 3,
  moveVectorPoint: 3,
  penCurveDrag: 3
} as const
