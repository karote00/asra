import type { ReactNode } from 'react'

type FoundationPageHeroProps = Readonly<{
  aside?: ReactNode
  children: ReactNode
  className?: string
  density?: 'compact' | 'feature'
  layout?: 'inline' | 'split'
  surface?: 'dark' | 'grid'
}>

export function FoundationPageHero({
  aside,
  children,
  className,
  density = 'compact',
  layout = 'inline',
  surface = 'grid'
}: FoundationPageHeroProps) {
  const classes = [
    'page-hero',
    `page-hero--${density}`,
    `page-hero--${layout}`,
    `page-hero--${surface}`,
    surface === 'grid' ? 'engineering-grid' : '',
    className ?? ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <header className={classes}>
      <div className="page-hero__copy">{children}</div>
      {aside ? <div className="page-hero__aside">{aside}</div> : null}
    </header>
  )
}
