import Script from 'next/script'
import { googleAnalyticsBootstrap } from '@/lib/site-google-services.mjs'

export function SiteGoogleAnalytics({
  measurementId
}: {
  measurementId?: string
}) {
  if (!measurementId) return null

  return (
    <>
      <Script id="asyra-ga-init" strategy="afterInteractive">
        {googleAnalyticsBootstrap(measurementId)}
      </Script>
      <Script
        id="asyra-ga-library"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
    </>
  )
}
