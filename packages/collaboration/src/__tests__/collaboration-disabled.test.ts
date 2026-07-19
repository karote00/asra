import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  AwarenessValidationError,
  createConflictPolicyPipeline,
  defineCanonicalOperationApply,
  defineCollaborationComposition,
  MemoryCollaborationHub,
  MemoryCollaborationProvider,
  MemoryCollaborationUpdatePersistence,
  ProviderFailure,
  type CollaborationCompositionInput,
  type CollaborationOperationDefinition,
  type SharedOperationEnvelope
} from '..'

const repoRoot = path.resolve(__dirname, '../../../..')

const listSourceFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return listSourceFiles(absolutePath)
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [absolutePath] : []
  })

const baseInput = (): CollaborationCompositionInput<string, () => boolean> => ({
  documentId: 'document-a',
  roomId: 'room-a',
  actorId: 'actor-a',
  factory: {
    subscribeToSharedDelivery: vi.fn(() => () => undefined)
  },
  operationDefinitions: [],
  permissionPolicy: () => true
})

describe('optional collaboration composition', () => {
  it('exports provider-neutral runtime building blocks without creating them', () => {
    ;[
      AwarenessValidationError,
      createConflictPolicyPipeline,
      MemoryCollaborationHub,
      MemoryCollaborationProvider,
      MemoryCollaborationUpdatePersistence,
      ProviderFailure
    ].forEach((value) => expect(value).toEqual(expect.any(Function)))
  })

  it('accepts a synchronous canonical apply handler with no explicit return', () => {
    const apply = vi.fn()
    const definition: CollaborationOperationDefinition<{ value: number }> = {
      channel: 'document',
      eventName: 'set-value',
      schemaVersion: 1,
      validate: (payload): payload is { value: number } =>
        typeof (payload as { value?: unknown } | undefined)?.value === 'number',
      apply: defineCanonicalOperationApply((envelope) => {
        apply(envelope.payload)
      })
    }
    const envelope = {
      payload: { value: 1 }
    } as SharedOperationEnvelope<{ value: number }>

    expect(definition.apply(envelope)).toBeUndefined()
    expect(apply).toHaveBeenCalledWith({ value: 1 })
  })

  it('rejects async canonical handlers before they can run', () => {
    const compileTimeAsyncRejection = () => {
      // @ts-expect-error canonical handlers cannot return a Promise
      defineCanonicalOperationApply(async () => undefined)
    }
    expect(compileTimeAsyncRejection).toEqual(expect.any(Function))
    let invoked = false
    const asyncHandler = async () => {
      invoked = true
    }

    expect(() => defineCanonicalOperationApply(asyncHandler as never)).toThrow(
      '[collaboration] canonical apply handler must be synchronous'
    )
    expect(invoked).toBe(false)
  })

  it('is absent from non-collaborative framework package dependencies and sources', () => {
    ;['core', 'factory', 'preset', 'persistence'].forEach((packageName) => {
      const packageRoot = path.join(repoRoot, 'packages', packageName)
      const manifest = JSON.parse(
        fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
      ) as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      expect(manifest.dependencies?.['@asyra/collaboration']).toBeUndefined()
      expect(manifest.devDependencies?.['@asyra/collaboration']).toBeUndefined()

      const sourceFiles = listSourceFiles(path.join(packageRoot, 'src'))
      sourceFiles.forEach((sourcePath) => {
        const source = fs.readFileSync(sourcePath, 'utf8')
        expect(source).not.toMatch(/@asyra\/collaboration/)
      })
    })
  })

  it('normalizes a frozen composition without invoking injected resources', () => {
    const input = baseInput()
    const provider = { connect: vi.fn() }
    const yDoc = { transact: vi.fn() }
    const awareness = { clear: vi.fn() }
    const persistence = { load: vi.fn() }
    const permissionPolicy = vi.fn(() => true)

    const composition = defineCollaborationComposition({
      ...input,
      provider,
      yDoc,
      awareness,
      persistence,
      permissionPolicy,
      resourceOwnership: {
        provider: 'owned',
        yDoc: 'borrowed',
        awareness: 'borrowed',
        persistence: 'borrowed'
      }
    })

    expect(composition).toMatchObject({
      documentId: 'document-a',
      roomId: 'room-a',
      actorId: 'actor-a',
      provider,
      yDoc,
      awareness,
      persistence,
      resourceOwnership: {
        provider: 'owned',
        yDoc: 'borrowed',
        awareness: 'borrowed',
        persistence: 'borrowed'
      }
    })
    expect(Object.isFrozen(composition)).toBe(true)
    expect(Object.isFrozen(composition.operationDefinitions)).toBe(true)
    expect(Object.isFrozen(composition.resourceOwnership)).toBe(true)
    expect(provider.connect).not.toHaveBeenCalled()
    expect(yDoc.transact).not.toHaveBeenCalled()
    expect(awareness.clear).not.toHaveBeenCalled()
    expect(persistence.load).not.toHaveBeenCalled()
    expect(permissionPolicy).not.toHaveBeenCalled()
    expect(input.factory.subscribeToSharedDelivery).not.toHaveBeenCalled()
  })

  it('defaults absent resources to owned creation and injected resources to borrowed', () => {
    const withoutResources = defineCollaborationComposition(baseInput())
    expect(withoutResources.resourceOwnership).toEqual({
      provider: 'borrowed',
      yDoc: 'owned',
      awareness: 'owned',
      persistence: 'borrowed'
    })

    const withResources = defineCollaborationComposition({
      ...baseInput(),
      provider: {},
      yDoc: {},
      awareness: {},
      persistence: {}
    })
    expect(withResources.resourceOwnership).toEqual({
      provider: 'borrowed',
      yDoc: 'borrowed',
      awareness: 'borrowed',
      persistence: 'borrowed'
    })
  })

  it.each([
    ['documentId', ''],
    ['documentId', '   '],
    ['roomId', ''],
    ['actorId', '']
  ] as const)(
    'rejects an invalid %s before resource activation',
    (key, value) => {
      expect(() =>
        defineCollaborationComposition({ ...baseInput(), [key]: value })
      ).toThrow(`${key} is required`)
    }
  )

  it('rejects an invalid Factory facade before resource activation', () => {
    expect(() =>
      defineCollaborationComposition({
        ...baseInput(),
        factory: {} as never
      })
    ).toThrow('factory.subscribeToSharedDelivery is required')
  })

  it('rejects invalid resource ownership before resource activation', () => {
    expect(() =>
      defineCollaborationComposition({
        ...baseInput(),
        resourceOwnership: { yDoc: 'shared' as never }
      })
    ).toThrow('resourceOwnership.yDoc must be owned or borrowed')
  })
})
