import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { isIndexingAuthorized, resolveSiteOrigin } from '@/lib/site-origin'
import './globals.css'

const description =
  'Bring your domain knowledge. Build the tool your world needs on Asyra.'

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteOrigin()),
  title: 'Asyra - Build the tool your world needs',
  description,
  applicationName: 'Asyra',
  alternates: { canonical: '/' },
  openGraph: {
    description,
    siteName: 'Asyra',
    title: 'Asyra - Build the tool your world needs',
    type: 'website',
    url: '/'
  },
  robots: isIndexingAuthorized()
    ? { follow: true, index: true }
    : { follow: false, index: false },
  twitter: {
    card: 'summary',
    description,
    title: 'Asyra - Build the tool your world needs'
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
