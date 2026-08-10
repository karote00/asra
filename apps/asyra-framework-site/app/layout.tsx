import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Asyra Framework',
    template: '%s · Asyra Framework'
  },
  description:
    'Build domain-owned information products on deterministic, composable infrastructure.',
  applicationName: 'Asyra Framework',
  robots: {
    index: false,
    follow: false
  }
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { color: '#f3efe3', media: '(prefers-color-scheme: light)' },
    { color: '#071018', media: '(prefers-color-scheme: dark)' }
  ]
}

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
