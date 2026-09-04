import type { Core } from '@asyra/core'
import {
  ComponentTypes,
  PropertyFields,
  PropertyNames,
  PropertyTypes
} from '../constants'
import { installModelProperties } from './properties'

export function installModelComponents(core: Core): void {
  installModelProperties(core)
  for (const key of ['BODY', 'CANDIDATE'] as const)
    core.defineComponent({
      type: ComponentTypes[key],
      idPrefix: ComponentTypes[key],
      namePrefix: key === 'BODY' ? 'Body' : 'Candidate',
      isContainer: true,
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
