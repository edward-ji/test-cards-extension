import { test, expect } from './fixtures';

test.describe('copy', () => {
    test.beforeEach(async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/panel.html`);
        await page.locator('#gatewaySelector').selectOption('adyen');
    });

    test('copy card number', async ({ page }) => {
        const cardnumber = page.locator('text="4871 0499 9999 9910"');
        await expect(cardnumber).toBeVisible();
        await cardnumber.click();

        const clipboard = await page.evaluate("navigator.clipboard.readText()");
        expect(clipboard).toContain('4871 0499 9999 9910');
    });

    test('copy CSC', async ({ page }) => {
        const csc = page.locator('text="7373"').first();
        await expect(csc).toBeVisible();
        await csc.click();

        const clipboard = await page.evaluate("navigator.clipboard.readText()");
        expect(clipboard).toContain('7373');
    });

    test('copy country', async ({ page }) => {
        const country = page.locator('text="NL"').first();
        await expect(country).toBeVisible();
        await country.click();

        const clipboard = await page.evaluate("navigator.clipboard.readText()");
        expect(clipboard).toContain('NL');
    });

    test('copy expiry', async ({ page }) => {
        const expiry = page.locator('text="03/30"').first();
        await expect(expiry).toBeVisible();
        await expiry.click();

        const clipboard = await page.evaluate("navigator.clipboard.readText()");
        expect(clipboard).toContain('03/30');
    });

    test('copied message appears', async ({ page }) => {
        await page.locator('text="4871 0499 9999 9910"').click();
        await expect(page.locator('#header')).toContainText('Copied');
    });

    test('copied message disappears', async ({ page }) => {
        await page.locator('text="4871 0499 9999 9910"').click();
        await expect(page.locator('#header')).toContainText('Copied');
        await page.waitForTimeout(2500);
        await expect(page.locator('#header')).toBeEmpty();
    });
});
