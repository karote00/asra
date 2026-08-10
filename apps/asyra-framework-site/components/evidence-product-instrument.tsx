export function EvidenceProductInstrument() {
  return (
    <figure className="evidence-product-instrument">
      <div className="evidence-product-instrument__label">
        <span>REFERENCE PRODUCT / COMPOSITION MAP</span>
        <span>APP 01 · LIVE PUBLIC SURFACE</span>
      </div>
      <div className="evidence-product-instrument__screen" aria-hidden="true">
        <div className="evidence-product-instrument__tools">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <svg viewBox="0 0 920 420">
          <g className="product-instrument__grid">
            <path d="M0 70h920M0 140h920M0 210h920M0 280h920M0 350h920" />
            <path d="M92 0v420M184 0v420M276 0v420M368 0v420M460 0v420M552 0v420M644 0v420M736 0v420M828 0v420" />
          </g>
          <g className="product-instrument__model">
            <path d="m338 94 224 0 96 92-224 0z" />
            <path d="m338 94 96 92v150l-96-92z" />
            <path d="m434 186 224 0v150H434z" />
            <path d="m392 142 224 0M386 278h224M498 94v242M562 94v242" />
          </g>
          <g className="product-instrument__nodes">
            <circle cx="338" cy="94" r="6" />
            <circle cx="562" cy="94" r="6" />
            <circle cx="658" cy="186" r="6" />
            <circle cx="434" cy="336" r="6" />
          </g>
          <path className="product-instrument__measure" d="M300 370h400" />
        </svg>
        <div className="evidence-product-instrument__panel">
          <span>SELECTED MODEL</span>
          <strong>Information / 01</strong>
          <dl>
            <div>
              <dt>Intent</dt>
              <dd>App</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>Canonical</dd>
            </div>
            <div>
              <dt>View</dt>
              <dd>Projection</dd>
            </div>
          </dl>
        </div>
      </div>
      <figcaption>
        <span>
          <strong>Your App</strong> defines product meaning, tools, and domain
          rules.
        </span>
        <span>
          <strong>Asyra Framework</strong> keeps the reusable runtime path
          predictable.
        </span>
      </figcaption>
    </figure>
  )
}
