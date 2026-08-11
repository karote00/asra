interface GalaxyMapProps {
  className?: string
}

type DomainId =
  | 'design'
  | 'bim'
  | 'simulation'
  | 'ai-model'
  | 'vr'
  | 'whiteboard'

interface Domain {
  id: DomainId
  label: string
  tone: 'coral' | 'cyan' | 'amber' | 'violet' | 'blue'
  x: number
  y: number
  route: string
}

type GalaxyVariant = 'desktop' | 'mobile'

interface ParticlePoint {
  color?: string
  group?: number
  opacity: number
  radius: number
  tone?: DustBand['tone']
  x: number
  y: number
}

interface ParticlePath {
  count: number
  d: string
  key: string
  luster: number
  tone: string
}

const referenceDomainIconPaths: Record<DomainId, readonly string[]> = {
  design: ['M0-12 10-6v12L0 12-10 6V-6Z', 'M-10-6 0 0 10-6M0 0v12'],
  bim: ['M-11-11H3l8 8v14h-22Z', 'M-4-11v22M3-11v8h8M-11-4H4M-11 4h22'],
  simulation: ['M0-11a11 11 0 1 1 0 22 11 11 0 0 1 0-22', 'M0-7v8l6 4'],
  'ai-model': [
    'M0-5 5 0 0 5-5 0Z',
    'M0-14v5M-2-12h4M0 9v5m-2-2h4M-14 0h5m-3-2v4M9 0h5m-2-2v4'
  ],
  vr: [
    'M-12-1c0-6 5-9 12-9s12 3 12 9v5c0 3-2 5-5 5H4L1 5h-2L-4 9h-3c-3 0-5-2-5-5Z',
    'M-8-2c2-3 5-4 8-4s6 1 8 4M-7 1h4l3 3 3-3h4'
  ],
  whiteboard: ['M-13 5c4 0 5-14 9-14 5 0-1 13 4 13 4 0 5-12 10-12', 'm7-1 3 3']
}

const referenceCoreMarkPath = 'M0-25 23 24 13 28 0 5-13 28-23 24Z'

const desktopDomains: readonly Domain[] = [
  {
    id: 'design',
    label: 'Design',
    tone: 'coral',
    x: 356,
    y: 74,
    route: 'M366 298C361 234 357 139 356 74'
  },
  {
    id: 'bim',
    label: 'BIM',
    tone: 'cyan',
    x: 570,
    y: 194,
    route: 'M366 298C435 265 499 214 570 194'
  },
  {
    id: 'simulation',
    label: '4D',
    tone: 'amber',
    x: 566,
    y: 410,
    route: 'M366 298C433 326 504 382 566 410'
  },
  {
    id: 'ai-model',
    label: 'AI',
    tone: 'violet',
    x: 363,
    y: 507,
    route: 'M366 298C357 374 362 445 363 507'
  },
  {
    id: 'vr',
    label: 'VR',
    tone: 'blue',
    x: 174,
    y: 400,
    route: 'M366 298C299 319 228 372 174 400'
  },
  {
    id: 'whiteboard',
    label: 'Whiteboard',
    tone: 'violet',
    x: 165,
    y: 166,
    route: 'M366 298C294 273 228 189 165 166'
  }
] as const

const mobileDomains: readonly Domain[] = [
  {
    id: 'design',
    label: 'Design',
    tone: 'coral',
    x: 226,
    y: 45,
    route: 'M201 219C207 166 218 92 226 45'
  },
  {
    id: 'bim',
    label: 'BIM',
    tone: 'cyan',
    x: 352,
    y: 139,
    route: 'M201 219C250 199 308 157 352 139'
  },
  {
    id: 'simulation',
    label: '4D',
    tone: 'amber',
    x: 345,
    y: 291,
    route: 'M201 219C254 238 306 273 345 291'
  },
  {
    id: 'ai-model',
    label: 'AI',
    tone: 'violet',
    x: 222,
    y: 380,
    route: 'M201 219C198 278 216 338 222 380'
  },
  {
    id: 'vr',
    label: 'VR',
    tone: 'blue',
    x: 70,
    y: 301,
    route: 'M201 219C154 242 105 277 70 301'
  },
  {
    id: 'whiteboard',
    label: 'Whiteboard',
    tone: 'violet',
    x: 63,
    y: 153,
    route: 'M201 219C155 201 108 167 63 153'
  }
] as const

const referenceOrbitPaths = [
  'M52 347C114 142 308 69 514 119c157 38 234 142 185 249-60 131-295 183-483 98',
  'M75 410C182 546 450 562 625 430c138-104 126-261-19-344',
  'M101 270C211 105 459 64 635 176c137 87 141 226 28 316',
  'M112 478C43 370 102 221 237 150c149-78 346-48 447 67',
  'M166 154C71 264 86 415 211 491c132 80 326 50 432-65',
  'M195 493C89 421 82 283 177 197c109-98 300-106 426-16',
  'M206 203C307 120 485 139 573 236c74 82 47 188-59 238',
  'M220 438C153 362 181 251 285 207c105-45 237-8 285 75',
  'M244 253C320 188 451 205 509 277c50 62 20 139-58 168',
  'M271 417C213 375 221 292 292 257c77-38 178-6 202 55',
  'M276 277C339 233 437 260 461 319c20 48-29 98-96 103',
  'M69 329C179 319 241 210 346 166c134-56 285-13 362 84',
  'M86 389C207 364 260 460 389 478c121 18 249-26 301-106',
  'M128 192C220 272 322 278 421 216c89-56 193-46 265 17',
  'M110 454C213 400 286 301 393 276c127-29 231 21 289 107',
  'M174 118C263 196 359 211 460 162c91-44 184-19 240 46'
] as const

const referenceLocalArcs = [
  'M258 375C295 402 347 407 386 385',
  'M286 246C333 215 395 220 428 255',
  'M301 430C363 461 438 446 472 402',
  'M187 327C225 282 279 260 329 267',
  'M366 184C419 173 477 193 506 229',
  'M396 469C456 468 513 438 536 397',
  'M130 383C178 406 231 399 268 370',
  'M488 250C536 265 566 299 574 336',
  'M220 184C268 151 326 145 372 166',
  'M494 361C535 345 578 355 604 382'
] as const

const filamentPaths = [
  'M28 360C104 191 270 101 447 122c153 19 252 105 271 201',
  'M44 409C158 510 345 522 493 462c132-53 198-146 189-232',
  'M71 292C158 185 292 142 423 169c111 23 184 88 201 160',
  'M102 455C172 382 226 283 329 233c107-52 226-33 302 35',
  'M141 170C230 226 301 267 400 230c103-39 190-25 246 33',
  'M154 427C227 456 319 443 371 389c49-50 100-72 162-66',
  'M208 233C287 181 408 193 471 260c54 57 34 124-28 165',
  'M228 393C189 339 220 275 288 248c71-28 161-3 195 49',
  'M275 420C345 453 433 426 462 370c25-48-15-96-75-102',
  'M84 370C159 357 228 329 284 287',
  'M402 194C482 188 565 226 612 285'
] as const

const desktopFlares = [
  [91, 329],
  [143, 241],
  [173, 418],
  [221, 183],
  [246, 367],
  [287, 146],
  [302, 442],
  [343, 225],
  [392, 171],
  [437, 427],
  [478, 236],
  [521, 378],
  [557, 172],
  [604, 313],
  [649, 399],
  [686, 257]
] as const

interface DustBand {
  count: number
  cx: number
  cy: number
  from: number
  radius: number
  rise: number
  span: number
  squash: number
  twist: number
  tone: 'warm' | 'gold' | 'white' | 'cyan' | 'ember'
  width: number
}

const desktopDustBands: readonly DustBand[] = [
  {
    count: 164,
    cx: 343,
    cy: 324,
    from: -0.45,
    radius: 18,
    rise: 158,
    span: 8.1,
    squash: 0.53,
    twist: 0.09,
    tone: 'white',
    width: 22
  },
  {
    count: 143,
    cx: 340,
    cy: 329,
    from: 1.65,
    radius: 64,
    rise: 260,
    span: 4.8,
    squash: 0.49,
    twist: -0.12,
    tone: 'warm',
    width: 28
  },
  {
    count: 128,
    cx: 360,
    cy: 303,
    from: 3.45,
    radius: 86,
    rise: 226,
    span: 3.46,
    squash: 0.43,
    twist: 0.18,
    tone: 'gold',
    width: 19
  },
  {
    count: 117,
    cx: 347,
    cy: 334,
    from: 0.12,
    radius: 76,
    rise: 268,
    span: 3.72,
    squash: 0.55,
    twist: -0.08,
    tone: 'ember',
    width: 24
  },
  {
    count: 103,
    cx: 337,
    cy: 321,
    from: 2.5,
    radius: 128,
    rise: 214,
    span: 2.78,
    squash: 0.62,
    twist: 0.14,
    tone: 'warm',
    width: 31
  },
  {
    count: 91,
    cx: 368,
    cy: 316,
    from: -1.82,
    radius: 112,
    rise: 248,
    span: 3.12,
    squash: 0.48,
    twist: -0.16,
    tone: 'cyan',
    width: 20
  },
  {
    count: 79,
    cx: 326,
    cy: 338,
    from: 0.9,
    radius: 177,
    rise: 184,
    span: 2.34,
    squash: 0.65,
    twist: 0.11,
    tone: 'gold',
    width: 34
  },
  {
    count: 67,
    cx: 352,
    cy: 306,
    from: 4.55,
    radius: 194,
    rise: 149,
    span: 1.94,
    squash: 0.44,
    twist: -0.13,
    tone: 'cyan',
    width: 18
  },
  {
    count: 55,
    cx: 348,
    cy: 326,
    from: 2.95,
    radius: 222,
    rise: 116,
    span: 1.72,
    squash: 0.58,
    twist: 0.2,
    tone: 'white',
    width: 26
  }
] as const

const mobileDustBands: readonly DustBand[] = desktopDustBands.map(
  (band, index) => ({
    ...band,
    count: Math.max(38, Math.round(band.count * 0.56)),
    cx: 199 + (band.cx - 348) * 0.28,
    cy: band.cy * 0.68 + (index % 3) * 1.3,
    radius: band.radius * 0.59,
    rise: band.rise * 0.64,
    squash: Math.min(0.76, band.squash * 1.15),
    width: band.width * 0.72
  })
)

const unitHash = (index: number, salt: number) => {
  let value = Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt, 0x27d4eb2d)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value ^= value >>> 16
  return (value >>> 0) / 0xffffffff
}

const rounded = (value: number) => Number(value.toFixed(2))

const circleSubpath = ({ radius, x, y }: ParticlePoint) => {
  const r = rounded(radius)
  const left = rounded(x - radius)
  const cy = rounded(y)
  return `M${left} ${cy}a${r} ${r} 0 1 0 ${rounded(r * 2)} 0a${r} ${r} 0 1 0-${rounded(r * 2)} 0`
}

const groupParticlePaths = (
  particles: readonly ParticlePoint[],
  keyFor: (particle: ParticlePoint, index: number) => string
) => {
  const groups = new Map<string, ParticlePoint[]>()
  particles.forEach((particle, index) => {
    const key = keyFor(particle, index)
    const bucket = groups.get(key)
    if (bucket) bucket.push(particle)
    else groups.set(key, [particle])
  })

  return Array.from(groups, ([key, points]): ParticlePath => {
    const [tone, luster = '1'] = key.split(':')
    return {
      count: points.length,
      d: points.map(circleSubpath).join(''),
      key,
      luster: Number(luster),
      tone
    }
  })
}

const createDustParticles = (bands: readonly DustBand[], saltOffset: number) =>
  bands.flatMap((band, bandIndex) =>
    Array.from({ length: band.count }, (_, index) => {
      const progress = (index + unitHash(index, 11 + bandIndex)) / band.count
      const angle =
        band.from +
        progress * band.span +
        Math.sin(progress * Math.PI * 3.1) * band.twist
      const radialJitter =
        (unitHash(index, saltOffset + bandIndex * 17) - 0.5) * band.width
      const radius = band.radius + progress * band.rise + radialJitter
      const lateral =
        (unitHash(index, saltOffset + 91 + bandIndex * 13) - 0.5) * band.width

      return {
        group: bandIndex % 3,
        opacity: 0.2 + unitHash(index, saltOffset + 131 + bandIndex) * 0.74,
        radius: 0.24 + unitHash(index, saltOffset + 173 + bandIndex) * 0.94,
        tone: band.tone,
        x: band.cx + Math.cos(angle) * radius + Math.sin(angle) * lateral,
        y:
          band.cy +
          Math.sin(angle) * radius * band.squash +
          Math.cos(angle) * lateral * 0.48
      }
    })
  )

const createBackgroundStars = (
  count: number,
  width: number,
  height: number,
  salt: number
) =>
  Array.from({ length: count }, (_, index) => ({
    opacity: 0.13 + unitHash(index, salt + 31) * 0.64,
    radius: index % 53 === 0 ? 1.38 : 0.22 + unitHash(index, salt + 53) * 0.58,
    x: 8 + unitHash(index, salt + 71) * (width - 16),
    y: 8 + unitHash(index, salt + 89) * (height - 16)
  }))

const desktopDustParticles = createDustParticles(
  desktopDustBands.map((band) => ({ ...band, cy: band.cy - 24 })),
  211
)
const mobileDustParticles = createDustParticles(mobileDustBands, 311)
const desktopBackgroundStars = createBackgroundStars(340, 760, 620, 401)
const mobileBackgroundStars = createBackgroundStars(210, 420, 430, 503)

const createCoreBurstParticles = (
  count: number,
  cx: number,
  cy: number,
  xSpread: number,
  ySpread: number,
  salt: number
) =>
  Array.from({ length: count }, (_, index) => {
    const angle = unitHash(index, salt + 17) * Math.PI * 2
    const distance = Math.pow(unitHash(index, salt + 31), 1.72)
    let color = '#f4b66e'
    if (index % 13 === 0) color = '#d9fbff'
    else if (index % 3 === 0) color = '#fffdf1'
    let radius = 0.32 + unitHash(index, salt + 59) * 1.16
    if (index % 17 === 0) radius = 2.35

    return {
      color,
      opacity: 0.48 + unitHash(index, salt + 47) * 0.52,
      radius,
      x: cx + Math.cos(angle) * distance * xSpread,
      y: cy + Math.sin(angle) * distance * ySpread
    }
  })

const desktopCoreBurstParticles = createCoreBurstParticles(
  210,
  285,
  298,
  155,
  65,
  601
)
const mobileCoreBurstParticles = createCoreBurstParticles(
  62,
  180,
  218,
  60,
  31,
  701
)

const dustPathKey = (particle: ParticlePoint) => {
  let luster = 0
  if (particle.opacity > 0.72) luster = 2
  else if (particle.opacity > 0.43) luster = 1
  return `${particle.tone ?? 'warm'}:${luster}:${particle.group ?? 0}`
}

const backgroundPathKey = (particle: ParticlePoint, index: number) => {
  let tone = 'white'
  if (index % 13 === 0) tone = 'cyan'
  else if (index % 7 === 0) tone = 'warm'
  const luster = particle.opacity > 0.55 || particle.radius > 1 ? 1 : 0
  return `${tone}:${luster}`
}

const corePathKey = (particle: ParticlePoint) => {
  const luster = particle.opacity > 0.78 || particle.radius > 1.7 ? 1 : 0
  return `${particle.color ?? '#f4b66e'}:${luster}`
}

const desktopDustPaths = groupParticlePaths(desktopDustParticles, dustPathKey)
const mobileDustPaths = groupParticlePaths(mobileDustParticles, dustPathKey)
const desktopBackgroundPaths = groupParticlePaths(
  desktopBackgroundStars,
  backgroundPathKey
)
const mobileBackgroundPaths = groupParticlePaths(
  mobileBackgroundStars,
  backgroundPathKey
)
const desktopCoreBurstPaths = groupParticlePaths(
  desktopCoreBurstParticles,
  corePathKey
)
const mobileCoreBurstPaths = groupParticlePaths(
  mobileCoreBurstParticles,
  corePathKey
)

function DomainIcon({ id }: { id: DomainId }) {
  return referenceDomainIconPaths[id].map((path) => (
    <path d={path} key={path} />
  ))
}

function GalaxyScene({ variant }: { variant: GalaxyVariant }) {
  const mobile = variant === 'mobile'
  const prefix = `galaxy-${variant}`
  const domains = mobile ? mobileDomains : desktopDomains
  const dustParticles = mobile ? mobileDustParticles : desktopDustParticles
  const dustPaths = mobile ? mobileDustPaths : desktopDustPaths
  const coreBurstPaths = mobile ? mobileCoreBurstPaths : desktopCoreBurstPaths
  const backgroundPaths = mobile
    ? mobileBackgroundPaths
    : desktopBackgroundPaths
  const flares = mobile
    ? desktopFlares.map(([x, y]) => [4 + x * 0.542, y * 0.68] as const)
    : desktopFlares.map(([x, y]) => [x, y - 24] as const)
  const flareFields = (['warm', 'cyan'] as const).map((tone) => {
    const points = flares.filter((_, index) =>
      tone === 'cyan' ? index % 4 === 0 : index % 4 !== 0
    )
    return {
      circles: points
        .map(([x, y], index) =>
          circleSubpath({
            opacity: 1,
            radius: index % 4 === 0 ? 2.2 : 1.35,
            x,
            y
          })
        )
        .join(''),
      rays: points
        .map(([x, y], index) => {
          const reach = index % 3 === 0 ? 9 : 6
          return `M${rounded(x - reach)} ${rounded(y)}H${rounded(
            x + reach
          )}M${rounded(x)} ${rounded(y - reach)}V${rounded(y + reach)}`
        })
        .join(''),
      tone
    }
  })
  const orbitTransform = mobile
    ? 'translate(4 0) scale(.542 .68)'
    : 'translate(0 -24)'
  const coreX = mobile ? 201 : 366
  const coreY = mobile ? 219 : 298

  return (
    <>
      <defs>
        <radialGradient id={`${prefix}-ambient`} cx="43%" cy="52%" r="59%">
          <stop offset="0" stopColor="#fff3dc" stopOpacity=".44" />
          <stop offset=".08" stopColor="#e89a63" stopOpacity=".34" />
          <stop offset=".25" stopColor="#a74732" stopOpacity=".15" />
          <stop offset=".55" stopColor="#29597a" stopOpacity=".07" />
          <stop offset="1" stopColor="#020a13" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${prefix}-core`} cx="42%" cy="48%" r="54%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <stop offset=".09" stopColor="#fff5d5" stopOpacity=".96" />
          <stop offset=".25" stopColor="#f0ad68" stopOpacity=".76" />
          <stop offset=".52" stopColor="#b95637" stopOpacity=".33" />
          <stop offset="1" stopColor="#7d3027" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${prefix}-warm-line`} x1="0" x2="1">
          <stop offset="0" stopColor="#b8563d" stopOpacity="0" />
          <stop offset=".24" stopColor="#dc7950" stopOpacity=".62" />
          <stop offset=".54" stopColor="#fff0c8" stopOpacity=".88" />
          <stop offset=".83" stopColor="#c75f40" stopOpacity=".46" />
          <stop offset="1" stopColor="#c75f40" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${prefix}-cool-line`} x1="0" x2="1">
          <stop offset="0" stopColor="#64dce9" stopOpacity="0" />
          <stop offset=".48" stopColor="#92edf4" stopOpacity=".62" />
          <stop offset="1" stopColor="#4485b1" stopOpacity="0" />
        </linearGradient>
        <filter
          id={`${prefix}-soft-glow`}
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
        >
          <feGaussianBlur stdDeviation={mobile ? '5' : '7'} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter
          id={`${prefix}-particle-glow`}
          x="-40%"
          y="-60%"
          width="180%"
          height="220%"
        >
          <feGaussianBlur stdDeviation=".8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter
          id={`${prefix}-fog`}
          x="-45%"
          y="-80%"
          width="190%"
          height="260%"
        >
          <feGaussianBlur stdDeviation={mobile ? '14' : '22'} />
        </filter>
        <mask id={`${prefix}-depth-mask`}>
          <rect
            fill="white"
            height={mobile ? 430 : 620}
            width={mobile ? 420 : 760}
          />
          <ellipse
            cx={coreX + (mobile ? 5 : 12)}
            cy={coreY + 5}
            fill="black"
            opacity=".56"
            rx={mobile ? 34 : 61}
            ry={mobile ? 21 : 34}
            transform={`rotate(-16 ${coreX} ${coreY})`}
          />
        </mask>
      </defs>

      <rect
        className="galaxy-map__motion-bounds"
        fill="transparent"
        height={mobile ? 406 : 596}
        width={mobile ? 404 : 736}
        x="12"
        y="12"
      />
      <ellipse
        className="galaxy-map__ambient"
        cx={coreX - (mobile ? 8 : 29)}
        cy={coreY + 3}
        fill={`url(#${prefix}-ambient)`}
        rx={mobile ? 196 : 354}
        ry={mobile ? 191 : 230}
      />

      <g className="galaxy-map__background-stars">
        {backgroundPaths.map((field, index) => (
          <path
            className={`galaxy-map__background-star-field galaxy-map__background-star-field--${field.tone} galaxy-map__background-star-field--${field.luster} galaxy-map__twinkle--${index % 5}`}
            d={field.d}
            key={`${variant}-background-${field.key}`}
          />
        ))}
      </g>

      <g
        className="galaxy-map__fog galaxy-map__fog--rear"
        filter={`url(#${prefix}-fog)`}
      >
        <ellipse
          cx={coreX - (mobile ? 16 : 61)}
          cy={coreY + (mobile ? 5 : 9)}
          rx={mobile ? 92 : 181}
          ry={mobile ? 28 : 50}
          transform={`rotate(-24 ${coreX} ${coreY})`}
        />
        <ellipse
          cx={coreX + (mobile ? 31 : 82)}
          cy={coreY - (mobile ? 29 : 42)}
          rx={mobile ? 101 : 204}
          ry={mobile ? 23 : 45}
          transform={`rotate(21 ${coreX} ${coreY})`}
        />
        <ellipse
          className="galaxy-map__fog--cool"
          cx={coreX + (mobile ? 14 : 102)}
          cy={coreY + (mobile ? 35 : 52)}
          rx={mobile ? 124 : 236}
          ry={mobile ? 23 : 48}
          transform={`rotate(-13 ${coreX} ${coreY})`}
        />
      </g>

      <g className="galaxy-map__field--outer">
        <g
          className="galaxy-map__orbits"
          mask={`url(#${prefix}-depth-mask)`}
          transform={orbitTransform}
        >
          {referenceOrbitPaths.map((path, index) => (
            <path
              className={`galaxy-map__orbit galaxy-map__orbit--${index % 4}`}
              d={path}
              key={path}
            />
          ))}
        </g>
        <g className="galaxy-map__local-arcs" transform={orbitTransform}>
          {referenceLocalArcs.map((path, index) => (
            <path
              className={`galaxy-map__local-arc galaxy-map__local-arc--${index % 3}`}
              d={path}
              key={path}
            />
          ))}
        </g>
      </g>

      <g
        className="galaxy-map__filaments"
        filter={`url(#${prefix}-soft-glow)`}
        mask={`url(#${prefix}-depth-mask)`}
        transform={orbitTransform}
      >
        {filamentPaths.map((path, index) => (
          <path
            className={`galaxy-map__filament galaxy-map__filament--${index % 4}`}
            d={path}
            key={path}
            stroke={
              index % 5 === 3
                ? `url(#${prefix}-cool-line)`
                : `url(#${prefix}-warm-line)`
            }
          />
        ))}
      </g>

      <g
        className="galaxy-map__field--dust galaxy-map__particle-field"
        data-cyan-count={
          dustParticles.filter((particle) => particle.tone === 'cyan').length
        }
        data-particle-count={dustParticles.length}
        filter={`url(#${prefix}-particle-glow)`}
      >
        {[0, 1, 2].map((group) => (
          <g
            className={`galaxy-map__dust-stream galaxy-map__dust-stream--${group}`}
            key={group}
          >
            {dustPaths
              .filter((field) => Number(field.key.split(':')[2]) === group)
              .map((field) => (
                <path
                  className={`galaxy-map__dust-path galaxy-map__dust-path--${field.tone} galaxy-map__dust-path--${field.luster}`}
                  d={field.d}
                  key={`${variant}-dust-${field.key}`}
                />
              ))}
          </g>
        ))}
      </g>

      <g className="galaxy-map__routes">
        {domains.map(({ id, route }) => (
          <path d={route} key={id} />
        ))}
      </g>

      <g className="galaxy-map__flares" data-flare-count={flares.length}>
        {flareFields.map(({ circles, rays, tone }) => (
          <g
            className={`galaxy-map__flare-field galaxy-map__flare-field--${tone}`}
            key={tone}
          >
            <path d={circles} />
            <path d={rays} />
          </g>
        ))}
      </g>

      <g className="galaxy-map__hot-core" filter={`url(#${prefix}-soft-glow)`}>
        <ellipse
          className="galaxy-map__core-energy"
          cx={coreX - 9}
          cy={coreY + 2}
          fill={`url(#${prefix}-core)`}
          rx={mobile ? 60 : 98}
          ry={mobile ? 43 : 62}
          transform={`rotate(-14 ${coreX} ${coreY})`}
        />
        <g className="galaxy-map__core-burst">
          {coreBurstPaths.map((field) => (
            <path
              className={`galaxy-map__core-burst-path galaxy-map__core-burst-path--${field.luster}`}
              d={field.d}
              fill={field.tone}
              key={`${variant}-core-burst-${field.key}`}
            />
          ))}
        </g>
        <circle
          className="galaxy-map__core-hotspot galaxy-map__core-hotspot--a"
          cx={coreX - 22}
          cy={coreY - 5}
          r={mobile ? 5 : 8}
        />
        <circle
          className="galaxy-map__core-hotspot galaxy-map__core-hotspot--b"
          cx={coreX + 9}
          cy={coreY + 11}
          r={mobile ? 3.5 : 5.5}
        />
        <circle
          className="galaxy-map__core-hotspot galaxy-map__core-hotspot--c"
          cx={coreX - 3}
          cy={coreY - 18}
          r={mobile ? 2.5 : 4.5}
        />
      </g>

      <path
        className="galaxy-map__occlusion"
        d={
          mobile
            ? 'M91 240C137 224 182 219 225 229c53 12 88 38 128 37-30 31-98 38-157 24-48-13-82-33-105-50Z'
            : 'M132 361C224 319 319 311 402 336c104 31 171 93 253 89-55 67-189 80-302 39-94-34-165-78-221-103Z'
        }
        transform={mobile ? undefined : 'translate(0 -24)'}
      />

      <g
        className="galaxy-map__core"
        transform={`translate(${coreX} ${coreY})`}
      >
        <circle className="galaxy-map__core-disc" r={mobile ? 29 : 52} />
        <path className="galaxy-map__core-mark" d={referenceCoreMarkPath} />
      </g>

      {domains.map(({ id, label, tone, x, y }, index) => (
        <g
          className="galaxy-map__domain"
          data-domain={id}
          data-tone={tone}
          key={id}
          transform={`translate(${x} ${y})`}
        >
          <g
            className={`galaxy-map__domain-body galaxy-map__domain-body--${index}`}
          >
            <circle className="galaxy-map__domain-disc" r={mobile ? 27 : 34} />
            <g className="galaxy-map__domain-icon">
              <DomainIcon id={id} />
            </g>
            <text textAnchor="middle" x="0" y={mobile ? 43 : 53}>
              {label}
            </text>
          </g>
        </g>
      ))}
    </>
  )
}

export function GalaxyMap({ className }: GalaxyMapProps) {
  return (
    <div className={className}>
      <svg
        aria-hidden="true"
        className="galaxy-map galaxy-map--desktop"
        focusable="false"
        viewBox="0 0 760 620"
      >
        <g className="galaxy-map__motion-field">
          <GalaxyScene variant="desktop" />
        </g>
      </svg>
      <svg
        aria-hidden="true"
        className="galaxy-map galaxy-map--mobile"
        focusable="false"
        viewBox="0 0 420 430"
      >
        <g className="galaxy-map__motion-field">
          <GalaxyScene variant="mobile" />
        </g>
      </svg>
    </div>
  )
}
