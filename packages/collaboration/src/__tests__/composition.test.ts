import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  Awareness,
  AwarenessValidationError,
  createCollaboration,
  MemoryHub,
  MemoryProvider,
  ProviderFailure,
  type CreateCollaborationInput
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
  processRemotePublication: vi.fn()
})

describe('optional collaboration composition', () => {
  it('exports Provider-neutral building blocks without creating them', () => {
    ;[
      AwarenessValidationError,
      MemoryHub,
      MemoryProvider,
      ProviderFailure
    ].forEach((value) => expect(value).toEqual(expect.any(Function)))
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

      listSourceFiles(path.join(packageRoot, 'src')).forEach((sourcePath) => {
        expect(fs.readFileSync(sourcePath, 'utf8')).not.toMatch(
          /@asyra\/collaboration/
        )
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

    expect(turbo.tasks?.['@asyra/collaboration#build:collaboration']).toEqual({
      cache: false,
      outputs: ['dist/**'],
      dependsOn: ['@asyra/factory#build:factory', '@asyra/utils#build:utils']
    })
  })

  it('constructs an inert instance without a Y.Doc or Provider activation', async () => {
    const input = baseInput()
    const awareness = new Awareness()
    const collaboration = createCollaboration({
      ...input,
      awareness,
      resourceOwnership: { awareness: 'borrowed' }
    })

    expect(collaboration).toMatchObject({
      identity: {
        documentId: 'document-a',
        roomId: 'room-a',
        actorId: 'actor-a'
      },
      awareness
    })
    expect('yDoc' in collaboration).toBe(false)
    expect(input.factory.subscribeToSharedPublication).not.toHaveBeenCalled()
    expect(input.processRemotePublication).not.toHaveBeenCalled()

    await collaboration.dispose()
  })

  it('keeps connection metadata on Provider identity instead of composition', () => {
    const compileTimeDeadFieldRejection = () =>
      createCollaboration({
        ...baseInput(),
        // @ts-expect-error connection metadata belongs to Provider identity
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

  it('rejects invalid required callbacks before resource activation', () => {
    expect(() =>
      createCollaboration({
        ...baseInput(),
        factory: {} as never
      })
    ).toThrow('factory.subscribeToSharedPublication is required')
    expect(() =>
      createCollaboration({
        ...baseInput(),
        processRemotePublication: undefined as never
      })
    ).toThrow('processRemotePublication is required')
  })

  it('rejects invalid resource ownership before resource activation', () => {
    expect(() =>
      createCollaboration({
        ...baseInput(),
        resourceOwnership: { awareness: 'shared' as never }
      })
    ).toThrow('resourceOwnership.awareness must be owned or borrowed')
  })
})
