export function EvidenceProductInstrument() {
  return (
    <figure className="evidence-product-instrument">
      <div className="evidence-product-instrument__label">
        <span>REFERENCE PRODUCT / LIVE COMPOSITION</span>
        <span>APP 01 · Asyra Design</span>
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
            <circle cx="460" cy="210" r="172" />
            <circle cx="460" cy="210" r="112" />
            <path d="M88 210h744M460 18v384" />
          </g>
          <g className="product-instrument__model">
            <path d="M460 210 278 110M460 210l210-78M460 210l176 130M460 210l-214 112" />
            <path d="M278 110 670 132 636 340 246 322Z" />
          </g>
          <g className="product-instrument__nodes">
            <circle cx="460" cy="210" r="28" />
            <circle cx="278" cy="110" r="12" />
            <circle cx="670" cy="132" r="12" />
            <circle cx="636" cy="340" r="12" />
            <circle cx="246" cy="322" r="12" />
          </g>
          <path className="product-instrument__measure" d="M154 378h612" />
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
