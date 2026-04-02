<script lang="ts">
  import type { Card, NetworkInfo, PrefillData } from '../../parser';

  let {
    card,
    networks,
    isFav,
    isSearchable,
    searchQuery,
    onFav,
    onUnfav,
    onCopy,
    onAutofill,
  }: {
    card: Card;
    networks: NetworkInfo[];
    isFav: boolean;
    isSearchable: boolean;
    searchQuery: string;
    onFav: (id: string) => Promise<void>;
    onUnfav: (id: string) => Promise<void>;
    onCopy: (text: string) => void;
    onAutofill: (prefill: PrefillData) => void;
  } = $props();

  const nets = $derived(Array.isArray(card.network) ? card.network : [card.network]);
  const isHidden = $derived(isSearchable && !card.search.includes(searchQuery.toLowerCase()));

  const STANDARD_KEYS = new Set(['number', 'exp', 'csc', 'name']);
  const extraEntries = $derived(
    Object.entries(card.display).filter(
      ([k, v]) => !STANDARD_KEYS.has(k) && v !== null && v !== undefined && v !== ''
    )
  );

  const standardFields = [
    { key: 'exp', label: 'Exp' },
    { key: 'csc', label: 'CSC' },
    { key: 'name', label: 'Name' },
  ] as const;
</script>

<div
  class="card-item"
  class:searchable={isSearchable}
  data-search={isSearchable ? card.search : undefined}
  style:display={isHidden ? 'none' : ''}
>
  <!-- Column 1: network logos -->
  <div class="card-logos">
    {#each nets as net (net)}
      {@const networkInfo = networks.find(n => n.id === net)}
      <img
        src={networkInfo?.logo ? `/images/logos/${networkInfo.logo}` : '/images/logos/nocard.svg'}
        class="network-icon"
        title={networkInfo?.names?.[0] ?? net}
        alt=""
      />
    {/each}
  </div>

  <!-- Column 2: card content -->
  <div class="card-content">
    {#if card.display['number'] != null && card.display['number'] !== ''}
      <div class="card-number copyable" role="button" tabindex="0" onclick={() => onCopy(String(card.display['number']))} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCopy(String(card.display['number'])); } }}>
        {card.display['number']}
      </div>
    {/if}

    {#if standardFields.some(({ key }) => card.display[key] != null && card.display[key] !== '')}
      <div class="card-fields">
        {#each standardFields as { key, label } (key)}
          {#if card.display[key] != null && card.display[key] !== ''}
            <div class="card-field" class:card-field--name={key === 'name'}>
              <span class="field-label">{label}</span>
              <span class="field-value copyable" role="button" tabindex="0" onclick={() => onCopy(String(card.display[key]))} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCopy(String(card.display[key])); } }}>{card.display[key]}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/if}

    {#if extraEntries.length > 0}
      <div class="card-extras">
        {#each extraEntries as [key, val] (key)}
          <span class="card-badge copyable" role="button" tabindex="0" title={typeof val === 'boolean' ? undefined : key.charAt(0).toUpperCase() + key.slice(1)} onclick={() => onCopy(typeof val === 'boolean' ? key : String(val))} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCopy(typeof val === 'boolean' ? key : String(val)); } }}>
            {typeof val === 'boolean' ? key : val}
          </span>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Column 3: action buttons -->
  <div class="card-actions">
    {#if isFav}
      <button type="button" class="unfav-icon" title="Remove from favourites" onclick={() => onUnfav(card.id)}></button>
    {:else}
      <button type="button" class="fav-icon" title="Add to favourites" onclick={() => onFav(card.id)}></button>
    {/if}

    <button type="button" class="fill-column" title="Autofill" onclick={() => onAutofill(card.prefill)}>
      <img src="/images/autofill.svg" class="action-icon" alt="" />
    </button>
  </div>
</div>
