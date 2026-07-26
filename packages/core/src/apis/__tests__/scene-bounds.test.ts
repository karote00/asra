import { describe, expect, it, vi } from 'vitest'
import { EntityTypes, type Bounds } from '@asyra/utils'
import { Core } from '../../core'

interface TestElement {
  id: string
  type: string
  parentId: string
  bounds?: {
    x: number
    y: number
    width: number
    height: number
  }
}

const WORKSPACE_ID = 'workspace'

const workspace = (parentId = ''): TestElement => ({
  id: WORKSPACE_ID,
  type: EntityTypes.WORKSPACE,
  parentId
})

const element = (
  id: string,
  parentId: string,
  bounds: NonNullable<TestElement['bounds']>,
  type = 'rect'
): TestElement => ({
  id,
  type,
  parentId,
  bounds
})

const createCoreWithElements = (elements: TestElement[]): Core => {
  const instances = new Map(
    elements.map((data) => [
      data.id,
      {
        get: (key: keyof TestElement) => data[key],
        getAllComputedData: () => data.bounds ?? {}
      }
    ])
  )

  return new Core({
    inputSystem: {} as never,
    factory: {
      registerTransactionReplayHandler: vi.fn(() => () => undefined),
      subscribeToCommitCapture: vi.fn(() => () => undefined),
      subscribeToTransactionStatus: vi.fn(() => () => undefined),
      reportPersistenceStatus: vi.fn()
    } as never,
    props: {} as never,
    render: {
      init: vi.fn(async () => ({ canvas: null, instance: null })),
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1,
      registerLayer: vi.fn(),
      unregisterLayer: vi.fn(() => true)
    } as never,
    sceneTree: {
      workspace: WORKSPACE_ID,
      getAllElements: () => instances,
      getElementById: (id: string) => instances.get(id)
    } as never,
    selection: {} as never,
    systemContext: {} as never
  })
}

const getBounds = (elements: TestElement[]): Bounds | null =>
  createCoreWithElements(elements).getAllElementsBounds()

describe('Core Scene Tree world-space bounds', () => {
  it('keeps scene bounds exactly equivalent before and after Group', () => {
    const before = getBounds([
      workspace(),
      element('first', WORKSPACE_ID, {
        x: 100,
        y: 50,
        width: 20,
        height: 20
      }),
      element('second', WORKSPACE_ID, {
        x: 200,
        y: 100,
        width: 20,
        height: 20
      })
    ])

    const after = getBounds([
      workspace(),
      element(
        'group',
        WORKSPACE_ID,
        {
          x: 100,
          y: 50,
          width: 120,
          height: 70
        },
        EntityTypes.GROUP
      ),
      element('first', 'group', {
        x: 0,
        y: 0,
        width: 20,
        height: 20
      }),
      element('second', 'group', {
        x: 100,
        y: 50,
        width: 20,
        height: 20
      })
    ])

    expect(before).toEqual({
      minX: 100,
      minY: 50,
      maxX: 220,
      maxY: 120
    })
    expect(after).toEqual(before)
  })

  it('keeps equivalent bounds while accumulating nested Group offsets', () => {
    const before = getBounds([
      workspace(),
      element('outer-leaf', WORKSPACE_ID, {
        x: 100,
        y: 50,
        width: 10,
        height: 10
      }),
      element('inner-first', WORKSPACE_ID, {
        x: 120,
        y: 60,
        width: 10,
        height: 10
      }),
      element('inner-last', WORKSPACE_ID, {
        x: 125,
        y: 65,
        width: 10,
        height: 10
      })
    ])
    const after = getBounds([
      workspace(),
      element(
        'outer',
        WORKSPACE_ID,
        {
          x: 100,
          y: 50,
          width: 35,
          height: 25
        },
        EntityTypes.GROUP
      ),
      element('outer-leaf', 'outer', {
        x: 0,
        y: 0,
        width: 10,
        height: 10
      }),
      element(
        'inner',
        'outer',
        {
          x: 20,
          y: 10,
          width: 15,
          height: 15
        },
        EntityTypes.GROUP
      ),
      element('inner-first', 'inner', {
        x: 0,
        y: 0,
        width: 10,
        height: 10
      }),
      element('inner-last', 'inner', {
        x: 5,
        y: 5,
        width: 10,
        height: 10
      })
    ])

    expect(before).toEqual({
      minX: 100,
      minY: 50,
      maxX: 135,
      maxY: 75
    })
    expect(after).toEqual(before)
  })

  it.each([
    {
      name: 'a missing parent',
      elements: [
        workspace(),
        element('leaf', 'missing', { x: 10, y: 20, width: 30, height: 40 })
      ]
    },
    {
      name: 'a parent cycle',
      elements: [
        workspace(),
        element(
          'first',
          'second',
          { x: 10, y: 20, width: 30, height: 40 },
          EntityTypes.GROUP
        ),
        element(
          'second',
          'first',
          { x: 5, y: 5, width: 10, height: 10 },
          EntityTypes.GROUP
        )
      ]
    },
    {
      name: 'an invalid workspace chain',
      elements: [
        workspace('other-root'),
        element('leaf', WORKSPACE_ID, {
          x: 10,
          y: 20,
          width: 30,
          height: 40
        })
      ]
    },
    {
      name: 'non-finite geometry',
      elements: [
        workspace(),
        element('leaf', WORKSPACE_ID, {
          x: Number.NaN,
          y: 20,
          width: 30,
          height: 40
        })
      ]
    }
  ])('fails closed without partial bounds for $name', ({ elements }) => {
    expect(getBounds(elements)).toBeNull()
  })

  it('preserves negative-dimension min/max semantics', () => {
    expect(
      getBounds([
        workspace(),
        element('leaf', WORKSPACE_ID, {
          x: 50,
          y: 40,
          width: -30,
          height: -10
        })
      ])
    ).toEqual({
      minX: 20,
      minY: 30,
      maxX: 50,
      maxY: 40
    })
  })

  it('returns no bounds for an empty workspace', () => {
    expect(getBounds([workspace()])).toBeNull()
  })
})
