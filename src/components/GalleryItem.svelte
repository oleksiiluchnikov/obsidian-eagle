<script lang="ts">
interface Props {
    id: string;
    src: string;
    settings?: {
        imageSourceType?: 'base64' | 'url';
        imageBaseUrl?: string;
    };
}

let { id, src, settings }: Props = $props();

let itemLoaded = $state(false);
let itemError = $state(false);

$effect(() => {
    itemLoaded = !!src;
    itemError = !src;
});

function openItem(e: Event) {
    e.preventDefault();
    window.open(`eagle://item/${id}`, '_blank');
}

function handleImageLoad() {
    itemLoaded = true;
}

function handleImageError() {
    itemError = true;
    itemLoaded = false;
}
</script>

{#if src}
    <div class="item-card" class:loaded={itemLoaded}>
        <a href="eagle://item/{id}" onclick={openItem}>
            <img
                {src}
                alt={id}
                loading="lazy"
                decoding="async"
                onload={handleImageLoad}
                onerror={handleImageError}
                style="width: 100%; height: auto;"
            />
        </a>
        <div class="item-info">
            <span class="item-id" title={id}>{id}</span>
        </div>
    </div>
{:else if itemError}
    <div class="item-card error">
        <div class="item-placeholder">
            <span class="error-icon">⚠</span>
            <span class="item-id">{id}</span>
        </div>
    </div>
{:else}
    <div class="item-card loading">
        <div class="item-placeholder">
            <span class="loading-spinner"></span>
            <span class="item-id">{id}</span>
        </div>
    </div>
{/if}

<style>
    .item-card {
        display: flex;
        flex-direction: column;
        padding: 0;
        border-radius: 6px;
        background-color: rgba(0, 0, 0, 0.2);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .item-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .item-card.loaded {
        background-color: rgba(0, 0, 0, 0.15);
    }

    .item-card.error {
        background-color: rgba(255, 0, 0, 0.1);
    }

    .item-card.loading {
        background-color: rgba(255, 255, 0, 0.05);
    }

    .item-card a {
        display: block;
        text-decoration: none;
        color: inherit;
    }

    .item-card img {
        display: block;
        max-width: 100%;
        height: auto;
        border-radius: 4px 4px 0 0;
        opacity: 0;
        transition: opacity 0.3s ease;
    }

    .item-card.loaded img {
        opacity: 1;
    }

    .item-info {
        padding: 0.5em;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .item-id {
        font-size: 0.75em;
        color: var(--text-muted);
        font-family: monospace;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
    }

    .item-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 1.5em;
        min-height: 100px;
        gap: 0.5em;
    }

    .loading-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid var(--text-muted);
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .error-icon {
        font-size: 1.5em;
        color: var(--text-error);
    }
</style>
