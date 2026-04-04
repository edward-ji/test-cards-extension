<script lang="ts">
  import { onMount } from 'svelte';
  import type { PublicPath } from 'wxt/browser';
  import { parseGatewayData, type NetworkInfo, type Card, type ParsedGroup, type RawCardItem, type PrefillData } from '../../parser';

  type GatewayId<P extends PublicPath = PublicPath> = P extends `/data/cards/${infer Id}.json` ? Id : never;
  function isGatewayId(value: string): value is GatewayId {
    return gateways.some(g => g.id === value);
  }
  import CardItem from './CardItem.svelte';
  import Settings from './Settings.svelte';
  import { prefillCardComponent } from './autofill';

  const FAVOURITES_LIST = 'favourites-list';
  const SELECTED_GATEWAY = 'selected-gateway';
  const COLOR_SCHEME = 'color-scheme';
  type ThemeMode = 'light' | 'dark' | 'system';

  // State
  let gateways = $state<{ id: string; name: string; docsLink?: string }[]>([]);
  let currentGatewayId = $state<GatewayId>('adyen');
  let cards = $state<ParsedGroup[]>([]);
  let favourites = $state<string[]>([]);
  let networks = $state<NetworkInfo[]>([]);
  let themeMode = $state<ThemeMode>('system');
  let copyMessage = $state('');
  let searchQuery = $state('');
  let isSettingsOpen = $state(false);

  // Derived
  const currentGateway = $derived(gateways.find(g => g.id === currentGatewayId));
  const searchQueryLower = $derived(searchQuery.toLowerCase());
  const favCards = $derived(
    cards.flatMap(g => g.items.filter((c: Card) => favourites.includes(c.id)))
  );
  const nonFavGroups = $derived(
    cards
      .map(g => ({ ...g, items: g.items.filter((c: Card) => !favourites.includes(c.id)) }))
      .filter(g => g.items.length > 0)
  );

  // Sync theme attribute to documentElement
  $effect(() => {
    if (themeMode === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (themeMode === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  });

  onMount(async () => {
    const [storedFavs, storedTheme, gatewayData, networkData, savedGateway] = await Promise.all([
      getFromStorage<string[]>(FAVOURITES_LIST),
      getFromStorage<ThemeMode>(COLOR_SCHEME),
      loadFromFile<{ id: string; name: string; docsLink?: string }[]>('/data/gateways.json'),
      loadFromFile<NetworkInfo[]>('/data/networks.json'),
      getFromStorage<string>(SELECTED_GATEWAY),
    ]);

    favourites = storedFavs ?? [];
    themeMode = storedTheme ?? 'system';
    gateways = gatewayData ?? [];
    networks = networkData ?? [];

    if (savedGateway && isGatewayId(savedGateway)) {
      currentGatewayId = savedGateway;
    }

    await loadDataForGateway(currentGatewayId);
  });

  async function loadDataForGateway(gatewayId: GatewayId) {
    const rawCards = await loadFromFile<{ group: string; items: RawCardItem[] }[]>(`/data/cards/${gatewayId}.json`);
    cards = parseGatewayData(gatewayId, rawCards ?? [], networks);
  }

  async function addFavourite(id: string) {
    if (!favourites.includes(id)) {
      const newFavs = [...favourites, id];
      await setInStorage(FAVOURITES_LIST, newFavs);
      favourites = newFavs;
    }
  }

  async function removeFavourite(id: string) {
    const newFavs = favourites.filter(f => f !== id);
    await setInStorage(FAVOURITES_LIST, newFavs);
    favourites = newFavs;
  }

  let copyTimerId: ReturnType<typeof setTimeout> | undefined;
  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    copyMessage = 'Copied ✅';
    clearTimeout(copyTimerId);
    copyTimerId = setTimeout(() => { copyMessage = ''; }, 2000);
  }

  async function handleAutofill(prefill: PrefillData) {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (browser.webNavigation?.getAllFrames) {
      const frames = await browser.webNavigation.getAllFrames({ tabId: activeTab.id! });
      frames?.forEach(frame => {
        browser.scripting.executeScript({
          target: { tabId: activeTab.id!, frameIds: [frame.frameId] },
          func: prefillCardComponent,
          args: [prefill.number, prefill.exp, prefill.csc, prefill.name],
        }).catch(() => {});
      });
    }
  }

  async function setInStorage(name: string, value: unknown) {
    await browser.storage.local.set({ [name]: value });
  }

  async function getFromStorage<T>(name: string): Promise<T | undefined> {
    const result = await browser.storage.local.get([name]);
    return result[name] as T | undefined;
  }

  async function loadFromFile<T>(filename: PublicPath): Promise<T | undefined> {
    try {
      const res = await fetch(browser.runtime.getURL(filename));
      return await res.json() as T;
    } catch {
      return undefined;
    }
  }


  async function updateTheme(next: ThemeMode) {
    themeMode = next;
    await setInStorage(COLOR_SCHEME, next);
  }

  async function handleGatewayChange(value: string) {
    if (!isGatewayId(value)) return;
    currentGatewayId = value;
    await setInStorage(SELECTED_GATEWAY, currentGatewayId);
    await loadDataForGateway(currentGatewayId);
  }
</script>

<header id="header">{copyMessage}</header>
<main class="content">
  <div class="header-controls">
    <select
      id="gatewaySelector"
      class="gateway-select"
      value={currentGatewayId}
      onchange={(e) => handleGatewayChange((e.target as HTMLSelectElement).value)}
    >
      {#each gateways as gw (gw.id)}
        <option value={gw.id}>{gw.name}</option>
      {/each}
    </select>

    <div class="search-container">
      <input
        id="search"
        class="search-input"
        type="text"
        placeholder="Filter..."
        autocomplete="off"
        bind:value={searchQuery}
      />
    </div>

    <button
      id="settingsButton"
      class="settings-button"
      title="Open Settings"
      onclick={() => isSettingsOpen = true}
    >
      <img src="/images/settings.svg" width="18" height="18" alt="" class="icon-dark-invert" />
    </button>
  </div>

  <Settings 
    isOpen={isSettingsOpen}
    themeMode={themeMode}
    onClose={() => isSettingsOpen = false}
    onThemeChange={updateTheme}
  />

  <div>
    <p>You can find these cards <a id="docsLink" href={currentGateway?.docsLink ?? '#'} target="_blank">here</a>.</p>
  </div>

  <div id="cards">
    <!-- Favourites section -->
    <div class="cards-section">
      <h3 class="section-title">Favourites</h3>
      <div id="tableFavouritesId">
        {#if favCards.length > 0}
          {#each favCards as card (card.id)}
            <CardItem
              {card}
              {networks}
              isFav={true}
              isSearchable={false}
              searchQuery={searchQueryLower}
              onFav={addFavourite}
              onUnfav={removeFavourite}
              onCopy={handleCopy}
              onAutofill={handleAutofill}
            />
          {/each}
        {:else}
          <p class="empty-favs">Click '&#9734;' to add your favourites here</p>
        {/if}
      </div>
    </div>

    <!-- Card group sections -->
    {#each nonFavGroups as group (group.group)}
      {@const anyVisible = group.items.some((c: Card) => c.search.includes(searchQueryLower))}
      <div class="cards-section" style:display={anyVisible ? '' : 'none'}>
        <h3 class="section-title">{group.group}</h3>
        {#each group.items as card (card.id)}
          <CardItem
            {card}
            {networks}
            isFav={false}
            isSearchable={true}
            searchQuery={searchQueryLower}
            onFav={addFavourite}
            onUnfav={removeFavourite}
            onCopy={handleCopy}
            onAutofill={handleAutofill}
          />
        {/each}
      </div>
    {/each}
  </div>
</main>
<style>
  a {
    color: var(--link);
    cursor: pointer;
    text-decoration: none;
  }

  /* ── Header ──────────────────────────────── */
  header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background-color: var(--header-bg);
    color: var(--text);
    padding: 10px;
    text-align: center;
    z-index: 100;
  }

  main {
    margin-top: 25px;
  }

  /* ── Top controls ────────────────────────── */
  .header-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    gap: 10px;
  }

  .gateway-select,
  .search-input {
    box-sizing: border-box;
    padding: 8px 12px;
    font-size: 13px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    outline: none;
    font-family: inherit;
    background-color: var(--input-bg);
    color: var(--input-text);
  }

  .gateway-select {
    flex: 1;
  }

  .search-container {
    flex: 2;
  }

  .search-input {
    width: 100%;
  }

  .settings-button {
    background: none;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    padding: 8px 10px;
    cursor: pointer;
    color: var(--text);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
  }

  .settings-button:hover {
    background: var(--row-hover);
    border-color: var(--text-muted);
  }

  /* ── Section ─────────────────────────────── */
  .cards-section {
    margin-bottom: 16px;
  }

  .section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text);
    opacity: 0.6;
    margin: 0 0 6px 2px;
    padding: 0;
  }

  /* ── Favourites empty state ──────────────── */
  .empty-favs {
    font-size: 11px;
    color: var(--text-muted);
    margin: 4px 0 0;
  }
</style>
