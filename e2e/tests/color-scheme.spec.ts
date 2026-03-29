import { test, expect } from './fixtures';
import { chromium } from '@playwright/test';
import path from 'path';

const READY_TEXT = '2222 4000 7000 0005'; // adyen default gateway first card

test.describe('color scheme - dark via system preference', () => {
    test('dark theme matches snapshot', async () => {
        const pathToExtension = path.join(__dirname, '../../.output/chrome-mv3');
        const darkContext = await chromium.launchPersistentContext('', {
            headless: false,
            args: [
                '--headless=new',
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`,
            ],
            colorScheme: 'dark',
        });
        try {
            let [background] = darkContext.serviceWorkers();
            if (!background) background = await darkContext.waitForEvent('serviceworker');
            const extensionId = background.url().split('/')[2];

            const page = await darkContext.newPage();
            await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
            await expect(page.locator('#cards')).toContainText(READY_TEXT);
            await expect(page).toHaveScreenshot('dark-system-adyen.png');
        } finally {
            await darkContext.close();
        }
    });
});

test.describe('color scheme - dark via toggle', () => {
    test.beforeEach(async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    });

    test('dark theme matches snapshot', async ({ page }) => {
        await expect(page.locator('#cards')).toContainText(READY_TEXT);
        // Click toggle twice: system → light → dark
        const toggle = page.locator('#themeToggle');
        await toggle.click(); // system → light
        await toggle.click(); // light → dark
        await expect(page).toHaveScreenshot('dark-toggle-adyen.png');
    });
});
