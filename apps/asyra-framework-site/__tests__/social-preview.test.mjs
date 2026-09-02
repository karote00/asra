import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import process from 'node:process'

/* global fetch, URL */

const siteRoot = path.resolve(import.meta.dirname, '..')
const imagePath = '/product-evidence/asyra-design-7076-product-evidence.jpg'

test('social previews use the unchanged canonical 7076 product screenshot', async () => {
  const published = await readFile(path.join(siteRoot, 'public', imagePath))
  const original = await readFile(
    path.resolve(siteRoot, '../../docs/public/assets', path.basename(imagePath))
  )
  assert.deepEqual(published, original)
  assert.deepEqual([...published.subarray(0, 3)], [0xff, 0xd8, 0xff])
  assert.ok(published.byteLength < 5_000_000)
})

test('root metadata includes large Open Graph and Twitter preview images', async () => {
  const layout = await readFile(path.join(siteRoot, 'app/layout.tsx'), 'utf8')
  assert.ok(layout.includes(imagePath))
  assert.match(layout, /openGraph:\s*\{\s*images: \[socialImage\]/u)
  assert.match(layout, /twitter:\s*\{\s*images: \[socialImage\]/u)
  assert.match(layout, /card: 'summary_large_image'/u)
  assert.match(layout, /width: 1280/u)
  assert.match(layout, /height: 720/u)
  assert.match(layout, /type: 'image\/jpeg'/u)
})

test(
  'built HTML exposes a fetchable JPEG preview to LinkedInBot',
  {
    skip: !process.env.SITE_URL
  },
  async () => {
    const response = await fetch(process.env.SITE_URL, {
      headers: { 'User-Agent': 'LinkedInBot/1.0' }
    })
    assert.equal(response.status, 200)
    const html = await response.text()
    const head = html.match(/<head>([\s\S]*?)<\/head>/u)?.[1]
    assert.ok(head, 'metadata must be available without executing JavaScript')
    const meta = (key) =>
      [...head.matchAll(/<meta\s+[^>]*>/gu)]
        .find(
          ([tag]) =>
            tag.includes(`property="${key}"`) || tag.includes(`name="${key}"`)
        )?.[0]
        .match(/content="([^"]*)"/u)?.[1]
    const imageUrl = new URL(meta('og:image'))
    assert.equal(imageUrl.protocol, 'https:')
    assert.equal(imageUrl.pathname, imagePath)
    assert.equal(meta('og:image:width'), '1280')
    assert.equal(meta('og:image:height'), '720')
    assert.equal(meta('og:image:type'), 'image/jpeg')
    assert.ok(meta('og:image:alt'))
    assert.equal(meta('twitter:image'), imageUrl.href)
    assert.equal(meta('twitter:card'), 'summary_large_image')
    const imageResponse = await fetch(
      new URL(imageUrl.pathname, process.env.SITE_URL)
    )
    assert.equal(imageResponse.status, 200)
    assert.match(imageResponse.headers.get('content-type'), /image\/jpeg/u)
    assert.deepEqual(
      Buffer.from(await imageResponse.arrayBuffer()),
      await readFile(path.join(siteRoot, 'public', imagePath))
    )
  }
)
