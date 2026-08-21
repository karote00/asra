import type { ReactNode } from 'react'

export function StatusSurface({
  children,
  label,
  tone,
  title
}: Readonly<{
  children: ReactNode
  label: string
  tone: 'current' | 'future' | 'boundary' | 'app'
  title: string
}>) {
  return (
    <section className={`status-surface status-surface--${tone}`}>
      <p>{label}</p>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  )
}
