export const ComponentTypes = {
  BODY: 'asyra-sim-body',
  CANDIDATE: 'asyra-sim-candidate',
  EXPERIMENT: 'asyra-sim-experiment'
} as const
export const PropertyTypes = {
  BODY: 'asyra-sim-body-properties',
  CANDIDATE: 'asyra-sim-candidate-properties',
  EXPERIMENT: 'asyra-sim-experiment-properties'
} as const
export const PropertyNames = {
  BODY: 'body',
  CANDIDATE: 'candidate',
  EXPERIMENT: 'experiment'
} as const
export const PropertyFields = {
  BODY: 'bodyParameters',
  CANDIDATE: 'candidateParameters',
  EXPERIMENT: 'experimentDefinition'
} as const
