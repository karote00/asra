# E2E Testing Architecture

## Overview

The E2E testing architecture provides comprehensive end-to-end validation of the Asra design tool using Playwright. This system ensures that all user interactions work correctly across different browsers and platforms while maintaining the quality and reliability expected in a production application.

## Architecture Components

### Test Framework Stack
- **Playwright**: Primary E2E testing framework
- **TypeScript**: Type-safe test development
- **Vite**: Development server for test environment
- **Chromium**: Primary target browser for CI/CD
- **HTML Reporter**: Test result visualization

### Test Organization
```
apps/ui/e2e/
├── spec/                    # Test specifications
│   ├── app.spec.ts          # Application initialization
│   ├── element-creation.spec.ts  # Element creation workflows
│   ├── selection.spec.ts    # Selection functionality
│   ├── properties.spec.ts   # Property editing
│   ├── tool-switching.spec.ts  # Tool switching behavior
│   ├── viewport-navigation.spec.ts  # Canvas navigation
│   └── undo-redo.spec.ts    # Undo/redo functionality
├── test-utils.ts            # Shared test utilities
└── fixtures/                # Test data and setup (future)
```

### Test Configuration

#### Playwright Configuration
```typescript
// apps/ui/playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'yarn react:start',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120 * 1000
      }
})
```

#### CI/CD Integration
- **GitHub Actions**: Automated test execution
- **PR Triggers**: Tests run on every pull request
- **Scheduled Runs**: Daily execution at 9 AM Taiwan time
- **Artifact Storage**: Test results and reports preserved
- **Failure Notifications**: Automatic alerts on test failures

## Test Patterns and Standards

### Data-testid Strategy
All interactive elements must have stable `data-testid` attributes:

```typescript
// ✅ Good: Stable test identifiers
<button data-testid="tool-rectangle" data-active={isActive}>
  Rectangle Tool
</button>

<div data-testid="properties-panel" data-open={isOpen}>
  {/* Properties content */}
</div>

// ❌ Bad: Unstable selectors
<button className="btn btn-primary">
  Rectangle Tool
</button>
```

### Test Utilities
Shared utilities for common testing patterns:

```typescript
// apps/ui/e2e/test-utils.ts
export class TestUtils {
  static async waitForAppLoad(page: Page) {
    await page.waitForSelector('[data-testid="app-container"]')
    await page.waitForLoadState('networkidle')
  }

  static async selectTool(page: Page, toolName: string) {
    await page.click(`[data-testid="tool-${toolName}"]`)
    await expect(page.locator(`[data-testid="tool-${toolName}"]`))
      .toHaveAttribute('data-active', 'true')
  }

  static async createRectangle(page: Page, bounds: {
    x: number, y: number, width: number, height: number
  }) {
    await page.mouse.move(bounds.x, bounds.y)
    await page.mouse.down()
    await page.mouse.move(bounds.x + bounds.width, bounds.y + bounds.height)
    await page.mouse.up()
  }

  static async expectElementSelected(page: Page, elementId: string) {
    await expect(page.locator(`[data-testid="element-${elementId}"]`))
      .toHaveAttribute('data-selected', 'true')
  }
}
```

### Cross-Platform Testing
Tests handle platform differences automatically:

```typescript
// Cross-platform keyboard shortcuts
const platformKey = process.platform === 'darwin' ? 'Meta' : 'Control'
await page.keyboard.press(`${platformKey}+z`)  // Undo
await page.keyboard.press(`${platformKey}+Shift+z`)  // Redo

// Neutral area focus to avoid triggering tools
await page.click('[data-testid="header"]')
```

## Test Coverage Areas

### Application Initialization
- Application loads without errors
- Default tool state is correct
- Initial viewport renders properly
- System context initialized correctly

### Element Creation
- Rectangle creation via mouse drag
- Element creation with keyboard shortcuts
- Multiple element creation
- Element positioning accuracy
- Creation while other tools active

### Element Selection
- Single element selection
- Multiple element selection
- Selection clearing
- Selection persistence
- Keyboard navigation (Tab, Shift+Tab)

### Property Editing
- Property value changes
- Real-time property updates
- Property validation
- Multiple element property editing
- Property reset functionality

### Tool Switching
- Toolbar tool selection
- Keyboard tool switching
- Context-sensitive tool behavior
- Tool state persistence
- Rapid tool switching

### Viewport Navigation
- Pan operations (mouse drag, keyboard)
- Zoom operations (mouse wheel, keyboard)
- Fit-to-screen functionality
- Viewport state persistence
- Navigation during operations

### Undo/Redo System
- Undo after element creation
- Undo after property changes
- Undo after viewport changes
- Redo after undo operations
- Multiple undo/redo steps

## Test Environment Management

### Development Testing
```bash
# Run all E2E tests locally
yarn test:e2e

# Run with UI mode for debugging
yarn test:e2e:ui

# Run headed mode for visual debugging
yarn test:e2e:headed

# Run with debugger
yarn test:e2e:debug
```

### CI/CD Testing
```bash
# Complete E2E test flow (used in CI)
bash scripts/run-e2e.sh
```

### Test Server Management
- **Development**: Automatic server start/stop
- **CI/CD**: Production build with preview server
- **Timeouts**: Configurable startup and test timeouts
- **Cleanup**: Automatic server cleanup on completion

## Error Handling and Debugging

### Test Isolation
- Each test runs in isolation
- Automatic cleanup between tests
- Consistent initial state setup
- No test dependencies

### Error Reporting
- Screenshots on test failure
- Video recording of test runs
- Detailed error messages with stack traces
- HTML test report with timeline view

### Debugging Tools
- Playwright Inspector for step-by-step debugging
- Browser DevTools integration
- Console log capture and reporting
- Network request/response logging

## Performance Considerations

### Test Execution Speed
- Parallel test execution where possible
- Optimized test data setup
- Minimal unnecessary wait times
- Efficient element selectors

### Resource Management
- Memory usage monitoring during tests
- Browser process cleanup
- Test server resource management
- CI/CD resource optimization

### Reliability
- Retry mechanisms for flaky tests
- Proper wait strategies
- Element state validation
- Network condition handling

## Integration with Development Workflow

### Pre-commit Testing
- Fast feedback on UI changes
- Integration with local development
- Continuous test running during development

### PR Validation
- Automated test execution on PR creation
- Test result reporting in PR comments
- Blocking merges on test failures
- Historical test result tracking

### Release Validation
- Full E2E test suite before releases
- Regression testing for bug fixes
- Performance impact assessment
- Cross-browser compatibility validation

## Future Enhancements

### Expanded Browser Support
- Firefox and Safari testing
- Mobile browser testing
- Different device sizes
- Accessibility testing

### Visual Testing
- Visual regression testing
- Screenshot comparison
- Component-level visual testing
- Design system validation

### Performance Testing
- Load testing for complex scenarios
- Memory leak detection
- Rendering performance measurement
- Network performance assessment

### Accessibility Testing
- Automated accessibility checks
- Screen reader testing
- Keyboard navigation validation
- WCAG compliance testing

## Best Practices

### Test Development
1. **Use Stable Selectors**: Always prefer `data-testid` over CSS classes or DOM structure
2. **Test User Behavior**: Focus on what users do, not implementation details
3. **Handle Async Properly**: Use appropriate wait strategies for dynamic content
4. **Maintain Test Independence**: Tests should not depend on each other
5. **Provide Clear Descriptions**: Use descriptive test names and comments

### Error Prevention
1. **Validate Element State**: Check elements are ready before interaction
2. **Handle Platform Differences**: Account for Mac vs Windows/Linux differences
3. **Use Proper Waits**: Prefer specific waits over fixed timeouts
4. **Test Edge Cases**: Include boundary conditions and error scenarios
5. **Monitor Test Flakiness**: Track and resolve inconsistent test results

### Maintenance
1. **Regular Test Review**: Keep tests aligned with application changes
2. **Update Selectors**: Maintain stable test identifiers as UI evolves
3. **Performance Monitoring**: Track test execution time and resource usage
4. **Documentation Updates**: Keep test documentation current
5. **Continuous Improvement**: Refactor tests for better maintainability
