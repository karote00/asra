import { describe, expect, it } from 'vitest'
import { getChangedDefinedPatchEntries } from './property-patch'

interface ExampleValue {
  label: string
  opacity: number
  visible: boolean
}

const exampleValue: ExampleValue = {
  label: 'Original',
  opacity: 0.5,
  visible: true
}

describe('getChangedDefinedPatchEntries', () => {
  it('returns only defined patch entries whose values changed', () => {
    expect(
      getChangedDefinedPatchEntries(
        ['label', 'opacity', 'visible'],
        exampleValue,
        {
          label: 'Updated',
          opacity: 0.5,
          visible: undefined
        }
      )
    ).toEqual([['label', 'Updated']])
  })

  it('returns no entries when the patch does not provide a tracked key', () => {
    expect(
      getChangedDefinedPatchEntries(
        ['label', 'opacity', 'visible'],
        exampleValue,
        {}
      )
    ).toEqual([])
  })
})
