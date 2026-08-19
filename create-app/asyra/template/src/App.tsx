import logoUrl from './framework-logo.svg'

const gettingStartedGuide =
  'https://github.com/karote00/asyra/blob/main/docs/ai/framework/GETTING_STARTED.md'

const App = () => (
  <main className="home">
    <div className="brand" aria-labelledby="framework-title">
      <img
        className="brand__mark"
        src={logoUrl}
        alt="Asyra Framework logo"
        width="176"
        height="176"
      />
      <p className="brand__eyebrow">Deterministic infrastructure</p>
      <h1 id="framework-title">Asyra Framework</h1>
      <p className="brand__intro">
        Your React shell is running. Begin with one information model, one
        registered intent, and one canonical state path.
      </p>
      <a className="brand__link" href={gettingStartedGuide}>
        Read the Framework guide
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  </main>
)

export default App
