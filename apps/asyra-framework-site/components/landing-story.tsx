const story = [
  {
    label: 'Describe',
    title: 'Bring your domain',
    body: 'Model the information your product understands. Names, geometry, relationships, constraints, and meaning remain yours.'
  },
  {
    label: 'Act',
    title: 'Define what can happen',
    body: 'Turn a person or machine’s intent into one controlled action. Your rules decide what is allowed to change.'
  },
  {
    label: 'Verify',
    title: 'Inspect every outcome',
    body: 'Follow the accepted path back to its owners. Given the same state and intent, the same rules lead to the same accepted outcome.'
  }
] as const

export function LandingStory() {
  return (
    <section aria-labelledby="story-heading" className="landing-story">
      <header className="landing-section-heading landing-section-heading--compact">
        <p className="section-eyebrow">A predictable way to build</p>
        <h2 id="story-heading">Describe. Act. Verify.</h2>
        <p>
          Asyra separates what your product knows from the infrastructure that
          moves an intention toward an accepted result.
        </p>
      </header>

      <ol>
        {story.map(({ label, title, body }, index) => (
          <li key={label}>
            <div className="landing-story__coordinate">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <span>{label}</span>
            </div>
            <div className="landing-story__copy">
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
