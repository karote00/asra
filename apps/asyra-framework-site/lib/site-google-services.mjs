import process from 'node:process'

const requireMeasurementId = (value) => {
  if (!/^G-[A-Z0-9]{6,}$/.test(value)) {
    throw new Error('GA4 measurement ID must use the G- identifier format')
  }
  return value
}

export const resolveGoogleSiteServices = (environment = process.env) => {
  if (environment.VERCEL_ENV !== 'production') return {}
  const settings = {}
  const measurementId = environment.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()
  const verification = environment.GOOGLE_SITE_VERIFICATION?.trim()
  if (measurementId)
    settings.measurementId = requireMeasurementId(measurementId)
  if (verification) {
    if (!/^[A-Za-z0-9_-]+$/.test(verification)) {
      throw new Error(
        'Google verification token must be the meta content value'
      )
    }
    settings.verification = verification
  }
  return settings
}

export const googleAnalyticsBootstrap = (measurementId) => {
  const id = JSON.stringify(requireMeasurementId(measurementId))
  // GA4 enhanced measurement owns the initial and history-based page views.
  return [
    'window.dataLayer=window.dataLayer||[];',
    'function gtag(){dataLayer.push(arguments);}',
    'gtag("js",new Date());',
    `gtag("config",${id},{allow_google_signals:false,allow_ad_personalization_signals:false});`
  ].join('\n')
}
