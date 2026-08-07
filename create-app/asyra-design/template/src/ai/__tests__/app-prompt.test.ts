import { describe, expect, it } from 'vitest'
import {
  AI_APP_PROMPT,
  AI_IMAGE_TOOL_CATALOG,
  AiImageToolIds
} from '../app-prompt'

describe('Design App App-owned AI prompt', () => {
  it('defines the complete registered image-tool decision pipeline without hidden reasoning', () => {
    expect(AI_APP_PROMPT).toMatch(
      /analyze the user request, accepted attachments, and current canonical context/i
    )
    expect(AI_APP_PROMPT).toMatch(/only App-registered image tools/i)
    expect(AI_APP_PROMPT).toMatch(/original or derived raster.*VTracer/is)
    expect(AI_APP_PROMPT).toMatch(
      /validate and post-process.*resource impact.*action batch/is
    )
    expect(AI_APP_PROMPT).toMatch(/confirmation.*registered actions/is)
    expect(AI_APP_PROMPT).toMatch(/do not expose.*chain-of-thought/i)
    expect(AI_APP_PROMPT).toMatch(
      /do not invent or invoke an unregistered\s+tool/i
    )
  })

  it('advertises only whole-image VTracer in the image-tool catalog', () => {
    expect(AI_IMAGE_TOOL_CATALOG).toEqual([
      {
        capabilities: ['whole-image-raster-vectorization'],
        id: AiImageToolIds.VTRACER,
        inputMediaTypes: ['image/jpeg', 'image/png', 'image/webp']
      }
    ])
    expect(JSON.stringify(AI_IMAGE_TOOL_CATALOG)).not.toMatch(
      /segment|remove-background|reimage|crop/i
    )
  })
})
