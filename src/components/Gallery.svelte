<script lang="ts">
import { onMount, onDestroy, tick } from 'svelte';
import type { GetItemListResult} from "@petamorikei/eagle-js/dist/types";
import { EagleClient } from '@petamorikei/eagle-js';
import GalleryItem from './GalleryItem.svelte';

type EagleFolderID = string;

export let content: string;
export let settings: {
    colWidth?: number;
    [key: string]: any;
};
export let stretchFirst = false;
export let gridGap = '0.5em';
export let colWidth = settings?.colWidth || 200;
$: computedColWidth = `minmax(Min(${colWidth}px, 100%), 1fr)`;

const EAGLE_FOLDER_ID_REGEX = /[A-Z0-9]{13}/;
let masonryElement: HTMLElement;
let grids: any[] = [];
let _window: Window;
const INITIAL_LIMIT = 50;
const BATCH_SIZE = 50;
let isLoading = false;
let hasMore = true;
let currentOffset = 0;

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
            itemIds = [...itemIds, ...newItems.map(item => item.id)];
            currentOffset += newItems.length;
        }
    } catch (error) {
        console.error('Failed to load more items:', error);
    } finally {
        isLoading = false;
    }
}


let itemIds: string[] = [];

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

onMount(async () => {
    _window = window;
    _window.addEventListener('resize', refreshLayout, false);
    _window.addEventListener('scroll', handleScroll, { passive: true });

    const folderIDMatch = content.match(EAGLE_FOLDER_ID_REGEX);
    if (!folderIDMatch) {
        console.warn('No Eagle folder ID found in content');
        return;
    }

    try {
        const items = await fetchEagleItemsByFolders([folderIDMatch[0]], INITIAL_LIMIT);
        if (!items?.length) {
            console.warn('No items found in Eagle folder');
            return;
        }
        itemIds = items.map((item) => item.id);
        currentOffset = items.length;

        if (masonryElement) {
            await calcGrid([masonryElement]);
        }
    } catch (error) {
        console.error('Failed to load Eagle folder contents:', error);
    }
});

onDestroy(() => {
    if (_window) {
        _window.removeEventListener('resize', refreshLayout, false);
        _window.removeEventListener('scroll', handleScroll);
    }
});

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

onDestroy(() => {
    if (_window) {
        _window.removeEventListener('resize', refreshLayout, false);
    }
});

$: if (masonryElement) {
    calcGrid([masonryElement]);
}
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
</div>

<div bind:this={masonryElement}
     class={`__grid--masonry ${stretchFirst ? '__stretch-first' : ''}`}
     style={`--grid-gap: ${gridGap}; --col-width: ${computedColWidth};`}>
    {#each itemIds as id}
        <GalleryItem {settings} {id} />
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
  }

  .gallery-controls label {
    display: flex;
    align-items: center;
    gap: 1em;
  }

  .gallery-controls input[type="range"] {
    flex: 1;
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
