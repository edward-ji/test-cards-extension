import browser from 'webextension-polyfill';
import { parseGatewayData, NetworkInfo, Card, ParsedGroup, RawCardItem } from './parser';

// name objects on local storage
const FAVOURITES_LIST = "favourites-list"
const SELECTED_GATEWAY = "selected-gateway"
const COLOR_SCHEME = "color-scheme"

type ThemeMode = 'light' | 'dark' | 'system';

let gateways: { id: string, name: string, docsLink?: string }[] = [];
let currentGatewayId = "adyen";
let cards: ParsedGroup[] = [];
let favourites: string[] = [];
let networks: NetworkInfo[] = [];

// DOM Elements
const searchInput = document.getElementById("search") as HTMLInputElement;
const gatewaySelector = document.getElementById("gatewaySelector") as HTMLSelectElement;
const cardsContainer = document.getElementById("cards") as HTMLDivElement;
const docsLink = document.getElementById("docsLink") as HTMLAnchorElement;
const header = document.getElementById("header") as HTMLElement;
const themeToggle = document.getElementById("themeToggle") as HTMLButtonElement;

if (searchInput) {
  searchInput.addEventListener("keyup", function () {
    const criteria = this.value.toLowerCase();

    document.querySelectorAll<HTMLElement>(".searchable").forEach(el => {
      const searchAttr = el.getAttribute('data-search') || "";
      el.style.display = searchAttr.includes(criteria) ? "" : "none";
    });

    // Hide sections where all searchable cards are hidden
    document.querySelectorAll<HTMLElement>('.cards-section').forEach(section => {
      const sectionCards = section.querySelectorAll<HTMLElement>('.searchable');
      if (sectionCards.length === 0) return; // favourites section — always visible
      const anyVisible = Array.from(sectionCards).some(c => c.style.display !== 'none');
      section.style.display = anyVisible ? "" : "none";
    });
  });
}

function applyTheme(mode: ThemeMode) {
  if (mode === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else if (mode === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function updateThemeToggleLabel(mode: ThemeMode) {
  if (!themeToggle) return;
  themeToggle.title = `${mode.charAt(0).toUpperCase() + mode.slice(1)} theme`;
  (themeToggle.querySelector('img') as HTMLImageElement).src = `images/theme-${mode}.svg`;
}

async function loadTheme() {
  const stored = await getFromStorage<ThemeMode>(COLOR_SCHEME);
  const mode: ThemeMode = stored || 'system';
  applyTheme(mode);
  updateThemeToggleLabel(mode);
}

if (themeToggle) {
  themeToggle.addEventListener('click', async function () {
    const stored = await getFromStorage<ThemeMode>(COLOR_SCHEME);
    const current: ThemeMode = stored || 'system';
    const next: ThemeMode = current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';
    await setInStorage(COLOR_SCHEME, next);
    applyTheme(next);
    updateThemeToggleLabel(next);
  });
}

// load content of the panel
async function load() {
  const storedFavs = await getFromStorage<string[]>(FAVOURITES_LIST);
  favourites = storedFavs || [];

  // Load gateway definitions and network definitions
  gateways = await loadFromFile("data/gateways.json");
  networks = await loadFromFile("data/networks.json");

  // Set up the Gateway Selector UI
  if (gatewaySelector) {
    gatewaySelector.innerHTML = '';
    gateways.forEach((gw) => {
      const option = document.createElement('option');
      option.value = gw.id;
      option.textContent = gw.name;
      gatewaySelector.appendChild(option);
    });

    // Restore previous selection if available
    const savedGateway = await getFromStorage<string>(SELECTED_GATEWAY);
    if (savedGateway && gateways.find(g => g.id === savedGateway)) {
      currentGatewayId = savedGateway;
    }
    gatewaySelector.value = currentGatewayId;

    // Handle gateway changes
    gatewaySelector.addEventListener('change', async function () {
      currentGatewayId = gatewaySelector.value;
      await setInStorage(SELECTED_GATEWAY, currentGatewayId);
      await loadDataForGateway(currentGatewayId);
    });
  }

  // Load the initial gateway data
  await loadDataForGateway(currentGatewayId);
}

// Load cards specific to the selected gateway
async function loadDataForGateway(gatewayId: string) {
  // Update docs link
  const gwInfo = gateways.find(g => g.id === gatewayId);
  if (gwInfo && gwInfo.docsLink && docsLink) {
    docsLink.href = gwInfo.docsLink;
  }

  const rawCards = await loadFromFile<{ group: string; items: RawCardItem[] }[]>(`data/${gatewayId}.json`);
  cards = parseGatewayData(gatewayId, rawCards as { group: string; items: RawCardItem[] }[], networks);

  renderCards();
}

function renderCards() {
  const outerdiv = document.createElement('div');

  // favourites section
  outerdiv.appendChild(createFavourites());

  // cards section
  createCards().forEach(div => outerdiv.appendChild(div));

  if (cardsContainer) {
    cardsContainer.innerHTML = '';
    cardsContainer.appendChild(outerdiv);
  }
}

// render all card sections
function createCards() {
  const divs: HTMLElement[] = [];

  cards.forEach(item => {
    const nonFavCards = item.items.filter(card => !isFavourite(card.id));
    if (nonFavCards.length === 0) return;

    const section = document.createElement('div');
    section.classList.add('cards-section');

    const h3 = document.createElement('h3');
    h3.classList.add('section-title');
    h3.textContent = item.group;
    section.appendChild(h3);

    nonFavCards.forEach(card => section.appendChild(renderCardDiv(card, false)));
    divs.push(section);
  });

  return divs;
}

// render favourites section
function createFavourites() {
  const section = document.createElement('div');
  section.classList.add('cards-section');

  const h3 = document.createElement('h3');
  h3.classList.add('section-title');
  h3.textContent = 'Favourites';
  section.appendChild(h3);

  const favContainer = document.createElement('div');
  favContainer.id = 'tableFavouritesId';

  const favItems: Card[] = [];
  cards.forEach(group => {
    group.items.forEach(card => {
      if (isFavourite(card.id)) favItems.push(card);
    });
  });

  if (favItems.length > 0) {
    favItems.forEach(card => favContainer.appendChild(renderCardDiv(card, true)));
  } else {
    const text = document.createElement('p');
    text.classList.add('empty-favs');
    text.innerHTML = "Click '&#9734;' to add your favourites here";
    favContainer.appendChild(text);
  }

  section.appendChild(favContainer);
  return section;
}

// render a single card as a styled div
function renderCardDiv(card: Card, isFavLayout: boolean): HTMLElement {
  const div = document.createElement('div');
  div.classList.add('card-item');
  if (!isFavLayout) {
    div.classList.add('searchable');
    div.setAttribute('data-search', card.search);
  }

  // Column 1: network logos stacked vertically
  const logosDiv = document.createElement('div');
  logosDiv.classList.add('card-logos');
  const nets = Array.isArray(card.network) ? card.network : [card.network];
  nets.forEach(net => {
    const networkInfo = networks.find(n => n.id === net);
    const img = document.createElement('img');
    img.src = networkInfo?.logo ? `./images/logos/${networkInfo.logo}` : './images/logos/nocard.svg';
    img.className = 'network-icon';
    img.title = networkInfo?.names?.[0] || net;
    logosDiv.appendChild(img);
  });

  // Column 2: card info rows
  const contentDiv = document.createElement('div');
  contentDiv.classList.add('card-content');

  // Row a: card number
  const numVal = card.display['number'];
  if (numVal != null && numVal !== '') {
    const numDiv = document.createElement('div');
    numDiv.classList.add('card-number');
    numDiv.textContent = numVal.toString();
    addCopyHandlers(numDiv);
    contentDiv.appendChild(numDiv);
  }

  // Row b: exp, csc, name
  const standardFields: { key: string; label: string }[] = [
    { key: 'exp', label: 'Exp' },
    { key: 'csc', label: 'CSC' },
    { key: 'name', label: 'Name' },
  ];

  const fieldsDiv = document.createElement('div');
  fieldsDiv.classList.add('card-fields');

  standardFields.forEach(({ key, label }) => {
    const val = card.display[key];
    if (val == null || val === '') return;

    const fieldDiv = document.createElement('div');
    fieldDiv.classList.add('card-field');
    if (key === 'name') fieldDiv.classList.add('card-field--name');

    const labelEl = document.createElement('span');
    labelEl.classList.add('field-label');
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.classList.add('field-value');
    valueEl.textContent = val.toString();
    addCopyHandlers(valueEl);

    fieldDiv.appendChild(labelEl);
    fieldDiv.appendChild(valueEl);
    fieldsDiv.appendChild(fieldDiv);
  });

  if (fieldsDiv.childElementCount > 0) {
    contentDiv.appendChild(fieldsDiv);
  }

  // Row c: extra fields as pills
  const standardKeys = new Set(['number', 'exp', 'csc', 'name']);
  const extrasDiv = document.createElement('div');
  extrasDiv.classList.add('card-extras');

  Object.entries(card.display).forEach(([key, val]) => {
    if (standardKeys.has(key)) return;
    if (val === null || val === undefined || val === '') return;

    const badge = document.createElement('span');
    badge.classList.add('card-badge');

    badge.textContent = typeof val === 'boolean' ? key : val.toString();
    addCopyHandlers(badge);

    extrasDiv.appendChild(badge);
  });

  if (extrasDiv.childElementCount > 0) {
    contentDiv.appendChild(extrasDiv);
  }

  // Column 3: action buttons stacked vertically
  const actionsDiv = document.createElement('div');
  actionsDiv.classList.add('card-actions');
  actionsDiv.appendChild(isFavLayout ? makeCardUnfavIcon(card.id) : makeCardFavIcon(card.id));

  const fillSpan = document.createElement('span');
  fillSpan.classList.add('fill-column');
  fillSpan.title = 'Autofill';
  const fillImg = document.createElement('img');
  fillImg.src = './images/autofill.svg';
  fillImg.className = 'action-icon';
  fillImg.alt = '';
  fillSpan.appendChild(fillImg);
  addPrefillHandler(fillSpan, card);
  actionsDiv.appendChild(fillSpan);

  div.appendChild(logosDiv);
  div.appendChild(contentDiv);
  div.appendChild(actionsDiv);

  return div;
}

// add handlers (hover, click, etc..)
function addCopyHandlers(element: HTMLElement) {
  element.classList.add("copyable");
  element.addEventListener('click', copyToClipboardHandler);
}

// when copying into the clipboard
function copyToClipboardHandler(this: HTMLElement) {
  const value = this.textContent?.trim() || "";
  copyToClipboard(value);

  // Show message "Copied!"
  if (header) {
    header.innerHTML = "Copied &#x2705;";
    // Hide after x seconds
    setTimeout(function () {
      header.innerHTML = "";
    }, 2000);
  }
}

// add to favourites
function addFavourite(key: string) {
  if (!favourites.includes(key)) {
    favourites.push(key);
    setInStorage(FAVOURITES_LIST, favourites);
    renderCards();
  }
}

// remove from favourites
function removeFavourite(key: string) {
  favourites = favourites.filter(fav => fav !== key);
  setInStorage(FAVOURITES_LIST, favourites);
  renderCards();
}

// check if the key (card) is in favourites
function isFavourite(key: string) {
  return favourites.includes(key);
}

// icon to add card in favourites
function makeCardFavIcon(id: string) {
  const div = document.createElement('div');
  div.id = sanitize(id);
  div.classList.add("fav-icon");
  div.addEventListener('click', function () {
    addFavourite(id);
  });
  return div;
}

// icon to remove card from favourites
function makeCardUnfavIcon(id: string) {
  const div = document.createElement('div');
  div.id = sanitize(id);
  div.classList.add("unfav-icon");
  div.addEventListener('click', function () {
    removeFavourite(id);
  });
  return div;
}

// attach prefill click handler
function addPrefillHandler(element: HTMLElement, card: Card) {
  element.addEventListener('click', async function (evt) {
    evt.preventDefault();
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    // inject js script to be run inside the active tab
    // must be injected to be able to access/update DOM
    if (browser.webNavigation && browser.webNavigation.getAllFrames) {
      const frames = await browser.webNavigation.getAllFrames({ tabId: activeTab.id! });
      frames?.forEach(function (frame) {
        browser.scripting.executeScript({
          target: { tabId: activeTab.id!, frameIds: [frame.frameId] },
          func: prefillCardComponent,
          args: [card.prefill.number, card.prefill.exp, card.prefill.csc, card.prefill.name]
        }).catch(function () {
          // Ignore missing host permissions for specific frames (e.g. tracking/ads)
        });
      });
    }
  });
}

async function copyToClipboard(val: string) {
  await navigator.clipboard.writeText(val);
}

// find and prefill form input fields (based on type)
function prefillCardComponent(number: string | undefined, exp: string | undefined, csc: string | undefined, name: string | undefined) {
  function fillField(selector: string, value: string | undefined) {
    if (value == null) return;
    const element = document.querySelector(selector) as HTMLInputElement;
    if (!element) return;
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  fillField('input[autocomplete="cc-number"]', number);
  fillField('input[autocomplete="cc-exp"]', exp);
  fillField('input[autocomplete="cc-csc"]', csc);
  fillField('input[autocomplete="cc-name"]', name);
  if (exp) {
    fillField('input[autocomplete="cc-exp-month"]', exp.slice(0, 2));
    fillField('input[autocomplete="cc-exp-year"]', exp.slice(-2));
  }
}

// save cards in local storage
async function setInStorage(name: string, value: unknown) {
  await browser.storage.local.set({ [name]: value });
}

async function getFromStorage<T>(name: string): Promise<T | undefined> {
  const storageResult = await browser.storage.local.get([name]);
  return storageResult[name] as T | undefined;
}

// load from json file
async function loadFromFile<T>(filename: string): Promise<T | []> {
  try {
    const res = await fetch(browser.runtime.getURL(filename));
    const obj = await res.json() as T;
    return obj;
  } catch {
    return [];
  }
}

// replace space with underscore
function sanitize(str: string) {
  return str.replace(/ /g, '_');
}

document.addEventListener('DOMContentLoaded', function () {
  loadTheme();
  load();
});
