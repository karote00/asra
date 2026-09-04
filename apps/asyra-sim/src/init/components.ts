import type { Core } from '@asyra/core'
import {
  ComponentTypes,
  PropertyFields,
  PropertyNames,
  PropertyTypes
} from '../constants'
import { installModelProperties } from './properties'

const componentNames = {
  BODY: 'Body',
  CANDIDATE: 'Candidate',
  EXPERIMENT: 'Experiment'
} as const

export function installModelComponents(core: Core): void {
  installModelProperties(core)
  for (const key of ['BODY', 'CANDIDATE', 'EXPERIMENT'] as const)
    core.defineComponent({
      type: ComponentTypes[key],
      idPrefix: ComponentTypes[key],
      namePrefix: componentNames[key],
      isContainer: key !== 'EXPERIMENT',
      properties: [
        {
          name: PropertyNames[key],
          type: PropertyTypes[key],
          alias: [PropertyFields[key]]
        }
      ],
      // The registered spatial layer owns visual output; there is no 2D surrogate.
      renderStrategy: () => null
    })
}
