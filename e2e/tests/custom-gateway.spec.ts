import { test, expect } from './fixtures';
import path from 'path';
import http from 'http';

const GATEWAY_FILE = path.join(__dirname, '../test-gateway.json');

const MOCK_FORM_HTML = `<!DOCTYPE html><html><body>
  <form>
    <input id="cc-number" autocomplete="cc-number" />
    <input id="cc-exp"    autocomplete="cc-exp"    />
    <input id="cc-csc"   autocomplete="cc-csc"    />
    <input id="cc-name"  autocomplete="cc-name"   />
  </form>
</body></html>`;

let server: http.Server;
let serverPort: number;

test.beforeAll(async () => {
    server = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(MOCK_FORM_HTML);
    });
    await new Promise<void>((resolve, reject) => {
        server.listen(0, 'localhost', resolve);
        server.on('error', reject);
    });
    serverPort = (server.address() as { port: number }).port;
});

test.afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
});

async function openSettings(page: import('@playwright/test').Page) {
    await page.locator('#settingsButton').click();
}

async function closeSettings(page: import('@playwright/test').Page) {
    await page.locator('.close-button').click();
}

async function importGateway(page: import('@playwright/test').Page) {
    const fileChooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import gateway file (.json)' }).click();
    await (await fileChooser).setFiles(GATEWAY_FILE);
}

test.describe('custom gateways', () => {
    test.beforeEach(async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    });

    test('import adds gateway to selector', async ({ page }) => {
        await openSettings(page);
        await importGateway(page);
        await closeSettings(page);

        const options = page.locator('#gatewaySelector option');
        await expect(options.filter({ hasText: 'Test Gateway' })).toBeAttached();
    });

    test('custom gateway cards display correctly', async ({ page }) => {
        await openSettings(page);
        await importGateway(page);
        await closeSettings(page);

        await page.locator('#gatewaySelector').selectOption('test-gateway');
        await expect(page.locator('#cards')).toContainText('4111 1111 1111 1111');
        await expect(page.locator('#cards')).toContainText('5500 0055 5555 5559');
    });

    test('custom gateway persists across reload', async ({ page, extensionId }) => {
        await openSettings(page);
        await importGateway(page);
        await closeSettings(page);

        await page.locator('#gatewaySelector').selectOption('test-gateway');
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

        await expect(page.locator('#gatewaySelector')).toHaveValue('test-gateway');
        await expect(page.locator('#cards')).toContainText('4111 1111 1111 1111');
    });

    test('imported gateway shown in settings list', async ({ page }) => {
        await openSettings(page);
        await importGateway(page);

        await expect(page.locator('.custom-gateway-name')).toContainText('Test Gateway');
    });

    test('remove gateway removes it from selector', async ({ page }) => {
        await openSettings(page);
        await importGateway(page);
        await page.locator('.custom-gateway-row').filter({ hasText: 'Test Gateway' }).getByRole('button', { name: 'Remove' }).click();
        await closeSettings(page);

        const options = page.locator('#gatewaySelector option');
        await expect(options.filter({ hasText: 'Test Gateway' })).not.toBeAttached();
    });

    test('removing active custom gateway falls back to Adyen', async ({ page }) => {
        await openSettings(page);
        await importGateway(page);
        await closeSettings(page);

        await page.locator('#gatewaySelector').selectOption('test-gateway');
        await openSettings(page);
        await page.locator('.custom-gateway-row').filter({ hasText: 'Test Gateway' }).getByRole('button', { name: 'Remove' }).click();
        await closeSettings(page);

        await expect(page.locator('#gatewaySelector')).toHaveValue('adyen');
    });

    test('importing invalid JSON shows error', async ({ page }) => {
        await openSettings(page);

        const fileChooser = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: 'Import gateway file (.json)' }).click();
        const chooser = await fileChooser;
        await chooser.setFiles({
            name: 'bad.json',
            mimeType: 'application/json',
            buffer: Buffer.from('not valid json'),
        });

        await expect(page.locator('.import-error')).toContainText('Could not parse');
    });

    test('importing wrong format shows error', async ({ page }) => {
        await openSettings(page);

        const fileChooser = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: 'Import gateway file (.json)' }).click();
        const chooser = await fileChooser;
        await chooser.setFiles({
            name: 'wrong.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify({ foo: 'bar' })),
        });

        await expect(page.locator('.import-error')).toContainText('Invalid format');
    });

    test('importing conflicting id shows error', async ({ page }) => {
        await openSettings(page);

        const fileChooser = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: 'Import gateway file (.json)' }).click();
        const chooser = await fileChooser;
        await chooser.setFiles({
            name: 'conflict.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify({
                id: 'adyen',
                name: 'Fake Adyen',
                cards: [{ group: 'Visa', items: [{ number: '4111111111111111' }] }],
            })),
        });

        await expect(page.locator('.import-error')).toContainText('conflicts with a built-in');
    });

    test('re-uploading same id replaces existing', async ({ page }) => {
        await openSettings(page);
        await importGateway(page);
        await expect(page.locator('.custom-gateway-row')).toHaveCount(1);

        // Upload again — should not add a second entry
        await importGateway(page);

        await expect(page.locator('.custom-gateway-row')).toHaveCount(1);
    });

    test('autofill fills form fields for custom gateway card', async ({ page }) => {
        await openSettings(page);
        await importGateway(page);
        await closeSettings(page);

        await page.locator('#gatewaySelector').selectOption('test-gateway');
        await expect(page.locator('#cards')).toContainText('4111 1111 1111 1111');

        const formPage = await page.context().newPage();
        await formPage.goto(`http://localhost:${serverPort}/`);
        await formPage.bringToFront();

        await page.locator('.card-item').filter({ hasText: '4111 1111 1111 1111' }).locator('.fill-column')
            .dispatchEvent('click');

        await expect(formPage.locator('#cc-number')).toHaveValue('4111 1111 1111 1111');
        await expect(formPage.locator('#cc-csc')).toHaveValue('123');

        await formPage.close();
    });

    test('clear all data removes custom gateways', async ({ page }) => {
        await openSettings(page);
        await importGateway(page);
        await closeSettings(page);

        await page.locator('#gatewaySelector').selectOption('test-gateway');
        await openSettings(page);
        await page.getByRole('button', { name: 'Clear all data' }).click();
        await closeSettings(page);

        await expect(page.locator('#gatewaySelector')).toHaveValue('adyen');
        const options = page.locator('#gatewaySelector option');
        await expect(options.filter({ hasText: 'Test Gateway' })).not.toBeAttached();
    });
});
