import { describe, expect } from 'vitest'
import { strokeIntegrationCoverageMap } from './stroke-integration-coverage-map'
import {
  getStrokeInspectorRoute,
  integrationCase,
  loadStrokeInspectorData
} from './stroke-integration-inspector-test-helper'

describe('stroke integration: source mutation ingress', () => {
  integrationCase('source-mutation-ingress-linear-handoff', 'preserves the declared stage handoff through downstream computed-patch subscribers', () => {
    const data = loadStrokeInspectorData()
    const segment = data.wholeFlowReviewContract.reviewSegments.find(
      (entry) => entry.id === 'source-mutation-ingress'
    )
    const coverage = strokeIntegrationCoverageMap.find(
      (entry) => entry.id === 'source-mutation-ingress-linear-handoff'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(segment).toBeDefined()
    expect(coverage).toBeDefined()
    expect(coverage?.stepIds).toEqual(segment?.stepIds)

    const routes = coverage?.routeIds.map((routeId) =>
      getStrokeInspectorRoute(data, routeId)
    )
    expect(routes).toHaveLength(11)
    routes?.forEach((route, index) => {
      expect(route).toMatchObject({
        from: segment?.stepIds[index],
        to: segment?.stepIds[index + 1],
        consumes: [`stage:${segment?.stepIds[index]}`],
        produces: [`stage:${segment?.stepIds[index + 1]}`]
      })
      expect(route.forbiddenContributors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/downstream .*repair|downstream repair/)
        ])
      )
    })
  })

  integrationCase('source-mutation-ingress-linear-handoff', 'keeps source intent, canonical state, topology evidence, and computed patch internal', () => {
    const data = loadStrokeInspectorData()
    const coverage = strokeIntegrationCoverageMap.find(
      (entry) => entry.id === 'source-mutation-ingress-linear-handoff'
    )
    const artifacts = coverage?.artifactIds.map((artifactId) =>
      data.artifactRegistry.find((artifact) => artifact.id === artifactId)
    )

    expect(artifacts).toHaveLength(4)
    expect(artifacts?.every((artifact) => artifact?.channel === 'internal')).toBe(
      true
    )
    expect(JSON.stringify(artifacts)).not.toContain('render-entry')
    expect(JSON.stringify(artifacts)).not.toContain('visible product')
  })
})
