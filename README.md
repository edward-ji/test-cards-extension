# Test Cards

Streamline your payment integration testing with instant access to test card
numbers for major gateways. This extension provides a convenient side panel to
browse, select, and manage the test credentials you need for any payment flow
without ever leaving your active tab.

## Installation

> [!NOTE]
> The extension requests permission to read and write data on all websites. This
> is required to autofill payment forms regardless of where your integration is
> hosted. No data is read from pages — the extension only writes card details
> into form fields. All code is open source and there is no telemetry.

- [Chrome Web Store](https://chromewebstore.google.com/detail/ddflppoejkafcaedakefoakkmaholoeh)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/test-cards/)
- [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/test-cards/cfejdbkkfbpjdfafkmjcpnkgmdegcdjl)

### Loading from source

> [!NOTE]
> Temporarily loaded extensions are removed on browser restart and must be reloaded.

```bash
npm install
npm run build  # chrome
npm run build:firefox
npm run build:edge
```

**Chrome / Edge:** Open `chrome://extensions` (or `edge://extensions`), enable
Developer Mode, click "Load unpacked", and select the build output folder.

**Firefox:** Open `about:debugging`, click "This Firefox", "Load Temporary
Add-on", and select the `manifest.json` from the build output folder.

## Development

```bash
npm run dev  # chrome
npm run dev:firefox
npm run dev:edge

npm run lint
npm run check
npm test
```

## License

MIT
