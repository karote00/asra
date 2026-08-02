import { cleanup, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const createSubject = <T,>(initialValue: T) => {
    let value = initialValue
    const subscribers = new Set<() => void>()
    return {
      getValue: () => value,
      next: (nextValue: T) => {
        value = nextValue
        subscribers.forEach((subscriber) => subscriber())
      },
      subscribe: (subscriber: () => void) => {
        subscribers.add(subscriber)
        return {
          unsubscribe: () => subscribers.delete(subscriber)
        }
      }
    }
  }

  const flattenedIds = createSubject<string[]>(['group-old'])
  const elementDataMap = createSubject<Record<string, Record<string, unknown>>>(
    {
      'group-old': {
        id: 'group-old',
        type: 'group',
        parentId: 'workspace'
      }
    }
  )

  return {
    flattenedIds,
    elementDataMap,
    core: {
      getUIProperty: vi.fn((key: string) =>
        key === 'flattenedElementIds'
          ? flattenedIds.getValue()
          : elementDataMap.getValue()
      ),
      getUIPropertySubject: vi.fn((key: string) =>
        key === 'flattenedElementIds' ? flattenedIds : elementDataMap
      )
    }
  }
})

vi.mock('../../contexts', () => ({
  default: mocks.core
}))

import {
  useElementData,
  useElementDataMap,
  useFlattenedIdsData
} from '../scene-tree'

const ProjectionProbe = () => {
  const flattenedIds = useFlattenedIdsData()
  const elementDataMap = useElementDataMap()
  return (
    <output data-testid="projection">
      {flattenedIds.join(',')}|{Object.keys(elementDataMap).join(',')}
    </output>
  )
}

const ElementProbe = ({
  elementId,
  renderCounts
}: {
  elementId: string
  renderCounts: Map<string, number>
}) => {
  const elementData = useElementData(elementId)
  renderCounts.set(elementId, (renderCounts.get(elementId) ?? 0) + 1)
  return (
    <output data-testid={`element-${elementId}`}>
      {String(elementData.name ?? '')}
    </output>
  )
}

describe('Scene Tree canonical UI projection hooks', () => {
  afterEach(() => {
    cleanup()
  })

  it('re-renders from Core UI property subjects without a stale mirror', () => {
    render(<ProjectionProbe />)
    expect(screen.getByTestId('projection').textContent).toBe(
      'group-old|group-old'
    )

    act(() => {
      mocks.flattenedIds.next(['group-new', 'child'])
      mocks.elementDataMap.next({
        'group-new': {
          id: 'group-new',
          type: 'group',
          parentId: 'workspace'
        },
        child: {
          id: 'child',
          type: 'element',
          parentId: 'group-new'
        }
      })
    })

    expect(screen.getByTestId('projection').textContent).toBe(
      'group-new,child|group-new,child'
    )
  })

  it('does not re-render an element subscriber when only another entry changes', () => {
    const elementA = {
      id: 'element-a',
      name: 'A',
      parentId: 'workspace',
      type: 'element'
    }
    const elementB = {
      id: 'element-b',
      name: 'B',
      parentId: 'workspace',
      type: 'element'
    }
    mocks.elementDataMap.next({
      'element-a': elementA,
      'element-b': elementB
    })
    const renderCounts = new Map<string, number>()

    render(
      <>
        <ElementProbe elementId="element-a" renderCounts={renderCounts} />
        <ElementProbe elementId="element-b" renderCounts={renderCounts} />
      </>
    )

    act(() => {
      mocks.elementDataMap.next({
        'element-a': elementA,
        'element-b': { ...elementB, name: 'B updated' }
      })
    })

    expect(screen.getByTestId('element-element-a').textContent).toBe('A')
    expect(screen.getByTestId('element-element-b').textContent).toBe(
      'B updated'
    )
    expect(renderCounts.get('element-a')).toBe(1)
    expect(renderCounts.get('element-b')).toBe(2)
  })
})
