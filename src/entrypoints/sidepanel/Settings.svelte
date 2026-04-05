<script lang="ts">
  import { fade, slide } from "svelte/transition";

  type ThemeMode = "light" | "dark" | "system";

  interface Props {
    isOpen: boolean;
    themeMode: ThemeMode;
    showRecent: boolean;
    recentLimit: number;
    onClose: () => void;
    onThemeChange: (theme: ThemeMode) => void;
    onShowRecentChange: (value: boolean) => void;
    onRecentLimitChange: (value: number) => void;
  }

  let { isOpen, themeMode, showRecent, recentLimit, onClose, onThemeChange, onShowRecentChange, onRecentLimitChange }: Props = $props();

  const manifest = browser.runtime.getManifest();
  const extensionName = $derived(manifest.name || "Test Cards");
  const extensionVersion = $derived(manifest.version || "0.0.0");

  function themeLabel(mode: ThemeMode) {
    return `${mode.charAt(0).toUpperCase()}${mode.slice(1)}`;
  }
</script>

{#if isOpen}
  <div
    class="settings-overlay"
    transition:fade={{ duration: 200 }}
    onclick={onClose}
    onkeydown={(e) => e.key === "Escape" && onClose()}
    role="presentation"
  >
    <div
      class="settings-panel"
      transition:slide={{ axis: "y", duration: 300 }}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      tabindex="-1"
    >
      <header class="settings-header">
        <h2 id="settings-title">Settings</h2>
        <button class="close-button" onclick={onClose} title="Close">
          <img src="/images/close.svg" width="20" height="20" alt="" class="icon-dark-invert" />
        </button>
      </header>

      <div class="settings-content">
        <section class="settings-section">
          <h3 class="section-label">Appearance</h3>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-name">Theme</span>
              <span class="setting-description"
                >Choose how the extension looks</span
              >
            </div>
            <div class="theme-options">
              {#each ["system", "light", "dark"] as mode}
                <button
                  class="theme-option"
                  class:active={themeMode === mode}
                  onclick={() => onThemeChange(mode as ThemeMode)}
                >
                  <img
                    src={`/images/theme-${mode}.svg`}
                    width="14"
                    height="14"
                    alt=""
                    class="icon-dark-invert"
                  />
                  <span>{themeLabel(mode as ThemeMode)}</span>
                </button>
              {/each}
            </div>
          </div>
        </section>

        <section class="settings-section">
          <h3 class="section-label">Recent cards</h3>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-name">Cards to show</span>
              <span class="setting-description">Show recently used cards at the top</span>
            </div>
            <div class="theme-options">
              <button
                class="theme-option"
                class:active={!showRecent}
                onclick={() => onShowRecentChange(false)}
              >
                <span>Off</span>
              </button>
              {#each [3, 5, 10] as n}
                <button
                  class="theme-option"
                  class:active={showRecent && recentLimit === n}
                  onclick={() => { onShowRecentChange(true); onRecentLimitChange(n); }}
                >
                  <span>{n}</span>
                </button>
              {/each}
            </div>
          </div>
        </section>
      </div>

      <footer class="settings-footer">
        <p>{extensionName} v{extensionVersion}</p>
      </footer>
    </div>
  </div>
{/if}

<style>
  .settings-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    overflow: hidden;
  }

  .settings-panel {
    background: var(--bg);
    width: 100%;
    margin: 0;
    border-top: 1px solid var(--card-border);
    border-top-left-radius: 20px;
    border-top-right-radius: 20px;
    max-height: 85%;
    overflow-y: auto;
    box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 24px;
    border-bottom: 1px solid var(--card-border);
    position: sticky;
    top: 0;
    background: var(--bg);
    z-index: 10;
  }

  .settings-content {
    padding: 24px;
  }

  .settings-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .close-button {
    background: none;
    border: none;
    padding: 6px;
    cursor: pointer;
    color: var(--text);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background 0.2s,
      transform 0.2s;
  }

  .close-button:hover {
    background: var(--row-hover);
    transform: scale(1.1);
  }

  .settings-section {
    margin-bottom: 24px;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .setting-item {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .setting-name {
    font-weight: 500;
    font-size: 13px;
  }

  .setting-description {
    font-size: 11px;
    color: var(--text-muted);
  }

  .theme-options {
    display: flex;
    gap: 8px;
    padding: 4px;
    background: var(--badge-bg);
    border-radius: 8px;
  }

  .theme-option {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text);
    transition: all 0.2s;
  }

  .theme-option span {
    font-size: 10px;
    font-weight: 500;
  }

  .theme-option.active {
    background: var(--bg);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .theme-option img {
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .theme-option.active img {
    opacity: 1;
  }

  .settings-footer {
    padding: 16px;
    text-align: center;
    font-size: 10px;
    color: var(--text-muted);
    border-top: 1px solid var(--card-border);
  }
</style>
