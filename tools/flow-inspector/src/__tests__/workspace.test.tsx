import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorkspaceApp } from '../App'
import { parseWorkspaceRoute, targetHref } from '../routing'
import type { WorkspaceBundle } from '../types'

const bundle: WorkspaceBundle = {
  schema: { id: 'flow-inspector-workspace-bundle', version: 1 },
  generatedFrom: { discoveryRoots: [], candidatePaths: [] },
  exclusions: [
    { path: 'docs/retired-flow-inspector.data.cjs', reason: 'superseded' }
  ],
  entries: [
    {
      id: 'app-flow',
      title: 'App Flow',
      kind: 'flow-v2',
      group: 'Apps',
      subgroup: 'Asyra Design',
      lifecycle: 'current',
      sourcePath: 'docs/app-flow-inspector.data.cjs',
      standalonePath: 'docs/app-flow-inspector.html',
      labels: ['app', 'flow-v2'],
      data: { target: { id: 'app-flow' } }
    },
    {
      id: 'framework-flow',
      title: 'Framework Flow',
      kind: 'legacy-v1',
      group: 'Framework',
      subgroup: 'Architecture',
      lifecycle: 'retained',
      sourcePath: 'docs/framework-flow-inspector.data.cjs',
      standalonePath: null,
      labels: ['framework', 'legacy-v1'],
      data: { target: { id: 'framework-flow' } }
    },
    {
      id: 'release-flow',
      title: 'Release Flow',
      kind: 'plan-contract',
      group: 'Release',
      subgroup: 'Distribution',
      lifecycle: 'current',
      sourcePath: 'docs/release-flow-inspector.data.cjs',
      standalonePath: null,
      labels: ['release', 'plan-contract'],
      data: {}
    },
    {
      id: 'tool-flow',
      title: 'Tool Flow',
      kind: 'flow-v2',
      group: 'Tools',
      subgroup: 'Flow Inspector',
      lifecycle: 'current',
      sourcePath: 'docs/tool-flow-inspector.data.cjs',
      standalonePath: null,
      labels: ['tool', 'flow-v2'],
      data: { target: { id: 'tool-flow' } }
    }
  ]
}

describe('workspace routing contract', () => {
  it('keeps the public hash stable and gives targets a cross-document identity', () => {
    expect(parseWorkspaceRoute('', bundle)).toEqual({ kind: 'overview' })
    expect(parseWorkspaceRoute('#inspector=app-flow', bundle)).toMatchObject({
      kind: 'selected',
      entry: bundle.entries[0]
    })
    expect(targetHref('app-flow')).toBe(
      './target.html?inspector=app-flow#inspector=app-flow'
    )
  })

  it('rejects unknown and excluded routes without fallback', () => {
    expect(parseWorkspaceRoute('#inspector=missing', bundle)).toMatchObject({
      kind: 'error'
    })
    expect(parseWorkspaceRoute('#inspector=retired', bundle)).toMatchObject({
      kind: 'error'
    })
  })
})

describe('React workspace', () => {
  it('renders Overview and all four catalog groups without runtime claims', () => {
    render(<WorkspaceApp bundle={bundle} initialHash="" />)
    expect(screen.getByRole('heading', { name: /one place/i })).toBeTruthy()
    expect(screen.getAllByTestId('inspector-entry')).toHaveLength(4)
    for (const group of ['Apps', 'Framework', 'Release', 'Tools']) {
      expect(screen.getByTestId(`group-${group}`)).toBeTruthy()
    }
    expect(document.body.textContent).not.toMatch(/runtime healthy/i)
    expect(screen.queryByText('Static')).toBeNull()
  })

  it('filters catalog entries without changing the active route', () => {
    render(<WorkspaceApp bundle={bundle} initialHash="#inspector=app-flow" />)
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'legacy-v1' }
    })
    expect(screen.getAllByTestId('inspector-entry')).toHaveLength(1)
    expect(
      screen.getByTitle('Selected Flow Inspector').getAttribute('src')
    ).toBe(targetHref('app-flow'))
  })

  it('collapses groups without changing catalog membership', () => {
    render(<WorkspaceApp bundle={bundle} initialHash="" />)
    const framework = screen.getByTestId('group-Framework')
    const toggle = framework.querySelector('.group-toggle')
    if (!toggle) throw new Error('Missing Framework group toggle')
    fireEvent.click(toggle)
    expect(within(framework).queryByTestId('inspector-entry')).toBeNull()
    fireEvent.click(toggle)
    expect(within(framework).getByTestId('inspector-entry')).toBeTruthy()
  })

  it('uses the selected id as the iframe key so rapid switching replaces the document', () => {
    const { rerender } = render(
      <WorkspaceApp bundle={bundle} initialHash="#inspector=app-flow" />
    )
    const firstFrame = screen.getByTitle('Selected Flow Inspector')
    rerender(
      <WorkspaceApp bundle={bundle} initialHash="#inspector=framework-flow" />
    )
    const finalFrame = screen.getByTitle('Selected Flow Inspector')
    expect(finalFrame).not.toBe(firstFrame)
    expect(finalFrame.getAttribute('src')).toBe(targetHref('framework-flow'))
  })

  it('toggles the catalog without changing or replacing the selected target', () => {
    render(<WorkspaceApp bundle={bundle} initialHash="#inspector=app-flow" />)
    const frame = screen.getByTitle('Selected Flow Inspector')
    expect(
      screen.queryByRole('toolbar', { name: 'Inspector panels' })
    ).toBeNull()
    const catalog = screen.getByRole('complementary', {
      name: 'Inspector catalog'
    })
    const closeCatalog = within(catalog).getByRole('button', {
      name: 'Close Inspector catalog'
    })
    expect(closeCatalog.textContent).toBe('×')
    fireEvent.click(closeCatalog)
    expect(
      screen.queryByRole('complementary', { name: 'Inspector catalog' })
    ).toBeNull()
    expect(screen.getByTitle('Selected Flow Inspector')).toBe(frame)
    fireEvent(
      window,
      new MessageEvent('message', {
        source: (frame as HTMLIFrameElement).contentWindow,
        data: {
          type: 'flow-inspector:panel-visibility',
          panel: 'catalog',
          visible: true
        }
      })
    )
    expect(
      screen.getByRole('complementary', { name: 'Inspector catalog' })
    ).toBeTruthy()
    expect(screen.getByTitle('Selected Flow Inspector')).toBe(frame)
  })

  it('accepts catalog toggle messages only from the selected target', () => {
    render(<WorkspaceApp bundle={bundle} initialHash="#inspector=app-flow" />)
    const frame = screen.getByTitle(
      'Selected Flow Inspector'
    ) as HTMLIFrameElement
    fireEvent(
      window,
      new MessageEvent('message', {
        source: frame.contentWindow,
        data: {
          type: 'flow-inspector:panel-visibility',
          panel: 'catalog',
          visible: false
        }
      })
    )

    expect(
      screen.queryByRole('complementary', { name: 'Inspector catalog' })
    ).toBeNull()
  })
})
