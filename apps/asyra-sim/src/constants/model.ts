export const ComponentTypes = {
  BODY: 'sim-body',
  CANDIDATE: 'sim-candidate',
  EXPERIMENT: 'sim-experiment',
  RUN_REFERENCE: 'sim-run-reference'
} as const
export const PropertyTypes = {
  BODY: 'sim-body-properties',
  CANDIDATE: 'sim-candidate-properties',
  EXPERIMENT: 'sim-experiment-properties',
  RUN_REFERENCE: 'sim-run-reference-properties'
} as const
export const PropertyNames = {
  BODY: 'body',
  CANDIDATE: 'candidate',
  EXPERIMENT: 'experiment',
  RUN_REFERENCE: 'runReference'
} as const
export const PropertyFields = {
  BODY: 'bodyParameters',
  CANDIDATE: 'candidateParameters',
  EXPERIMENT: 'experimentDefinition',
  RUN_REFERENCE: 'runReference'
} as const
