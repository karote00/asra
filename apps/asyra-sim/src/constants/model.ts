export const ComponentTypes = {
  BODY: 'asyra-sim-body',
  CANDIDATE: 'asyra-sim-candidate',
  EXPERIMENT: 'asyra-sim-experiment',
  RUN_REFERENCE: 'asyra-sim-run-reference'
} as const
export const PropertyTypes = {
  BODY: 'asyra-sim-body-properties',
  CANDIDATE: 'asyra-sim-candidate-properties',
  EXPERIMENT: 'asyra-sim-experiment-properties',
  RUN_REFERENCE: 'asyra-sim-run-reference-properties'
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
