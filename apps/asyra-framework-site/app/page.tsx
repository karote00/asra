import { LandingHero } from '@/components/landing-hero'
import { LandingEntryEvidence } from '@/components/landing-entry-evidence'
import { LandingOwnershipExplorer } from '@/components/landing-ownership-explorer'
import { LandingPossibilityField } from '@/components/landing-possibility-field'
import { LandingStory } from '@/components/landing-story'
import { LandingTopology } from '@/components/landing-topology'
import { loadContentBundle } from '@/lib/content'

export default function LandingPage() {
  const bundle = loadContentBundle()

  return (
    <div className="landing-route">
      <LandingHero release={bundle.release} />
      <LandingPossibilityField />
      <LandingStory />
      <LandingOwnershipExplorer />
      <LandingTopology />
      <LandingEntryEvidence bundle={bundle} />
    </div>
  )
}
