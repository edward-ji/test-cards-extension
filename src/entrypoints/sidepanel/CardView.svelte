<script lang="ts">
  import type { Card, NetworkInfo, PrefillData } from '../../parser';
  import CardItem from './CardItem.svelte';

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
    onInteract?: (cardId: string) => void;
  } = $props();
</script>

{#each cards as card (card.id)}
  <CardItem
    {card}
    {networks}
    isFav={isFavSection || favourites.includes(card.id)}
    isSearchable={false}
    searchQuery=""
    {onFav}
    {onUnfav}
    {onCopy}
    {onAutofill}
    {onInteract}
  />
{/each}
