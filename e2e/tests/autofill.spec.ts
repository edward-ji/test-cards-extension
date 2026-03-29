import { test, expect } from './fixtures';
import http from 'http';

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

// Start server once for the whole worker
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

async function openFormPage(page: import('@playwright/test').Page) {
    const formPage = await page.context().newPage();
    await formPage.goto(`http://localhost:${serverPort}/`);
    // Make this the active tab so the autofill targets it
    await formPage.bringToFront();
    return formPage;
}

async function clickFill(page: import('@playwright/test').Page, cardNumber: string) {
    await page.locator('.card-item').filter({ hasText: cardNumber }).locator('.fill-column')
        .dispatchEvent('click');
}

test.describe('autofill', () => {
    test.beforeEach(async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
        await page.locator('#gatewaySelector').selectOption('adyen');
    });

    test('autofill button present on each row', async ({ page }) => {
        const fillCells = page.locator('.fill-column');
        const count = await fillCells.count();
        expect(count).toBeGreaterThan(0);
        await expect(fillCells.first()).toBeVisible();
        await expect(fillCells.last()).toBeVisible();
    });

    test('autofill button present in favorites', async ({ page }) => {
        await page.locator('.card-item').filter({ hasText: '4871 0499 9999 9910' }).locator('.fav-icon').click();
        await expect(page.locator('#tableFavouritesId .fill-column')).toBeVisible();
    });

    test('fills number, expiry, csc, and name for a complete card', async ({ page }) => {
        const formPage = await openFormPage(page);

        await clickFill(page, '3700 0000 0000 002');

        await expect(formPage.locator('#cc-number')).toHaveValue('3700 0000 0000 002');
        await expect(formPage.locator('#cc-exp')).toHaveValue('03/30');
        await expect(formPage.locator('#cc-csc')).toHaveValue('7373');
        await expect(formPage.locator('#cc-name')).toHaveValue('J. Smith');

        await formPage.close();
    });

    test('false csc: cc-csc field is cleared', async ({ page }) => {
        const formPage = await openFormPage(page);
        // Pre-populate csc so we can confirm it was overwritten with empty string.
        await formPage.locator('#cc-csc').fill('pre-existing');
        await formPage.bringToFront(); // restore active tab after fill() interaction

        await clickFill(page, '6703 4444 4444 4449');

        await expect(formPage.locator('#cc-number')).toHaveValue('6703 4444 4444 4449');
        await expect(formPage.locator('#cc-csc')).toHaveValue('');

        await formPage.close();
    });

    test('explicit exp: cc-exp is filled with given date', async ({ page }) => {
        const formPage = await openFormPage(page);

        await clickFill(page, '5127 8809 9999 9990');

        await expect(formPage.locator('#cc-number')).toHaveValue('5127 8809 9999 9990');
        await expect(formPage.locator('#cc-exp')).toHaveValue('03/30');
        await expect(formPage.locator('#cc-csc')).toHaveValue('737');

        await formPage.close();
    });
});
