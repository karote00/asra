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

export default function HomePage() {
  return (
    <div className="site-shell" id="top">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Asyra home">
          ASYRA
        </a>
        <nav className="primary-nav" aria-label="Primary navigation">
          <a href="#examples">Examples</a>
          <a href="#how-it-works">How it works</a>
          <a href="/docs">Docs</a>
          <a href="/atlas">Atlas</a>
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <h1 id="hero-title">
              <span className="reference-line">Build the tool</span>
              <span className="reference-line">your world needs.</span>
            </h1>
            <p className="hero__lead">
              <span className="reference-line">
                You bring the domain knowledge. AI builds with Asyra.
              </span>
              <span className="reference-line">
                Your tool stays easy to extend, automate, and undo.
              </span>
            </p>
            <div className="button-row">
              <a
                className="button button--red"
                href="/docs/start/custom-composition"
              >
                Start building
              </a>
              <a className="text-action" href="#examples">
                See examples
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
          id="examples"
          aria-labelledby="domains-title"
        >
          <div className="domains__heading">
            <h2 id="domains-title">One foundation. Any field.</h2>
            <p>
              Design tools, research workspaces, BIM systems, studio pipelines,
              field apps, simulations, and whatever your world needs next.
            </p>
            <span>Examples, not limits.</span>
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

          <section className="proof" aria-labelledby="path-title">
            <div className="proof__copy">
              <p className="eyebrow">Same path</p>
              <h2 id="path-title">
                <span className="reference-line">Build each feature once.</span>
                <span className="reference-line">People and AI use the</span>
                <span className="reference-line">same action path.</span>
              </h2>
            </div>
            <figure className="proof__visual illustration-stage illustration-stage--light illustration-stage--proof illustration-stage--same-path">
              <Illustration
                alt="Human and AI inputs traveling through one shared feature gate to the same action"
                className="proof-image proof-image--same-path"
                height={887}
                name="same-path-photoroom"
                sizes="(max-width: 800px) calc(200vw - 80px), (max-width: 1100px) 104vw, 1360px"
                widths={[720, 1280, 1774]}
                width={1774}
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

      <footer className="site-footer">
        <a className="wordmark" href="#top">
          ASYRA
        </a>
        <nav aria-label="Footer navigation">
          <a href="/docs">Docs</a>
          <a href="https://github.com/karote00/asyra">GitHub</a>
          <a href="/roadmap">Roadmap</a>
        </nav>
        <p className="project-identity">
          <span>2026</span>
          <a href="https://github.com/karote00/asyra/blob/main/LICENSE">
            MIT License
          </a>
        </p>
      </footer>
    </div>
  )
}
