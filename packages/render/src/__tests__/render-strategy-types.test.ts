import { describe, expectTypeOf, it } from 'vitest'
import type { RenderElementData } from '../types.js'
import type { EngineNeutralRenderStrategy } from '../types/render-strategy.js'

interface AppRenderFields {
  customCount: number
}

describe('EngineNeutralRenderStrategy custom field typing', () => {
  it('combines app fields with the required render element data', () => {
    type Strategy = EngineNeutralRenderStrategy<AppRenderFields>
    type StrategyData = Parameters<Strategy>[1]

    expectTypeOf<StrategyData>().toEqualTypeOf<
      RenderElementData & AppRenderFields
    >()
  })
})
