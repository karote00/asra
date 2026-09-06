// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSyntheticExperimentDraft } from '../../../../samples/synthetic-experiment'
import { createSyntheticExample } from '../../../../samples/synthetic-workcell'
import type { SimRuntime } from '../../../init/bootstrap'
import { TrajectoryImportPanel } from '../../imports/trajectory-import-panel'
import { ExperimentPanel } from '../experiment-panel'
import { ViewSource } from '../../shared/view-source'
import type { ExperimentInputs } from '../experiment-inputs'

const renders = vi.hoisted(() => ({ layout: 0, picker: 0, scopeRows: 0 }))

vi.mock('react/jsx-dev-runtime', async (original) => {
  const actual = await original<typeof import('react/jsx-dev-runtime')>()

  return {
    ...actual,
    jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => {
      const props = args[1] as { className?: string; 'aria-label'?: string }

      if (props?.className?.startsWith('experiment-panel ')) renders.layout++

      if (props?.className?.startsWith('experiment-picker ')) renders.picker++

      if (props?.['aria-label']?.endsWith(' analysis role')) renders.scopeRows++

      return actual.jsxDEV(...args)
    }
  }
})

let inputSource: ViewSource<ExperimentInputs> | undefined

function renderExperiment(input: ExperimentInputs) {
  if (inputSource) inputSource.publish(input)
  else {
    inputSource = new ViewSource(input)

    root.render(createElement(ExperimentPanel, { inputs: inputSource }))
  }
}

let host: HTMLDivElement

let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

  inputSource = undefined

  host = document.createElement('div')

  document.body.append(host)

  root = createRoot(host)
})

afterEach(async () => {
  await act(() => root.unmount())

  host.remove()

  vi.unstubAllGlobals()
})

const example = createSyntheticExample()

const draft = createSyntheticExperimentDraft(example)

const experiment = {
  id: 'study',
  candidateId: 'candidate',
  name: 'Study',
  definition: { ...draft, revision: 1, rule: { ...draft.rule, revision: 1 } }
}

const runtime = {
  getExperiments: vi.fn(() => [structuredClone(experiment)]),
  getMethodDescriptors: () => [
    { id: draft.method.id, version: draft.method.version }
  ]
} as unknown as SimRuntime

const button = (name: string) =>
  [...host.querySelectorAll('button')].find((node) => node.textContent === name)

it('preserves an unapplied experiment draft when the workcell changes', async () => {
  const onPlayback = vi.fn()

  const perform = vi.fn()

  const render = (revision: number) =>
    renderExperiment({
      runtime,
      candidateId: 'candidate',
      workcell: example.workcell,
      revision,
      perform,
      onPlayback,
      runs: [],
      retainedIds: new Set<string>(),
      onRun: vi.fn(),
      onOpenRuns: vi.fn(),
      onVisualPreview: vi.fn(),
      isCurrent: () => true,
      visualImportActive: true
    })

  await act(() => render(1))

  renders.layout = renders.picker = renders.scopeRows = 0

  const field = host.querySelector<HTMLInputElement>(
    '[aria-label="Minimum clearance (mm)"]'
  )

  if (!field) throw new Error('Missing clearance field')

  await act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set

    if (!setter) throw new Error('Missing value setter')

    setter.call(field, '75')

    field.dispatchEvent(new Event('input', { bubbles: true }))
  })

  expect(field.value).toBe('75')

  expect(renders).toEqual({ layout: 0, picker: 0, scopeRows: 0 })

  await act(() => render(2))

  expect(field.value).toBe('75')
})

it('exposes a new experiment draft even when a saved experiment exists', async () => {
  await act(() =>
    renderExperiment({
      runtime,
      candidateId: 'candidate',
      workcell: example.workcell,
      revision: 1,
      perform: vi.fn(),
      onPlayback: vi.fn(),
      runs: [],
      retainedIds: new Set<string>(),
      onRun: vi.fn(),
      onOpenRuns: vi.fn(),
      onVisualPreview: vi.fn(),
      isCurrent: () => true,
      visualImportActive: true
    })
  )

  expect(button('New experiment')).toBeDefined()

  expect(
    host.querySelector<HTMLInputElement>(
      '[aria-label="Global interval budget"]'
    )?.max
  ).toBe('1000000')

  expect(
    host.querySelector<HTMLInputElement>('[aria-label="Wall-time budget (ms)"]')
      ?.min
  ).toBe('100')

  expect(
    host.querySelector<HTMLInputElement>('[aria-label="Wall-time budget (ms)"]')
      ?.max
  ).toBe('120000')

  await act(() => button('New experiment')?.click())

  expect(button('Create experiment')).toBeDefined()
})

it('draft-only changes do not recapture canonical experiments', async () => {
  const onPlayback = vi.fn()

  await act(() =>
    renderExperiment({
      runtime,
      candidateId: 'candidate',
      workcell: example.workcell,
      revision: 1,
      perform: vi.fn(),
      onPlayback,
      runs: [],
      retainedIds: new Set<string>(),
      onRun: vi.fn(),
      onOpenRuns: vi.fn(),
      onVisualPreview: vi.fn(),
      isCurrent: () => true,
      visualImportActive: true
    })
  )

  vi.mocked(runtime.getExperiments).mockClear()

  await act(() => button('New experiment')?.click())

  expect(button('Create experiment')).toBeDefined()

  expect(runtime.getExperiments).not.toHaveBeenCalled()
})

it('shows mapped canonical columns before preview and invalidates acceptance after a mapping change', async () => {
  await act(() =>
    root.render(
      createElement(TrajectoryImportPanel, {
        workcell: example.workcell,
        trajectory: example.trajectory,
        onAccept: vi.fn()
      })
    )
  )

  const timeColumn = host.querySelector('select')

  if (!timeColumn) throw new Error('Missing CSV column selector')

  expect(timeColumn.value).toBe('time')

  await act(() => button('Preview trajectory')?.click())

  expect(button('Accept into draft')).toBeDefined()

  const unit = host.querySelectorAll('select')[1]

  await act(() => {
    unit.value = 'ms'

    unit.dispatchEvent(new Event('change', { bubbles: true }))
  })

  expect(button('Accept into draft')).toBeUndefined()
})
