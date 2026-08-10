import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const route = [
  ['01', 'Intent', 'A person or machine asks for one product action.'],
  ['02', 'Feature', 'The app controls the action session and priority.'],
  ['03', 'Common API', 'One public route expresses the accepted mutation.'],
  ['04', 'Factory transaction', 'One durability boundary settles the action.'],
  ['05', 'Canonical owners', 'Each state slice validates and owns its truth.'],
  [
    '06',
    'Projection',
    'Screens, renderers, and transports observe the result.'
  ],
  ['07', 'Accepted result', 'The product receives one inspectable outcome.']
] as const

export function LandingTopology() {
  return (
    <section aria-labelledby="topology-heading" className="landing-topology">
      <header className="landing-topology__header">
        <p className="section-eyebrow">Runtime Atlas / one state, many views</p>
        <div>
          <h2 id="topology-heading">Predictable from request to result.</h2>
          <p>
            The names become technical here because the ownership matters. The
            route stays the same whether intent begins in a pointer, a command,
            an imported document, or an app-authorized AI action.
          </p>
        </div>
      </header>

      <div className="landing-topology__diagram">
        <ol aria-label="Intent to accepted result">
          {route.map(([coordinate, label, description]) => (
            <li key={coordinate}>
              <span>{coordinate}</span>
              <div>
                <strong>{label}</strong>
                <p>{description}</p>
              </div>
              <ArrowRight aria-hidden="true" size={18} />
            </li>
          ))}
        </ol>

        <div className="landing-topology__annotations">
          <aside className="landing-topology__optional">
            <p className="technical-label">Optional composition</p>
            <h3>Preset · Provider</h3>
            <p>
              Adopt official defaults or replace a provider where its contract
              permits. Neither becomes mandatory infrastructure or app meaning.
            </p>
          </aside>
          <aside className="landing-topology__projection">
            <p className="technical-label">Rebuildable edge</p>
            <h3>Projection observes; it does not own.</h3>
            <p>
              A renderer, panel, export, or machine consumer can be replaced and
              rebuilt from accepted owner state.
            </p>
          </aside>
        </div>
      </div>

      <footer className="landing-topology__atlas">
        <div>
          <p className="technical-label">From explanation to evidence</p>
          <h3>Runtime Atlas owns the executable proof.</h3>
          <p>
            Inspect real cases, accepted state, ownership, and failure
            boundaries in the dedicated Atlas instead of trusting a decorative
            simulation.
          </p>
        </div>
        <Link className="landing-action landing-action--dark" href="/atlas">
          Open Runtime Atlas
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </footer>
    </section>
  )
}
