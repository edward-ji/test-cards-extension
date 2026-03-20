import { test, expect } from './fixtures';

const ADYEN_MASTERCARD = '2222 4000 7000 0005';
const ADYEN_MAESTRO = '6771 7980 2100 0008';
const ADYEN_BANCONTACT = '4871 0499 9999 9910';

test.describe('filter', () => {
    test.beforeEach(async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/panel.html`);
        await page.locator('#gatewaySelector').selectOption('adyen');
    });

    test('matches shown', async ({ page }) => {
        await page.locator('input').pressSequentially('Mastercard', { delay: 100 });
        await expect(page.locator(`text="${ADYEN_MASTERCARD}"`)).toBeVisible();
    });

    test('non-matches hidden', async ({ page }) => {
        await page.locator('input').pressSequentially('Mastercard', { delay: 100 });
        await expect(page.locator(`text="${ADYEN_MAESTRO}"`)).not.toBeVisible();
    });

    test('case-insensitive', async ({ page }) => {
        await page.locator('input').pressSequentially('mastercard', { delay: 100 });
        await expect(page.locator(`text="${ADYEN_MASTERCARD}"`)).toBeVisible();
    });

    test('clear filter shows all', async ({ page }) => {
        await page.locator('input').pressSequentially('Mastercard', { delay: 100 });
        await expect(page.locator(`text="${ADYEN_MAESTRO}"`)).not.toBeVisible();

        await page.locator('input').click({ clickCount: 3 });
        await page.keyboard.press('Backspace');

        await expect(page.locator(`text="${ADYEN_MAESTRO}"`)).toBeVisible();
    });

    test('empty sections hidden when no matches', async ({ page }) => {
        // 'Amex' only matches the American Express group — Bancontact section should disappear
        await page.locator('input').pressSequentially('Amex', { delay: 100 });
        await expect(page.locator('text="Bancontact (BCMC)"').first()).not.toBeVisible();
    });

    test('filter by card number', async ({ page }) => {
        await page.locator('input').pressSequentially('4871', { delay: 100 });
        await expect(page.locator(`text="${ADYEN_BANCONTACT}"`)).toBeVisible();
    });
});
