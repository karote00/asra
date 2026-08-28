interface EvidenceItem {
  label: string
  value: string
}

export function EvidenceStrip({ items }: { items: readonly EvidenceItem[] }) {
  return (
    <dl className="evidence-strip">
      {items.map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
