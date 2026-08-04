import type { ComputedAttrs } from '@asyra/utils'
import { describe, expectTypeOf, it } from 'vitest'
import type {
  PropertyComputeContext,
  PropertyRegistration
} from '../property-registry.js'

interface AppElementFields {
  customCount: number
}

describe('PropertyComputeContext custom element typing', () => {
  it('combines app fields with canonical computed element data', () => {
    type Context = PropertyComputeContext<AppElementFields>

    expectTypeOf<Context['elements'][number]>().toEqualTypeOf<
      ComputedAttrs & AppElementFields
    >()
  })

  it('keeps a custom registration assignable to the default facade contract', () => {
    const customRegistration: PropertyRegistration<number, AppElementFields> = {
      defaultValue: 0,
      compute: (context) => context.elements[0]?.customCount ?? 0
    }
    const acceptDefaultRegistration = (
      registration: PropertyRegistration<number>
    ) => registration

    expectTypeOf(acceptDefaultRegistration(customRegistration)).toEqualTypeOf<
      PropertyRegistration<number>
    >()
  })
})
