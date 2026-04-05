<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
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
  const RECENT_CARDS = 'recent-cards';
  const SHOW_RECENT = 'show-recent';
  const RECENT_LIMIT = 'recent-limit';
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
  let recentCardIds = $state<string[]>([]);
  let showRecent = $state(false);
  let recentLimit = $state(5);

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
  const allCurrentCards = $derived(cards.flatMap(g => g.items));
  const recentCards = $derived(
    !showRecent ? [] :
    recentCardIds
      .map(id => allCurrentCards.find((c: Card) => c.id === id))
      .filter((c): c is Card => c !== undefined)
      .slice(0, recentLimit)
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
    const [storedFavs, storedTheme, gatewayData, networkData, savedGateway, storedRecent, storedShowRecent, storedRecentLimit] = await Promise.all([
      getFromStorage<string[]>(FAVOURITES_LIST),
      getFromStorage<ThemeMode>(COLOR_SCHEME),
      loadFromFile<{ id: string; name: string; docsLink?: string }[]>('/data/gateways.json'),
      loadFromFile<NetworkInfo[]>('/data/networks.json'),
      getFromStorage<string>(SELECTED_GATEWAY),
      getFromStorage<string[]>(RECENT_CARDS),
      getFromStorage<boolean>(SHOW_RECENT),
      getFromStorage<number>(RECENT_LIMIT),
    ]);

    favourites = storedFavs ?? [];
    themeMode = storedTheme ?? 'system';
    gateways = gatewayData ?? [];
    networks = networkData ?? [];
    recentCardIds = storedRecent ?? [];
    showRecent = storedShowRecent ?? false;
    recentLimit = storedRecentLimit ?? 5;

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
    copyMessage = 'Copied';
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
    copyMessage = 'Filled';
    clearTimeout(copyTimerId);
    copyTimerId = setTimeout(() => { copyMessage = ''; }, 2000);
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


  async function trackRecent(cardId: string) {
    const updated = [cardId, ...recentCardIds.filter(id => id !== cardId)];
    await setInStorage(RECENT_CARDS, updated);
    recentCardIds = updated;
  }

  async function updateShowRecent(value: boolean) {
    await setInStorage(SHOW_RECENT, value);
    showRecent = value;
  }

  async function updateRecentLimit(value: number) {
    await setInStorage(RECENT_LIMIT, value);
    recentLimit = value;
  }

  async function clearFavourites() {
    await setInStorage(FAVOURITES_LIST, []);
    favourites = [];
  }

  async function clearRecent() {
    await setInStorage(RECENT_CARDS, []);
    recentCardIds = [];
  }

  async function clearAll() {
    await browser.storage.local.clear();
    favourites = [];
    recentCardIds = [];
    themeMode = 'system';
    showRecent = false;
    recentLimit = 5;
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

<main class="content">
  <div class="header-controls">
    <div class="controls-row controls-row--top">
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

      {#if currentGateway?.docsLink}
        <a
          id="docsLink"
          href={currentGateway.docsLink}
          target="_blank"
          rel="noopener noreferrer"
          class="icon-button"
          title="Link to source"
        >
          <img src="/images/external-link.svg" width="18" height="18" alt="" class="icon-dark-invert" />
        </a>
      {/if}

      <button
        id="settingsButton"
        class="icon-button"
        title="Open Settings"
        onclick={() => isSettingsOpen = true}
      >
        <img src="/images/settings.svg" width="18" height="18" alt="" class="icon-dark-invert" />
      </button>
    </div>

    <div class="controls-row controls-row--bottom">
      <input
        id="search"
        class="search-input"
        type="text"
        placeholder="Filter..."
        autocomplete="off"
        bind:value={searchQuery}
      />
    </div>
  </div>

  <Settings
    isOpen={isSettingsOpen}
    themeMode={themeMode}
    showRecent={showRecent}
    recentLimit={recentLimit}
    onClose={() => isSettingsOpen = false}
    onThemeChange={updateTheme}
    onShowRecentChange={updateShowRecent}
    onRecentLimitChange={updateRecentLimit}
    onClearFavourites={clearFavourites}
    onClearRecent={clearRecent}
    onClearAll={clearAll}
  />

  <div id="cards">
    <!-- Favourites section -->
    {#if favCards.length > 0}
      <div class="cards-section">
        <h3 class="section-title">Favourites</h3>
        <div id="tableFavouritesId">
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
              onInteract={trackRecent}
            />
          {/each}
        </div>
      </div>
    {/if}

    <!-- Recent section -->
    {#if recentCards.length > 0}
      <div class="cards-section">
        <h3 class="section-title">Recent</h3>
        <div id="tableRecentId">
          {#each recentCards as card (card.id)}
            <CardItem
              {card}
              {networks}
              isFav={favourites.includes(card.id)}
              isSearchable={false}
              searchQuery={searchQueryLower}
              onFav={addFavourite}
              onUnfav={removeFavourite}
              onCopy={handleCopy}
              onAutofill={handleAutofill}
              onInteract={trackRecent}
            />
          {/each}
        </div>
      </div>
    {/if}

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
            onInteract={trackRecent}
          />
        {/each}
      </div>
    {/each}
  </div>

  {#if copyMessage}
    <div class="copy-toast" transition:fade={{ duration: 200 }}>
      {copyMessage}
    </div>
  {/if}
</main>
<style>
  a {
    color: var(--link);
    cursor: pointer;
    text-decoration: none;
  }

  /* ── Copy toast ──────────────────────────── */
  .copy-toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: var(--text);
    color: var(--bg);
    padding: 8px 18px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    z-index: 200;
    pointer-events: none;
    white-space: nowrap;
  }

  /* ── Top controls ────────────────────────── */
  .header-controls {
    position: sticky;
    top: 0;
    z-index: 10;
    background-color: var(--bg);
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: -4px -4px 7px;
    padding: 4px 4px 8px;
    border-bottom: 1px solid var(--card-border);
  }

  .controls-row--top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .controls-row--bottom {
    display: flex;
  }

  .gateway-select {
    box-sizing: border-box;
    padding: 8px 12px;
    font-size: 13px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    outline: none;
    font-family: inherit;
    background-color: var(--input-bg);
    color: var(--input-text);
    flex: 1;
    min-width: 0;
  }

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
    width: 100%;
  }

  .icon-button {
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
    transition: background 0.2s, border-color 0.2s;
    text-decoration: none;
  }

  .icon-button:hover {
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

</style>
