<script lang="ts">
  import { onMount } from 'svelte';
  import { parseGatewayData, type NetworkInfo, type Card, type ParsedGroup, type RawCardItem, type PrefillData } from '../../parser';
  import CardItem from './CardItem.svelte';
  import { prefillCardComponent } from './autofill';

  const FAVOURITES_LIST = 'favourites-list';
  const SELECTED_GATEWAY = 'selected-gateway';
  const COLOR_SCHEME = 'color-scheme';
  type ThemeMode = 'light' | 'dark' | 'system';

  // State
  let gateways = $state<{ id: string; name: string; docsLink?: string }[]>([]);
  let currentGatewayId = $state('adyen');
  let cards = $state<ParsedGroup[]>([]);
  let favourites = $state<string[]>([]);
  let networks = $state<NetworkInfo[]>([]);
  let themeMode = $state<ThemeMode>('system');
  let copyMessage = $state('');
  let searchQuery = $state('');

  // Derived
  const currentGateway = $derived(gateways.find(g => g.id === currentGatewayId));
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
    const [storedFavs, storedTheme, gatewayData, networkData] = await Promise.all([
      getFromStorage<string[]>(FAVOURITES_LIST),
      getFromStorage<ThemeMode>(COLOR_SCHEME),
      loadFromFile<{ id: string; name: string; docsLink?: string }[]>('data/gateways.json'),
      loadFromFile<NetworkInfo[]>('data/networks.json'),
    ]);

    favourites = storedFavs ?? [];
    themeMode = storedTheme ?? 'system';
    gateways = gatewayData ?? [];
    networks = networkData ?? [];

    const savedGateway = await getFromStorage<string>(SELECTED_GATEWAY);
    if (savedGateway && gateways.find(g => g.id === savedGateway)) {
      currentGatewayId = savedGateway;
    }

    await loadDataForGateway(currentGatewayId);
  });

  async function loadDataForGateway(gatewayId: string) {
    const rawCards = await loadFromFile<{ group: string; items: RawCardItem[] }[]>(`data/${gatewayId}.json`);
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

  async function loadFromFile<T>(filename: string): Promise<T | undefined> {
    try {
      const res = await fetch(browser.runtime.getURL(filename));
      return await res.json() as T;
    } catch {
      return undefined;
    }
  }

  function themeLabel(mode: ThemeMode) {
    return `${mode.charAt(0).toUpperCase()}${mode.slice(1)} theme`;
  }

  async function cycleTheme() {
    const next: ThemeMode = themeMode === 'system' ? 'light' : themeMode === 'light' ? 'dark' : 'system';
    themeMode = next;
    await setInStorage(COLOR_SCHEME, next);
  }
</script>

<header id="header">{copyMessage}</header>
<main class="content">
  <div class="header-controls">
    <select
      id="gatewaySelector"
      class="gateway-select"
      value={currentGatewayId}
      onchange={async (e) => {
        currentGatewayId = (e.target as HTMLSelectElement).value;
        await setInStorage(SELECTED_GATEWAY, currentGatewayId);
        await loadDataForGateway(currentGatewayId);
      }}
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
      id="themeToggle"
      class="theme-toggle"
      title={themeLabel(themeMode)}
      onclick={cycleTheme}
    >
      <img src={`/images/theme-${themeMode}.svg`} width="16" height="16" alt="" />
    </button>
  </div>

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
              {searchQuery}
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
      {@const anyVisible = group.items.some((c: Card) => c.search.includes(searchQuery.toLowerCase()))}
      <div class="cards-section" style:display={anyVisible ? '' : 'none'}>
        <h3 class="section-title">{group.group}</h3>
        {#each group.items as card (card.id)}
          <CardItem
            {card}
            {networks}
            isFav={false}
            isSearchable={true}
            {searchQuery}
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
