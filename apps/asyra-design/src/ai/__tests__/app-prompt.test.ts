import { describe, expect, it } from 'vitest'
import {
  ASYRA_DESIGN_AI_APP_PROMPT,
  ASYRA_DESIGN_AI_IMAGE_TOOL_CATALOG,
  AsyraDesignAiImageToolIds
} from '../app-prompt'

describe('Asyra Design App-owned AI prompt', () => {
  it('defines the complete registered image-tool decision pipeline without hidden reasoning', () => {
    expect(ASYRA_DESIGN_AI_APP_PROMPT).toMatch(
      /analyze the user request, accepted attachments, and current canonical context/i
    )
    expect(ASYRA_DESIGN_AI_APP_PROMPT).toMatch(
      /only App-registered image tools/i
    )
    expect(ASYRA_DESIGN_AI_APP_PROMPT).toMatch(
      /original or derived raster.*VTracer/is
    )
    expect(ASYRA_DESIGN_AI_APP_PROMPT).toMatch(
      /validate and post-process.*resource impact.*action batch/is
    )
    expect(ASYRA_DESIGN_AI_APP_PROMPT).toMatch(
      /confirmation.*registered actions/is
    )
    expect(ASYRA_DESIGN_AI_APP_PROMPT).toMatch(
      /do not expose.*chain-of-thought/i
    )
    expect(ASYRA_DESIGN_AI_APP_PROMPT).toMatch(
      /do not invent or invoke an unregistered\s+tool/i
    )
  })

  it('advertises only whole-image VTracer in the image-tool catalog', () => {
    expect(ASYRA_DESIGN_AI_IMAGE_TOOL_CATALOG).toEqual([
      {
        capabilities: ['whole-image-raster-vectorization'],
        id: AsyraDesignAiImageToolIds.VTRACER,
        inputMediaTypes: ['image/jpeg', 'image/png', 'image/webp']
      }
    ])
    expect(JSON.stringify(ASYRA_DESIGN_AI_IMAGE_TOOL_CATALOG)).not.toMatch(
      /segment|remove-background|reimage|crop/i
    )
  })
})
