export const EditingFeatureNames = {
  EDIT_WORKCELL: 'asyra-sim.edit-workcell'
} as const
export const HistoryFeatureNames = { HISTORY: 'asyra-sim.history' } as const
type NoOverlap =
  Extract<
    keyof typeof EditingFeatureNames,
    keyof typeof HistoryFeatureNames
  > extends never
    ? true
    : never
const distinctKeys: NoOverlap = true
void distinctKeys
export const FeatureNames = {
  ...EditingFeatureNames,
  ...HistoryFeatureNames
} as const
