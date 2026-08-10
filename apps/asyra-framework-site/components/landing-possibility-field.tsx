const possibilities = [
  ['01', 'Design tools'],
  ['02', 'Whiteboards'],
  ['03', 'BIM and digital twins'],
  ['04', 'VR environments'],
  ['05', 'Industrial simulation'],
  ['06', 'Knowledge and decision products']
] as const

export function LandingPossibilityField() {
  return (
    <section
      aria-labelledby="possibility-heading"
      className="landing-possibility"
    >
      <header className="landing-section-heading">
        <p className="section-eyebrow">One infrastructure, many products</p>
        <h2 id="possibility-heading">Your field provides the meaning.</h2>
        <p>
          Asyra does not pretend to know architecture, manufacturing, chemistry,
          healthcare, or your craft. Your app owns that knowledge. The Framework
          keeps the infrastructure beneath it coherent.
        </p>
      </header>

      <div className="landing-possibility__sheet">
        <figure className="landing-possibility__figure">
          <svg
            aria-hidden="true"
            className="landing-possibility__drawing"
            viewBox="0 0 760 470"
          >
            <g className="landing-possibility__construction">
              <path d="M44 64H716M44 235H716M44 406H716" />
              <path d="M138 30V440M380 30V440M622 30V440" />
              <circle cx="380" cy="235" r="148" />
              <circle cx="380" cy="235" r="82" />
            </g>
            <g className="landing-possibility__routes">
              <path d="M380 153L200 88M462 235L650 154M380 317L558 390" />
              <path d="M298 235L112 314M380 153L518 68M462 235L670 302" />
            </g>
            <g className="landing-possibility__core">
              <rect height="104" width="164" x="298" y="183" />
              <text textAnchor="middle" x="380" y="225">
                YOUR DOMAIN
              </text>
              <text textAnchor="middle" x="380" y="251">
                MODEL + RULES
              </text>
            </g>
            <g className="landing-possibility__nodes">
              <circle cx="200" cy="88" r="9" />
              <circle cx="650" cy="154" r="9" />
              <circle cx="558" cy="390" r="9" />
              <circle cx="112" cy="314" r="9" />
              <circle cx="518" cy="68" r="9" />
              <circle cx="670" cy="302" r="9" />
            </g>
          </svg>
          <figcaption>
            App-owned possibilities — not built-in features
          </figcaption>
        </figure>

        <ol aria-label="Examples of products an App could own">
          {possibilities.map(([coordinate, label]) => (
            <li key={coordinate}>
              <span>{coordinate}</span>
              <strong>{label}</strong>
              <small>App knowledge</small>
            </li>
          ))}
        </ol>

        <aside className="landing-possibility__roadmap">
          <span aria-hidden="true" />
          <div>
            <p className="technical-label">Roadmap / future direction</p>
            <h3>Products made for machines to understand and act on.</h3>
            <p>
              Future machine-facing information products may help AI search and
              execute through explicit app-owned rules. This is a direction, not
              current release support.
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}
