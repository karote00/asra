import { beforeEach, describe, expect, it } from 'vitest'
import { removeElement, selectElements } from '@asyra/reactive-events'
import { SELECTION_TYPES } from '@asyra/utils'
import selectionManager, { ElementSelection } from '..'

describe('element selection remove-element subscribe', () => {
  beforeEach(() => {
    selectionManager.register(SELECTION_TYPES.ELEMENT, new ElementSelection())
  })

  it('removes deleted element id from current selection', () => {
    selectElements(['rect-1', 'oval-1'])
    expect(selectionManager.getElementSelectionIds()).toEqual([
      'rect-1',
      'oval-1'
    ])

    removeElement({ id: 'oval-1', type: 'oval' })

    expect(selectionManager.getElementSelectionIds()).toEqual(['rect-1'])
  })

  it('keeps selection unchanged when removed id is not selected', () => {
    selectElements(['rect-1'])
    removeElement({ id: 'oval-1', type: 'oval' })

    expect(selectionManager.getElementSelectionIds()).toEqual(['rect-1'])
  })
})
