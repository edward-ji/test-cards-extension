import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const CARD = '4871 0499 9999 9910';
const OTHER_CARD = '3700 0000 0000 002';

async function switchToCompact(page: Page) {
    await page.locator('#settingsButton').click();
    await page.getByRole('button', { name: 'Compact' }).click();
    await page.locator('.close-button').click();
}

test.describe('compact density', () => {
    test.beforeEach(async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
        await page.locator('#gatewaySelector').selectOption('adyen');
        await switchToCompact(page);
    });

    test('renders table rows instead of card items', async ({ page }) => {
        await expect(page.locator('.cards-table').first()).toBeVisible();
        await expect(page.locator('.card-item')).toHaveCount(0);
    });

    test('filter shows matching rows only', async ({ page }) => {
        await page.locator('#search').fill('4871');
        await expect(page.locator('.card-row').filter({ hasText: CARD })).toBeVisible();
        await expect(page.locator('.card-row').filter({ hasText: OTHER_CARD })).toHaveCount(0);
    });

    test('favourite and unfavourite', async ({ page }) => {
        await page.locator('.card-row').filter({ hasText: CARD }).locator('.fav-icon').click();
        await expect(page.locator('.section-title', { hasText: 'Favourites' })).toBeVisible();
        await page.locator('.card-row').filter({ hasText: CARD }).locator('.unfav-icon').click();
        await expect(page.locator('.section-title', { hasText: 'Favourites' })).not.toBeAttached();
    });

    test('density persists across reload', async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
        await expect(page.locator('.cards-table').first()).toBeVisible();
        await expect(page.locator('.card-item')).toHaveCount(0);
    });
});
