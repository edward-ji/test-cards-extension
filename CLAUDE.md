# CLAUDE.md — Test Cards Browser Extension

## Project Overview

A multi-browser extension (Chrome & Firefox) that surfaces payment gateway test card numbers directly in the browser for easy copying and form prefilling. Supports Adyen, Adyen 3DS, Worldpay, NAB Gateway, and Ebanx.

- **Version:** 0.3.0
- **Manifest:** V3 on both browsers
- **Chrome:** Side panel (`side_panel`)
- **Firefox:** Sidebar (`sidebar_action`)

---

## Repository Structure

```
test-cards-extension/
├── src/                     # Everything that ships in the extension
│   ├── data/                # Payment gateway card data (JSON)
│   │   ├── adyen.json
│   │   ├── adyen-3ds.json
│   │   ├── ebanx.json
│   │   ├── nab.json
│   │   ├── worldpay.json
│   │   ├── gateways.json    # Gateway definitions (5 gateways)
│   │   └── networks.json    # Payment network metadata (20+ networks)
│   ├── images/logos/        # Payment network SVG/PNG/WebP logos
│   ├── manifests/
│   │   ├── chrome.json      # Manifest V3 for Chrome
│   │   └── firefox.json     # Manifest V3 for Firefox
│   ├── parser.ts            # Core data transformation (parseGatewayData)
│   ├── panel.ts             # Main extension UI logic (~460 lines)
│   ├── panel.html           # Extension panel HTML
│   ├── panel.css            # Extension styles
│   ├── background-chrome.ts # Chrome service worker (minimal)
│   └── background-firefox.ts# Firefox background script (minimal)
├── e2e/tests/               # Playwright E2E tests
│   ├── fixtures.ts          # Chrome extension test fixture setup
│   └── *.spec.ts            # filter, copy, favorites, gateway, autofill
├── .github/workflows/       # CI/CD pipelines
├── scripts/
│   ├── build.ts             # ESBuild orchestration
│   └── validate-data.ts     # JSON data validation
└── worker/                  # Cloudflare Worker (smart redirect by User-Agent)
```

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| TypeScript | Language (strict mode) |
| ESBuild | Bundler |
| Playwright | E2E testing |
| ESLint + typescript-eslint | Linting |
| tsx | TypeScript script runner |
| webextension-polyfill | Cross-browser API wrapper |
| Node | Runtime (CI: ubuntu-24.04) |

---

## Development Commands

```bash
npm run build            # Build both Chrome and Firefox
npm run build:chrome     # Build Chrome only → dist/chrome/
npm run build:firefox    # Build Firefox only → dist/firefox/
npm test                 # Build then run Playwright E2E tests
npm run lint             # Run ESLint
npm run validate-data    # Validate all gateway JSON files
```

### Build Output

Both `dist/chrome/` and `dist/firefox/` contain:
- `manifest.json` (browser-specific)
- `panel.html`, `panel.css`, `panel.js`
- `service-worker.js` (Chrome) or `background-firefox.js` (Firefox)
- `data/` — all JSON gateway definitions
- `images/` — icons and logos

---

## Code Conventions

### Naming
- **Variables/functions:** camelCase (`currentGatewayId`, `loadDataForGateway`)
- **Constants (storage keys):** SCREAMING_SNAKE_CASE (`FAVOURITES_LIST`, `SELECTED_GATEWAY`)
- **Types/interfaces:** PascalCase (`NetworkInfo`, `ParsedGroup`, `Card`)
- **CSS classes:** kebab-case (`.fav-icon`, `.search-input`)

### TypeScript
- Strict mode is enabled — no implicit `any`
- Generic storage helpers: `getFromStorage<T>()`, `loadFromFile<T>()`
- Interfaces in `src/parser.ts`: `NetworkInfo`, `PrefillData`, `Card`, `ParsedGroup`, `RawCardItem`

### DOM
- Manual DOM manipulation via `createElement()` (no framework)
- `data-search` attributes hold searchable text for filter
- Class toggling via `classList.add()` / `classList.toggle()`

---

## Data Layer

### Adding or Modifying Card Data

Card files in `src/data/` follow this structure:

```json
[
  {
    "group": "Visa",
    "items": [
      {
        "number": "4111111111111111",
        "exp": "03/30",        // or "+3Y" for 3 years from now
        "csc": "737",          // omit to use default (123, or 1234 for Amex)
        "name": "J. Smith",    // optional, defaults to "J. Smith"
        "network": "visa",     // string or array of network IDs
        "country": "US",       // arbitrary extra fields are displayed as-is
        "3ds": true            // boolean fields are searchable by key name when true
      }
    ]
  }
]
```

**Expiry shorthand:** `+XY` where X is a number and Y is `Y` (years), computed relative to the current date at parse time.

**Defaults (applied in `src/parser.ts`):**
- CSC: `1234` for Amex, `123` for all others
- Name: `J. Smith`

After editing data files, always run:

```bash
npm run validate-data
```

### Adding a New Gateway

1. Create `src/data/<gateway-id>.json` following the structure above
2. Add an entry to `src/data/gateways.json`
3. Run `npm run validate-data` to verify
4. Run `npm run build` and test in-browser

### Adding a Network Logo

Place the logo file in `src/images/logos/` and reference it in `src/data/networks.json`.

---

## Architecture Notes

### Data Flow

```
src/data/*.json
   └─► parseGatewayData() [src/parser.ts]
          └─► Card[] (typed, with computed fields)
                 └─► renderCards() [panel.ts]
                        └─► DOM table rows
```

### Cross-Browser Strategy

- Single TypeScript source, two build targets
- `browser` API via `webextension-polyfill` — use `browser.*` everywhere, never `chrome.*` directly
- Background scripts are minimal and browser-specific only where the API differs (`side_panel` vs `sidebar_action`)

### Autofill

`prefillCardComponent()` in `panel.ts` injects a content script into all frames of the active tab. It targets HTML5 autocomplete attributes (`cc-number`, `cc-exp`, `cc-csc`, `cc-name`) with fallback to separate month/year fields. Frame permission errors are silently ignored (nested cross-origin iframes).

### Storage

Extension local storage (via `browser.storage.local`) persists:
- `SELECTED_GATEWAY` — last selected gateway ID
- `FAVOURITES_LIST` — array of favorited card IDs

---

## Testing

E2E tests use Playwright with a real Chrome extension loaded from `dist/chrome/`. The `pretest` hook auto-builds before tests run.

**Spec files in `e2e/tests/`:**
- `filter.spec.ts` — search/filter behavior
- `copy.spec.ts` — clipboard copy for each card field
- `favorites.spec.ts` — pin/unpin, persistence, cross-gateway
- `gateway.spec.ts` — gateway switching and persistence
- `autofill.spec.ts` — form prefill via autocomplete attributes

**Running tests:**
```bash
npm test            # full run
npx playwright test --ui   # interactive UI mode
```

Tests require a built extension in `dist/chrome/`. The fixture in `fixtures.ts` loads it and grants `clipboard-read`/`clipboard-write` permissions.

---

## CI/CD

| Workflow | Trigger | What It Does |
|----------|---------|-------------|
| `e2e.yml` | Push/PR to `main` | Build + run Playwright tests |
| `lint.yml` | TS/config/data changes | ESLint + validate-data |
| `package.yml` | GitHub release | Package `test-cards-chrome.zip` and `test-cards-firefox.zip` |
| `deploy-worker.yml` | (separate) | Deploy Cloudflare Worker redirect |

---

## Common Gotchas

- **Never use `chrome.*` APIs directly** — always use the `browser` polyfill for cross-browser compatibility
- **`dist/` is not committed** — always build before loading the extension manually in a browser
- **Data validation is a CI gate** — `npm run validate-data` must pass for `lint.yml` to succeed
- **Expiry dates in JSON** — prefer `+XY` relative format over hardcoded dates so test cards don't expire
- **Worker is a separate package** — `worker/` is a Cloudflare Worker that redirects visitors to the appropriate browser extension store based on User-Agent; it has its own `package.json` so run `npm install` inside it separately
