import { useEffect, useMemo, useRef, useState } from 'react'
import { parseWorkspaceRoute, targetHref, workspaceHash } from './routing'
import type { InspectorGroup, WorkspaceBundle, WorkspaceEntry } from './types'

const groups: InspectorGroup[] = ['Apps', 'Framework', 'Release', 'Tools']

interface WorkspaceAppProps {
  bundle: WorkspaceBundle
  initialHash?: string
}

const searchableText = (entry: WorkspaceEntry) =>
  [entry.title, entry.id, entry.subgroup, ...entry.labels]
    .join(' ')
    .toLocaleLowerCase()

export function WorkspaceApp({ bundle, initialHash }: WorkspaceAppProps) {
  const [browserHash, setBrowserHash] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash
  )
  const [query, setQuery] = useState('')
  const [catalogVisible, setCatalogVisible] = useState(true)
  const [headerVisible, setHeaderVisible] = useState(true)
  const [detailsVisible, setDetailsVisible] = useState(true)
  const targetFrameRef = useRef<HTMLIFrameElement>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<InspectorGroup>>(
    new Set()
  )
  const activeHash = initialHash ?? browserHash
  const route = useMemo(
    () => parseWorkspaceRoute(activeHash, bundle),
    [activeHash, bundle]
  )

  useEffect(() => {
    if (initialHash !== undefined) return
    const updateHash = () => setBrowserHash(window.location.hash)
    window.addEventListener('hashchange', updateHash)
    return () => window.removeEventListener('hashchange', updateHash)
  }, [initialHash])

  useEffect(() => {
    const receivePanelVisibility = (event: MessageEvent) => {
      const message = event.data
      if (event.source !== targetFrameRef.current?.contentWindow) return
      if (message?.type !== 'flow-inspector:panel-visibility') return
      if (typeof message.visible !== 'boolean') return
      if (message.panel === 'catalog') setCatalogVisible(message.visible)
      if (message.panel === 'header') setHeaderVisible(message.visible)
      if (message.panel === 'details') setDetailsVisible(message.visible)
    }
    window.addEventListener('message', receivePanelVisibility)
    return () => window.removeEventListener('message', receivePanelVisibility)
  }, [])

  const navigate = (id: string | null) => {
    window.location.hash = id ? workspaceHash(id) : ''
    setBrowserHash(window.location.hash)
  }

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleEntries = bundle.entries.filter(
    (entry) =>
      !normalizedQuery || searchableText(entry).includes(normalizedQuery)
  )

  const toggleGroup = (group: InspectorGroup) => {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  const sendPanelVisibility = (
    panel: 'catalog' | 'header' | 'details',
    visible: boolean
  ) => {
    targetFrameRef.current?.contentWindow?.postMessage(
      {
        type: 'flow-inspector:set-panel-visibility',
        panel,
        visible
      },
      '*'
    )
  }

  const syncTargetPanels = () => {
    sendPanelVisibility('catalog', catalogVisible)
    sendPanelVisibility('header', headerVisible)
    sendPanelVisibility('details', detailsVisible)
  }

  return (
    <div
      className={`workspace-shell${catalogVisible ? '' : ' is-catalog-collapsed'}`}
    >
      <aside
        className="sidebar"
        aria-label="Inspector catalog"
        hidden={!catalogVisible}
      >
        <button
          className="panel-close-button"
          type="button"
          aria-label="Close Inspector catalog"
          onClick={() => setCatalogVisible(false)}
        >
          ×
        </button>
        <div className="brand">
          <h1>Flow Inspector</h1>
        </div>
        <button
          className="overview-link"
          type="button"
          aria-current={route.kind === 'overview' ? 'page' : undefined}
          onClick={() => navigate(null)}
        >
          Overview
        </button>
        <label className="search-field">
          <span className="eyebrow">Search catalog</span>
          <input
            className="search"
            type="search"
            value={query}
            placeholder="Title, id, subgroup, label"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <nav className="catalog" aria-label="Available Inspectors">
          {groups.map((group) => {
            const entries = visibleEntries.filter(
              (entry) => entry.group === group
            )
            const collapsed = collapsedGroups.has(group)
            return (
              <section
                className="group"
                data-testid={`group-${group}`}
                key={group}
              >
                <button
                  className="group-toggle"
                  type="button"
                  aria-label={`${group} ${entries.length}`}
                  aria-expanded={!collapsed}
                  onClick={() => toggleGroup(group)}
                >
                  <span>{group}</span>
                  <span>{entries.length}</span>
                </button>
                {!collapsed && (
                  <div className="group-items">
                    {entries.map((entry) => (
                      <button
                        className="inspector-link"
                        data-testid="inspector-entry"
                        type="button"
                        aria-current={
                          route.kind === 'selected' &&
                          route.entry.id === entry.id
                            ? 'page'
                            : undefined
                        }
                        key={entry.id}
                        onClick={() => navigate(entry.id)}
                      >
                        <span>{entry.title}</span>
                        <small>
                          {entry.subgroup} - {entry.kind}
                        </small>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </nav>
      </aside>
      <main className="workspace-main">
        {route.kind === 'overview' && <Overview bundle={bundle} />}
        {route.kind === 'selected' && (
          <iframe
            className="target-frame"
            ref={targetFrameRef}
            key={route.entry.id}
            src={targetHref(route.entry.id)}
            title="Selected Flow Inspector"
            onLoad={syncTargetPanels}
          />
        )}
        {route.kind === 'error' && (
          <section className="route-error">
            <p className="eyebrow">Route error</p>
            <h2>Inspector “{route.id}” is not available.</h2>
            <p>
              {route.excluded
                ? 'This Inspector is explicitly excluded from the current catalog.'
                : 'No fallback target was selected.'}
            </p>
          </section>
        )}
      </main>
    </div>
  )
}

function Overview({ bundle }: { bundle: WorkspaceBundle }) {
  const metrics = [
    ['Inspectors', bundle.entries.length],
    [
      'Flow v2',
      bundle.entries.filter((entry) => entry.kind === 'flow-v2').length
    ],
    [
      'Compatibility',
      bundle.entries.filter((entry) => entry.kind !== 'flow-v2').length
    ],
    ['Explicit exclusions', bundle.exclusions.length]
  ] as const

  return (
    <section className="overview">
      <p className="eyebrow">Current project catalog</p>
      <h2>One place to read every current Inspector.</h2>
      <p className="lede">
        This is static documentation: it describes contracts and planned flow,
        but does not claim runtime status, execute commands, or decide CI
        acceptance.
      </p>
      <div className="metrics">
        {metrics.map(([label, value]) => (
          <article className="metric" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </div>
    </section>
  )
}
