import { describe, expect, it } from 'vitest'
import { AI_APP_PROMPT, AI_IMAGE_TOOL_CATALOG } from '../ai-domain-prompt'

describe('Asyra Design backend-owned AI domain prompt', () => {
  it('defines the registered App action and image-tool policy on the server', () => {
    expect(AI_APP_PROMPT).toMatch(
      /registered App actions and image tools\s+supplied with the current request/i
    )
    expect(AI_APP_PROMPT).toMatch(/only App-registered image tools/i)
    expect(AI_APP_PROMPT).toMatch(/original or derived raster.*VTracer/is)
    expect(AI_APP_PROMPT).toMatch(
      /must not enter canonical state, persistence, or collaboration/i
    )
    expect(AI_APP_PROMPT).toMatch(/confirmation.*registered actions/is)
    expect(AI_APP_PROMPT).toMatch(/do not expose.*chain-of-thought/i)
    expect(AI_APP_PROMPT).toMatch(
      /Never regenerate a\s+complete composition as a fallback/i
    )
  })

  it('advertises only registered backend image capabilities', () => {
    expect(AI_IMAGE_TOOL_CATALOG).toEqual([
      {
        capabilities: ['whole-image-raster-vectorization'],
        id: 'vtracer',
        inputMediaTypes: ['image/jpeg', 'image/png', 'image/webp']
      }
    ])
    expect(JSON.stringify(AI_IMAGE_TOOL_CATALOG)).not.toMatch(
      /background-removal|segmentation|crop/
    )
  })
})
