interface AtlasNetworkProps {
  activeStep: number
  caseTitle: string
  status: string
}

const majorNodes = [
  { id: 'intent', label: 'Intent', tone: 'coral', x: 132, y: 284 },
  { id: 'feature', label: 'Feature', tone: 'coral', x: 246, y: 334 },
  { id: 'transaction', label: 'Transaction', tone: 'cyan', x: 356, y: 292 },
  { id: 'canonical', label: 'Canonical', tone: 'violet', x: 468, y: 344 },
  { id: 'projection', label: 'Projection', tone: 'violet', x: 578, y: 286 },
  { id: 'persistence', label: 'Persistence', tone: 'amber', x: 678, y: 370 }
] as const

const smallNodes = Array.from({ length: 38 }, (_, index) => ({
  id: `n-${index}`,
  tone: ['coral', 'cyan', 'violet', 'amber', 'green'][index % 5],
  x: 46 + ((index * 127 + index * index * 17) % 674),
  y: 110 + ((index * 71 + index * index * 13) % 346)
}))

const graphNodes = [...majorNodes, ...smallNodes]

const backgroundEdges = Array.from({ length: 52 }, (_, index) => {
  const from = graphNodes[index % graphNodes.length]
  const to = graphNodes[(index * 7 + 11) % graphNodes.length]
  return { from, id: `e-${index}`, to }
})

function MajorNodeIcon({ id }: { id: (typeof majorNodes)[number]['id'] }) {
  if (id === 'intent') {
    return (
      <>
        <circle r="8" />
        <circle r="3" />
        <path d="m4-4 8-8m-1 0h-5m5 0v5" />
      </>
    )
  }
  if (id === 'feature') {
    return <path d="M-8-8h6v6h-6Zm10 0h6v6H2ZM-8 2h6v6h-6Zm10 0h6v6H2Z" />
  }
  if (id === 'transaction') {
    return <path d="m2-12-10 14h8l-2 10L8-2H0Z" />
  }
  if (id === 'canonical') {
    return <path d="m-9-5 9-5 9 5v10L0 10-9 5Zm0 0L0 0l9-5M0 0v10" />
  }
  if (id === 'projection') {
    return (
      <>
        <path d="M-12 0c6-8 18-8 24 0-6 8-18 8-24 0Z" />
        <circle r="3.5" />
      </>
    )
  }
  return (
    <>
      <ellipse cx="0" cy="-7" rx="9" ry="4" />
      <path d="M-9-7V7c0 5 18 5 18 0V-7M-9 0c0 5 18 5 18 0" />
    </>
  )
}

export function AtlasNetwork({
  activeStep,
  caseTitle,
  status
}: AtlasNetworkProps) {
  return (
    <figure className="atlas-network" aria-label="Runtime ownership network">
      <div className="atlas-network__title">
        <h3>Runtime Atlas</h3>
        <p>Explore the causal map of executable information.</p>
      </div>
      <ol className="atlas-network__pipeline" aria-label="Runtime pipeline">
        {majorNodes.map((node, index) => (
          <li
            data-active={activeStep > index}
            data-tone={node.tone}
            key={node.id}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{node.label}</strong>
          </li>
        ))}
      </ol>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 760 520">
        <defs>
          <filter
            id="atlas-node-glow"
            x="-150%"
            y="-150%"
            width="400%"
            height="400%"
          >
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="atlas-map-field">
            <stop offset="0" stopColor="#12334a" stopOpacity=".56" />
            <stop offset=".55" stopColor="#071624" stopOpacity=".16" />
            <stop offset="1" stopColor="#020a13" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse
          cx="390"
          cy="294"
          fill="url(#atlas-map-field)"
          rx="350"
          ry="230"
        />
        <g className="atlas-network__edges">
          {backgroundEdges.map(({ from, id, to }) => (
            <line
              className="atlas-network__edge"
              data-tone={from.tone}
              key={id}
              x1={from.x}
              x2={to.x}
              y1={from.y}
              y2={to.y}
            />
          ))}
          {majorNodes.slice(0, -1).map((node, index) => (
            <line
              className="atlas-network__edge atlas-network__edge--route"
              data-active={activeStep > index}
              data-tone={node.tone}
              key={`route-${node.id}`}
              x1={node.x}
              x2={majorNodes[index + 1].x}
              y1={node.y}
              y2={majorNodes[index + 1].y}
            />
          ))}
        </g>
        <g className="atlas-network__small-nodes">
          {smallNodes.map((node) => (
            <g
              className="atlas-network__node"
              data-tone={node.tone}
              key={node.id}
              transform={`translate(${node.x} ${node.y})`}
            >
              <circle r={node.id.endsWith('0') ? 6 : 3.2} />
              <circle
                className="atlas-network__node-ring"
                r={node.id.endsWith('0') ? 12 : 6.5}
              />
            </g>
          ))}
        </g>
        <g
          className="atlas-network__major-nodes"
          filter="url(#atlas-node-glow)"
        >
          {majorNodes.map((node, index) => (
            <g
              className="atlas-network__node atlas-network__major-node"
              data-active={activeStep > index}
              data-tone={node.tone}
              key={node.id}
              transform={`translate(${node.x} ${node.y})`}
            >
              <circle className="atlas-network__major-halo" r="34" />
              <circle className="atlas-network__major-disc" r="23" />
              <g className="atlas-network__major-icon">
                <MajorNodeIcon id={node.id} />
              </g>
              <text textAnchor="middle" x="0" y="48">
                {node.label}
              </text>
            </g>
          ))}
        </g>
      </svg>

      <aside className="atlas-network__selection">
        <p className="technical-label">Selected flow</p>
        <dl>
          <div>
            <dt>ID</dt>
            <dd>RW-7A3C-9821</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{caseTitle}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{status}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>Live</dd>
          </div>
        </dl>
      </aside>
      <figcaption>
        Executable information, inspected as a causal map.
      </figcaption>
    </figure>
  )
}
