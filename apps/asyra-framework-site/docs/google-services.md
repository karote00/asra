# Google Search Console and GA4

The site loads Google Analytics only when Vercel identifies the deployment as
Production and a valid GA4 measurement ID is configured. Local development and
Preview deployments do not emit Google tags or the Search Console verification
meta tag. Empty configuration leaves the services disabled; invalid configured
Production identifiers fail the build.

## Production configuration

Set these build-time variables on the existing Vercel site project:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://asyra-framework.vercel.app` |
| `NEXT_PUBLIC_SITE_INDEXING` | `true` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | The website stream's `G-...` measurement ID |
| `GOOGLE_SITE_VERIFICATION` | The HTML meta tag's content value, not the full tag |

Vercel supplies `VERCEL_ENV`. The site-specific Turbo task forwards these
variables to Next.js. Rebuild after configuration changes because metadata,
scripts, and response headers are emitted at build time.

The identifiers become public in the site's HTML. Never place a Google password,
OAuth token, service-account key, or Analytics API secret in these variables.

## Search Console

Use the URL-prefix property `https://asyra-framework.vercel.app/`.
The project does not own DNS for `vercel.app`, so use HTML-tag verification.
Copy the token into the Production environment variable, merge the reviewed PR and let the existing Git integration deploy main, check that the anonymous homepage head contains the token, then press
Verify in Search Console. Keep the token configured after verification.

Submit `https://asyra-framework.vercel.app/sitemap.xml` and inspect the homepage
and a representative document URL. Verification and sitemap submission do not
guarantee indexing or ranking.

## GA4 stream

Use the Asyra account and Asyra Framework Website resource, with Taiwan reporting
time and TWD. The website stream should use the official site URL.

Enable enhanced measurement for page loads and page changes based on browser
history. This is the sole owner of virtual page views: the site initializes
`gtag` once in its root layout and does not separately send manual page views.
Enable outbound clicks to measure GitHub and Demo links. Do not add a second GTM
container or manual navigation tracker for the same measurement ID.

Google signals and ad personalization are disabled by the site's bootstrap.
The CSP permits only the Google Analytics and tag-loading hosts required for
this setup, without adding advertising hosts or production `unsafe-eval`.

Before declaring live collection complete, use Realtime/DebugView to verify one
initial `page_view`, one event per actual internal navigation, and a GitHub or
Demo outbound click. Check the page location and referrer across navigation.
Then link the verified GSC property to the same GA4 website stream if desired.

## Formal checks

Run the existing site unit tests, build, route smoke, and these E2E tests:

- `mobile-image-delivery.spec.ts`: fresh Retina contexts, selected image widths,
  transfer budgets, and screenshots.
- `google-services.spec.ts`: disabled configuration by default; for a server
  built with Google services, set `GOOGLE_SERVICES_TEST_ENABLED=1` plus the
  matching measurement ID and verification token in the test process.

The Google E2E test intercepts the external library, so it checks site integration
and navigation stability without sending test data to Google. It does not prove
that GA4 received real events; the account-side live check remains necessary.

For isolated worktrees, supply `SITE_URL` explicitly and use a free port.
Screenshots belong under Playwright's app-owned output directory.

## References

- <a href="https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications" target="_blank" rel="noopener noreferrer">Google: measure single-page applications</a>
- <a href="https://developers.google.com/tag-platform/security/guides/csp" target="_blank" rel="noopener noreferrer">Google: Content Security Policy requirements</a>
- <a href="https://support.google.com/webmasters/answer/9008080" target="_blank" rel="noopener noreferrer">Google: verify site ownership</a>
