export interface GoogleSiteServices {
  measurementId?: string
  verification?: string
}

export function resolveGoogleSiteServices(
  environment?: Readonly<Record<string, string | undefined>>
): GoogleSiteServices

export function googleAnalyticsBootstrap(measurementId: string): string
