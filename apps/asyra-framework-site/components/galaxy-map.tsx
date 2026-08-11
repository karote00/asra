interface GalaxyMapProps {
  className?: string
}

const starRadiusFor = (index: number) => {
  if (index % 41 === 0) return 1.65
  if (index % 13 === 0) return 0.92
  if (index % 5 === 0) return 0.58
  return 0.34
}

const starColorFor = (index: number) => {
  if (index % 9 === 0) return '#ff8a73'
  if (index % 7 === 0) return '#6de6f2'
  return '#d8e7ef'
}

const unitHash = (index: number, salt: number) => {
  let value = Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt, 0x27d4eb2d)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value ^= value >>> 16
  return (value >>> 0) / 0xffffffff
}

const stars = Array.from({ length: 520 }, (_, index) => {
  const clustered = index >= 390
  const angle = unitHash(index, 17) * Math.PI * 10
  const distance = 34 + unitHash(index, 29) * 285
  const clusterX = 380 + Math.cos(angle) * distance * 1.08
  const clusterY = 310 + Math.sin(angle) * distance * 0.66

  return {
    color: starColorFor(index),
    opacity: 0.18 + unitHash(index, 43) * 0.72,
    radius: starRadiusFor(index),
    x: clustered ? clusterX : 14 + unitHash(index, 53) * 732,
    y: clustered ? clusterY : 12 + unitHash(index, 71) * 596
  }
})

const streamStarColorFor = (index: number) => {
  if (index % 17 === 0) return '#65d8e9'
  if (index % 9 === 0) return '#ffd0a0'
  return '#ff765d'
}

const streamStars = Array.from({ length: 340 }, (_, index) => {
  const arm = index % 4
  const step = Math.floor(index / 4)
  const progress = step / 84
  const angle = progress * Math.PI * 2.55 + arm * (Math.PI / 2)
  const distance = 28 + progress * 274 + (unitHash(index, 83) - 0.5) * 15

  return {
    color: streamStarColorFor(index),
    opacity: 0.22 + unitHash(index, 97) * 0.68,
    radius: 0.25 + unitHash(index, 109) * 0.72,
    x: 380 + Math.cos(angle) * distance * 1.06,
    y: 310 + Math.sin(angle) * distance * 0.64
  }
})

const clusterStarColorFor = (index: number) => {
  if (index % 19 === 0) return '#fff1d7'
  if (index % 11 === 0) return '#ffbb7d'
  return '#ff7459'
}

const clusterStars = Array.from({ length: 280 }, (_, index) => {
  const angle = unitHash(index, 127) * Math.PI * 2
  const distance = Math.pow(unitHash(index, 139), 1.65) * 188

  return {
    color: clusterStarColorFor(index),
    opacity: 0.3 + unitHash(index, 149) * 0.67,
    radius: 0.28 + unitHash(index, 157) * 0.94,
    x: 340 + Math.cos(angle) * distance * 1.12,
    y: 320 + Math.sin(angle) * distance * 0.58
  }
})

const auroraRibbons = [
  {
    color: 'url(#galaxy-aurora-coral)',
    d: 'M72 356C151 186 352 105 552 164c137 40 186 142 127 226-72 102-282 126-437 58',
    opacity: 0.2,
    width: 3.5
  },
  {
    color: 'url(#galaxy-aurora-gold)',
    d: 'M96 421c123 102 352 111 503 7 122-84 119-199 2-267',
    opacity: 0.17,
    width: 3
  },
  {
    color: 'url(#galaxy-aurora-coral)',
    d: 'M134 286c102-112 304-149 452-72 107 56 129 147 51 207-94 73-291 47-390-42',
    opacity: 0.26,
    width: 2.5
  },
  {
    color: 'url(#galaxy-aurora-cyan)',
    d: 'M122 454c86 60 248 77 373 35 141-47 222-151 178-232-47-86-204-119-335-55',
    opacity: 0.16,
    width: 2
  },
  {
    color: 'url(#galaxy-aurora-gold)',
    d: 'M190 409c-67-83-13-177 101-208 113-31 252 11 292 91 36 72-38 143-153 143',
    opacity: 0.3,
    width: 1.7
  },
  {
    color: 'url(#galaxy-aurora-coral)',
    d: 'M208 222c-58 51-40 123 38 167 82 46 215 47 286-7 61-46 43-107-20-142',
    opacity: 0.34,
    width: 1.45
  },
  {
    color: 'url(#galaxy-aurora-violet)',
    d: 'M268 418c-65-35-85-95-44-139 47-50 156-62 230-22 65 35 76 91 26 126',
    opacity: 0.24,
    width: 1.2
  },
  {
    color: 'url(#galaxy-aurora-gold)',
    d: 'M292 367c-43-29-46-69-4-94 46-27 126-18 157 18 26 31 2 68-48 76',
    opacity: 0.44,
    width: 1
  }
] as const

const brightStars = [
  [286, 232, 2.2],
  [485, 216, 2.6],
  [514, 356, 2],
  [270, 398, 2.5],
  [382, 170, 1.8],
  [376, 452, 2.2],
  [196, 316, 1.5],
  [230, 184, 1.35],
  [315, 145, 1.15],
  [438, 137, 1.4],
  [558, 257, 1.7],
  [601, 334, 1.25],
  [553, 444, 1.55],
  [460, 485, 1.3],
  [326, 489, 1.15],
  [205, 450, 1.35],
  [152, 371, 1.6],
  [177, 247, 1.25],
  [346, 253, 1.1],
  [430, 337, 1.2],
  [334, 366, 1.05],
  [454, 393, 1.25]
] as const

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
            <stop offset="0" stopColor="#ffc0a1" stopOpacity=".62" />
            <stop offset=".13" stopColor="#ff795f" stopOpacity=".34" />
            <stop offset=".34" stopColor="#d65142" stopOpacity=".14" />
            <stop offset=".6" stopColor="#7868da" stopOpacity=".11" />
            <stop offset="1" stopColor="#020a13" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="galaxy-dust-coral">
            <stop offset="0" stopColor="#ff8a69" stopOpacity=".72" />
            <stop offset=".46" stopColor="#db4e3e" stopOpacity=".24" />
            <stop offset="1" stopColor="#db4e3e" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="galaxy-dust-gold">
            <stop offset="0" stopColor="#ffc07c" stopOpacity=".62" />
            <stop offset=".48" stopColor="#e36f42" stopOpacity=".2" />
            <stop offset="1" stopColor="#e36f42" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="galaxy-dust-blue">
            <stop offset="0" stopColor="#62d7eb" stopOpacity=".3" />
            <stop offset=".55" stopColor="#406eae" stopOpacity=".11" />
            <stop offset="1" stopColor="#406eae" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="galaxy-aurora-coral" x1="0" x2="1">
            <stop offset="0" stopColor="#ff6d54" stopOpacity="0" />
            <stop offset=".32" stopColor="#ff7459" stopOpacity=".78" />
            <stop offset=".58" stopColor="#ffc197" stopOpacity=".94" />
            <stop offset="1" stopColor="#ff6d54" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="galaxy-aurora-gold" x1="0" x2="1">
            <stop offset="0" stopColor="#ff9d56" stopOpacity="0" />
            <stop offset=".46" stopColor="#ffd199" stopOpacity=".82" />
            <stop offset="1" stopColor="#ef704d" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="galaxy-aurora-cyan" x1="0" x2="1">
            <stop offset="0" stopColor="#60d5eb" stopOpacity="0" />
            <stop offset=".5" stopColor="#74deec" stopOpacity=".54" />
            <stop offset="1" stopColor="#525bba" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="galaxy-aurora-violet" x1="0" x2="1">
            <stop offset="0" stopColor="#9a6ae8" stopOpacity="0" />
            <stop offset=".5" stopColor="#bc7be9" stopOpacity=".58" />
            <stop offset="1" stopColor="#ff7960" stopOpacity="0" />
          </linearGradient>
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
          <filter
            id="galaxy-particle-glow"
            x="-20%"
            y="-30%"
            width="140%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="1.15" result="particleBlur" />
            <feMerge>
              <feMergeNode in="particleBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id="galaxy-aurora-glow"
            x="-30%"
            y="-50%"
            width="160%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="5" result="auroraBlur" />
            <feMerge>
              <feMergeNode in="auroraBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id="galaxy-dust-blur"
            x="-40%"
            y="-60%"
            width="180%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>

        <ellipse
          cx="350"
          cy="320"
          fill="url(#galaxy-nebula)"
          rx="300"
          ry="225"
        />
        <g className="galaxy-map__dust" filter="url(#galaxy-dust-blur)">
          <ellipse
            cx="306"
            cy="320"
            fill="url(#galaxy-dust-coral)"
            rx="188"
            ry="54"
            transform="rotate(-21 306 320)"
          />
          <ellipse
            cx="395"
            cy="287"
            fill="url(#galaxy-dust-gold)"
            rx="162"
            ry="42"
            transform="rotate(18 395 287)"
          />
          <ellipse
            cx="460"
            cy="351"
            fill="url(#galaxy-dust-coral)"
            rx="206"
            ry="48"
            transform="rotate(-14 460 351)"
          />
          <ellipse
            cx="430"
            cy="260"
            fill="url(#galaxy-dust-blue)"
            rx="245"
            ry="64"
            transform="rotate(24 430 260)"
          />
          <ellipse
            cx="345"
            cy="343"
            fill="url(#galaxy-dust-gold)"
            rx="112"
            ry="82"
          />
        </g>
        <g className="galaxy-map__aurora" filter="url(#galaxy-aurora-glow)">
          {auroraRibbons.map((ribbon) => (
            <path
              d={ribbon.d}
              key={ribbon.d}
              opacity={ribbon.opacity}
              stroke={ribbon.color}
              strokeWidth={ribbon.width}
            />
          ))}
        </g>
        <g
          className="galaxy-map__stream-stars"
          filter="url(#galaxy-particle-glow)"
        >
          {streamStars.map((star, index) => (
            <circle
              className="galaxy-map__stream-star"
              cx={star.x}
              cy={star.y}
              fill={star.color}
              key={`${index}-${star.x}`}
              opacity={star.opacity}
              r={star.radius}
            />
          ))}
        </g>
        <g
          className="galaxy-map__cluster-stars"
          filter="url(#galaxy-particle-glow)"
        >
          {clusterStars.map((star, index) => (
            <circle
              className="galaxy-map__cluster-star"
              cx={star.x}
              cy={star.y}
              fill={star.color}
              key={`${index}-${star.y}`}
              opacity={star.opacity}
              r={star.radius}
            />
          ))}
        </g>
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
          {brightStars.map(([cx, cy, radius]) => (
            <circle cx={cx} cy={cy} key={`${cx}-${cy}`} r={radius} />
          ))}
        </g>
      </svg>
    </div>
  )
}
