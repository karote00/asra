export const EditingFeatureNames = {
  EDIT_WORKCELL: 'asyra-sim.edit-workcell'
} as const
export const HistoryFeatureNames = { HISTORY: 'asyra-sim.history' } as const
export const AnalysisFeatureNames = {
  ANALYZE_EXPERIMENT: 'asyra-sim.analyze-experiment'
} as const
type ExistingFeatureNames = typeof EditingFeatureNames &
  typeof HistoryFeatureNames
type NoOverlap =
  Extract<
    keyof ExistingFeatureNames,
    keyof typeof AnalysisFeatureNames
  > extends never
    ? Extract<
        keyof typeof EditingFeatureNames,
        keyof typeof HistoryFeatureNames
      > extends never
      ? true
      : never
    : never
const distinctKeys: NoOverlap = true
void distinctKeys
export const FeatureNames = {
  ...EditingFeatureNames,
  ...HistoryFeatureNames,
  ...AnalysisFeatureNames
} as const
