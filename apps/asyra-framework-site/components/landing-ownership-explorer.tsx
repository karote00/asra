'use client'

import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { AsyraMark } from '@/components/asyra-mark'

const owners = [
  {
    id: 'framework',
    label: 'Framework',
    coordinate: 'F / 01',
    summary: 'Framework owns reusable infrastructure.',
    owns: 'Lifecycle coordination, typed communication, canonical state contracts, transactions, validation, and replaceable boundaries.',
    leaves:
      'It does not know your profession, product language, workflows, permissions, or interface.'
  },
  {
    id: 'preset',
    label: 'Preset',
    coordinate: 'P / 02',
    summary: 'Preset offers optional official defaults.',
    owns: 'A selectable 2D baseline, official adapters, and design-tool-oriented defaults that an app may compose in whole or in part.',
    leaves:
      'It is not Core, a universal product, or a required source of app-domain knowledge.'
  },
  {
    id: 'app',
    label: 'App',
    coordinate: 'A / 03',
    summary: 'App owns domain knowledge and product policy.',
    owns: 'The information model, product Features, permissions, confirmations, provider choices, services, interface, and user promises.',
    leaves:
      'It uses Framework contracts without creating a second canonical truth or bypassing accepted transactions.'
  }
] as const

type OwnerId = (typeof owners)[number]['id']

export function LandingOwnershipExplorer() {
  return (
    <section
      aria-labelledby="ownership-heading"
      className="landing-ownership"
      id="why-asyra"
    >
      <header className="landing-section-heading">
        <p className="section-eyebrow">The Asyra Framework</p>
        <h2 id="ownership-heading">
          Deterministic by design. Composable by nature.
        </h2>
        <p>
          Asyra gives you the primitives to model information as code—clear,
          consistent, and composable. From concepts to runtime, every layer is
          built to scale with confidence.
        </p>
      </header>

      <div className="landing-ownership__architecture">
        <aside>
          <p className="technical-label">You bring</p>
          <ul>
            <li>Domain knowledge</li>
            <li>Business rules</li>
            <li>Data and schemas</li>
            <li>Product experience</li>
          </ul>
        </aside>
        <div aria-hidden="true" className="landing-ownership__layers">
          <span data-layer="experience">Experience layer</span>
          <span data-layer="information">Information layer</span>
          <span data-layer="runtime">Runtime layer</span>
          <span data-layer="foundation">Foundation layer</span>
          <strong>
            <AsyraMark />
          </strong>
        </div>
        <aside>
          <p className="technical-label">Asyra provides</p>
          <ul>
            <li>Deterministic runtime</li>
            <li>Executable models</li>
            <li>Consistency and lineage</li>
            <li>Replaceable projections</li>
          </ul>
        </aside>
      </div>
    </section>
  )
}

export function LandingOwnershipDetails() {
  const [selectedId, setSelectedId] = useState<OwnerId>('framework')
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const selected = owners.find(({ id }) => id === selectedId) ?? owners[0]

  const selectAt = (index: number) => {
    const normalized = (index + owners.length) % owners.length
    const owner = owners[normalized]
    setSelectedId(owner.id)
    tabRefs.current[normalized]?.focus()
  }

  const onTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      selectAt(index - 1)
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      selectAt(index + 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      selectAt(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      selectAt(owners.length - 1)
    }
  }

  return (
    <section
      aria-labelledby="owner-details-heading"
      className="landing-owner-details"
    >
      <header className="landing-section-heading landing-section-heading--compact">
        <p className="section-eyebrow">Know who owns what</p>
        <h2 id="owner-details-heading">Keep meaning and machinery separate.</h2>
        <p>
          Clear ownership lets a product grow without turning packages,
          providers, projections, and screens into competing sources of truth.
        </p>
      </header>

      <div className="landing-ownership__summary">
        {owners.map(({ coordinate, label, summary }) => (
          <article key={label}>
            <span>{coordinate}</span>
            <h3>{label}</h3>
            <p>{summary}</p>
          </article>
        ))}
      </div>

      <div className="landing-ownership__explorer">
        <div aria-label="Inspect an owner" role="tablist">
          {owners.map(({ id, label }, index) => (
            <button
              aria-controls={`owner-panel-${id}`}
              aria-selected={selectedId === id}
              id={`owner-tab-${id}`}
              key={id}
              onClick={() => setSelectedId(id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              ref={(node) => {
                tabRefs.current[index] = node
              }}
              role="tab"
              tabIndex={selectedId === id ? 0 : -1}
              type="button"
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              {label}
            </button>
          ))}
        </div>

        <div
          aria-labelledby={`owner-tab-${selected.id}`}
          className="landing-ownership__panel"
          id={`owner-panel-${selected.id}`}
          role="tabpanel"
        >
          <p className="technical-label">Selected owner / {selected.label}</p>
          <div>
            <h3>Owns</h3>
            <p>{selected.owns}</p>
          </div>
          <div>
            <h3>Leaves to others</h3>
            <p>{selected.leaves}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
