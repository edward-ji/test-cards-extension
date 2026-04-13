<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { PublicPath } from 'wxt/browser';
  import { parseGatewayData, type NetworkInfo, type Card, type ParsedGroup, type RawGatewayFile, type PrefillData } from '../../parser';

  function isGatewayId(value: string): boolean {
    return gateways.some(g => g.id === value);
  }
  import CardView from './CardView.svelte';
  import Settings from './Settings.svelte';
  import TableView from './TableView.svelte';
  import { prefillCardComponent } from './autofill';

  const FAVOURITES_LIST = 'favourites-list';
  const SELECTED_GATEWAY = 'selected-gateway';
  const COLOR_SCHEME = 'color-scheme';
  const RECENT_CARDS = 'recent-cards';
  const SHOW_RECENT = 'show-recent';
  const RECENT_LIMIT = 'recent-limit';
  const DENSITY = 'density';
  const CUSTOM_GATEWAYS = 'custom-gateways';

  const SETTINGS_KEYS = [COLOR_SCHEME, DENSITY, SHOW_RECENT, RECENT_LIMIT] as const;
  type ThemeMode = 'light' | 'dark' | 'system';
  type Density = 'comfortable' | 'compact';

  // State
  let builtinGatewayFiles = $state<RawGatewayFile[]>([]);
  let customGatewayFiles = $state<RawGatewayFile[]>([]);
  let currentGatewayId = $state<string>('adyen');
  let cards = $state<ParsedGroup[]>([]);
  let favourites = $state<string[]>([]);
  let networks = $state<NetworkInfo[]>([]);
  let themeMode = $state<ThemeMode>('system');
  let density = $state<Density>('comfortable');
  let copyMessage = $state('');
  let searchQuery = $state('');
  let isSettingsOpen = $state(false);
  let recentCardIds = $state<string[]>([]);
  let showRecent = $state(false);
  let recentLimit = $state(5);
  let recentSectionEl: HTMLElement | null = $state(null);
  let cardsEl: HTMLElement | null = $state(null);

  // Derived
  const gateways = $derived<RawGatewayFile[]>([...builtinGatewayFiles, ...customGatewayFiles]);
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
    const [storedFavs, storedTheme, storedDensity, gatewayIds, networkData, savedGateway, storedRecent, storedShowRecent, storedRecentLimit, storedCustomGateways] = await Promise.all([
      getFromStorage<string[]>(FAVOURITES_LIST),
      getFromStorage<ThemeMode>(COLOR_SCHEME),
      getFromStorage<Density>(DENSITY),
      loadFromFile<string[]>('/data/gateways.json'),
      loadFromFile<NetworkInfo[]>('/data/networks.json'),
      getFromStorage<string>(SELECTED_GATEWAY),
      getFromStorage<string[]>(RECENT_CARDS),
      getFromStorage<boolean>(SHOW_RECENT),
      getFromStorage<number>(RECENT_LIMIT),
      getFromStorage<RawGatewayFile[]>(CUSTOM_GATEWAYS),
    ]);

    favourites = storedFavs ?? [];
    themeMode = storedTheme ?? 'system';
    density = storedDensity ?? 'comfortable';
    networks = networkData ?? [];
    recentCardIds = storedRecent ?? [];
    showRecent = storedShowRecent ?? false;
    recentLimit = storedRecentLimit ?? 5;
    customGatewayFiles = storedCustomGateways ?? [];

    // Load all built-in gateway files in parallel (small local resources)
    const ids = gatewayIds ?? [];
    builtinGatewayFiles = (
      await Promise.all(ids.map(id => loadFromFile<RawGatewayFile>(`/data/cards/${id}.json` as PublicPath)))
    ).filter((f): f is RawGatewayFile => f !== undefined);

    if (savedGateway && isGatewayId(savedGateway)) {
      currentGatewayId = savedGateway;
    }

    await loadDataForGateway(currentGatewayId);
  });

  async function loadDataForGateway(gatewayId: string) {
    const file = gateways.find(g => g.id === gatewayId);
    if (file) {
      cards = parseGatewayData(gatewayId, file.cards, networks);
    }
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


  function sectionHeightWithMargin(el: HTMLElement | null): number {
    if (!el) return 0;
    return el.offsetHeight + parseFloat(getComputedStyle(el).marginBottom);
  }

  async function trackRecent(cardId: string, compensateScroll = false) {
    const prevHeight = sectionHeightWithMargin(recentSectionEl);
    const prevScrollTop = cardsEl?.scrollTop ?? 0;

    const updated = [cardId, ...recentCardIds.filter(id => id !== cardId)];
    await setInStorage(RECENT_CARDS, updated);
    recentCardIds = updated;

    if (!compensateScroll) return;

    await tick();

    const newSection = recentSectionEl ?? document.getElementById('tableRecentId')?.closest<HTMLElement>('.cards-section');
    const newHeight = sectionHeightWithMargin(newSection ?? null);
    const heightDiff = newHeight - prevHeight;
    if (heightDiff > 0 && cardsEl) {
      cardsEl.scrollTop = prevScrollTop + heightDiff;
    }
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

  async function clearCustomGateways() {
    await setInStorage(CUSTOM_GATEWAYS, []);
    customGatewayFiles = [];
    if (!builtinGatewayFiles.some(g => g.id === currentGatewayId)) {
      const fallback = builtinGatewayFiles[0]?.id ?? 'adyen';
      currentGatewayId = fallback;
      await setInStorage(SELECTED_GATEWAY, fallback);
      await loadDataForGateway(fallback);
    }
  }

  async function clearSettings() {
    await browser.storage.local.remove([...SETTINGS_KEYS]);
    themeMode = 'system';
    density = 'comfortable';
    showRecent = false;
    recentLimit = 5;
  }

  async function clearAll() {
    await browser.storage.local.clear();
    favourites = [];
    recentCardIds = [];
    themeMode = 'system';
    density = 'comfortable';
    showRecent = false;
    recentLimit = 5;
    customGatewayFiles = [];
    if (!builtinGatewayFiles.some(g => g.id === currentGatewayId)) {
      currentGatewayId = builtinGatewayFiles[0]?.id ?? 'adyen';
      await loadDataForGateway(currentGatewayId);
    }
  }

  async function updateTheme(next: ThemeMode) {
    themeMode = next;
    await setInStorage(COLOR_SCHEME, next);
  }

  async function updateDensity(next: Density) {
    await setInStorage(DENSITY, next);
    density = next;
  }

  async function handleGatewayChange(value: string) {
    if (!isGatewayId(value)) return;
    currentGatewayId = value;
    await setInStorage(SELECTED_GATEWAY, value);
    await loadDataForGateway(value);
  }

  async function handleImportGateway(file: File): Promise<string | undefined> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return 'Could not parse file. Ensure it is valid JSON.';
    }
    if (
      typeof parsed !== 'object' || parsed === null || Array.isArray(parsed) ||
      typeof (parsed as Record<string, unknown>).id !== 'string' ||
      typeof (parsed as Record<string, unknown>).name !== 'string' ||
      !Array.isArray((parsed as Record<string, unknown>).cards) ||
      !(parsed as { cards: unknown[] }).cards.every(
        (g) => typeof (g as Record<string, unknown>).group === 'string' && Array.isArray((g as Record<string, unknown>).items)
      )
    ) {
      return 'Invalid format. Expected: { id, name, docsLink?, cards: [{ group, items[] }] }';
    }
    const gw = parsed as RawGatewayFile;
    if (builtinGatewayFiles.some(g => g.id === gw.id)) {
      return `"${gw.id}" conflicts with a built-in gateway. Use a different id.`;
    }
    const updated = [...customGatewayFiles.filter(g => g.id !== gw.id), gw];
    await setInStorage(CUSTOM_GATEWAYS, updated);
    customGatewayFiles = updated;
  }

  async function handleRemoveCustomGateway(id: string) {
    const updated = customGatewayFiles.filter(g => g.id !== id);
    await setInStorage(CUSTOM_GATEWAYS, updated);
    customGatewayFiles = updated;
    if (currentGatewayId === id) {
      const fallback = builtinGatewayFiles[0]?.id ?? 'adyen';
      currentGatewayId = fallback;
      await setInStorage(SELECTED_GATEWAY, fallback);
      await loadDataForGateway(fallback);
    }
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
    density={density}
    showRecent={showRecent}
    recentLimit={recentLimit}
    onClose={() => isSettingsOpen = false}
    onThemeChange={updateTheme}
    onDensityChange={updateDensity}
    onShowRecentChange={updateShowRecent}
    onRecentLimitChange={updateRecentLimit}
    onClearFavourites={clearFavourites}
    onClearRecent={clearRecent}
    onClearCustomGateways={clearCustomGateways}
    onClearSettings={clearSettings}
    onClearAll={clearAll}
    customGateways={customGatewayFiles.map(g => ({ id: g.id, name: g.name }))}
    onImportGateway={handleImportGateway}
    onRemoveCustomGateway={handleRemoveCustomGateway}
  />

  <div id="cards" bind:this={cardsEl} style:overflow-y={isSettingsOpen ? 'hidden' : undefined}>
    <!-- Favourites section -->
    {#if favCards.length > 0}
      <div class="cards-section">
        <h3 class="section-title">Favourites</h3>
        <div id="tableFavouritesId">
          {#if density === 'compact'}
            <TableView
              cards={favCards}
              {networks}
              {favourites}
              isFavSection={true}
              onFav={addFavourite}
              onUnfav={removeFavourite}
              onCopy={handleCopy}
              onAutofill={handleAutofill}
              onInteract={trackRecent}
            />
          {:else}
            <CardView
              cards={favCards}
              {networks}
              {favourites}
              isFavSection={true}
              onFav={addFavourite}
              onUnfav={removeFavourite}
              onCopy={handleCopy}
              onAutofill={handleAutofill}
              onInteract={trackRecent}
            />
          {/if}
        </div>
      </div>
    {/if}

    <!-- Recent section -->
    {#if recentCards.length > 0}
      <div class="cards-section" bind:this={recentSectionEl}>
        <h3 class="section-title">Recent</h3>
        <div id="tableRecentId">
          {#if density === 'compact'}
            <TableView
              cards={recentCards}
              {networks}
              {favourites}
              isFavSection={false}
              onFav={addFavourite}
              onUnfav={removeFavourite}
              onCopy={handleCopy}
              onAutofill={handleAutofill}
              onInteract={trackRecent}
            />
          {:else}
            <CardView
              cards={recentCards}
              {networks}
              {favourites}
              isFavSection={false}
              onFav={addFavourite}
              onUnfav={removeFavourite}
              onCopy={handleCopy}
              onAutofill={handleAutofill}
              onInteract={trackRecent}
            />
          {/if}
        </div>
      </div>
    {/if}

    <!-- Card group sections -->
    {#each nonFavGroups as group (group.group)}
      {@const visibleCards = group.items.filter((c: Card) => c.search.includes(searchQueryLower))}
      {#if visibleCards.length > 0}
        <div class="cards-section">
          <h3 class="section-title">{group.group}</h3>
          {#if density === 'compact'}
            <TableView
              cards={visibleCards}
              {networks}
              {favourites}
              isFavSection={false}
              onFav={addFavourite}
              onUnfav={removeFavourite}
              onCopy={handleCopy}
              onAutofill={handleAutofill}
              onInteract={(id) => trackRecent(id, true)}
            />
          {:else}
            <CardView
              cards={visibleCards}
              {networks}
              {favourites}
              isFavSection={false}
              onFav={addFavourite}
              onUnfav={removeFavourite}
              onCopy={handleCopy}
              onAutofill={handleAutofill}
              onInteract={(id) => trackRecent(id, true)}
            />
          {/if}
        </div>
      {/if}
    {/each}
  </div>

  {#if copyMessage}
    <div class="copy-toast" transition:fade={{ duration: 200 }}>
      {copyMessage}
    </div>
  {/if}
</main>
<style>
  .content {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

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
    flex-shrink: 0;
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

  /* ── Cards area ─────────────────────────── */
  #cards {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    scrollbar-gutter: stable;
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
