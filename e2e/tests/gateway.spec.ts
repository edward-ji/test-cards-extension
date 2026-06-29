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

async function openSettings(page: import('@playwright/test').Page) {
    await page.locator('#settingsButton').click();
}

async function closeSettings(page: import('@playwright/test').Page) {
    await page.locator('.close-button').click();
}

test.describe('gateway screenshots', () => {
    test.beforeEach(async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
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
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
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

    test('includes Adyen result codes gateway', async ({ page }) => {
        await page.locator('#gatewaySelector').selectOption('adyen-result-codes');
        await expect(page.locator('#gatewaySelector')).toHaveValue('adyen-result-codes');
        await expect(page.locator('#gatewaySelector')).toContainText('Adyen (result codes)');
        await expect(page.locator('#cards')).toContainText('INVALID_CARD_NUMBER');
        await expect(page.locator('#cards')).toContainText('004');
        await expect(page.locator('#cards')).not.toContainText('2222 4000 7000 0005');
        await expect(page.locator('#docsLink')).toHaveAttribute('href', /result-codes/);
    });

    test('gateway selection persists across reload', async ({ page, extensionId }) => {
        await page.locator('#gatewaySelector').selectOption('worldpay');
        await expect(page.locator('text="3434 3434 3434 343"').first()).toBeVisible();

        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
        await expect(page.locator('#gatewaySelector')).toHaveValue('worldpay');
        await expect(page.locator('text="3434 3434 3434 343"').first()).toBeVisible();
    });

    test('gateway rename updates selector and persists across reload', async ({ page, extensionId }) => {
        await openSettings(page);

        const adyenRow = page.locator('.gateway-row').filter({
            has: page.locator('.gateway-name', { hasText: /^Adyen$/ }),
        });
        await adyenRow.getByRole('button', { name: 'Rename Adyen' }).click();
        await page.getByRole('textbox', { name: 'Rename Adyen' }).fill('Primary Gateway');
        await page.getByRole('button', { name: 'Save gateway name' }).click();
        await closeSettings(page);

        await expect(page.locator('#gatewaySelector option[value="adyen"]')).toHaveText('Primary Gateway');

        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
        await expect(page.locator('#gatewaySelector option[value="adyen"]')).toHaveText('Primary Gateway');
        await expect(page.locator('#gatewaySelector')).toHaveValue('adyen');

        await openSettings(page);
        const renamedAdyenRow = page.locator('.gateway-row').filter({
            has: page.locator('.gateway-name', { hasText: /^Primary Gateway$/ }),
        });
        await renamedAdyenRow.getByRole('button', { name: 'Reset gateway name' }).click();
        await closeSettings(page);

        await expect(page.locator('#gatewaySelector option[value="adyen"]')).toHaveText('Adyen');

        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
        await expect(page.locator('#gatewaySelector option[value="adyen"]')).toHaveText('Adyen');
        await expect(page.locator('#gatewaySelector')).toHaveValue('adyen');
    });
});
