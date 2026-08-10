export interface VerifiedLandingLink {
  href: string
  title: string
  verifiedAt: string
  evidence: string
}

export const verifiedLandingFacts: Readonly<{
  designApp: Readonly<VerifiedLandingLink>
}>
