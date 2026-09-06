const routes = [
  {
    description: 'A person, AI, automation, or device requests new work.',
    inputs: ['Person', 'AI', 'Automation', 'Device'],
    label: 'Product intent',
    steps: [
      { label: 'Policy', value: 'Feature' },
      { label: 'Change', value: 'API + Transaction' }
    ]
  },
  {
    description: 'Saved or remote work returns through the owning boundary.',
    inputs: ['Load', 'Replay', 'Remote update'],
    label: 'Existing state',
    steps: [
      { label: 'Safety', value: 'Validate - Resolve' },
      { label: 'Apply', value: 'Apply API' }
    ]
  }
] as const

const owners = [
  'Scene tree',
  'Properties',
  'System context',
  'Selection'
] as const
const outputs = [
  'Render',
  'UI',
  'Search',
  'AI context',
  'Save',
  'Integrations'
] as const

export function FrameworkTechnicalFlow() {
  return (
    <section
      aria-labelledby="framework-flow-technical-title"
      className="framework-technical"
      id="framework-flow-technical"
    >
      <header className="framework-technical__heading">
        <p>Framework architecture</p>
        <h2 id="framework-flow-technical-title">Two routes. One authority.</h2>
        <span>
          New intent and returning state enter differently. Both must reach the
          same owners before the product updates.
        </span>
      </header>

      <div className="framework-technical__routes">
        {routes.map((route) => (
          <article className="framework-technical__route" key={route.label}>
            <header>
              <h3>{route.label}</h3>
            </header>
            <p>{route.description}</p>
            <ul className="framework-technical__inputs">
              {route.inputs.map((input) => (
                <li key={input}>{input}</li>
              ))}
            </ul>
            <ol className="framework-technical__steps">
              {route.steps.map((step) => (
                <li key={step.value}>
                  <small>{step.label}</small>
                  <strong>{step.value}</strong>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>

      <section className="framework-technical__owners">
        <header>
          <p>Shared authority</p>
          <h3>Canonical owners</h3>
          <span>Information and rules</span>
        </header>
        <ul>
          {owners.map((owner) => (
            <li key={owner}>{owner}</li>
          ))}
        </ul>
      </section>

      <footer className="framework-technical__outputs">
        <p>Used by the product</p>
        <ul>
          {outputs.map((output) => (
            <li key={output}>{output}</li>
          ))}
        </ul>
      </footer>
    </section>
  )
}
