import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { SiteGoogleAnalytics } from '@/components/site-google-analytics'
import { resolveGoogleSiteServices } from '@/lib/site-google-services.mjs'
import { isIndexingAuthorized, resolveSiteOrigin } from '@/lib/site-origin'
import './styles/tokens.css'
import './globals.css'
import './styles/foundation.css'
import './styles/docs.css'
import './styles/support.css'
import './styles/atlas.css'

const title = 'Asyra - Framework for canvas-based and domain-driven tools'
const googleServices = resolveGoogleSiteServices()
const description =
  'Build canvas-based editors, visual tools, BIM workspaces, simulations, and other domain products from composable application building blocks.'
const socialImage = {
  url: '/product-evidence/asyra-design-7076-product-evidence.jpg',
  width: 1280,
  height: 720,
  type: 'image/jpeg',
  alt: 'Asyra Design displaying the editable 7,076-element vector cat drawing'
}

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteOrigin()),
  title,
  description,
  applicationName: 'Asyra',
  verification: { google: googleServices.verification },
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
    images: [socialImage],
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
    images: [socialImage],
    card: 'summary_large_image',
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
      <body>
        {children}
        <SiteGoogleAnalytics measurementId={googleServices.measurementId} />
      </body>
    </html>
  )
}
