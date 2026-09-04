import { describe, expect, it } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { preflightExperiment } from '../../analysis/preflight'
import {
  createExperimentSnapshot,
  validateHistoricalSnapshot
} from '../../analysis/snapshot'
import { createMethodCatalog } from '../catalog'
import type {
  InstalledMethodDescriptor,
  MethodRegistration
} from '../contracts'

function registration(): MethodRegistration {
  const descriptor: InstalledMethodDescriptor = {
    id: 'private-clearance',
    version: '1.0.0',
    geometryKinds: ['sphere', 'box', 'capsule'],
    supportsStatic: true,
    supportsMotion: true,
    maxPairs: 4096,
    manifest: {
      contractVersion: 1,
      name: 'Private clearance',
      origin: 'private',
      author: 'Local team',
      source: 'local/method.ts',
      license: 'Private',
      purpose: 'Local clearance experiments.',
      units: 'm-rad-s',
      coordinates: 'right-handed-y-up',
      applicability: 'Machine-scale proxy geometry; no physical safety claim.',
      numericalSemantics: 'Bounded clearance with unresolved equality.',
      controls: 'Uses the common distance, time and iteration controls.',
      reproducibility: 'Deterministic; no random seed or external runtime.',
      resources: 'One owned Worker, platform budgets and termination apply.',
      services: {
        network: false,
        additionalFiles: false,
        commercialRuntime: false
      },
      validation: {
        status: 'unverified',
        evidence: 'No numerical validation supplied.'
      }
    },
    parameterSchema: {
      margin: {
        kind: 'number',
        label: 'Margin',
        unit: 'm',
        min: 0,
        max: 0.01,
        default: 0
      },
      mode: {
        kind: 'enum',
        label: 'Mode',
        values: ['strict', 'conservative'],
        default: 'strict'
      },
      enabled: { kind: 'boolean', label: 'Enabled', default: true }
    }
  }
  return {
    descriptor,
    execute: () => {
      throw new Error('Not executed by admission')
    }
  }
}

describe('trusted pre-start method catalog', () => {
  it('detaches and freezes declarations without executing code or permitting replacement', () => {
    const input = registration(),
      catalog = createMethodCatalog([input])
    input.descriptor.manifest.name = 'Changed after installation'
    expect(catalog.descriptors[0].manifest.name).toBe('Private clearance')
    expect(Object.isFrozen(catalog.descriptors[0].parameterSchema.margin)).toBe(
      true
    )
    expect(catalog.resolve('private-clearance', '1.0.0').descriptor).toBe(
      catalog.descriptors[0]
    )
    expect(() => catalog.resolve('private-clearance', '2.0.0')).toThrow(
      'unavailable'
    )
    expect(Object.isFrozen(catalog)).toBe(true)
  })

  it('rejects duplicate IDs and case-insensitive names, even under a different version', () => {
    for (const change of [
      (item: MethodRegistration) => {
        item.descriptor.version = '2.0.0'
      },
      (item: MethodRegistration) => {
        item.descriptor.id = 'another-method'
        item.descriptor.manifest.name = 'PRIVATE CLEARANCE'
      }
    ]) {
      const duplicate = registration()
      change(duplicate)
      expect(() => createMethodCatalog([registration(), duplicate])).toThrow(
        'Duplicate'
      )
    }
  })

  it('rejects incompatible contracts, incomplete declarations and unbounded schemas', () => {
    for (const change of [
      (item: MethodRegistration) => {
        Object.assign(item.descriptor.manifest, { contractVersion: 2 })
      },
      (item: MethodRegistration) => {
        item.descriptor.manifest.author = ''
      },
      (item: MethodRegistration) => {
        Object.assign(item.descriptor, { maxPairs: 4097 })
      },
      (item: MethodRegistration) => {
        Object.assign(item.descriptor.parameterSchema.margin, { max: Infinity })
      },
      (item: MethodRegistration) => {
        Object.assign(item.descriptor.parameterSchema.margin, { default: -1 })
      },
      (item: MethodRegistration) => {
        Object.assign(item.descriptor.manifest, { executable: 'not data' })
      }
    ]) {
      const malformed = registration()
      change(malformed)
      expect(() => createMethodCatalog([malformed])).toThrow()
    }
  })

  it('checks method-specific parameters before snapshotting and preserves unavailable history', () => {
    const catalog = createMethodCatalog([registration()]),
      example = createSyntheticExample()
    const draft = createSyntheticExperimentDraft(example),
      descriptor = catalog.descriptors[0]
    const definition = {
      ...draft,
      revision: 1,
      rule: { ...draft.rule, revision: 1 },
      method: {
        id: descriptor.id,
        version: descriptor.version,
        settings: {
          ...draft.method.settings,
          parameters: { margin: 0.002, mode: 'strict', enabled: true }
        }
      }
    }
    expect(
      preflightExperiment(example.workcell, definition, catalog.descriptors)
        .blockers
    ).toEqual([])
    const snapshot = createExperimentSnapshot({
      snapshotId: 'private-run',
      candidateId: 'candidate',
      experimentId: 'study',
      workcell: example.workcell,
      definition,
      methods: catalog.descriptors,
      acknowledgedWarningCodes: []
    })
    expect(snapshot.methodDescriptor).toEqual(descriptor)
    expect(snapshot.methodDescriptor).not.toBe(descriptor)
    expect(Object.isFrozen(snapshot.methodDescriptor?.manifest)).toBe(true)
    expect(validateHistoricalSnapshot(snapshot)).toEqual(snapshot)
    expect(
      preflightExperiment(example.workcell, definition, []).blockers
    ).toContainEqual(expect.objectContaining({ code: 'method-unavailable' }))
    const invalidParameters: Record<string, number | string | boolean>[] = [
      { margin: -1, mode: 'strict', enabled: true },
      { margin: 0, mode: 'invented', enabled: true },
      { margin: 0, mode: 'strict' },
      { margin: 0, mode: 'strict', enabled: true, unexpected: 1 }
    ]
    for (const parameters of invalidParameters) {
      const invalid = {
        ...definition,
        method: {
          ...definition.method,
          settings: { ...definition.method.settings, parameters }
        }
      }
      expect(
        preflightExperiment(example.workcell, invalid, catalog.descriptors)
          .blockers
      ).toContainEqual(expect.objectContaining({ code: 'method-parameters' }))
    }
    const forged = structuredClone(snapshot)
    if (!forged.methodDescriptor) throw new Error('Missing descriptor')
    forged.methodDescriptor.version = 'different'
    expect(() => validateHistoricalSnapshot(forged)).toThrow('identity')
  })
})
