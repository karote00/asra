import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { FoundationBrowserSupport } from '@/components/foundation-browser-support'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { isIndexingAuthorized, resolveSiteOrigin } from '@/lib/site-origin'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteOrigin()),
  title: {
    default: 'Asyra Framework',
    template: '%s · Asyra Framework'
  },
  description:
    'Build domain-owned information products on deterministic, composable infrastructure.',
  applicationName: 'Asyra Framework',
  alternates: { canonical: '/' },
  openGraph: {
    description:
      'Build domain-owned information products on deterministic, composable infrastructure.',
    siteName: 'Asyra Framework',
    title: 'Asyra Framework',
    type: 'website',
    url: '/'
  },
  robots: isIndexingAuthorized()
    ? { follow: true, index: true }
    : { follow: false, index: false },
  twitter: {
    card: 'summary',
    description:
      'Build domain-owned information products on deterministic, composable infrastructure.',
    title: 'Asyra Framework'
  }
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f4f0e6'
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
        <FoundationBrowserSupport />
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
