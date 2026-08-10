import { LandingHero } from '@/components/landing-hero'
import { LandingOwnershipExplorer } from '@/components/landing-ownership-explorer'
import { LandingPossibilityField } from '@/components/landing-possibility-field'
import { LandingStory } from '@/components/landing-story'
import { LandingTopology } from '@/components/landing-topology'
import { loadContentBundle } from '@/lib/content'

export default function LandingPage() {
  const { release } = loadContentBundle()

  return (
    <div className="landing-route">
      <LandingHero release={release} />
      <LandingPossibilityField />
      <LandingStory />
      <LandingOwnershipExplorer />
      <LandingTopology />
    </div>
  )
}
