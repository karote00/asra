import { BookOpen, Boxes, Braces, CircleCheck, Network } from 'lucide-react'

const capabilities = [
  ['Deterministic runtime', CircleCheck],
  ['Executable models', Braces],
  ['Consistency & lineage', BookOpen],
  ['Projection engine', Network],
  ['Performance at scale', Boxes]
] as const

export function LandingCapabilityFlow() {
  return (
    <section
      className="landing-capability-flow"
      aria-label="Asyra capability flow"
    >
      <aside className="landing-capability-flow__inputs">
        <p className="technical-label">You bring</p>
        <ul>
          <li>Domain knowledge</li>
          <li>Business rules</li>
          <li>Data & schemas</li>
          <li>UX & workflows</li>
          <li>Industry context</li>
        </ul>
      </aside>

      <div className="landing-capability-flow__runtime">
        <p className="technical-label">Asyra provides</p>
        <ol>
          {capabilities.map(([label, Icon]) => (
            <li key={label}>
              <span>
                <Icon aria-hidden="true" size={18} strokeWidth={1.3} />
              </span>
              <strong>{label}</strong>
            </li>
          ))}
        </ol>
      </div>

      <aside className="landing-capability-flow__outcomes">
        <p className="technical-label">Outcomes</p>
        <ul>
          <li>Predictable outcomes</li>
          <li>Reusable models</li>
          <li>Faster delivery</li>
          <li>Infinite possibilities</li>
        </ul>
      </aside>

      <footer>// Infrastructure for domain-owned information products</footer>
    </section>
  )
}
