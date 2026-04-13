<script lang="ts">
  import type { Card, NetworkInfo, PrefillData } from '../../parser';

  let {
    cards,
    networks,
    favourites,
    isFavSection,
    onFav,
    onUnfav,
    onCopy,
    onAutofill,
    onInteract,
  }: {
    cards: Card[];
    networks: NetworkInfo[];
    favourites: string[];
    isFavSection: boolean;
    onFav: (id: string) => Promise<void>;
    onUnfav: (id: string) => Promise<void>;
    onCopy: (text: string) => void;
    onAutofill: (prefill: PrefillData) => void;
    onInteract: (cardId: string) => void;
  } = $props();

  const STANDARD_KEYS = new Set(['number', 'exp', 'csc', 'name']);

  function hasField(key: string): boolean {
    return cards.some(c => c.display[key] != null && c.display[key] !== '');
  }

  function getExtras(card: Card) {
    return Object.entries(card.display).filter(
      ([k, v]) => !STANDARD_KEYS.has(k) && v !== null && v !== undefined && v !== ''
    );
  }

  function getNets(card: Card) {
    return Array.isArray(card.network) ? card.network : [card.network];
  }

  function copyField(value: unknown, cardId: string) {
    onCopy(String(value));
    onInteract(cardId);
  }

  function onKeydown(fn: () => void) {
    return (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    };
  }

  const c = $derived({
    number: hasField('number'),
    exp:    hasField('exp'),
    csc:    hasField('csc'),
    name:   hasField('name'),
  });
</script>

<table class="cards-table">
  <tbody>
    {#each cards as card (card.id)}
      {@const nets = getNets(card)}
      {@const extras = getExtras(card)}
      {@const isFav = isFavSection || favourites.includes(card.id)}
      <tr class="card-row">
        <td class="col-logo">
          <div class="logos">
            {#each nets as net (net)}
              {@const ni = networks.find(n => n.id === net)}
              <img
                src={ni?.logo ? `/images/logos/${ni.logo}` : '/images/logos/nocard.svg'}
                class="net-icon"
                title={ni?.names?.[0] ?? net}
                alt=""
              />
            {/each}
          </div>
        </td>

        {#if c.number}
          <td class="col-number">
            {#if card.display['number'] != null && card.display['number'] !== ''}
              <span
                class="copyable mono"
                role="button"
                tabindex="0"
                onclick={() => copyField(card.display['number'], card.id)}
                onkeydown={onKeydown(() => copyField(card.display['number'], card.id))}
              >{card.display['number']}</span>
            {/if}
          </td>
        {/if}

        {#if c.exp}
          <td class="col-field">
            {#if card.display['exp'] != null && card.display['exp'] !== ''}
              <span
                class="copyable field-val"
                role="button"
                tabindex="0"
                onclick={() => copyField(card.display['exp'], card.id)}
                onkeydown={onKeydown(() => copyField(card.display['exp'], card.id))}
              >{card.display['exp']}</span>
            {/if}
          </td>
        {/if}

        {#if c.csc}
          <td class="col-field">
            {#if card.display['csc'] != null && card.display['csc'] !== ''}
              <span
                class="copyable field-val"
                role="button"
                tabindex="0"
                onclick={() => copyField(card.display['csc'], card.id)}
                onkeydown={onKeydown(() => copyField(card.display['csc'], card.id))}
              >{card.display['csc']}</span>
            {/if}
          </td>
        {/if}

        {#if c.name}
          <td class="col-name">
            {#if card.display['name'] != null && card.display['name'] !== ''}
              <span
                class="copyable field-val name-val"
                role="button"
                tabindex="0"
                onclick={() => copyField(card.display['name'], card.id)}
                onkeydown={onKeydown(() => copyField(card.display['name'], card.id))}
              >{card.display['name']}</span>
            {/if}
          </td>
        {/if}

        <td class="col-extras">
          <div class="extras-wrap">
            {#each extras as [key, val] (key)}
              {@const copyVal = typeof val === 'boolean' ? key : String(val)}
              <span
                class="badge copyable"
                role="button"
                tabindex="0"
                title={typeof val === 'boolean' ? undefined : key.charAt(0).toUpperCase() + key.slice(1)}
                onclick={() => { onCopy(copyVal); onInteract(card.id); }}
                onkeydown={onKeydown(() => { onCopy(copyVal); onInteract(card.id); })}
              >{typeof val === 'boolean' ? key : val}</span>
            {/each}
          </div>
        </td>

        <td class="col-actions">
          {#if isFav}
            <button type="button" class="unfav-icon" title="Remove from favourites" onclick={() => onUnfav(card.id)}></button>
          {:else}
            <button type="button" class="fav-icon" title="Add to favourites" onclick={() => onFav(card.id)}></button>
          {/if}
          <button
            type="button"
            class="fill-btn"
            title="Autofill"
            onclick={() => { onAutofill(card.prefill); onInteract(card.id); }}
          ></button>
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .cards-table {
    width: 100%;
    max-width: 100%;
    table-layout: auto;
    border-collapse: collapse;
    font-size: 11px;
  }

  /* ── Card rows ───────────────────────────── */
  .card-row {
    border-top: 1px solid var(--card-border);
  }

  .card-row:last-child {
    border-bottom: 1px solid var(--card-border);
  }

  .card-row td {
    padding: 6px 4px;
    vertical-align: middle;
  }

  /* ── Logo column ─────────────────────────── */
  .col-logo {
    width: 1px;
    white-space: nowrap;
  }

  .logos {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .net-icon {
    height: 16px;
    width: 30px;
    object-fit: contain;
  }

  /* ── Number column ── */
  .col-number {
    overflow-wrap: break-word;
  }

  .mono {
    font-family: 'Roboto Mono', monospace;
    letter-spacing: 0.03em;
  }

  /* ── Fixed-width field columns (exp, csc) ── */
  .col-field {
    width: 1px;
    white-space: nowrap;
  }

  /* ── Name column ─────────────────────────── */
  .col-name {
    width: 1px;
    white-space: nowrap;
  }

  /* ── Extras column: auto-sized, but yields space under pressure ── */
  .col-extras {
    min-width: 0;
    overflow: hidden;
  }

  .extras-wrap {
    overflow: hidden;
  }

  .badge {
    display: inline-block;
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 8px;
    background: var(--badge-bg);
    color: var(--badge-text);
    line-height: 1.5;
    overflow-wrap: break-word;
    overflow: hidden;
    max-width: 100%;
    margin: 0 2px 3px 0;
  }

  /* ── Actions column ──────────────────────── */
  .col-actions {
    width: 1px;
    text-align: right;
    white-space: nowrap;
  }

  /* Undo the negative margin .copyable applies to inline text spans */
  .badge.copyable {
    margin: 0 2px 3px 0;
  }

  /* ── Copyable ────────────────────────────── */
  .copyable {
    cursor: pointer;
    border-radius: 3px;
    padding: 1px 3px;
    margin: 0 -3px;
  }

  .copyable:hover {
    background: var(--row-hover);
  }

  .field-val {
    font-size: 11px;
  }

  /* ── Fav / fill buttons ──────────────────── */
  .fav-icon,
  .unfav-icon,
  .fill-btn {
    width: 14px;
    height: 14px;
    background-size: cover;
    padding: 0;
    border: none;
    background-color: transparent;
    cursor: pointer;
    display: inline-block;
    vertical-align: middle;
    margin-left: 4px;
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

  .fill-btn {
    background-image: url('/images/autofill-inactive.svg');
  }

  .fill-btn:hover {
    background-image: url('/images/autofill.svg');
  }
</style>
