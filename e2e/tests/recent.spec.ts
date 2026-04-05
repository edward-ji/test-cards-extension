import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const CARD_1 = '4871 0499 9999 9910';
const CARD_2 = '2222 4000 7000 0005';
const CARD_3 = '3700 0000 0000 002';
const CARD_4 = '3700 0000 0100 018';

async function enableRecent(page: Page, limit = 5) {
    await page.locator('#settingsButton').click();
    await page.getByRole('button', { name: String(limit), exact: true }).click();
    await page.locator('.close-button').click();
}

test.describe('recent cards', () => {
    test.beforeEach(async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
        await page.locator('#gatewaySelector').selectOption('adyen');
    });

    test('recent section hidden by default', async ({ page }) => {
        await expect(page.locator('#tableRecentId')).not.toBeAttached();
    });

    test('card appears in recent after interaction', async ({ page }) => {
        await enableRecent(page);
        await page.locator('.card-number').filter({ hasText: CARD_1 }).click();
        await expect(page.locator('#tableRecentId')).toContainText(CARD_1);
    });

    test('most recently used card is first', async ({ page }) => {
        await enableRecent(page);
        await page.locator('.card-number').filter({ hasText: CARD_1 }).first().click();
        await page.locator('.card-number').filter({ hasText: CARD_2 }).first().click();
        const items = page.locator('#tableRecentId .card-item');
        await expect(items.first()).toContainText(CARD_2);
        await expect(items.nth(1)).toContainText(CARD_1);
    });

    test('re-interacting moves card to top without duplicating', async ({ page }) => {
        await enableRecent(page);
        await page.locator('.card-number').filter({ hasText: CARD_1 }).first().click();
        await page.locator('.card-number').filter({ hasText: CARD_2 }).first().click();
        await page.locator('#tableRecentId .card-number').filter({ hasText: CARD_1 }).click();
        const items = page.locator('#tableRecentId .card-item');
        await expect(items.first()).toContainText(CARD_1);
        await expect(items.nth(1)).toContainText(CARD_2);
        await expect(items).toHaveCount(2);
    });

    test('respects configured limit', async ({ page }) => {
        await enableRecent(page, 3);
        for (const card of [CARD_1, CARD_2, CARD_3, CARD_4]) {
            await page.locator('.card-number').filter({ hasText: card }).first().click();
        }
        await expect(page.locator('#tableRecentId .card-item')).toHaveCount(3);
    });

    test('persists across reload', async ({ page, extensionId }) => {
        await enableRecent(page);
        await page.locator('.card-number').filter({ hasText: CARD_1 }).first().click();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
        await expect(page.locator('#tableRecentId')).toContainText(CARD_1);
    });

    test('clear recent removes section', async ({ page }) => {
        await enableRecent(page);
        await page.locator('.card-number').filter({ hasText: CARD_1 }).first().click();
        await expect(page.locator('#tableRecentId')).toBeAttached();
        await page.locator('#settingsButton').click();
        await page.getByRole('button', { name: 'Clear recent' }).click();
        await page.locator('.close-button').click();
        await expect(page.locator('#tableRecentId')).not.toBeAttached();
    });

    test('recent section hides on gateway switch and reappears on switch back', async ({ page }) => {
        await enableRecent(page);
        await page.locator('.card-number').filter({ hasText: CARD_1 }).first().click();
        await page.locator('#gatewaySelector').selectOption('worldpay');
        await expect(page.locator('#tableRecentId')).not.toBeAttached();
        await page.locator('#gatewaySelector').selectOption('adyen');
        await expect(page.locator('#tableRecentId')).toContainText(CARD_1);
    });
});
