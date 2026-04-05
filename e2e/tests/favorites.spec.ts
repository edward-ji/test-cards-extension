import { test, expect } from './fixtures';

const CARD_1 = '4871 0499 9999 9910';
const CARD_2 = '2222 4000 7000 0005';

test.describe('favorites', () => {
    test.beforeEach(async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
        await page.locator('#gatewaySelector').selectOption('adyen');
    });

    test('favorites section hidden initially', async ({ page }) => {
        await expect(page.locator('#tableFavouritesId')).not.toBeAttached();
    });

    test('add shows favorites section', async ({ page }) => {
        await page.locator('.card-item').filter({ hasText: CARD_1 }).locator('.fav-icon').click();
        await expect(page.locator('#tableFavouritesId')).toBeAttached();
    });

    test('card appears in favorites section', async ({ page }) => {
        await page.locator('.card-item').filter({ hasText: CARD_1 }).locator('.fav-icon').click();
        await expect(page.locator('#tableFavouritesId')).toContainText(CARD_1);
    });

    test('card removed from main list', async ({ page }) => {
        await page.locator('.card-item').filter({ hasText: CARD_1 }).locator('.fav-icon').click();
        // After favoriting, the main section no longer has a card with .fav-icon for this card
        await expect(
            page.locator('.card-item').filter({ hasText: CARD_1 }).locator('.fav-icon')
        ).toHaveCount(0);
    });

    test('remove hides favorites section', async ({ page }) => {
        await page.locator('.card-item').filter({ hasText: CARD_1 }).locator('.fav-icon').click();
        await expect(page.locator('#tableFavouritesId')).toBeAttached();

        await page.locator('.card-item').filter({ hasText: CARD_1 }).locator('.unfav-icon').click();
        await expect(page.locator('#tableFavouritesId')).not.toBeAttached();
    });

    test('card returns to main list after unfav', async ({ page }) => {
        await page.locator('.card-item').filter({ hasText: CARD_1 }).locator('.fav-icon').click();
        await page.locator('.card-item').filter({ hasText: CARD_1 }).locator('.unfav-icon').click();
        await expect(
            page.locator('.card-item').filter({ hasText: CARD_1 }).locator('.fav-icon')
        ).toBeVisible();
    });

    test('multiple favorites', async ({ page }) => {
        await page.locator('.card-item').filter({ hasText: CARD_1 }).locator('.fav-icon').click();
        await page.locator('.card-item').filter({ hasText: CARD_2 }).locator('.fav-icon').click();
        await expect(page.locator('#tableFavouritesId')).toContainText(CARD_1);
        await expect(page.locator('#tableFavouritesId')).toContainText(CARD_2);
    });

    test('favorites persist across reload', async ({ page, extensionId }) => {
        await page.locator('.card-item').filter({ hasText: CARD_1 }).locator('.fav-icon').click();
        await expect(page.locator('#tableFavouritesId')).toContainText(CARD_1);

        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
        await expect(page.locator('#tableFavouritesId')).toContainText(CARD_1);
    });

    test('favorites carry across gateway switch', async ({ page }) => {
        await page.locator('.card-item').filter({ hasText: CARD_1 }).locator('.fav-icon').click();
        await expect(page.locator('#tableFavouritesId')).toContainText(CARD_1);

        // Switch to a different gateway
        await page.locator('#gatewaySelector').selectOption('worldpay');

        // Switch back to adyen
        await page.locator('#gatewaySelector').selectOption('adyen');
        await expect(page.locator('#tableFavouritesId')).toContainText(CARD_1);
    });
});
