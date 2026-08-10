import Link from 'next/link'
import { ArrowUpRight, BookOpen, Boxes, Sparkles } from 'lucide-react'
import type { ContentBundle } from '@/lib/content'
import { sourceHref } from '@/lib/content'
import { verifiedLandingFacts } from '@/lib/landing-facts'

interface LandingEntryEvidenceProps {
  bundle: ContentBundle
}

export function LandingEntryEvidence({ bundle }: LandingEntryEvidenceProps) {
  const licenseHref = sourceHref(bundle, 'LICENSE')
  const contributionHref = sourceHref(
    bundle,
    'README.md',
    '#support-and-contribution-policy'
  )

  return (
    <>
      <section aria-labelledby="entry-heading" className="landing-entry">
        <header className="landing-section-heading">
          <p className="section-eyebrow">
            Choose the distance you want to travel
          </p>
          <h2 id="entry-heading">
            Begin with a product, the documentation, or the parts.
          </h2>
          <p>
            You do not need to understand every package before beginning. Start
            with a working design product, study one Framework route, or compose
            only the infrastructure your own product needs.
          </p>
        </header>

        <div className="landing-entry__paths">
          <article>
            <div className="landing-entry__coordinate">
              <span>01</span>
              <Sparkles aria-hidden="true" size={19} />
            </div>
            <p className="technical-label">Working-product path</p>
            <h3>Start with a working product</h3>
            <p>
              Generate <code>create-asyra-design-app</code>, open a usable 2D
              product, then extend it through the Framework documentation with
              help from AI or by hand.
            </p>
            <Link href="/docs/start/create-design-app">
              Generate and extend
              <ArrowUpRight aria-hidden="true" size={17} />
            </Link>
          </article>

          <article>
            <div className="landing-entry__coordinate">
              <span>02</span>
              <BookOpen aria-hidden="true" size={19} />
            </div>
            <p className="technical-label">Framework-learning path</p>
            <h3>Learn the Framework</h3>
            <p>
              Read task-focused guides with copyable code, then use Runtime
              Atlas to inspect how intent, ownership, transactions, outcomes,
              and failure paths fit together in a running system.
            </p>
            <div className="landing-entry__links">
              <Link href="/docs">Read the guides</Link>
              <Link href="/atlas">Open Runtime Atlas</Link>
            </div>
          </article>

          <article>
            <div className="landing-entry__coordinate">
              <span>03</span>
              <Boxes aria-hidden="true" size={19} />
            </div>
            <p className="technical-label">Custom-product path</p>
            <h3>Compose a custom product</h3>
            <p>
              Begin with an App-owned information model and add public packages,
              optional defaults, providers, and projections only where their
              contracts match your product.
            </p>
            <Link href="/docs/start/custom-composition">
              Plan a custom composition
              <ArrowUpRight aria-hidden="true" size={17} />
            </Link>
          </article>
        </div>
      </section>

      <section
        aria-labelledby="reference-product-heading"
        className="landing-reference"
      >
        <div className="landing-reference__drawing" aria-hidden="true">
          <span>PRODUCT / 01 · REFERENCE PRODUCT</span>
          <svg className="landing-reference__blueprint" viewBox="0 0 720 520">
            <g className="landing-reference__construction">
              <path d="M58 430L350 260L662 416L366 486Z" />
              <path d="M92 410L92 238L352 100L352 260" />
              <path d="M352 100L624 222V398" />
              <path d="M92 238L366 356L624 222" />
              <path d="M146 261V389M208 286V416M274 316V442" />
              <path d="M408 126V330M472 155V356M540 186V381" />
              <path d="M92 326L366 444L624 310" />
              <path d="M58 430L58 450M350 260V282M662 416V438M366 486V506" />
            </g>
            <g className="landing-reference__structure">
              <path d="M116 247L350 128L598 235V382L365 460L116 369Z" />
              <path d="M116 305L365 406L598 322" />
              <path d="M350 128V296L116 369M350 296L598 382" />
              <path d="M170 331V387M228 354V411M430 380V438M492 359V417" />
            </g>
          </svg>
          <div className="landing-reference__toolbar">
            {Array.from({ length: 8 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
          <b>CANONICAL MODEL / MULTI-VIEW</b>
        </div>
        <div className="landing-reference__copy">
          <p className="section-eyebrow">
            Reference product, not Framework authority
          </p>
          <h2 id="reference-product-heading">
            See one real product made with Asyra.
          </h2>
          <p>
            Asyra Design shows the division in practice: reusable Framework
            infrastructure underneath, design-tool defaults where selected, and
            App-owned product behavior above them.
          </p>
          <div className="landing-reference__actions">
            <a
              href={verifiedLandingFacts.designApp.href}
              rel="noreferrer"
              target="_blank"
            >
              Open {verifiedLandingFacts.designApp.title}
              <ArrowUpRight aria-hidden="true" size={17} />
            </a>
            <Link href="/asyra-design">Read the responsibility map</Link>
          </div>
          <small>
            Verified {verifiedLandingFacts.designApp.verifiedAt} · public stable
            alias
          </small>
        </div>
      </section>

      <section aria-labelledby="evidence-heading" className="landing-evidence">
        <header>
          <p className="section-eyebrow">Public evidence, not promises</p>
          <h2 id="evidence-heading">
            Inspect the candidate and its boundaries.
          </h2>
          <p>
            Versions, package count, policies, and source destinations resolve
            from the accepted repository inputs used to build this site.
          </p>
        </header>

        <div className="landing-evidence__candidate">
          <p className="technical-label">Current repository candidate</p>
          <strong>{bundle.release.status}</strong>
          <span>Family {bundle.release.family}</span>
          <span>{bundle.release.packageCount} public packages</span>
          <em>Publication is not authorized</em>
        </div>

        <nav aria-label="Public project evidence">
          <Link href="/docs">Documentation</Link>
          <Link href="/releases">Release inventory</Link>
          <Link href="/roadmap">Roadmap</Link>
          <Link href="/docs/reference/support-release#security-reporting">
            Security reporting
          </Link>
          <a href={bundle.repositoryHref}>Source repository</a>
          <a href={licenseHref}>MIT License</a>
          <a href={contributionHref}>Contribution policy</a>
        </nav>

        <p className="landing-evidence__policy">
          External issues and contributions are not accepted at this time.
          Security-sensitive reports use the private route in the security
          guide.
        </p>
      </section>
    </>
  )
}
