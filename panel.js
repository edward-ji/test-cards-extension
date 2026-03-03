// Cross-browser API: Chrome uses chrome.*, Firefox uses browser.*
const api = typeof browser !== "undefined" ? browser : chrome;

// suffix displaying 3DS support
const THREE_DS_SUFFIX = " (3DS)";

// name objects on local storage
const FAVOURITES_LIST = "favourites-list"
const SELECTED_GATEWAY = "selected-gateway"

let gateways = [];
let currentGatewayId = "adyen";
let cards = [];
let favourites = [];

$("#search").on("keyup", function () {
  // filter criteria
  var criteria = $(this).val().toLowerCase();

  $(".searchable").each(function (i, card) {
    // filter: hide rows that don't match the criteria
    $(card).toggle($(card).text().toLowerCase().indexOf(criteria) > -1)
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

  // Load gateway definitions
  gateways = await loadFromFile("data/gateways.json");

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

  cards = await loadFromFile(`data/${gatewayId}.json`);

  // Assign a unique ID to each item
  $.each(cards, function (gIndex, group) {
    $.each(group.items, function (iIndex, item) {
      item.id = gatewayId + '-' + gIndex + '-' + iIndex;
    });
  });

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

    const cards = createCardsBrandSection(item.group, item.items);
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

  // find favourite cards
  var table = $('<table>').attr("id", "tableFavouritesId");

  $.each(cards, function (index, item) {

    const logo = item.logo;
    const group = item.group;

    $.each(item.items, function (index, item) {

      if (isFavourite(item.id)) {
        numFavs++;

        var row = $('<tr>');
        var tdIcon = ($('<td>').append(makeCardUnfavIcon(item.id)));

        var cardnumber = item.cardnumber;
        if (item.secure3DS) {
          // add suffix when card flow supports 3DS ie 3714 4963 5398 431 (3DS)
          cardnumber = cardnumber + THREE_DS_SUFFIX;
        }
        var tdNumber = $('<td>').addClass("tdCardNumber").text(cardnumber);
        addCopyHandlers(tdNumber);
        var tdExpiry = ($('<td>').addClass("tdExpiry").text(item.expiry));
        addCopyHandlers(tdExpiry);
        var tdCode = ($('<td>').addClass("tdCode").text(item.CVC || ""));
        addCopyHandlers(tdCode);
        var tdLogo = ($('<td>').addClass("center").addClass(logo).attr('title', group));
        var tdLinks = ($('<td>').addClass("center").append(createLinks("card")));
        row.append(tdIcon).append(tdNumber).append(tdExpiry).append(tdCode).append(tdLogo).append(tdLinks);
        table.append(row);
      }
      divFavourites.append(table);
    });
  });

  if (numFavs == 0) {
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
  // remove suffix (if found)
  value = value.replace(THREE_DS_SUFFIX, "")
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

// render brand of cards
function createCardsBrandSection(brand, cards) {

  let numCards = 0;

  var table = $('<table>');
  $.each(cards, function (index, item) {

    // display card only if not in favourites
    if (!isFavourite(item.id)) {
      numCards++;

      var row = $('<tr>').addClass("searchable");
      var tdIcon = ($('<td>').append(makeCardFavIcon(item.id)));
      if (item.secure3DS) {
        // add suffix when card flow supports 3DS ie 3714 4963 5398 431 (3DS)
        var tdNumber = ($('<td>').addClass("tdCardNumber").text(item.cardnumber + THREE_DS_SUFFIX));
        // add hidden cell to allow filtering on content (cardnumber, brand, etc..)
        var tdHidden = ($('<td>').addClass("hidden").text(brand + " " + item.cardnumber + THREE_DS_SUFFIX));
      } else {
        var tdNumber = ($('<td>').addClass("tdCardNumber").text(item.cardnumber));
        // add hidden cell to allow filtering on content (cardnumber, brand, etc..)
        var tdHidden = ($('<td>').addClass("hidden").text(brand + " " + item.cardnumber));
      }
      addCopyHandlers(tdNumber);
      var tdCountry = ($('<td>').addClass("center").addClass("tdCountry").text(item.country || ""));
      addCopyHandlers(tdCountry);
      var tdExpiry = ($('<td>').addClass("center").addClass("tdExpiry").text(item.expiry));
      addCopyHandlers(tdExpiry);
      var tdCode = ($('<td>').addClass("center").addClass("tdCode").text(item.CVC || ""));
      addCopyHandlers(tdCode);
      var tdLinks = ($('<td>').addClass("center").append(createLinks("card")));
      row.append(tdHidden).append(tdIcon).append(tdNumber).append(tdCountry).append(tdExpiry).append(tdCode).append(tdLinks);
      table.append(row);
    }
  });

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

// create action links (copy, prefill)   
function createLinks(type) {
  return $('<div>').addClass("actionLinks").append("&nbsp;&nbsp;&nbsp;").append(createPrefillLink(type));
}

function createCopyLink() {
  const anchor = $('<a>');
  anchor.addClass("copyLinkClick");
  anchor.attr('href', "a");
  anchor.text("Copy");
  anchor
    .click(
      function (evt) {
        evt.preventDefault();
        var cardNumberTd = $(this).closest("tr").find("td.tdCardNumber");
        // remove suffix (if found)
        var value = cardNumberTd.text().replace(THREE_DS_SUFFIX, "")

        copyToClipboard(value);
      }
    );

  return anchor
}


// create prefill link based on type (card)
function createPrefillLink(type) {
  const anchor = $('<a>');
  anchor.addClass("copyPrefillClick");
  anchor.attr('href', "a");
  anchor.text("Prefill");
  anchor
    .click(
      async function (evt) {
        evt.preventDefault();
        var cardNumberTd = $(this).closest("tr").find("td.tdCardNumber");
        // remove suffix (if found)
        var cardNumberTdValue = cardNumberTd.text().replace(THREE_DS_SUFFIX, "")
        var expiryTd = $(this).closest("tr").find("td.tdExpiry");
        var codeTd = $(this).closest("tr").find("td.tdCode");

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
                  args: [cardNumberTdValue, expiryTd.text(), codeTd.text()]
                }).catch(function (err) {
                  // Ignore missing host permissions for specific frames (e.g. tracking/ads)
                });
              });
            });
          }
        });
      }
    );
  return anchor
}

async function copyToClipboard(val) {
  await navigator.clipboard.writeText(val)
}

// find and prefill form input fields (based on type)
function prefillCardComponent(cardNumberTd, expiryTd, codeTd) {

  function fillField(selector, value) {
    var element = document.querySelector(selector);
    if (!element) return;
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  fillField('input[autocomplete="cc-number"]', cardNumberTd);
  fillField('input[autocomplete="cc-exp"]', expiryTd);
  fillField('input[autocomplete="cc-csc"]', codeTd);
  fillField('input[autocomplete="cc-name"]', "J. Smith");
  fillField('input[autocomplete="cc-exp-month"]', expiryTd.slice(0, 2));
  fillField('input[autocomplete="cc-exp-year"]', expiryTd.slice(-2));
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

