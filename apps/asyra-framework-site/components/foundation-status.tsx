import type { ReactNode } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface FoundationStatusProps {
  actionHref: string
  actionLabel: string
  children: ReactNode
  code: string
  eyebrow: string
  title: string
}

export function FoundationStatus({
  actionHref,
  actionLabel,
  children,
  code,
  eyebrow,
  title
}: FoundationStatusProps) {
  return (
    <div className="foundation-status">
      <div aria-hidden="true" className="foundation-status__coordinate">
        {code}
      </div>
      <p className="section-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <div className="foundation-status__message">{children}</div>
      <Link className="primary-action" href={actionHref as Route}>
        {actionLabel}
        <ArrowRight aria-hidden="true" size={17} />
      </Link>
    </div>
  )
}
