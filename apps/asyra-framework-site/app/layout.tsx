import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { isIndexingAuthorized, resolveSiteOrigin } from '@/lib/site-origin'
import './globals.css'
import './styles/foundation.css'
import './styles/docs.css'
import './styles/support.css'
import './styles/atlas.css'

const title = 'Asyra - Framework for canvas-based and domain-driven tools'
const description =
  'Build canvas-based editors, visual tools, BIM workspaces, simulations, and other domain products from composable application building blocks.'

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteOrigin()),
  title,
  description,
  applicationName: 'Asyra',
  keywords: [
    'canvas tool framework',
    'canvas editor framework',
    'visual editor framework',
    'whiteboard framework',
    'BIM application framework',
    'undo redo framework',
    'domain-driven tools',
    'TypeScript application framework'
  ],
  alternates: { canonical: '/' },
  openGraph: {
    description,
    siteName: 'Asyra',
    title,
    type: 'website',
    url: '/'
  },
  robots: isIndexingAuthorized()
    ? { follow: true, index: true }
    : { follow: false, index: false },
  twitter: {
    card: 'summary',
    description,
    title
  }
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f3eee5'
}

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
