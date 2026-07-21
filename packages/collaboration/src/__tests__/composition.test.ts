import fs from 'node:fs'
import path from 'node:path'
import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vitest'
import {
  Awareness,
  AwarenessValidationError,
  createCollaboration,
  defineCanonicalOperationApply,
  MemoryHub,
  MemoryProvider,
  MemoryPersistence,
  ProviderFailure,
  type CreateCollaborationInput,
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

const baseInput = (): CreateCollaborationInput => ({
  documentId: 'document-a',
  roomId: 'room-a',
  actorId: 'actor-a',
  factory: {
    subscribeToSharedPublication: vi.fn(() => () => undefined)
  },
  operationDefinitions: [],
  permissionPolicy: () => true
})

describe('optional collaboration composition', () => {
  it('exports provider-neutral building blocks without creating them', () => {
    ;[
      AwarenessValidationError,
      MemoryHub,
      MemoryProvider,
      MemoryPersistence,
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

  it('is present in the generated workspace build graph', () => {
    const turbo = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'turbo.json'), 'utf8')
    ) as {
      tasks?: Record<
        string,
        {
          cache?: boolean
          outputs?: readonly string[]
          dependsOn?: readonly string[]
        }
      >
    }

    expect(turbo.tasks?.['build:collaboration']).toEqual({
      cache: false,
      outputs: ['dist/**'],
      dependsOn: ['^build:factory']
    })
  })

  it('constructs collaboration without activating injected resources', async () => {
    const input = baseInput()
    const yDoc = new Y.Doc()
    const awareness = new Awareness()
    const permissionPolicy = vi.fn(() => true)

    const collaboration = createCollaboration({
      ...input,
      yDoc,
      awareness,
      permissionPolicy,
      resourceOwnership: {
        yDoc: 'borrowed',
        awareness: 'borrowed'
      }
    })

    expect(collaboration).toMatchObject({
      identity: {
        documentId: 'document-a',
        roomId: 'room-a',
        actorId: 'actor-a'
      },
      yDoc,
      awareness
    })
    expect(Object.isFrozen(collaboration.operationDefinitions)).toBe(true)
    expect(permissionPolicy).not.toHaveBeenCalled()
    expect(input.factory.subscribeToSharedPublication).not.toHaveBeenCalled()

    await collaboration.dispose()
  })

  it('keeps connection metadata on provider identity instead of composition', () => {
    const compileTimeDeadFieldRejection = () =>
      createCollaboration({
        ...baseInput(),
        // @ts-expect-error connection metadata belongs to provider identity
        connectionMetadata: { accessToken: 'provider-owned' }
      })

    expect(compileTimeDeadFieldRejection).toEqual(expect.any(Function))
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
        createCollaboration({ ...baseInput(), [key]: value })
      ).toThrow(`${key} is required`)
    }
  )

  it('rejects an invalid Factory facade before resource activation', () => {
    expect(() =>
      createCollaboration({
        ...baseInput(),
        factory: {} as never
      })
    ).toThrow('factory.subscribeToSharedPublication is required')
  })

  it('rejects invalid resource ownership before resource activation', () => {
    expect(() =>
      createCollaboration({
        ...baseInput(),
        resourceOwnership: { yDoc: 'shared' as never }
      })
    ).toThrow('resourceOwnership.yDoc must be owned or borrowed')
  })
})
