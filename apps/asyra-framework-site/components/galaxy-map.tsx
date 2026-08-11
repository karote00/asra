interface GalaxyMapProps {
  className?: string
}

const starRadiusFor = (index: number) => {
  if (index % 13 === 0) return 1.8
  if (index % 5 === 0) return 1.15
  return 0.68
}

const starColorFor = (index: number) => {
  if (index % 9 === 0) return '#ff8a73'
  if (index % 7 === 0) return '#6de6f2'
  return '#d8e7ef'
}

const stars = Array.from({ length: 168 }, (_, index) => ({
  color: starColorFor(index),
  opacity: 0.28 + ((index * 17) % 62) / 100,
  radius: starRadiusFor(index),
  x: 22 + ((index * 83 + index * index * 7) % 716),
  y: 18 + ((index * 47 + index * index * 11) % 584)
}))

const domains = [
  { id: 'design', label: 'Design', tone: 'coral', x: 380, y: 78 },
  { id: 'bim', label: 'BIM', tone: 'cyan', x: 596, y: 194 },
  { id: 'simulation', label: '4D', tone: 'amber', x: 598, y: 424 },
  { id: 'ai-model', label: 'AI', tone: 'violet', x: 380, y: 544 },
  { id: 'vr', label: 'VR', tone: 'blue', x: 164, y: 424 },
  { id: 'whiteboard', label: 'Whiteboard', tone: 'violet', x: 164, y: 194 }
] as const

function DomainIcon({ id }: { id: (typeof domains)[number]['id'] }) {
  if (id === 'design') {
    return <path d="m-10-6 10-6 10 6v12L0 12-10 6Zm0 0L0 0l10-6M0 0v12" />
  }
  if (id === 'bim') {
    return (
      <>
        <rect height="24" width="20" x="-10" y="-12" />
        <path d="M-3-12v24M4-12v24M-10-4h20M-10 4h20" />
      </>
    )
  }
  if (id === 'simulation') {
    return (
      <>
        <circle cx="0" cy="0" r="11" />
        <path d="M0-7v8l6 4" />
      </>
    )
  }
  if (id === 'ai-model') {
    return <path d="M0-12 3-4l8 4-8 4-3 8-3-8-8-4 8-4Zm8 13 2 5 5 2-5 2-2 5" />
  }
  if (id === 'vr') {
    return <path d="M-14 3c1-9 4-13 14-13S13-6 14 3l-3 7-7-5h-8l-7 5Z" />
  }
  return <path d="M-13 7c4 0 5-14 10-14 4 0 1 13 5 13 5 0 6-12 11-12" />
}

export function GalaxyMap({ className }: GalaxyMapProps) {
  return (
    <div className={className}>
      <svg
        aria-hidden="true"
        className="galaxy-map"
        focusable="false"
        viewBox="0 0 760 620"
      >
        <defs>
          <radialGradient id="galaxy-nebula" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ff795f" stopOpacity=".62" />
            <stop offset=".2" stopColor="#ff795f" stopOpacity=".18" />
            <stop offset=".48" stopColor="#7868da" stopOpacity=".09" />
            <stop offset="1" stopColor="#020a13" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="galaxy-core" cx="50%" cy="45%" r="55%">
            <stop offset="0" stopColor="#ffb19d" stopOpacity=".9" />
            <stop offset=".28" stopColor="#ff725c" stopOpacity=".42" />
            <stop offset="1" stopColor="#ff725c" stopOpacity="0" />
          </radialGradient>
          <filter
            id="galaxy-soft-glow"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id="galaxy-star-glow"
            x="-300%"
            y="-300%"
            width="700%"
            height="700%"
          >
            <feGaussianBlur stdDeviation="2.3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <ellipse
          cx="380"
          cy="310"
          fill="url(#galaxy-nebula)"
          rx="315"
          ry="252"
        />
        <g className="galaxy-map__stars">
          {stars.map((star, index) => (
            <circle
              className="galaxy-map__star"
              cx={star.x}
              cy={star.y}
              fill={star.color}
              key={`${star.x}-${star.y}`}
              opacity={star.opacity}
              r={star.radius}
            />
          ))}
        </g>

        <g className="galaxy-map__spirals">
          <path d="M84 337C180 166 383 118 566 183c117 41 151 137 93 208-82 101-305 94-433 13-91-57-91-139-21-191 78-59 234-59 329 4 80 53 85 125 21 166-66 42-189 30-251-20-47-38-39-86 8-108 51-24 133-7 159 28" />
          <path d="M109 252c126-113 320-139 465-64 124 64 146 172 60 239-103 80-309 53-408-42-72-69-45-142 36-173 93-36 222 4 267 77 35 56 6 109-57 120-68 12-143-25-155-73-9-36 29-66 73-60" />
          <path d="M147 461c81 50 213 66 330 38 133-31 222-119 201-205-20-83-132-140-262-132-131 8-231 80-225 157 6 74 109 123 215 107 92-14 151-72 133-126-16-48-91-76-159-55-50 15-78 52-60 82" />
        </g>

        <g className="galaxy-map__orbits">
          <circle className="galaxy-map__orbit" cx="380" cy="310" r="104" />
          <circle className="galaxy-map__orbit" cx="380" cy="310" r="190" />
          <ellipse
            className="galaxy-map__orbit"
            cx="380"
            cy="310"
            rx="282"
            ry="124"
          />
          <ellipse
            className="galaxy-map__orbit"
            cx="380"
            cy="310"
            rx="286"
            ry="146"
            transform="rotate(31 380 310)"
          />
          <ellipse
            className="galaxy-map__orbit"
            cx="380"
            cy="310"
            rx="286"
            ry="146"
            transform="rotate(-31 380 310)"
          />
          <ellipse
            className="galaxy-map__orbit"
            cx="380"
            cy="310"
            rx="238"
            ry="205"
            transform="rotate(61 380 310)"
          />
          <ellipse
            className="galaxy-map__orbit"
            cx="380"
            cy="310"
            rx="238"
            ry="205"
            transform="rotate(-61 380 310)"
          />
        </g>

        <g className="galaxy-map__routes">
          {domains.map(({ id, x, y }) => (
            <path d={`M380 310L${x} ${y}`} key={id} />
          ))}
        </g>

        <g className="galaxy-map__core" filter="url(#galaxy-soft-glow)">
          <circle cx="380" cy="310" fill="url(#galaxy-core)" r="84" />
          <circle cx="380" cy="310" r="49" />
          <circle cx="380" cy="310" r="35" />
          <path
            className="galaxy-map__core-mark"
            d="m354 340 26-58 26 58m-41-14 15-15 15 15m-15-44v29"
          />
        </g>

        {domains.map(({ id, label, tone, x, y }) => (
          <g
            className="galaxy-map__domain"
            data-domain={id}
            data-tone={tone}
            key={id}
            transform={`translate(${x} ${y})`}
          >
            <circle className="galaxy-map__domain-halo" r="42" />
            <circle className="galaxy-map__domain-disc" r="28" />
            <g className="galaxy-map__domain-icon">
              <DomainIcon id={id} />
            </g>
            <text textAnchor="middle" x="0" y="51">
              {label}
            </text>
          </g>
        ))}

        <g className="galaxy-map__bright-stars" filter="url(#galaxy-star-glow)">
          <circle cx="286" cy="232" r="2.2" />
          <circle cx="485" cy="216" r="2.6" />
          <circle cx="514" cy="356" r="2" />
          <circle cx="270" cy="398" r="2.5" />
          <circle cx="382" cy="170" r="1.8" />
          <circle cx="376" cy="452" r="2.2" />
        </g>
      </svg>
    </div>
  )
}
