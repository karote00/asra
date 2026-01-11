import { test, expect } from '@playwright/test'
import {
    waitForAppReady,
    resetCanvas,
    createRectangle,
    getElementCount,
    undo,
    redo
} from './test-utils'

/**
 * E2E Tests for Undo/Redo
 * Based on: .project/golden-paths/undoing-an-action.md
 */

test.describe('Undo/Redo Actions', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', (msg) => {
            console.log(`[BROWSER] ${msg.text()}`)
        })
        await page.goto('/')
        await waitForAppReady(page)
        await resetCanvas(page)
    })

    test('should undo element creation', async ({ page }) => {
        // Get initial element count
        const initialCount = await getElementCount(page)

        // Create a rectangle
        await createRectangle(page, 0.3, 0.3)

        // Verify a new element was created
        const currentCount = await getElementCount(page)
        expect(currentCount).toBe(initialCount + 1)

        // Undo the creation
        await undo(page)

        // Verify the element was removed with retries
        await expect(async () => {
            const count = await getElementCount(page)
            expect(count).toBe(initialCount)
        }).toPass({ timeout: 2000 })
    })

    test('should redo element creation', async ({ page }) => {
        // Get initial element count
        const initialCount = await getElementCount(page)

        // Create a rectangle
        await createRectangle(page, 0.3, 0.3)
        await page.waitForTimeout(200)

        // Undo the creation
        await undo(page)
        await expect(async () => {
            expect(await getElementCount(page)).toBe(initialCount)
        }).toPass({ timeout: 2000 })

        // Redo the creation
        await redo(page)

        // Verify the element was added back
        await expect(async () => {
            expect(await getElementCount(page)).toBe(initialCount + 1)
        }).toPass({ timeout: 2000 })
    })

    test('should undo multiple actions in sequence', async ({ page }) => {
        // Create three rectangles
        await createRectangle(page, 0.2, 0.2)
        await createRectangle(page, 0.4, 0.4)
        await createRectangle(page, 0.6, 0.6)

        expect(await getElementCount(page)).toBe(3)

        // Undo 3 times
        await undo(page)
        await expect(async () => {
            expect(await getElementCount(page)).toBe(2)
        }).toPass({ timeout: 2000 })

        await undo(page)
        await expect(async () => {
            expect(await getElementCount(page)).toBe(1)
        }).toPass({ timeout: 2000 })

        await undo(page)
        await expect(async () => {
            expect(await getElementCount(page)).toBe(0)
        }).toPass({ timeout: 2000 })

        // Redo 2 times
        await redo(page)
        await expect(async () => {
            expect(await getElementCount(page)).toBe(1)
        }).toPass({ timeout: 2000 })

        await redo(page)
        await expect(async () => {
            expect(await getElementCount(page)).toBe(2)
        }).toPass({ timeout: 2000 })
    })
})
