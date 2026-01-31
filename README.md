# Adyen Test Cards browser extension

A [Chrome](https://chrome.google.com/webstore/detail/adyen-test-cards/icllkfleeahmemjgoibajcmeoehkeoag) and Firefox extension that lets you copy and prefill Adyen test card numbers with a single click.

Check also our [video](https://www.youtube.com/watch?v=INDxpfjnAnE&t=1s) to learn how to install and use it.

![Browser extension image](browser-extension.gif)

## Chrome vs Firefox

The extension is built from one codebase for both browsers. **Chrome** uses a side panel (toolbar icon opens the panel); **Firefox** uses a sidebar (toolbar icon opens the sidebar). The same panel UI, test data, and copy/prefill logic run in both. Build output is separate: `dist/chrome` (Chrome Web Store) and `dist/firefox` (Firefox Add-ons).

## Adyen Test Cards

Adyen provides [test card numbers](https://docs.adyen.com/development-resources/testing/test-card-numbers) to test the Checkout integration with different payment methods and flows.

This extension brings those test card numbers directly into your browser where you can:
* copy the card number to the clipboard
* prefill the Adyen Web Drop-in with the selected card details and perform the testing quickly and easily.

### Installation

#### Chrome: from Chrome Web Store

1. Find the extension in the [Chrome Web Store](https://chrome.google.com/webstore/detail/adyen-test-cards/icllkfleeahmemjgoibajcmeoehkeoag)
2. Click "Add to Chrome"

The installation will warn that the extension can read and write data on all websites:

![Chrome Web Store message](chrome-store-popup.png)

> **Note**
This is necessary as we do not know where your integration is hosted. The Adyen Test Cards extension only copies (using Javascript) the selected card details into the Credit Card fields. No other data or fields are read or changed. All of the code is Open-Source and there is no telemetry in this extension.
>

#### Firefox: from Add-ons (AMO)

Install the extension from Firefox Add-ons when available, or load the built package (see "Building from source" below).

#### Building from source (Chrome and Firefox)

1. Build both browser packages:
   ```bash
   npm run build
   ```
   This produces `dist/chrome/` and `dist/firefox/`.

2. **Chrome:** Open `chrome://extensions`, enable Developer Mode, click "Load unpacked", and select the `dist/chrome` folder (or the repo root for development; the root `manifest.json` is Chrome-only).

3. **Firefox:** Open `about:debugging`, click "This Firefox", "Load Temporary Add-on", and select `dist/firefox/manifest.json`.


### Usage

Open the extension and choose a card number.

## Contributing

We commit all our new features directly into our GitHub repository. Feel free to request or suggest new features or code changes yourself as well!

Find out more in our [contributing](https://github.com/adyen-examples/.github/blob/main/CONTRIBUTING.md) guidelines.

### Build & PR

To contribute:
* create a new GitHub issue (please specify if it is a feature, improvement or bug fix)
* create a local branch
* develop and test your changes locally ("Load unpacked" from your source)
* run the E2E tests locally
  ```
  cd e2e
  npx playwright test
  ```
* submit a PR

**Note**: the list of cards, giftcards, etc.. are saved (as JSON) on local storage. If the JSON format changes then the existing users might be affected (breaking change?). 

## Maintainers

### Build & publish

In order to publish a new release:
* develop and test features and changes
* update the version (and other applicable fields) in `manifests/chrome.json` and `manifests/firefox.json`
* create a new release: the `package-extension.yml` workflow runs `npm run build`, zips `dist/chrome` and `dist/firefox`, and attaches `adyen-testcards-chrome.zip` and `adyen-testcards-firefox.zip` to the release
* upload the Chrome zip to the Chrome Web Store and the Firefox zip to Firefox Add-ons (AMO)

## License

MIT license. For more information, see the **LICENSE** file.
