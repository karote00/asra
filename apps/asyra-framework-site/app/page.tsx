import { FrameworkValueStory } from '@/components/framework-value-story'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

interface IllustrationProps {
  alt: string
  className?: string
  eager?: boolean
  height: number
  name: string
  sizes: string
  widths: readonly [number, number, ...number[]]
  width: number
}

function Illustration({
  alt,
  className = '',
  eager = false,
  height,
  name,
  sizes,
  widths,
  width
}: IllustrationProps) {
  const large = widths.at(-1)
  return (
    <img
      alt={alt}
      className={className}
      decoding="async"
      fetchPriority={eager ? 'high' : 'auto'}
      height={height}
      loading={eager ? 'eager' : 'lazy'}
      sizes={sizes}
      src={`/illustrations/${name}-${large}.webp`}
      srcSet={widths
        .map(
          (candidate) =>
            `/illustrations/${name}-${candidate}.webp ${candidate}w`
        )
        .join(', ')}
      width={width}
    />
  )
}

const pocStoryPanels = [
  {
    asyra: {
      alt: 'The domain expert builds the idea directly with AI in the product.',
      image: '/illustrations/poc-storyboard-stage-01-asyra.png',
      title: 'Domain + AI'
    },
    stage: '01',
    traditional: {
      alt: 'A domain expert sketches a domain idea on a whiteboard.',
      image: '/illustrations/poc-storyboard-stage-01-traditional.png',
      title: 'Domain idea'
    },
    width: 374
  },
  {
    asyra: {
      alt: 'The validated proof of concept continues as a real feature.',
      image: '/illustrations/poc-storyboard-stage-02-asyra.png',
      title: 'Real Feature'
    },
    stage: '02',
    traditional: {
      alt: 'A disposable proof of concept is thrown away.',
      image: '/illustrations/poc-storyboard-stage-02-traditional.png',
      title: 'Disposable PoC'
    },
    width: 376
  },
  {
    asyra: {
      alt: 'The domain expert and engineer review the same implementation together.',
      image: '/illustrations/poc-storyboard-stage-03-asyra.png',
      title: 'Engineer review'
    },
    stage: '03',
    traditional: {
      alt: 'A proof of concept stops at a handoff wall between domain expert and engineer.',
      image: '/illustrations/poc-storyboard-stage-03-traditional.png',
      title: 'Handoff'
    },
    width: 374
  },
  {
    asyra: {
      alt: 'The reviewed feature continues into the product.',
      image: '/illustrations/poc-storyboard-stage-04-asyra.png',
      title: 'Product'
    },
    stage: '04',
    traditional: {
      alt: 'A product is rebuilt around the proof of concept.',
      image: '/illustrations/poc-storyboard-stage-04-traditional.png',
      title: 'Rebuild'
    },
    width: 374
  }
] as const

const pocStoryPaths = [
  {
    artworkHeight: 225,
    key: 'traditional',
    label: 'Traditional'
  },
  {
    artworkHeight: 217,
    key: 'asyra',
    label: 'With Asyra'
  }
] as const

const ownershipLayers = [
  {
    detail:
      'Deterministic execution, transactions, rollback, Undo/Redo, and projections.',
    label: 'Framework owned',
    title: 'Repeatable correctness boundaries'
  },
  {
    detail:
      'Selectable official defaults that an App can use, replace, or omit.',
    label: 'Preset owned',
    title: 'A maintained starting composition'
  },
  {
    detail:
      'Schemas, domain rules, workflows, permissions, product UI, and specialized engines.',
    label: 'App owned',
    title: 'What your product means'
  },
  {
    detail:
      'Transport, authorization, durability, and operational policy without a second product owner.',
    label: 'Service owned',
    title: 'External operations and adapters'
  }
] as const

const readinessPaths = [
  {
    body: 'Start from a complete design product, then replace its domain with yours.',
    href: '/docs/start/create-design-app',
    label: 'Product builder',
    link: 'Create a design app'
  },
  {
    body: 'Compose the browser/Core foundation with the capabilities your product needs.',
    href: '/docs/start/custom-composition',
    label: 'Framework composer',
    link: 'Compose the Framework'
  },
  {
    body: 'Inspect the maintained runtime route, owners, and current boundaries.',
    href: '/atlas',
    label: 'Technical evaluator',
    link: 'Open Runtime Atlas'
  }
] as const

export default function HomePage() {
  return (
    <div className="site-shell" id="top">
      <SiteHeader variant="landing" />

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <h1 id="hero-title">
              <span className="reference-line">Build product features, </span>
              <span className="reference-line">not infrastructure.</span>
            </h1>
            <p className="hero__lead">
              <span className="reference-line">
                Build the tool your world needs. You own its information, rules,
                workflows, services, and UI.
              </span>
              <span className="reference-line">
                Asyra keeps intent, transactions, rollback, history,
                persistence, and projections on one governed path.
              </span>
            </p>
            <p className="hero__category">
              A composable application Framework, not a hosted builder, no-code
              platform, canvas widget, or bundle of industry tools.
            </p>
            <div className="button-row">
              <a
                className="button button--red"
                href="/docs/start/custom-composition"
              >
                Start building
              </a>
              <a
                className="text-action"
                href="https://asyra-design.vercel.app/?fileId=demo"
                rel="noopener noreferrer"
                target="_blank"
              >
                Try the demo
              </a>
            </div>
          </div>
          <figure className="hero__visual illustration-stage illustration-stage--light illustration-stage--hero">
            <Illustration
              alt="A modular Asyra foundation with open ports ready for a product to grow"
              className="hero-core"
              eager
              height={1254}
              name="hero-core-v08-desktop-photoroom"
              sizes="(max-width: 800px) calc(200vw - 80px), (max-width: 1100px) 96vw, 1240px"
              widths={[720, 1080, 1400]}
              width={1400}
            />
          </figure>
        </section>

        <section
          className="domains"
          id="domains"
          aria-labelledby="domains-title"
        >
          <div className="domains__heading">
            <h2 id="domains-title">One foundation. Any field.</h2>
            <p>
              Design tools, research workspaces, BIM systems, studio pipelines,
              field apps, simulations, and whatever your world needs next.
            </p>
          </div>
          <div className="domains__rail illustration-stage illustration-stage--dark illustration-stage--rail">
            <picture className="domain-rail__picture">
              <source
                height={325}
                media="(max-width: 680px)"
                sizes="100vw"
                srcSet="/illustrations/domain-rail-v08-desktop-photoroom-row-1-800.webp 800w, /illustrations/domain-rail-v08-desktop-photoroom-row-1-1200.webp 1200w"
                width={1200}
              />
              <Illustration
                alt="Examples: Design, Photography, Research, BIM, Education, Manufacturing, Media, Operations, Simulation, and Your field"
                className="domain-rail"
                height={325}
                name="domain-rail-v08-desktop-photoroom"
                sizes="110vw"
                widths={[800, 1600, 2400]}
                width={2400}
              />
            </picture>
            <Illustration
              alt=""
              className="domain-rail__second"
              height={325}
              name="domain-rail-v08-desktop-photoroom-row-2"
              sizes="100vw"
              widths={[800, 1200]}
              width={1200}
            />
          </div>
        </section>

        <FrameworkValueStory />

        <section
          aria-labelledby="product-evidence-title"
          className="product-evidence"
        >
          <div className="product-evidence__copy">
            <p className="eyebrow">Built with Asyra</p>
            <h2 id="product-evidence-title">
              A real product. One shared foundation.
            </h2>
            <p>
              Asyra Design turns app-owned design rules into editable product
              behavior. The interface, tools, and drawing semantics belong to
              the App; Asyra supplies the reusable execution, history,
              persistence, rendering, and optional AI boundaries beneath them.
            </p>
            <ul className="product-evidence__facts">
              <li>7,076 editable vector elements</li>
              <li>App-owned Features and design rules</li>
              <li>Undo/Redo, rendering, and persistence on the same owners</li>
            </ul>
            <div className="evidence-actions">
              <a
                className="button button--red"
                href="https://asyra-design.vercel.app/?fileId=demo"
                rel="noopener noreferrer"
                target="_blank"
              >
                Open the live product
              </a>
              <a className="text-action" href="/asyra-design">
                Read the product case
              </a>
            </div>
          </div>
          <figure className="product-evidence__frame">
            <img
              alt="Asyra Design displaying a complete 7,076-element vector cat face, with its editable layer tree, AI action progress, and Undo control visible"
              decoding="async"
              height={720}
              loading="lazy"
              src="/product-evidence/asyra-design-7076-product-evidence.webp"
              width={1280}
            />
            <figcaption>
              Current product evidence: the completed 7,076-element drawing
              remains ordinary editable product information.
            </figcaption>
          </figure>
        </section>

        <section
          className="poc-story"
          id="how-it-works"
          aria-labelledby="poc-story-title"
        >
          <div className="poc-story__inner">
            <div className="poc-story__heading">
              <div>
                <p className="eyebrow">PoC to product</p>
                <h2 id="poc-story-title">Prove it once. Keep what works.</h2>
              </div>
              <div className="poc-story__intro">
                <p className="poc-story__summary">
                  <strong>Keep validated work moving.</strong>
                  What proves the idea becomes the starting point for the
                  product.
                </p>
                <ul aria-label="Storyboard paths" className="poc-story__legend">
                  <li className="poc-story__legend-item poc-story__legend-item--traditional">
                    <span
                      aria-hidden="true"
                      className="poc-story__legend-swatch poc-story__legend-swatch--traditional"
                    />
                    <span>Traditional</span>
                  </li>
                  <li className="poc-story__legend-item poc-story__legend-item--asyra">
                    <span
                      aria-hidden="true"
                      className="poc-story__legend-swatch poc-story__legend-swatch--asyra"
                    />
                    <span>With Asyra</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="story-panels">
              {pocStoryPaths.map((path) => (
                <section
                  aria-labelledby={`story-flow-${path.key}`}
                  className={`story-flow story-flow--${path.key}`}
                  key={path.key}
                >
                  <h3
                    className="story-flow__label"
                    id={`story-flow-${path.key}`}
                  >
                    {path.label}
                  </h3>
                  <ol
                    aria-label={`${path.label} product path`}
                    className="story-flow__steps"
                  >
                    {pocStoryPanels.map((panel) => {
                      const scene = panel[path.key]

                      return (
                        <li
                          className="story-panel"
                          key={`${path.key}-${panel.stage}`}
                        >
                          <header className="story-panel__header">
                            <span className="story-panel__stage">
                              {panel.stage}
                            </span>
                          </header>
                          <figure
                            className={`story-panel__scene story-panel__scene--${path.key}`}
                          >
                            <figcaption className="story-panel__scene-header">
                              <h4 className="story-panel__title">
                                {scene.title}
                              </h4>
                            </figcaption>
                            <div
                              className="story-panel__artwork-frame"
                              style={{
                                aspectRatio: `${panel.width} / ${path.artworkHeight}`
                              }}
                            >
                              <img
                                alt={scene.alt}
                                className="story-panel__artwork"
                                decoding="async"
                                height={path.artworkHeight}
                                loading="lazy"
                                src={scene.image}
                                width={panel.width}
                              />
                            </div>
                          </figure>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              ))}
            </div>

            <p className="poc-story__governance">
              <strong>Engineering still owns production readiness:</strong>{' '}
              review, tests, security, and performance.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="feature-evidence-title"
          className="feature-evidence"
        >
          <header className="feature-evidence__heading">
            <p className="eyebrow">Code to runtime</p>
            <h2 id="feature-evidence-title">One Feature. Every caller.</h2>
            <p>
              The App names the behavior once. A person or AI action enters the
              same public boundary, so callers do not grow parallel product
              decisions.
            </p>
          </header>
          <div className="feature-evidence__body">
            <figure className="code-proof">
              <figcaption>
                App-owned behavior from the maintained public guide
              </figcaption>
              <pre aria-label="TypeScript Feature example">
                <code>{`import { defineFeature } from '@asyra/core'

type ReviewState = 'pending' | 'approved'
const state = new Map<string, ReviewState>([
  ['review-1', 'pending']
])

export const reviewActions = defineFeature(
  'app.reviewActions', undefined, {
  priority: 30,
  exclusive: true,
  api: {
    setStatus(id: string, status: ReviewState) {
      if (!state.has(id)) {
        throw new Error(\`Unknown review: \${id}\`)
      }
      state.set(id, status)
      return { id, status }
    }
  }
})`}</code>
              </pre>
              <p>
                In a document-backed Feature, this body calls the generated App
                common API so Factory owns the transaction and Undo evidence.
              </p>
              <a className="text-action" href="/docs/build/feature-session">
                Read the complete Feature session guide
              </a>
            </figure>
            <div className="runtime-proof">
              <ol aria-label="Governed Feature runtime path">
                <li>
                  <span>01</span>
                  <strong>Person or AI intent</strong>
                  <small>Different callers, one product decision</small>
                </li>
                <li>
                  <span>02</span>
                  <strong>App Feature and public API</strong>
                  <small>
                    The App owns meaning, validation, and permission
                  </small>
                </li>
                <li>
                  <span>03</span>
                  <strong>Transaction and canonical owner</strong>
                  <small>
                    Asyra supplies commit, rollback, and history boundaries
                  </small>
                </li>
                <li>
                  <span>04</span>
                  <strong>Projections update</strong>
                  <small>
                    UI, persistence, collaboration, and AI read the accepted
                    result
                  </small>
                </li>
              </ol>
              <figure className="illustration-stage illustration-stage--light illustration-stage--proof illustration-stage--same-path">
                <Illustration
                  alt="Human and AI inputs traveling through one shared feature gate to the same action"
                  className="proof-image proof-image--same-path"
                  height={887}
                  name="same-path-photoroom"
                  sizes="(max-width: 680px) 88vw, (max-width: 1100px) 48vw, 650px"
                  widths={[720, 1280, 1774]}
                  width={1774}
                />
              </figure>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="ownership-title"
          className="landing-ownership"
        >
          <header>
            <p className="eyebrow">Clear ownership</p>
            <h2 id="ownership-title">
              You own the product. Asyra owns the repeatable boundaries.
            </h2>
          </header>
          <div className="landing-ownership__grid">
            {ownershipLayers.map((layer) => (
              <article key={layer.label}>
                <p>{layer.label}</p>
                <h3>{layer.title}</h3>
                <span>{layer.detail}</span>
              </article>
            ))}
          </div>
        </section>

        <div className="proof-stack">
          <section
            className="proof proof--visual-first"
            aria-labelledby="grow-title"
          >
            <div className="proof__copy">
              <p className="eyebrow">Grow</p>
              <h2 id="grow-title">
                <span className="reference-line">Add what your workflow</span>
                <span className="reference-line">needs without rebuilding</span>
                <span className="reference-line">the rest.</span>
              </h2>
            </div>
            <figure className="proof__visual illustration-stage illustration-stage--light illustration-stage--proof illustration-stage--grow">
              <Illustration
                alt="A new capability module joining one open port while the surrounding system stays fixed"
                className="proof-image proof-image--grow"
                height={1036}
                name="grow-photoroom"
                sizes="(max-width: 800px) calc(200vw - 80px), (max-width: 1100px) 92vw, 1120px"
                widths={[720, 1200, 1518]}
                width={1518}
              />
            </figure>
          </section>

          <section
            className="proof proof--visual-first"
            aria-labelledby="source-title"
          >
            <div className="proof__copy">
              <p className="eyebrow">One source</p>
              <h2 id="source-title">
                <span className="reference-line">
                  One source of truth across
                </span>
                <span className="reference-line">every feature and view.</span>
              </h2>
            </div>
            <figure className="proof__visual illustration-stage illustration-stage--light illustration-stage--proof illustration-stage--one-source">
              <Illustration
                alt="Four different product views connected to one stable information source"
                className="proof-image proof-image--one-source"
                height={800}
                name="one-source-v08-desktop-photoroom"
                sizes="(max-width: 800px) calc(200vw - 80px), (max-width: 1100px) 92vw, 1120px"
                widths={[720, 1280, 1536]}
                width={1536}
              />
            </figure>
          </section>
        </div>

        <section aria-labelledby="readiness-title" className="readiness">
          <header>
            <p className="eyebrow">Ready now</p>
            <h2 id="readiness-title">Choose your starting point</h2>
            <p>
              Current browser/Core support, the official 2D Preset, and
              engine-neutral custom composition are available today. Future
              runtime directions remain roadmap, not a public API promise.
            </p>
          </header>
          <div className="readiness__paths">
            {readinessPaths.map((path) => (
              <article key={path.label}>
                <p>{path.label}</p>
                <span>{path.body}</span>
                <a href={path.href}>{path.link}</a>
              </article>
            ))}
          </div>
        </section>

        <section
          className="closing illustration-stage illustration-stage--dark illustration-stage--closing"
          aria-labelledby="closing-title"
        >
          <div className="closing__copy">
            <h2 id="closing-title">
              <span className="reference-line">Bring your domain.</span>
              <span className="reference-line">Keep its logic.</span>
            </h2>
          </div>
          <Illustration
            alt="A protected domain core inside one continuous blue infrastructure loop"
            className="closing__core"
            height={1024}
            name="closing-core-v09-photoroom"
            sizes="(max-width: 800px) 340px, (max-width: 1100px) 340px, 480px"
            widths={[960, 1280, 1536]}
            width={1536}
          />
          <a
            className="button button--red closing__button"
            href="/docs/start/custom-composition"
          >
            Start building
          </a>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
