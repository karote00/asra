export const EditingFeatureNames = {
  EDIT_WORKCELL: 'asyra-sim.edit-workcell'
} as const
export const HistoryFeatureNames = { HISTORY: 'asyra-sim.history' } as const
export const AnalysisFeatureNames = {
  ANALYZE_EXPERIMENT: 'asyra-sim.analyze-experiment'
} as const
export const StorageFeatureNames = {
  RETAIN_RUN: 'asyra-sim.retain-run',
  PREPARE_VISUAL: 'asyra-sim.prepare-visual',
  RETAIN_VISUAL: 'asyra-sim.retain-visual',
  PREPARE_OBSERVATION: 'asyra-sim.prepare-observation',
  RETAIN_OBSERVATION: 'asyra-sim.retain-observation'
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
const distinctStorageKeys: Extract<
  keyof (ExistingFeatureNames & typeof AnalysisFeatureNames),
  keyof typeof StorageFeatureNames
> extends never
  ? true
  : never = true
void distinctStorageKeys
export const FeatureNames = {
  ...EditingFeatureNames,
  ...HistoryFeatureNames,
  ...AnalysisFeatureNames,
  ...StorageFeatureNames
} as const
