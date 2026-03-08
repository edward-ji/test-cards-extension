import browser from 'webextension-polyfill';
import { parseGatewayData, NetworkInfo, Card, ParsedGroup, RawCardItem } from './shared/parser';

// name objects on local storage
const FAVOURITES_LIST = "favourites-list"
const SELECTED_GATEWAY = "selected-gateway"

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

if (searchInput) {
  searchInput.addEventListener("keyup", function () {
    // filter criteria
    const criteria = this.value.toLowerCase();

    const searchables = document.querySelectorAll(".searchable");
    searchables.forEach(function (card) {
      const el = card as HTMLElement;
      const searchAttr = el.getAttribute('data-search') || "";

      // filter: hide rows that don't match the criteria
      const isMatch = searchAttr.indexOf(criteria) > -1;
      el.style.display = isMatch ? "" : "none";

      // hide divs containing empty tables (ie don't show empty sections)
      const table = el.closest('table');
      if (table) {
        const rows = table.querySelectorAll('tr');
        let numVisibleRows = 0;
        rows.forEach(r => {
          if (r.style.display !== 'none') numVisibleRows++;
        });

        const cardNumbersDiv = table.closest('.cardnumbers') as HTMLElement;
        if (cardNumbersDiv) {
          cardNumbersDiv.style.display = numVisibleRows === 0 ? "none" : "";
        }
      }
    });
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
  const cardDivs = createCards();
  cardDivs.forEach(div => outerdiv.appendChild(div));

  if (cardsContainer) {
    cardsContainer.innerHTML = '';
    cardsContainer.appendChild(outerdiv);
  }
}

// render cards section
function createCards() {
  const divs: HTMLElement[] = [];

  // all cards section
  cards.forEach(function (item) {
    const div = document.createElement('div');
    div.classList.add("cardnumbers");

    const h3 = document.createElement('h3');
    h3.classList.add("sectionTitle");
    h3.textContent = item.group;

    const cardsTable = createCardsNetworkSection(item.group, item.items);
    if (cardsTable) {
      // show section when not empty (i.e. all cards are in the favourites section)
      div.appendChild(h3);
      div.appendChild(cardsTable);
      divs.push(div);
    }
  });

  return divs;
}

// render favourites section
function createFavourites() {
  const divFavourites = document.createElement('div');
  divFavourites.classList.add("cardnumbers");

  // Favourites title and helper messages
  const divFavouritesContainer = document.createElement('div');
  divFavouritesContainer.classList.add("divFavouritesContainer");
  const h3 = document.createElement('h3');
  h3.classList.add("sectionTitle");
  h3.textContent = "Favourites";
  divFavouritesContainer.appendChild(h3);

  divFavourites.appendChild(divFavouritesContainer);



  // We need to collect all favourites first to determine the columns
  const favItems: Card[] = [];
  cards.forEach(group => {
    group.items.forEach(card => {
      if (isFavourite(card.id)) {
        favItems.push(card);
      }
    });
  });

  if (favItems.length > 0) {
    const keys = new Set<string>();
    favItems.forEach(card => {
      Object.keys(card.display).forEach(k => keys.add(k));
    });

    const columns = Array.from(keys);
    const standardColumns = ['number', 'exp', 'csc', 'name'];
    const dynamicColumns = columns.filter(c => !standardColumns.includes(c));
    const orderedColumns: string[] = [];
    standardColumns.forEach(c => {
      if (columns.includes(c)) orderedColumns.push(c);
    });
    orderedColumns.push(...dynamicColumns);

    const table = document.createElement('table');
    table.id = "tableFavouritesId";
    const tbody = document.createElement('tbody');

    favItems.forEach(card => {

      const row = document.createElement('tr');

      const tdIcon = document.createElement('td');
      tdIcon.appendChild(makeCardUnfavIcon(card.id));
      row.appendChild(tdIcon);

      orderedColumns.forEach(c => {
        const td = document.createElement('td');
        const displayValue = card.display[c];

        if (c === 'number') {
          td.classList.add("tdCardNumber");
          td.textContent = displayValue?.toString() || "";
        } else if (c === 'exp') {
          td.classList.add("center", "tdExpiry");
          td.textContent = displayValue?.toString() || "";
        } else if (c === 'csc') {
          td.classList.add("center", "tdCode");
          td.textContent = displayValue?.toString() || "";
        } else {
          let cellValue = displayValue !== null && displayValue !== undefined ? displayValue : "";
          if (typeof cellValue === 'boolean') cellValue = cellValue ? c : "";
          td.classList.add("center");
          td.textContent = cellValue.toString();
        }

        if (displayValue !== null && displayValue !== undefined && displayValue !== "") {
          addCopyHandlers(td);
        }
        row.appendChild(td);
      });

      const tdLogo = document.createElement('td');
      tdLogo.classList.add("center", "card-logo");
      tdLogo.style.backgroundImage = `url('./images/logos/${card.network}.svg')`;
      const networkName = networks.find(n => n.id === card.network)?.names?.join(", ") || card.network;
      tdLogo.title = "Prefill " + networkName;

      addPrefillHandler(tdLogo, card);
      row.appendChild(tdLogo);

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    divFavourites.appendChild(table);
  } else {
    // empty section
    const text = document.createElement('span');
    text.innerHTML = "Click '&#9734' to add your favourites here";
    divFavourites.appendChild(text);
  }

  return divFavourites;
}

// add handlers (hover, click, etc..)
function addCopyHandlers(element: HTMLElement) {
  // make it copyable
  element.classList.add("copyable");
  // set handlers
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
    // add key
    favourites.push(key);
    // save to storage and reload
    setInStorage(FAVOURITES_LIST, favourites);
    load();
  }
}

// remove from favourites
function removeFavourite(key: string) {
  // remove key
  favourites = favourites.filter(fav => fav !== key);
  // save to storage and reload
  setInStorage(FAVOURITES_LIST, favourites);
  load();
}

// render network of cards
function createCardsNetworkSection(group: string, gCards: Card[]) {
  let numCards = 0;

  const table = document.createElement('table');

  // Extract dynamic columns
  const keys = new Set<string>();
  gCards.forEach(card => {
    Object.keys(card.display).forEach(k => keys.add(k));
  });

  const columns = Array.from(keys);
  const standardColumns = ['number', 'exp', 'csc', 'name'];
  const dynamicColumns = columns.filter(c => !standardColumns.includes(c));
  const orderedColumns: string[] = [];
  standardColumns.forEach(c => {
    if (columns.includes(c)) orderedColumns.push(c);
  });
  orderedColumns.push(...dynamicColumns);

  const tbody = document.createElement('tbody');

  gCards.forEach(card => {
    // display card only if not in favourites
    if (!isFavourite(card.id)) {
      numCards++;

      const row = document.createElement('tr');
      row.classList.add("searchable");
      row.setAttribute("data-search", card.search);

      const tdIcon = document.createElement('td');
      tdIcon.appendChild(makeCardFavIcon(card.id));
      row.appendChild(tdIcon);

      orderedColumns.forEach(c => {
        const td = document.createElement('td');
        const displayValue = card.display[c];

        if (c === 'number') {
          td.classList.add("tdCardNumber");
          td.textContent = displayValue?.toString() || "";
        } else if (c === 'exp') {
          td.classList.add("center", "tdExpiry");
          td.textContent = displayValue?.toString() || "";
        } else if (c === 'csc') {
          td.classList.add("center", "tdCode");
          td.textContent = displayValue?.toString() || "";
        } else {
          let cellValue = displayValue !== null && displayValue !== undefined ? displayValue : "";
          if (typeof cellValue === 'boolean') cellValue = cellValue ? c : "";
          td.classList.add("center");
          td.textContent = cellValue.toString();
        }

        if (displayValue !== null && displayValue !== undefined && displayValue !== "") {
          addCopyHandlers(td);
        }
        row.appendChild(td);
      });

      const tdLogo = document.createElement('td');
      tdLogo.classList.add("center", "card-logo");
      tdLogo.style.backgroundImage = `url('./images/logos/${card.network}.svg')`;
      const networkName = networks.find(n => n.id === card.network)?.names?.join(", ") || card.network;
      tdLogo.title = "Prefill " + networkName;

      addPrefillHandler(tdLogo, card);
      row.appendChild(tdLogo);

      tbody.appendChild(row);
    }
  });

  table.appendChild(tbody);

  if (numCards > 0) {
    return table;
  } else {
    return undefined;
  }
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
  element.classList.add("copyPrefillClick");
  element.addEventListener('click', async function (evt) {
    evt.preventDefault();
    const cardNumberText = card.prefill.number;
    const expiryText = card.prefill.exp;
    const codeText = card.prefill.csc;
    const nameText = card.prefill.name;

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
          args: [cardNumberText, expiryText, codeText, nameText]
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
function prefillCardComponent(cardNumberText: string, expiryText: string, codeText: string, nameText: string) {
  function fillField(selector: string, value: string) {
    if (value === undefined) return;
    const element = document.querySelector(selector) as HTMLInputElement;
    if (!element) return;
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  fillField('input[autocomplete="cc-number"]', cardNumberText);
  fillField('input[autocomplete="cc-exp"]', expiryText);
  fillField('input[autocomplete="cc-csc"]', codeText);
  fillField('input[autocomplete="cc-name"]', nameText);
  if (expiryText) {
    fillField('input[autocomplete="cc-exp-month"]', expiryText.slice(0, 2));
    fillField('input[autocomplete="cc-exp-year"]', expiryText.slice(-2));
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
  console.log("loadFromFile " + filename);
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
  load();
});
