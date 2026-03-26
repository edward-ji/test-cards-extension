import { test, expect } from './fixtures';

const gateways: { id: string; readyText: string }[] = [
    { id: 'adyen', readyText: '2222 4000 7000 0005' },
    { id: 'adyen-3ds', readyText: '3714 4963 5398 431' },
    { id: 'worldpay', readyText: '3434 3434 3434 343' },
    { id: 'worldpay-3ds', readyText: '4000 0000 0000 2701' },
    { id: 'worldpay-wpg', readyText: '3434 3434 3434 343' },
    { id: 'worldpay-wpg-3ds', readyText: '4000 0000 0000 1000' },
    { id: 'nab', readyText: '4111 1111 1111 1111' },
    { id: 'ebanx', readyText: '6362 9700 0045 7013' },
    { id: 'nmi', readyText: '3711 1111 1111 114' },
];

test.describe('gateway screenshots', () => {
    test.beforeEach(async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/panel.html`);
    });

    for (const { id, readyText } of gateways) {
        test(`${id}`, async ({ page }) => {
            await page.locator('#gatewaySelector').selectOption(id);
            await expect(page.locator('#cards')).toContainText(readyText);
            await expect(page).toHaveScreenshot(`${id}.png`);
        });
    }
});

test.describe('gateway', () => {
    test.beforeEach(async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/panel.html`);
    });

    test('default is Adyen', async ({ page }) => {
        await expect(page.locator('#gatewaySelector')).toHaveValue('adyen');
        await expect(page.locator('text="2222 4000 7000 0005"')).toBeVisible();
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
