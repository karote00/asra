import type { ReactNode } from 'react'

interface EvidenceHeroProps {
  children?: ReactNode
  coordinate: string
  description: string
  eyebrow: string
  title: string
}

export function EvidenceHero({
  children,
  coordinate,
  description,
  eyebrow,
  title
}: EvidenceHeroProps) {
  return (
    <header className="evidence-hero">
      <div aria-hidden="true" className="evidence-hero__coordinate">
        <span>{coordinate}</span>
        <span>VERIFIED PUBLIC SURFACE</span>
      </div>
      <div aria-hidden="true" className="evidence-hero__instrument">
        <span>{coordinate} / PUBLIC CONTRACT</span>
        <i />
        <i />
      </div>
      <p className="section-eyebrow">{eyebrow}</p>
      <div className="evidence-hero__content">
        <h1>{title}</h1>
        <div>
          <p>{description}</p>
          {children}
        </div>
      </div>
    </header>
  )
}
