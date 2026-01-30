<script lang="ts">
import { tick } from 'svelte';
import type { GetItemListResult, GetItemThumbnailResult } from "@petamorikei/eagle-js/dist/types";
import { EagleClient } from '@petamorikei/eagle-js';
import { promises } from 'fs';
import GalleryItem from './GalleryItem.svelte';

type EagleFolderID = string;

interface Props {
    content: string;
    settings: {
        colWidth?: number;
        imageSourceType?: 'base64' | 'url';
        imageBaseUrl?: string;
        [key: string]: any;
    };
    stretchFirst?: boolean;
    gridGap?: string;
}

let { content, settings, stretchFirst = false, gridGap = '0.5em' }: Props = $props();

let colWidth = $state(settings?.colWidth || 200);
let computedColWidth = $derived(`minmax(min(${colWidth}px, 100%), 1fr)`);

const EAGLE_FOLDER_ID_REGEX = /[A-Z0-9]{13}/;
let masonryElement: HTMLElement | undefined = $state(undefined);
let grids: any[] = $state([]);
let _window: Window | undefined = $state(undefined);
const INITIAL_LIMIT = 50;
const BATCH_SIZE = 50;
let isLoading = $state(false);
let hasMore = $state(true);
let currentOffset = $state(0);
let itemIds: string[] = $state([]);
let thumbnailCache = $state<Map<string, string>>(new Map());

function base64Encode(buffer: Buffer): string {
    return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function fetchThumbnailPath(id: string): Promise<string | null> {
    try {
        const result: GetItemThumbnailResult | null = await EagleClient.instance.getItemThumbnail({ id });
        return result?.status === 'success' ? result.data : null;
    } catch (error) {
        console.warn(`Failed to fetch thumbnail path for ${id}:`, error);
        return null;
    }
}

async function loadThumbnail(id: string): Promise<string | null> {
    if (thumbnailCache.has(id)) {
        return thumbnailCache.get(id)!;
    }

    try {
        const path = await fetchThumbnailPath(id);
        if (!path) return null;

        const decodedPath = decodeURIComponent(path);
        let buffer: Buffer | null = null;
        const ext = decodedPath.split('.').pop() || 'png';
        const basePath = decodedPath.replace(/_thumbnail\.(png|jpg|jpeg|webp|gif|bmp)$/, '');

        const pathsToTry = [
            decodedPath,
            decodedPath.replace(`_thumbnail.${ext}`, `.${ext}`),
            `${basePath}.${ext}`,
            `${basePath}.png`,
            `${basePath}.jpg`,
            `${basePath}.jpeg`,
            `${basePath}.webp`,
        ];

        for (const tryPath of pathsToTry) {
            try {
                buffer = await promises.readFile(tryPath);
                break;
            } catch {
                continue;
            }
        }

        if (!buffer) {
            console.warn(`No thumbnail or original file found for ${id}`);
            return null;
        }

        const src = settings.imageSourceType === 'url'
            ? `${settings.imageBaseUrl || ''}/images/${id}.info/${path.split('/').pop()}`
            : base64Encode(buffer);

        thumbnailCache.set(id, src);
        return src;
    } catch (error) {
        console.warn(`Failed to load thumbnail for ${id}:`, error);
        return null;
    }
}

async function batchLoadThumbnails(ids: string[]): Promise<Map<string, string>> {
    const cache = new Map<string, string>();

    const uncachedIds = ids.filter(id => !thumbnailCache.has(id));

    if (uncachedIds.length === 0) {
        return thumbnailCache;
    }

    const results = await Promise.allSettled(
        uncachedIds.map(id => loadThumbnail(id))
    );

    uncachedIds.forEach((id, index) => {
        const result = results[index];
        if (result.status === 'fulfilled' && result.value) {
            cache.set(id, result.value);
        }
    });

    return cache;
}

async function fetchEagleItemsByFolders(
    folders: EagleFolderID[],
    limit: number = INITIAL_LIMIT,
    offset: number = 0
): Promise<any[] | null> {
    try {
        const result: GetItemListResult | null = await EagleClient.instance.getItemList({
            limit,
            folders,
            offset
        });
        if (result?.status === 'success') {
            hasMore = result.data.length === limit;
            return result.data;
        }
        return null;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to fetch Eagle items: ${errorMessage}`);
    }
}

async function loadMoreItems(folderID: string) {
    if (!hasMore || isLoading) return;

    isLoading = true;
    try {
        const newItems = await fetchEagleItemsByFolders([folderID], BATCH_SIZE, currentOffset);
        if (newItems?.length) {
            const newIds = newItems.map(item => item.id);
            itemIds = [...itemIds, ...newIds];
            currentOffset += newItems.length;

            batchLoadThumbnails(newIds).then(() => {
                thumbnailCache = new Map(thumbnailCache);
            });
        }
    } catch (error) {
        console.error('Failed to load more items:', error);
    } finally {
        isLoading = false;
    }
}

export const refreshLayout = async () => {
    grids.forEach(async grid => {
        let ncol = getComputedStyle(grid._el).gridTemplateColumns.split(' ').length;

        grid.items.forEach((c: HTMLElement) => {
            let new_h = c.getBoundingClientRect().height;
            if (!c.dataset.h) {
                c.dataset.h = new_h.toString();
            }
            if(new_h !== Number(c.dataset.h)) {
                c.dataset.h = new_h.toString();
                grid.mod++;
            }
        });

        if(grid.ncol !== ncol || grid.mod) {
            grid.ncol = ncol;
            grid.items.forEach((c: HTMLElement) => c.style.removeProperty('margin-top'));
            if(grid.ncol > 1) {
                grid.items.slice(ncol).forEach((c: HTMLElement, i: number) => {
                    let prev_fin = grid.items[i].getBoundingClientRect().bottom,
                        curr_ini = c.getBoundingClientRect().top;
                    c.style.marginTop = `${prev_fin + grid.gap - curr_ini}px`;
                });
            }
            grid.mod = 0;
        }
    });
};

const calcGrid = async (_masonryArr: HTMLElement[]) => {
    await tick();
    if(_masonryArr.length && getComputedStyle(_masonryArr[0]).gridTemplateRows !== 'masonry') {
        grids = _masonryArr.map(grid => ({
            _el: grid,
            gap: parseFloat(getComputedStyle(grid).rowGap),
            items: Array.from(grid.children).filter((child): child is HTMLElement => {
                return child instanceof HTMLElement &&
                    Number(getComputedStyle(child).gridColumnEnd) !== -1;
            }),
            ncol: 0,
            mod: 0
        }));
        refreshLayout();
    }
};

function handleScroll() {
    if (!masonryElement) return;

    const rect = masonryElement.getBoundingClientRect();
    const bottomOffset = rect.bottom - window.innerHeight;

    if (bottomOffset < 300 && !isLoading && hasMore) {
        const folderIDMatch = content.match(EAGLE_FOLDER_ID_REGEX);
        if (folderIDMatch) {
            loadMoreItems(folderIDMatch[0]);
        }
    }
}

$effect(() => {
    _window = window;
    _window.addEventListener('resize', refreshLayout, false);
    _window.addEventListener('scroll', handleScroll, { passive: true });

    const folderIDMatch = content.match(EAGLE_FOLDER_ID_REGEX);
    if (!folderIDMatch) {
        console.warn('No Eagle folder ID found in content');
        return;
    }

    fetchEagleItemsByFolders([folderIDMatch[0]], INITIAL_LIMIT).then(items => {
        if (!items?.length) {
            console.warn('No items found in Eagle folder');
            return;
        }
        itemIds = items.map((item) => item.id);
        currentOffset = items.length;

        batchLoadThumbnails(itemIds).then(cache => {
            thumbnailCache = cache;
            if (masonryElement) {
                calcGrid([masonryElement]);
            }
        });
    }).catch(error => {
        console.error('Failed to load Eagle folder contents:', error);
    });

    return () => {
        if (_window) {
            _window.removeEventListener('resize', refreshLayout, false);
            _window.removeEventListener('scroll', handleScroll);
        }
    };
});

$effect(() => {
    if (masonryElement) {
        calcGrid([masonryElement]);
    }
});
</script>

<div class="gallery-controls">
    <label>
        Column width: {colWidth}px
        <input
            type="range"
            bind:value={colWidth}
            min="20"
            max="500"
            step="10"
        />
    </label>
    <span class="cache-stats">{thumbnailCache.size} cached</span>
</div>

<div bind:this={masonryElement}
     class={`__grid--masonry ${stretchFirst ? '__stretch-first' : ''}`}
     style={`--grid-gap: ${gridGap}; --col-width: ${computedColWidth};`}>
    {#each itemIds as id (id)}
        <GalleryItem {id} src={thumbnailCache.get(id) || ''} {settings} />
    {/each}
    {#if isLoading}
        <div class="loading">Loading more items...</div>
    {/if}
</div>

<style>
  .gallery-controls {
    padding: 1em;
    margin-bottom: 1em;
    background: var(--background-secondary);
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 1em;
  }

  .gallery-controls label {
    display: flex;
    align-items: center;
    gap: 1em;
    flex: 1;
  }

  .gallery-controls input[type="range"] {
    flex: 1;
  }

  .cache-stats {
    font-size: 0.8em;
    color: var(--text-muted);
    min-width: 80px;
    text-align: right;
  }

  .loading {
    grid-column: 1 / -1;
    text-align: center;
    padding: 1em;
    color: var(--text-muted);
  }

  :global(.__grid--masonry) {
    display: grid;
    grid-template-columns: repeat(auto-fit, var(--col-width));
    grid-template-rows: masonry;
    justify-content: center;
    grid-gap: var(--grid-gap);
    padding: var(--grid-gap);
  }

  :global(.__grid--masonry > *) {
    align-self: start
  }

  :global(.__grid--masonry.__stretch-first > *:first-child) {
    grid-column: 1/ -1;
  }
</style>
