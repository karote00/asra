import { describe, expect, it, vi } from 'vitest'
import {
  RegistrationGraph,
  RegistrationRelationError,
  type RegistrationNodeDefinition,
  type RegistrationRef
} from '../registration-graph'

const ref = (kind: string, key: string): RegistrationRef => ({ kind, key })

const node = (
  kind: string,
  key: string,
  overrides: Partial<RegistrationNodeDefinition> = {}
): RegistrationNodeDefinition => ({
  ref: ref(kind, key),
  ...overrides
})

const expectError = (
  run: () => unknown,
  code: RegistrationRelationError['code']
) => {
  try {
    run()
    throw new Error(`Expected RegistrationRelationError ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(RegistrationRelationError)
    expect((error as RegistrationRelationError).code).toBe(code)
    expect((error as RegistrationRelationError).result).toMatchObject({
      ok: false,
      code
    })
  }
}

describe('RegistrationGraph', () => {
  it('returns stable sorted node/relation metadata with default app ownership', () => {
    const graph = new RegistrationGraph()
    graph.registerNode(node('property', 'z'))
    graph.registerNode(
      node('component', 'rect', {
        owner: {
          packageName: '@asyra/preset',
          name: 'default-preset'
        }
      })
    )
    graph.registerNode(node('property', 'a'))

    graph.defineRelation(ref('component', 'rect'), {
      name: 'z-slot',
      target: ref('property', 'z'),
      onTargetUnregister: 'detach'
    })
    graph.defineRelation(ref('component', 'rect'), {
      name: 'a-slot',
      target: ref('property', 'a'),
      onTargetUnregister: 'detach'
    })

    const registrations = graph.getRegistrations()
    const relations = graph.getOutgoingRelations(ref('component', 'rect'))

    expect(
      registrations.map(({ ref: item }) => `${item.kind}:${item.key}`)
    ).toEqual(['component:rect', 'property:a', 'property:z'])
    expect(registrations).toEqual([
      {
        ref: ref('component', 'rect'),
        owner: { packageName: '@asyra/preset', name: 'default-preset' }
      },
      {
        ref: ref('property', 'a'),
        owner: { packageName: 'app', name: 'a' }
      },
      {
        ref: ref('property', 'z'),
        owner: { packageName: 'app', name: 'z' }
      }
    ])
    expect(relations.map((relation) => relation.name)).toEqual([
      'a-slot',
      'z-slot'
    ])
    ;(registrations[0].owner as { name: string }).name = 'mutated'
    ;(relations[0].target as { key: string }).key = 'mutated'
    expect(graph.getRegistration(ref('component', 'rect'))?.owner.name).toBe(
      'default-preset'
    )
    expect(
      graph.getOutgoingRelations(ref('component', 'rect'))[0].target.key
    ).toBe('a')
  })

  it('transfers only owner metadata while preserving node behavior and relations', () => {
    const events: string[] = []
    const graph = new RegistrationGraph()
    const source = ref('component', 'shape')
    const target = ref('property', 'style')
    graph.registerNode(
      node('component', 'shape', {
        handlers: {
          detachRelation: (relation) => events.push(`detach:${relation.name}`)
        }
      })
    )
    graph.registerNode(
      node('property', 'style', {
        owner: { packageName: '@asyra/preset', name: 'default-style' },
        resources: [
          { key: 'style-runtime', dispose: () => events.push('dispose:style') }
        ]
      })
    )
    graph.defineRelation(source, {
      name: 'style',
      target,
      onTargetUnregister: 'detach'
    })
    const relations = graph.getRelations()
    const appOwner = { packageName: 'app', name: 'style' }

    const result = graph.transferRegistrationOwner(target, appOwner)

    appOwner.name = 'mutated-input'
    ;(result.owner as { name: string }).name = 'mutated-result'
    expect(graph.getRegistration(target)?.owner).toEqual({
      packageName: 'app',
      name: 'style'
    })
    expect(graph.getRelations()).toEqual(relations)

    graph.unregister(target)
    expect(events).toEqual(['detach:style', 'dispose:style'])
  })

  it('rejects owner transfer for missing, pending, or closed registrations', () => {
    let compositionOpen = true
    const graph = new RegistrationGraph({
      isCompositionOpen: () => compositionOpen
    })
    const target = ref('property', 'style')
    graph.registerNode(
      node('property', 'style', {
        resources: [
          {
            key: 'style-runtime',
            dispose: () => {
              throw new Error('cleanup failed')
            }
          }
        ]
      })
    )

    expectError(
      () =>
        graph.transferRegistrationOwner(ref('property', 'missing'), {
          packageName: 'app',
          name: 'missing'
        }),
      'REGISTRATION_NOT_FOUND'
    )
    expectError(() => graph.unregister(target), 'UNREGISTER_FAILED')
    expectError(
      () =>
        graph.transferRegistrationOwner(target, {
          packageName: 'app',
          name: 'style'
        }),
      'UNREGISTER_FAILED'
    )

    compositionOpen = false
    expectError(
      () =>
        graph.transferRegistrationOwner(target, {
          packageName: 'app',
          name: 'style'
        }),
      'COMPOSITION_CLOSED'
    )
  })

  it('fails fast for missing registrations, targets, duplicate relations, and missing relations', () => {
    const graph = new RegistrationGraph()
    graph.registerNode(node('component', 'rect'))
    graph.registerNode(node('property', 'fills'))

    expectError(
      () =>
        graph.defineRelation(ref('component', 'missing'), {
          name: 'fills',
          target: ref('property', 'fills'),
          onTargetUnregister: 'detach'
        }),
      'REGISTRATION_NOT_FOUND'
    )
    expectError(
      () =>
        graph.defineRelation(ref('component', 'rect'), {
          name: 'missing',
          target: ref('property', 'missing'),
          onTargetUnregister: 'detach'
        }),
      'RELATION_TARGET_NOT_FOUND'
    )

    graph.defineRelation(ref('component', 'rect'), {
      name: 'fills',
      target: ref('property', 'fills'),
      onTargetUnregister: 'detach'
    })
    expectError(
      () =>
        graph.defineRelation(ref('component', 'rect'), {
          name: 'fills',
          target: ref('property', 'fills'),
          onTargetUnregister: 'detach'
        }),
      'DUPLICATE_RELATION'
    )
    expectError(
      () => graph.removeRelation(ref('component', 'rect'), 'missing'),
      'RELATION_NOT_FOUND'
    )
  })

  it('removes one relation while preserving both registrations', () => {
    const graph = new RegistrationGraph()
    graph.registerNode(node('component', 'rect'))
    graph.registerNode(node('property', 'fills'))
    graph.defineRelation(ref('component', 'rect'), {
      name: 'fills',
      target: ref('property', 'fills'),
      onTargetUnregister: 'detach'
    })

    expect(graph.removeRelation(ref('component', 'rect'), 'fills')).toEqual({
      ok: true,
      operation: 'remove-relation',
      source: ref('component', 'rect'),
      relation: expect.objectContaining({
        name: 'fills',
        target: ref('property', 'fills')
      })
    })
    expect(graph.getRegistration(ref('component', 'rect'))).toBeDefined()
    expect(graph.getRegistration(ref('property', 'fills'))).toBeDefined()
    expect(graph.getRelations()).toEqual([])
  })

  it('detaches structural sources and recursively unregisters hard sources deterministically', () => {
    const events: string[] = []
    const graph = new RegistrationGraph()
    graph.registerNode(
      node('property', 'fills', {
        resources: [
          { key: 'fills.schema', dispose: () => events.push('fills.schema') },
          { key: 'fills.runtime', dispose: () => events.push('fills.runtime') }
        ]
      })
    )
    graph.registerNode(
      node('component', 'oval', {
        handlers: {
          detachRelation: (relation) => events.push(`detach:${relation.name}`)
        }
      })
    )
    graph.registerNode(
      node('render-strategy', 'oval', {
        resources: [
          { key: 'render.oval', dispose: () => events.push('render.oval') }
        ]
      })
    )
    graph.registerNode(
      node('feature', 'fill-tool', {
        resources: [
          { key: 'feature.fill-tool', dispose: () => events.push('feature') }
        ]
      })
    )

    graph.defineRelation(ref('component', 'oval'), {
      name: 'fills',
      target: ref('property', 'fills'),
      onTargetUnregister: 'detach'
    })
    graph.defineRelation(ref('render-strategy', 'oval'), {
      name: 'fills-runtime',
      target: ref('property', 'fills'),
      onTargetUnregister: 'unregister-source'
    })
    graph.defineRelation(ref('feature', 'fill-tool'), {
      name: 'oval-renderer',
      target: ref('render-strategy', 'oval'),
      onTargetUnregister: 'unregister-source'
    })

    const result = graph.unregister(ref('property', 'fills'))

    expect(result).toEqual({
      ok: true,
      operation: 'unregister-registration',
      root: ref('property', 'fills'),
      removedRelations: expect.arrayContaining([
        expect.objectContaining({ name: 'fills' }),
        expect.objectContaining({ name: 'fills-runtime' }),
        expect.objectContaining({ name: 'oval-renderer' })
      ]),
      detachedSources: [ref('component', 'oval')],
      recursivelyUnregisteredSources: [
        ref('render-strategy', 'oval'),
        ref('feature', 'fill-tool')
      ],
      removedOwnedRegistrations: [
        'feature.fill-tool',
        'render.oval',
        'fills.runtime',
        'fills.schema'
      ],
      cleanupFailures: [],
      pendingCleanup: []
    })
    expect(events).toEqual([
      'detach:fills',
      'feature',
      'render.oval',
      'fills.runtime',
      'fills.schema'
    ])
    expect(graph.getRegistration(ref('component', 'oval'))).toBeDefined()
    expect(graph.getRegistration(ref('property', 'fills'))).toBeUndefined()
    expect(
      graph.getRegistration(ref('render-strategy', 'oval'))
    ).toBeUndefined()
    expect(graph.getRegistration(ref('feature', 'fill-tool'))).toBeUndefined()
  })

  it('does not infer ownership from outgoing targets', () => {
    const graph = new RegistrationGraph()
    graph.registerNode(node('property', 'parent'))
    graph.registerNode(node('property', 'child'))
    graph.defineRelation(ref('property', 'parent'), {
      name: 'child',
      target: ref('property', 'child'),
      onTargetUnregister: 'detach'
    })

    graph.unregister(ref('property', 'parent'))

    expect(graph.getRegistration(ref('property', 'parent'))).toBeUndefined()
    expect(graph.getRegistration(ref('property', 'child'))).toBeDefined()
  })

  it('keeps failed cleanup retryable and never reruns completed cleanup', () => {
    const events: string[] = []
    let fail = true
    const graph = new RegistrationGraph()
    graph.registerNode(
      node('property', 'fills', {
        resources: [
          { key: 'first', dispose: () => events.push('first') },
          {
            key: 'second',
            dispose: () => {
              events.push('second')
              if (fail) throw new Error('still active')
            }
          },
          { key: 'third', dispose: () => events.push('third') }
        ]
      })
    )

    expectError(
      () => graph.unregister(ref('property', 'fills')),
      'UNREGISTER_FAILED'
    )
    expect(events).toEqual(['third', 'second', 'first'])
    expect(graph.getRegistration(ref('property', 'fills'))).toBeDefined()
    expectError(
      () => graph.registerNode(node('property', 'fills')),
      'UNREGISTER_FAILED'
    )

    fail = false
    const result = graph.unregister(ref('property', 'fills'))
    expect(events).toEqual(['third', 'second', 'first', 'second'])
    expect(result.removedOwnedRegistrations).toEqual([
      'third',
      'first',
      'second'
    ])
    expect(result.pendingCleanup).toEqual([])
  })

  it('retries only unfinished detach handlers after a relation removal failure', () => {
    const events: string[] = []
    let failSecondDetach = true
    const graph = new RegistrationGraph()
    graph.registerNode(node('property', 'fills'))
    graph.registerNode(
      node('component', 'a', {
        handlers: {
          detachRelation: () => events.push('detach:a')
        }
      })
    )
    graph.registerNode(
      node('component', 'b', {
        handlers: {
          detachRelation: () => {
            events.push('detach:b')
            if (failSecondDetach) throw new Error('detach failed')
          }
        }
      })
    )
    graph.defineRelation(ref('component', 'a'), {
      name: 'fills',
      target: ref('property', 'fills'),
      onTargetUnregister: 'detach'
    })
    graph.defineRelation(ref('component', 'b'), {
      name: 'fills',
      target: ref('property', 'fills'),
      onTargetUnregister: 'detach'
    })

    expectError(
      () => graph.unregister(ref('property', 'fills')),
      'RELATION_REMOVE_FAILED'
    )
    expect(events).toEqual(['detach:a', 'detach:b'])
    expect(graph.getOutgoingRelations(ref('component', 'a'))).toEqual([])
    expect(graph.getOutgoingRelations(ref('component', 'b'))).toHaveLength(1)

    failSecondDetach = false
    expect(graph.unregister(ref('property', 'fills'))).toMatchObject({
      ok: true,
      detachedSources: [ref('component', 'a'), ref('component', 'b')]
    })
    expect(events).toEqual(['detach:a', 'detach:b', 'detach:b'])
  })

  it('reconciles a pending detach with current adjacency before retrying owner cleanup', () => {
    let detachAttempts = 0
    const graph = new RegistrationGraph()
    graph.registerNode(node('property', 'fills'))
    graph.registerNode(node('property', 'strokes'))
    graph.registerNode(
      node('component', 'shape', {
        handlers: {
          detachRelation: () => {
            detachAttempts += 1
            if (detachAttempts === 1) throw new Error('detach failed')
          }
        }
      })
    )
    graph.defineRelation(ref('component', 'shape'), {
      name: 'paint',
      target: ref('property', 'fills'),
      onTargetUnregister: 'detach'
    })

    expectError(
      () => graph.unregister(ref('property', 'fills')),
      'RELATION_REMOVE_FAILED'
    )
    graph.removeRelation(ref('component', 'shape'), 'paint')
    graph.defineRelation(ref('component', 'shape'), {
      name: 'paint',
      target: ref('property', 'strokes'),
      onTargetUnregister: 'detach'
    })

    expect(graph.unregister(ref('property', 'fills'))).toMatchObject({
      ok: true,
      detachedSources: [ref('component', 'shape')]
    })
    expect(detachAttempts).toBe(1)
    expect(graph.getOutgoingRelations(ref('component', 'shape'))).toEqual([
      {
        source: ref('component', 'shape'),
        name: 'paint',
        target: ref('property', 'strokes'),
        onTargetUnregister: 'detach'
      }
    ])
  })

  it('rejects mutations after composition closes', () => {
    let open = true
    const graph = new RegistrationGraph({ isCompositionOpen: () => open })
    graph.registerNode(node('component', 'rect'))
    graph.registerNode(node('property', 'fills'))
    open = false

    expectError(
      () =>
        graph.defineRelation(ref('component', 'rect'), {
          name: 'fills',
          target: ref('property', 'fills'),
          onTargetUnregister: 'detach'
        }),
      'COMPOSITION_CLOSED'
    )
    expectError(
      () => graph.unregister(ref('property', 'fills')),
      'COMPOSITION_CLOSED'
    )
  })

  it('reports dangling owner registrations before runtime side effects', () => {
    const isPresent = vi.fn(() => false)
    const graph = new RegistrationGraph()
    graph.registerNode(node('component', 'rect'))
    graph.registerNode(node('property', 'fills', { handlers: { isPresent } }))
    graph.defineRelation(ref('component', 'rect'), {
      name: 'fills',
      target: ref('property', 'fills'),
      onTargetUnregister: 'detach'
    })

    expectError(() => graph.validateRelations(), 'DANGLING_RELATION')
    expect(isPresent).toHaveBeenCalledOnce()
  })
})
