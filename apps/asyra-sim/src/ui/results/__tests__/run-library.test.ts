// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSyntheticExperimentDraft } from '../../../../samples/synthetic-experiment'
import { createSyntheticExample } from '../../../../samples/synthetic-workcell'
import { OFFICIAL_CLEARANCE_METHOD } from '../../../analysis/methods/official-method'
import { terminalAnalysisResult } from '../../../analysis/result'
import { createExperimentSnapshot } from '../../../analysis/snapshot'
import { validateRunRecord } from '../../../storage/run-record'
import { RunLibrary } from '../run-library'

const observationAccess = {
  features: {
    observations: {
      prepare: vi.fn(),
      retain: vi.fn(),
      discard: vi.fn(),
      cancel: vi.fn()
    },
    edit: {
      addObservation: vi.fn(),
      updateObservation: vi.fn(),
      removeObservation: vi.fn()
    }
  },
  getObservations: () => [],
  getObservationAttachment: vi.fn(),
  exportObservations: vi.fn()
}

let host: HTMLDivElement

let root: Root

const originalShow = HTMLDialogElement.prototype.showModal

const originalClose = HTMLDialogElement.prototype.close

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

  HTMLDialogElement.prototype.showModal = vi.fn()

  HTMLDialogElement.prototype.close = vi.fn()

  host = document.createElement('div')

  document.body.append(host)

  root = createRoot(host)
})

afterEach(async () => {
  await act(() => root.unmount())

  host.remove()

  HTMLDialogElement.prototype.showModal = originalShow

  HTMLDialogElement.prototype.close = originalClose

  vi.unstubAllGlobals()
})

function record(id: string, threshold = 0.01) {
  const example = createSyntheticExample()

  const draft = createSyntheticExperimentDraft(example)

  draft.rule.minimumClearance = threshold

  const snapshot = createExperimentSnapshot({
    snapshotId: `snapshot-${id}`,
    candidateId: 'candidate',
    experimentId: 'study',
    workcell: example.workcell,
    definition: { ...draft, revision: 1, rule: { ...draft.rule, revision: 1 } },
    methods: [OFFICIAL_CLEARANCE_METHOD],
    acknowledgedWarningCodes: []
  })

  return validateRunRecord({
    version: 1,
    name: id,
    retainedAt: new Date().toISOString(),
    environment: {
      appVersion: 'test',
      userAgent: 'Test browser',
      hardwareConcurrency: 8
    },
    snapshot,
    result: terminalAnalysisResult(snapshot, [], {
      runId: id,
      startedAt: 0,
      endedAt: 1,
      execution: 'cancelled',
      error: 'Cancelled by user'
    })
  })
}

const button = (text: string) => {
  const found = [...host.querySelectorAll('button')].find(
    (item) => item.textContent === text
  )

  if (!found) throw new Error(`Missing button: ${text}`)

  return found
}

it('discloses incompatible comparisons and limits selection to three immutable runs', async () => {
  const runs = [record('a'), record('b', 0.03), record('c'), record('d')]

  await act(() =>
    root.render(
      createElement(RunLibrary, {
        runs,
        retainedIds: new Set<string>(['a']),
        candidateIds: new Set(['candidate']),
        onRetain: vi.fn(),
        onReplay: vi.fn(),
        onCandidate: vi.fn(),
        isStale: () => false,
        onClose: vi.fn(),
        runtime: observationAccess,
        isCurrent: () => true
      })
    )
  )

  for (const id of ['a', 'b', 'c']) {
    await act(() =>
      host
        .querySelector<HTMLInputElement>(`[aria-label="Compare ${id}"]`)
        ?.click()
    )
  }

  expect(
    host.querySelector<HTMLInputElement>('[aria-label="Compare d"]')?.disabled
  ).toBe(true)

  await act(() => button('Compare selected runs (3/3)').click())

  const comparison = host.querySelector('[aria-label="Run comparison"]')

  expect(comparison?.textContent).toContain('Not directly comparable')

  expect(comparison?.textContent).toContain('Decision rules differ')

  expect(
    comparison?.querySelectorAll('.comparison-columns > article')
  ).toHaveLength(3)

  expect(comparison?.textContent).toContain('rule.minimumClearance')

  expect(comparison?.textContent).toContain('unresolved/missing pairs')
})

it('retains the exact result and reports failure without claiming acknowledgement', async () => {
  const run = record('a')

  const onRetain = vi.fn(async () => {
    throw new Error('Missing source candidate')
  })

  const props = {
    runs: [run],
    retainedIds: new Set<string>(),
    candidateIds: new Set(['candidate']),
    onRetain,
    onReplay: vi.fn(),
    onCandidate: vi.fn(),
    isStale: () => false,
    onClose: vi.fn(),
    runtime: observationAccess,
    isCurrent: () => true
  }

  await act(() => root.render(createElement(RunLibrary, props)))

  await act(async () => {
    button('Retain selected result').click()

    await Promise.resolve()
  })

  expect(onRetain).toHaveBeenCalledWith(run)

  expect(host.querySelector('[role="alert"]')?.textContent).toBe(
    'Missing source candidate'
  )

  expect(host.querySelector('.run-detail')?.textContent).toContain(
    'Temporary result'
  )

  await act(() =>
    root.render(
      createElement(RunLibrary, { ...props, retainedIds: new Set(['a']) })
    )
  )

  expect(button('Retain selected result').disabled).toBe(true)

  expect(host.querySelector('.run-detail')?.textContent).toContain(
    'Retained in project'
  )
})
