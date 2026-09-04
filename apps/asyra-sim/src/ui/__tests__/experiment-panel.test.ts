// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import type { SimRuntime } from '../../init/bootstrap'
import { ExperimentPanel } from '../experiment-panel'
import { TrajectoryImportPanel } from '../trajectory-import-panel'

let host: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
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
  getExperiments: () => [structuredClone(experiment)],
  getMethodDescriptors: () => [
    { id: draft.method.id, version: draft.method.version }
  ]
} as unknown as SimRuntime
const button = (name: string) =>
  [...host.querySelectorAll('button')].find((node) => node.textContent === name)

it('preserves an unapplied experiment draft when the workcell changes', async () => {
  const onPlayback = vi.fn(),
    perform = vi.fn()
  const render = (revision: number) =>
    root.render(
      createElement(ExperimentPanel, {
        runtime,
        candidateId: 'candidate',
        workcell: example.workcell,
        revision,
        perform,
        onPlayback
      })
    )
  await act(() => render(1))
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
  await act(() => render(2))
  expect(field.value).toBe('75')
})

it('exposes a new experiment draft even when a saved experiment exists', async () => {
  await act(() =>
    root.render(
      createElement(ExperimentPanel, {
        runtime,
        candidateId: 'candidate',
        workcell: example.workcell,
        revision: 1,
        perform: vi.fn(),
        onPlayback: vi.fn()
      })
    )
  )
  expect(button('New experiment')).toBeDefined()
  await act(() => button('New experiment')?.click())
  expect(button('Create experiment')).toBeDefined()
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
