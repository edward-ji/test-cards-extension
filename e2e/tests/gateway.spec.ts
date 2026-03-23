import { test, expect } from './fixtures';

test.describe('gateway', () => {
    test.beforeEach(async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/panel.html`);
    });

    test('default is Adyen', async ({ page }) => {
        await expect(page.locator('#gatewaySelector')).toHaveValue('adyen');
        await expect(page.locator('text="2222 4000 7000 0005"')).toBeVisible();
    });

    test('switch to Worldpay', async ({ page }) => {
        await page.locator('#gatewaySelector').selectOption('worldpay');
        await expect(page.locator('text="3434 3434 3434 343"').first()).toBeVisible();
    });

    test('switch to Adyen (3DS)', async ({ page }) => {
        await page.locator('#gatewaySelector').selectOption('adyen-3ds');
        await expect(page.locator('text="3714 4963 5398 431"')).toBeVisible();
    });

    test('switch to NAB', async ({ page }) => {
        await page.locator('#gatewaySelector').selectOption('nab');
        await expect(page.locator('text="4111 1111 1111 1111"').first()).toBeVisible();
    });

    test('switch to EBANX', async ({ page }) => {
        await page.locator('#gatewaySelector').selectOption('ebanx');
        await expect(page.locator('#cards')).toContainText('6362 9700 0045 7013');
    });

    test('docs link updates on gateway switch', async ({ page }) => {
        await page.locator('#gatewaySelector').selectOption('adyen');
        await expect(page.locator('#docsLink')).toHaveAttribute('href', /docs\.adyen\.com/);

        await page.locator('#gatewaySelector').selectOption('worldpay');
        await expect(page.locator('#docsLink')).toHaveAttribute('href', /worldpay\.com/);
    });

    test('gateway selection persists across reload', async ({ page, extensionId }) => {
        await page.locator('#gatewaySelector').selectOption('worldpay');
        await expect(page.locator('text="3434 3434 3434 343"').first()).toBeVisible();

        await page.goto(`chrome-extension://${extensionId}/panel.html`);
        await expect(page.locator('#gatewaySelector')).toHaveValue('worldpay');
        await expect(page.locator('text="3434 3434 3434 343"').first()).toBeVisible();
    });
});
