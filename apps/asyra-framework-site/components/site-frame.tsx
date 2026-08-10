import type { ReactNode } from 'react'

interface SiteFrameProps {
  children: ReactNode
  coordinate?: string
  eyebrow: string
}

export function SiteFrame({
  children,
  coordinate = '01',
  eyebrow
}: SiteFrameProps) {
  return (
    <section className="site-frame">
      <div aria-hidden="true" className="site-frame__registration">
        <span>{coordinate}</span>
        <span>Asyra / Public Working Sheet</span>
      </div>
      <p className="section-eyebrow">{eyebrow}</p>
      {children}
    </section>
  )
}
