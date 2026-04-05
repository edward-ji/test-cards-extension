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
  const isHidden = $derived(isSearchable && !card.search.includes(searchQuery));

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

  function onCopyKeydown(copyFn: () => void) {
    return (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        copyFn();
      }
    };
  }
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
      <div class="card-number copyable" role="button" tabindex="0"
        onclick={() => onCopy(String(card.display['number']))}
        onkeydown={onCopyKeydown(() => onCopy(String(card.display['number'])))}>
        {card.display['number']}
      </div>
    {/if}

    {#if standardFields.some(({ key }) => card.display[key] != null && card.display[key] !== '')}
      <div class="card-fields">
        {#each standardFields as { key, label } (key)}
          {#if card.display[key] != null && card.display[key] !== ''}
            <div class="card-field" class:card-field--name={key === 'name'}>
              <span class="field-label">{label}</span>
              <span class="field-value copyable" role="button" tabindex="0"
                onclick={() => onCopy(String(card.display[key]))}
                onkeydown={onCopyKeydown(() => onCopy(String(card.display[key])))}
              >{card.display[key]}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/if}

    {#if extraEntries.length > 0}
      <div class="card-extras">
        {#each extraEntries as [key, val] (key)}
          {@const copyVal = typeof val === 'boolean' ? key : String(val)}
          <span class="card-badge copyable" role="button" tabindex="0"
            title={typeof val === 'boolean' ? undefined : key.charAt(0).toUpperCase() + key.slice(1)}
            onclick={() => onCopy(copyVal)}
            onkeydown={onCopyKeydown(() => onCopy(copyVal))}>
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

    <button type="button" class="fill-column" title="Autofill" onclick={() => onAutofill(card.prefill)}></button>
  </div>
</div>
<style>
  .card-item {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--card-border);
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 8px;
  }

  /* ── Left column: logos stacked vertically ─ */
  .card-logos {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }

  .network-icon {
    height: 20px;
    width: 36px;
    object-fit: contain;
  }

  /* ── Right column: content ───────────────── */
  .card-content {
    flex: 1;
    min-width: 0;
  }

  /* ── Column 3: action buttons ────────────── */
  .card-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .fav-icon,
  .unfav-icon {
    width: 15px;
    height: 15px;
    background-size: cover;
    padding: 0;
    border: none;
    background-color: transparent;
    cursor: pointer;
    flex-shrink: 0;
  }

  .fav-icon {
    background-image: var(--star-empty-url);
  }

  .fav-icon:hover {
    background-image: var(--star-filled-url);
  }

  .unfav-icon {
    background-image: var(--star-filled-url);
  }

  .unfav-icon:hover {
    background-image: var(--star-empty-url);
  }

  .fill-column {
    width: 15px;
    height: 15px;
    background-size: cover;
    padding: 0;
    border: none;
    background-color: transparent;
    cursor: pointer;
    flex-shrink: 0;
    background-image: url('/images/autofill-inactive.svg');
  }

  .fill-column:hover {
    background-image: url('/images/autofill.svg');
  }

  /* ── Card number ─────────────────────────── */
  .card-number {
    font-family: 'Roboto Mono', monospace;
    font-size: 13px;
    letter-spacing: 0.04em;
    padding: 2px 4px;
    margin: 0 -4px;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-number:hover {
    background: var(--row-hover);
  }

  /* ── Standard fields (exp, csc, name) ────── */
  .card-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
  }

  .card-field {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .field-label {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    user-select: none;
  }

  .field-value {
    font-size: 12px;
    padding: 1px 3px;
    border-radius: 3px;
    cursor: pointer;
  }

  .field-value:hover {
    background: var(--row-hover);
  }

  .card-field--name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .card-field--name .field-value {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Extra fields (country, flags, etc.) ─── */
  .card-extras {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .card-badge {
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 10px;
    background: var(--badge-bg);
    color: var(--badge-text);
    line-height: 1.5;
  }

  .card-badge.copyable {
    cursor: pointer;
  }

  .card-badge.copyable:hover {
    filter: brightness(0.92);
  }
</style>
