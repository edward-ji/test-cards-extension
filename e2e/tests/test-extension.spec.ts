import { test, expect } from './fixtures';

const ADD_TO_FAVS_TEXT = "Click '☆' to add your favourites here";

// verify filter
test('filter', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/panel.html`);

    // default to adyen to match existing test data
    await page.locator('#gatewaySelector').selectOption('adyen');

    // use filter
    await expect(page.getByPlaceholder('Filter...')).toBeVisible();
    await page.locator('input').pressSequentially('Mastercard', { delay: 100 });

    // Mastercard visible
    await expect(page.locator('text="2222 4000 7000 0005"')).toBeVisible();
    // Maestro not visible
});

// verify favourites message
test('fav', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/panel.html`);
    await expect(page.locator('text=' + ADD_TO_FAVS_TEXT)).toBeVisible();
});

// verify copy card to clipboard
test('copy card details', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/panel.html`);

    // default to adyen to match existing test data
    await page.locator('#gatewaySelector').selectOption('adyen');

    // card number
    const cardnumber = page.locator('text="4871 0499 9999 9910"');
    await expect(cardnumber).toBeVisible();
    await cardnumber.click();

    let clipboard = await page.evaluate("navigator.clipboard.readText()");
    expect(clipboard).toContain("4871 0499 9999 9910");

    // cvc
    const cvc = page.locator('text="7373"').first();
    await expect(cvc).toBeVisible();
    await cvc.click();

    clipboard = await page.evaluate("navigator.clipboard.readText()");
    expect(clipboard).toContain("7373");

    // country
    const country = page.locator('text="NL"').first();
    await expect(country).toBeVisible();
    await country.click();

    clipboard = await page.evaluate("navigator.clipboard.readText()");
    expect(clipboard).toContain("NL");

});


// verify make favourite
test('make favourite', async ({ page, extensionId }) => {

    await page.goto(`chrome-extension://${extensionId}/panel.html`);

    // default to adyen to match existing test data
    await page.locator('#gatewaySelector').selectOption('adyen');

    // empty favs message is visible
    await expect(page.locator('text=' + ADD_TO_FAVS_TEXT)).toBeVisible();

    // pin card in favs
    await page.locator('tr').filter({ hasText: '4871 0499 9999 9910' }).locator('.fav-icon').click();
    await page.waitForTimeout(1000);

    // empty favs message is hidden
    await expect(page.locator('text=' + ADD_TO_FAVS_TEXT)).not.toBeVisible();

    // unpin card from favs
    await page.locator('tr').filter({ hasText: '4871 0499 9999 9910' }).locator('.unfav-icon').click();
    await page.waitForTimeout(1000);

    // empty favs message is visible
    await expect(page.locator('text=' + ADD_TO_FAVS_TEXT)).toBeVisible();

});
