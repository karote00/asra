import type { AtlasRunSnapshot } from '@/lib/runtime-atlas/runtime.mjs'

const readable = (value: unknown) =>
  typeof value === 'string' ? value : JSON.stringify(value, null, 2)

export function RuntimeAtlasProjection({
  snapshot
}: Readonly<{ snapshot?: AtlasRunSnapshot }>) {
  const entries = snapshot
    ? Object.entries(snapshot.result).filter(([, value]) => value !== undefined)
    : []

  return (
    <section aria-labelledby="projection-title" className="atlas-projection">
      <header>
        <p>App-owned projection</p>
        <h3 id="projection-title">Returned runtime result</h3>
      </header>
      {entries.length ? (
        <dl>
          {entries.slice(0, 6).map(([label, value]) => (
            <div key={label}>
              <dt>{label.replaceAll(/([A-Z])/g, ' $1')}</dt>
              <dd>
                <pre>{readable(value)}</pre>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="atlas-projection__empty">
          Run or step the case. This surface only renders evidence returned by
          the isolated runtime.
        </p>
      )}
    </section>
  )
}
