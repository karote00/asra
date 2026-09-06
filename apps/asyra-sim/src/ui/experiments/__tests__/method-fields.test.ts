// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSyntheticExperimentDraft } from '../../../../samples/synthetic-experiment'
import { createSyntheticExample } from '../../../../samples/synthetic-workcell'
import type { ExperimentDraft } from '../../../common-apis/experiment'
import { INSTALLED_METHOD_CATALOG } from '../../../extensions/installed-methods'
import { ExperimentFields } from '../experiment-fields'

let host: HTMLDivElement

let root: Root

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

async function setup(methods = INSTALLED_METHOD_CATALOG.descriptors) {
  let draft: ExperimentDraft = createSyntheticExperimentDraft(example)

  const original = structuredClone(draft)

  const render = () =>
    root.render(
      createElement(ExperimentFields, {
        draft,
        onChange: (next) => {
          draft = next

          render()
        },
        exclusions: '',
        onExclusions: vi.fn(),
        workcell: example.workcell,
        methods
      })
    )

  await act(render)

  return { original, draft: () => draft }
}

async function select(value: string) {
  const element = host.querySelector<HTMLSelectElement>(
    '[aria-label="Analysis method"]'
  )

  if (!element) throw new Error('Missing method selector')

  await act(() => {
    element.value = value

    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

async function editParameter(value: string) {
  const element = host.querySelector<HTMLInputElement>(
    '[aria-label="Method parameter additionalError"]'
  )

  if (!element) throw new Error('Missing parameter field')

  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set?.call(element, value)

    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

it('selects installed method defaults and edits bounded parameters only in the draft', async () => {
  const state = await setup()

  const exampleMethod = INSTALLED_METHOD_CATALOG.descriptors[1]

  await select(`${exampleMethod.id}@${exampleMethod.version}`)

  expect(state.draft().method.settings.parameters).toEqual({
    additionalError: 0
  })

  const parameter = host.querySelector<HTMLInputElement>(
    '[aria-label="Method parameter additionalError"]'
  )

  expect(parameter?.min).toBe('0')

  expect(parameter?.max).toBe('0.001')

  await editParameter('0.0005')

  expect(state.draft().method.settings.parameters).toEqual({
    additionalError: 0.0005
  })

  expect(state.original.method.settings.parameters).toBeUndefined()

  await editParameter('')

  expect(state.draft().method.settings.parameters).toEqual({})

  expect(host.textContent).toContain(
    'Required method parameters are missing or outside their declared limits'
  )

  const official = INSTALLED_METHOD_CATALOG.descriptors[0]

  await select(`${official.id}@${official.version}`)

  expect(state.draft().method.settings.parameters).toEqual({})

  expect(
    host.querySelector('[aria-label="Method parameter additionalError"]')
  ).toBeNull()
})

it('discloses example provenance, unsupported motion, and validation without an endorsement', async () => {
  await setup()

  const method = INSTALLED_METHOD_CATALOG.descriptors[1]

  await select(`${method.id}@${method.version}`)

  expect(host.textContent).toContain('Origin: example')

  expect(host.textContent).toContain('Motion: unsupported')

  expect(host.textContent).toContain('Declared validation: unverified')

  expect(host.textContent).toContain('not a safety certification')

  expect(host.textContent).toContain('additionalError widens bounds')
})

it('uses typed boolean and enum controls and renders private declarations as inert text', async () => {
  const method = structuredClone(INSTALLED_METHOD_CATALOG.descriptors[1])

  method.manifest.origin = 'private'

  method.manifest.author = '<img src=x onerror=alert(1)>'

  method.parameterSchema = {
    ...method.parameterSchema,
    enabled: { kind: 'boolean', label: 'Enabled', default: true },
    mode: {
      kind: 'enum',
      label: 'Mode',
      default: 'strict',
      values: ['strict', 'conservative']
    }
  }

  const state = await setup([method])

  await select(`${method.id}@${method.version}`)

  for (const [key, value] of [
    ['enabled', 'false'],
    ['mode', 'conservative']
  ]) {
    const field = host.querySelector<HTMLSelectElement>(
      `[aria-label="Method parameter ${key}"]`
    )

    if (!field) throw new Error('Missing typed method parameter')

    await act(() => {
      field.value = value

      field.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  expect(state.draft().method.settings.parameters).toEqual({
    additionalError: 0,
    enabled: false,
    mode: 'conservative'
  })

  expect(host.textContent).toContain('Origin: private')

  expect(host.textContent).toContain('<img src=x onerror=alert(1)>')

  expect(host.querySelector('img')).toBeNull()
})
