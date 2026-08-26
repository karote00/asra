const productSurfaces = [
  'Product screen',
  'AI action',
  'Saved work',
  'Undo + redo',
  'Synced users'
] as const

const changeBoundaries = [
  'Clear owner',
  'Focused review',
  'Focused tests',
  'Smaller change',
  'Easier revisit'
] as const

export function FrameworkValueStory() {
  return (
    <section
      aria-labelledby="framework-value-title"
      className="framework-value"
      id="framework-value"
    >
      <div className="framework-value__inner">
        <header className="framework-value__heading">
          <div>
            <p className="eyebrow">Change cost</p>
            <h2 id="framework-value-title">
              One feature request. One place to change.
            </h2>
          </div>
          <p>
            A small behavior change should not become five separate
            implementation tasks. With Asyra, the change stays inside the
            Feature that owns it.
          </p>
        </header>

        <div className="framework-value__comparison">
          <article className="framework-value__path framework-value__path--traditional">
            <div
              aria-hidden="true"
              className="framework-value__accent framework-value__accent--traditional"
            />
            <header>
              <p>Without Asyra</p>
              <h3>One request, many edits</h3>
              <span>
                Each product concern becomes another maintenance task.
              </span>
            </header>
            <div className="framework-value__flow">
              <ul className="framework-value__repeat-list">
                {productSurfaces.map((surface, index) => (
                  <li key={surface}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{surface}</strong>
                    <small>Separate edit</small>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className="framework-value__path framework-value__path--asyra">
            <div
              aria-hidden="true"
              className="framework-value__accent framework-value__accent--asyra"
            />
            <header>
              <p>With Asyra</p>
              <h3>One request, one bounded change</h3>
              <span>Update the Feature that owns the behavior.</span>
            </header>
            <div className="framework-value__flow">
              <div className="framework-value__feature">
                <span>One Feature definition</span>
                <strong>Change the behavior where it is owned.</strong>
              </div>
              <ul className="framework-value__shared-list">
                {changeBoundaries.map((boundary) => (
                  <li key={boundary}>{boundary}</li>
                ))}
              </ul>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
