// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createSyntheticExperimentDraft } from '../../../../samples/synthetic-experiment'
import { createSyntheticExample } from '../../../../samples/synthetic-workcell'
import { ExperimentFields } from '../experiment-fields'

const roles = vi.hoisted(() => new Map<string, number>())

vi.mock('react/jsx-dev-runtime', async (original) => {
  const actual = await original<typeof import('react/jsx-dev-runtime')>()

  return {
    ...actual,
    jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => {
      const label = (args[1] as { 'aria-label'?: string })?.['aria-label']

      if (label?.endsWith(' analysis role'))
        roles.set(label, (roles.get(label) ?? 0) + 1)

      return actual.jsxDEV(...args)
    }
  }
})

it('threshold edits do not rerender scope rows, and a role edit retains the latest threshold', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

  const example = createSyntheticExample()

  let draft = createSyntheticExperimentDraft(example)

  const host = document.createElement('div')

  const root = createRoot(host)

  const onChange = vi.fn((next) => {
    draft = next
  })

  const onExclusions = vi.fn()

  const render = () =>
    act(() =>
      root.render(
        createElement(ExperimentFields, {
          draft,
          onChange,
          onExclusions,
          exclusions: '',
          workcell: example.workcell,
          methods: []
        })
      )
    )

  try {
    await render()

    roles.clear()

    draft = { ...draft, rule: { ...draft.rule, minimumClearance: 0.075 } }

    await render()

    expect([...roles.keys()]).toEqual([])

    const select = host.querySelector<HTMLSelectElement>(
      '[aria-label="fixture post analysis role"]'
    )

    if (!select) throw new Error('Missing scope role')

    await act(() => {
      select.value = 'primary'

      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await render()

    expect(draft.rule.minimumClearance).toBe(0.075)

    expect(draft.scope.primaryBodyIds).toContain('example:fixture-post')

    expect([...roles.keys()]).toEqual(['fixture post analysis role'])
  } finally {
    await act(() => root.unmount())

    vi.unstubAllGlobals()
  }
})
