export default function Loading() {
  return (
    <div aria-live="polite" className="foundation-status" role="status">
      <div aria-hidden="true" className="foundation-status__coordinate">
        WAIT / VERIFIED INPUT
      </div>
      <p className="section-eyebrow">Preparing the requested public surface</p>
      <h1>Loading accepted content.</h1>
      <div className="foundation-status__message">
        <p>
          The final geometry is reserved. No placeholder product output is
          shown.
        </p>
      </div>
    </div>
  )
}
