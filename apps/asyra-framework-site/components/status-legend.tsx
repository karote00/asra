interface StatusLegendProps {
  compact?: boolean
}

export function StatusLegend({ compact = false }: StatusLegendProps) {
  return (
    <div
      className={
        compact ? 'status-legend status-legend--compact' : 'status-legend'
      }
    >
      <span data-status="current">
        <i aria-hidden="true" />
        Current Framework
      </span>
      <span data-status="app">
        <i aria-hidden="true" />
        App-owned possibility
      </span>
      <span data-status="roadmap">
        <i aria-hidden="true" />
        Verified roadmap
      </span>
    </div>
  )
}
