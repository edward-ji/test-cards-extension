// Cross-browser API: Chrome uses chrome.*, Firefox uses browser.*
const api = typeof browser !== "undefined" ? browser : chrome;

// name objects on local storage
const FAVOURITES_LIST = "favourites-list"
const SELECTED_GATEWAY = "selected-gateway"

let gateways = [];
let currentGatewayId = "adyen";
let cards = [];
let favourites = [];
let networks = [];

$("#search").on("keyup", function () {
  // filter criteria
  var criteria = $(this).val().toLowerCase();

  $(".searchable").each(function (i, card) {
    // filter: hide rows that don't match the criteria
    $(card).toggle($(card).attr('data-search').indexOf(criteria) > -1)
    // hide divs containing empty tables (ie don't show empty sections)
    var table = $(card).closest('table');
    var numVisibleRows = table.find('tr').filter(function () {
      return $(this).css('display') !== 'none';
    }).length;
    if (numVisibleRows === 0) {
      $(card).closest('div.cardnumbers').hide();
    } else {
      $(card).closest('div.cardnumbers').show();
    }
  });

});

// load content of the panel
async function load() {

  favourites = await getFromStorage(FAVOURITES_LIST);
  if (favourites == undefined) {
    favourites = [];
  }

  // Load gateway definitions and network definitions
  gateways = await loadFromFile("data/gateways.json");
  networks = await loadFromFile("data/networks.json");

  // Set up the Gateway Selector UI
  var selector = $('#gatewaySelector');
  selector.empty();
  $.each(gateways, function (index, gw) {
    selector.append($('<option>').val(gw.id).text(gw.name));
  });

  // Restore previous selection if available
  let savedGateway = await getFromStorage(SELECTED_GATEWAY);
  if (savedGateway && gateways.find(g => g.id === savedGateway)) {
    currentGatewayId = savedGateway;
  }
  selector.val(currentGatewayId);

  // Handle gateway changes
  selector.on('change', async function () {
    currentGatewayId = $(this).val();
    await setInStorage(SELECTED_GATEWAY, currentGatewayId);
    await loadDataForGateway(currentGatewayId);
  });

  // Load the initial gateway data
  await loadDataForGateway(currentGatewayId);
}

// Load cards specific to the selected gateway
async function loadDataForGateway(gatewayId) {

  // Update docs link
  let gwInfo = gateways.find(g => g.id === gatewayId);
  if (gwInfo && gwInfo.docsLink) {
    $('#docsLink').attr('href', gwInfo.docsLink);
  }

  const rawCards = await loadFromFile(`data/${gatewayId}.json`);
  cards = parseGatewayData(gatewayId, rawCards, networks);

  renderCards();
}

function renderCards() {
  var outerdiv = $('<div>');

  // favourites section
  outerdiv.append(createFavourites());
  // cards section
  outerdiv.append(createCards());

  $('#cards').html(outerdiv);
}

// render cards section
function createCards() {

  var divs = []

  // all cards section
  $.each(cards, function (index, item) {

    var div = $('<div>').addClass("cardnumbers");
    var h3 = $('<h3>').addClass("sectionTitle").text(item.group);

    const cards = createCardsNetworkSection(item.group, item.items);
    if (cards != undefined) {
      // show section when not empty (i.e. all cards are in the favourites section)
      div.append(h3);
      div.append(cards);

      divs.push(div);
    }
  });

  return divs;
}

// render favourites section
// find favourites in cards
function createFavourites() {

  var divFavourites = $('<div>').addClass("cardnumbers");

  // Favourites title and helper messages
  var divFavouritesContainer = $('<div>').addClass("divFavouritesContainer");
  var h3 = $('<h3>').addClass("sectionTitle").text("Favourites");
  divFavouritesContainer.append(h3);

  divFavourites.append(divFavouritesContainer);

  let numFavs = 0;

  // We need to collect all favourites first to determine the columns
  let favItems = [];
  $.each(cards, function (index, group) {
    $.each(group.items, function (i, card) {
      if (isFavourite(card.id)) {
        favItems.push(card);
      }
    });
  });

  if (favItems.length > 0) {
    let keys = new Set();
    favItems.forEach(card => {
      Object.keys(card.display).forEach(k => {
        keys.add(k);
      });
    });

    let columns = Array.from(keys);
    let standardColumns = ['number', 'exp', 'csc', 'name'];
    let dynamicColumns = columns.filter(c => !standardColumns.includes(c));
    let orderedColumns = [];
    standardColumns.forEach(c => {
      if (columns.includes(c)) orderedColumns.push(c);
    });
    orderedColumns.push(...dynamicColumns);

    var table = $('<table>').attr("id", "tableFavouritesId");

    var tbody = $('<tbody>');
    favItems.forEach(card => {
      numFavs++;
      var row = $('<tr>');
      var tdIcon = ($('<td>').append(makeCardUnfavIcon(card.id)));
      row.append(tdIcon);

      orderedColumns.forEach(c => {
        var td = $('<td>');
        if (c === 'number') {
          td.addClass("tdCardNumber").text(card.display[c] || "");
        } else if (c === 'exp') {
          td.addClass("center tdExpiry").text(card.display[c] || "");
        } else if (c === 'csc') {
          td.addClass("center tdCode").text(card.display[c] || "");
        } else {
          let cellValue = card.display[c] !== null && card.display[c] !== undefined ? card.display[c] : "";
          if (typeof cellValue === 'boolean') cellValue = cellValue ? c : "";
          td.addClass("center").text(cellValue);
        }
        if (card.display[c] !== null && card.display[c] !== undefined && card.display[c] !== "") {
          addCopyHandlers(td);
        }
        row.append(td);
      });

      var tdLogo = ($('<td>')
        .addClass("center card-logo")
        .css("background-image", `url('./images/logos/${card.network}.svg')`)
        .attr('title', "Prefill " + (networks.find(n => n.id === card.network)?.names?.join(", ") || card.network)));
      addPrefillHandler(tdLogo, card);
      row.append(tdLogo);

      tbody.append(row);
    });
    table.append(tbody);
    divFavourites.append(table);
  } else {
    // empty section
    var text = $('<span>').html("Click '&#9734' to add your favourites here");
    divFavourites.append(text);
  }

  return divFavourites;
}

// add handlers (hover, click, etc..)
function addCopyHandlers(element) {
  // make it copyable
  element.addClass("copyable");
  // set handlers
  element.click(copyToClipboardHandler)
}

// when copying into the clipboard
function copyToClipboardHandler() {
  var value = $(this).text().trim();
  copyToClipboard(value);

  // Show message "Copied!"
  $('#header').html("Copied &#x2705;");

  // Hide after x seconds
  setTimeout(function () {
    $('#header').html("");
  }, 1000 * 2);
}

// add to favourites
function addFavourite(key) {
  if (!favourites.includes(key)) {
    // add key
    favourites.push(key);
    // save to storage and reload
    setInStorage(FAVOURITES_LIST, favourites);
    load();
  }
}

// remove from favourites
function removeFavourite(key) {
  // remove key
  favourites = favourites.filter(fav => fav !== key);
  // save to storage and reload
  setInStorage(FAVOURITES_LIST, favourites);
  load();
}

// render network of cards
function createCardsNetworkSection(group, cards) {

  let numCards = 0;

  var table = $('<table>');

  // Extract dynamic columns
  let keys = new Set();
  $.each(cards, function (index, card) {
    Object.keys(card.display).forEach(k => {
      keys.add(k);
    });
  });
  let columns = Array.from(keys);
  let standardColumns = ['number', 'exp', 'csc', 'name'];
  let dynamicColumns = columns.filter(c => !standardColumns.includes(c));
  let orderedColumns = [];
  standardColumns.forEach(c => {
    if (columns.includes(c)) orderedColumns.push(c);
  });
  orderedColumns.push(...dynamicColumns);

  var tbody = $('<tbody>');
  $.each(cards, function (index, card) {

    // display card only if not in favourites
    if (!isFavourite(card.id)) {
      numCards++;

      var row = $('<tr>').addClass("searchable").attr("data-search", card.search);
      var tdIcon = ($('<td>').append(makeCardFavIcon(card.id)));

      row.append(tdIcon);

      orderedColumns.forEach(c => {
        var td = $('<td>');
        if (c === 'number') {
          td.addClass("tdCardNumber").text(card.display[c] || "");
        } else if (c === 'exp') {
          td.addClass("center tdExpiry").text(card.display[c] || "");
        } else if (c === 'csc') {
          td.addClass("center tdCode").text(card.display[c] || "");
        } else {
          let cellValue = card.display[c] !== null && card.display[c] !== undefined ? card.display[c] : "";
          if (typeof cellValue === 'boolean') cellValue = cellValue ? c : "";
          td.addClass("center").text(cellValue);
        }
        if (card.display[c] !== null && card.display[c] !== undefined && card.display[c] !== "") {
          addCopyHandlers(td);
        }
        row.append(td);
      });

      var tdLogo = ($('<td>')
        .addClass("center card-logo")
        .css("background-image", `url('./images/logos/${card.network}.svg')`)
        .attr('title', "Prefill"));
      addPrefillHandler(tdLogo, card);
      row.append(tdLogo);

      tbody.append(row);
    }
  });

  table.append(tbody);

  if (numCards > 0) {
    return table;
  } else {
    return undefined;
  }
}

// check if the key (card) is in favourites
function isFavourite(key) {
  return favourites.includes(key);
}

// icon to add card in favourites
function makeCardFavIcon(id) {
  var div = $('<div>').attr("id", sanitize(id)).addClass("fav-icon");

  div.on('click', function () {
    addFavourite(id);
  });

  return div;
}

// icon to remove card from favourites
function makeCardUnfavIcon(id) {
  var div = $('<div>').attr("id", sanitize(id)).addClass("unfav-icon");

  div.on('click', function () {
    removeFavourite(id);
  });

  return div;
}

// attach prefill click handler
function addPrefillHandler(element, card) {
  element.addClass("copyPrefillClick");
  element
    .click(
      async function (evt) {
        evt.preventDefault();
        var cardNumberText = card.prefill.number;
        var expiryText = card.prefill.exp;
        var codeText = card.prefill.csc;
        var nameText = card.prefill.name;

        api.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          var activeTab = tabs[0];
          // inject js script to be run inside the active tab
          // must be injected to be able to access/update DOM
          if (api.webNavigation && api.webNavigation.getAllFrames) {
            api.webNavigation.getAllFrames({ tabId: activeTab.id }, function (frames) {
              frames?.forEach(function (frame) {
                api.scripting.executeScript({
                  target: { tabId: activeTab.id, frameIds: [frame.frameId] },
                  func: prefillCardComponent,
                  args: [cardNumberText, expiryText, codeText, nameText]
                }).catch(function (err) {
                  // Ignore missing host permissions for specific frames (e.g. tracking/ads)
                });
              });
            });
          }
        });
      }
    );
}

async function copyToClipboard(val) {
  await navigator.clipboard.writeText(val)
}

// find and prefill form input fields (based on type)
function prefillCardComponent(cardNumberText, expiryText, codeText, nameText) {

  function fillField(selector, value) {
    if (value === undefined) return;
    var element = document.querySelector(selector);
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
async function setInStorage(name, value) {
  await api.storage.local.set({ [name]: value });
}

// get cards from local storage
async function getFromStorage(name) {
  let cards = await api.storage.local.get([name]);

  return cards[name];
}

// load from json file
async function loadFromFile(filename) {
  console.log("loadFromFile " + filename);
  try {
    const res = await fetch(api.runtime.getURL(filename));
    const obj = await res.json();
    return obj;
  } catch (e) {
    return [];
  }
}

// replace space with underscore
function sanitize(str) {
  return str.replace(/ /g, '_');
}

document.addEventListener('DOMContentLoaded', function () {
  load();
});

