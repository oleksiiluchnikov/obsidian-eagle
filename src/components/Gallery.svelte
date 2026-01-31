<script lang="ts">
import { tick } from 'svelte';
import { promises } from 'fs';
import GalleryItem from './GalleryItem.svelte';

type EagleFolderID = string;

interface EagleItem {
    id: string;
    name: string;
    width: number | string;
    height: number | string;
    [key: string]: unknown;
}

interface GridItem {
    _el: HTMLElement;
    gap: number;
    items: HTMLElement[];
    ncol: number;
    mod: number;
}

interface Props {
    content: string;
    settings: {
        colWidth?: number;
        imageSourceType?: 'base64' | 'url';
        imageBaseUrl?: string;
        [key: string]: unknown;
    };
    stretchFirst?: boolean;
    gridGap?: string;
}

let { content, settings, stretchFirst = false, gridGap = '0.5em' }: Props = $props();

let colWidth = $state(settings?.colWidth || 200);
let computedColWidth = $derived(`minmax(min(${colWidth}px, 100%), 1fr)`);

const EAGLE_FOLDER_URL_REGEX = /eagle:\/\/folder\/([A-Z0-9]{13})/;
let masonryElement: HTMLElement | undefined = $state(undefined);
let grids: GridItem[] = $state([]);
let _window: Window | undefined = $state(undefined);
const INITIAL_LIMIT = 50;
const BATCH_SIZE = 50;
let isLoading = $state(false);
let hasMore = $state(true);
let currentOffset = $state(0);
let items: EagleItem[] = $state([]);
let thumbnailCache = $state<Map<string, string>>(new Map());
let svgContentCache = $state<Map<string, string>>(new Map());

function base64Encode(buffer: Buffer, mime: string): string {
    return `data:${mime};base64,${buffer.toString('base64')}`;
}

function getExtFromPath(p: string): string {
    const m = p.match(/\.([^\.\/\\?#]+)(?:[?#].*)?$/);
    return (m && m[1]) ? m[1].toLowerCase() : '';
}

async function fetchThumbnailPath(id: string): Promise<string | null> {
    try {
        const response = await fetch(`${EAGLE_SERVER_URL}/api/item/thumbnail?id=${id}`);
        if (!response.ok) return null;
        const result = await response.json();
        return result.status === 'success' ? result.data : null;
    } catch (error) {
        console.warn(`Failed to fetch thumbnail path for ${id}:`, error);
        return null;
    }
}

async function loadThumbnail(id: string): Promise<string | null> {
    // Return cached value if available
    if (thumbnailCache.has(id)) {
        return thumbnailCache.get(id)!;
    }

    try {
        const path = await fetchThumbnailPath(id);
        if (!path) return null;

        const decodedPath = decodeURIComponent(path);
        let ext = getExtFromPath(decodedPath);

        // If the original is SVG, let the SVG pipeline handle it
        if (ext === 'svg') {
            return null;
        }

        let buffer: Buffer | null = null;
        let foundPath: string | null = null;
        const basePath = decodedPath.replace(/_thumbnail\.(png|jpg|jpeg|webp|gif|bmp)$/, '');

        const pathsToTry = [
            decodedPath,
            decodedPath.replace(`_thumbnail.${ext}`, `.${ext}`),
            `${basePath}.${ext}`,
            `${basePath}.png`,
            `${basePath}.jpg`,
            `${basePath}.jpeg`,
            `${basePath}.webp`,
            `${basePath}.gif`,
            `${basePath}.bmp`,
        ];

        for (const tryPath of pathsToTry) {
            try {
                buffer = await promises.readFile(tryPath);
                foundPath = tryPath;
                break;
            } catch {
                continue;
            }
        }

        if (!buffer || !foundPath) {
            console.warn(`No thumbnail or original file found for ${id}`);
            return null;
        }

        // Determine mime from found path
        const foundExt = getExtFromPath(foundPath) || ext;
        const mimeMap: Record<string, string> = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            webp: 'image/webp',
            gif: 'image/gif',
            bmp: 'image/bmp',
        };
        const mime = mimeMap[foundExt.toLowerCase()] || 'application/octet-stream';

        const src = settings.imageSourceType === 'url'
            ? `${settings.imageBaseUrl || ''}/images/${id}.info/${decodedPath.split('/').pop()}`
            : base64Encode(buffer, mime);

        // Update cache (in-place)
        thumbnailCache.set(id, src);
        return src;
    } catch (error) {
        console.warn(`Failed to load thumbnail for ${id}:`, error);
        return null;
    }
}

async function batchLoadThumbnails(items: EagleItem[]): Promise<Map<string, string>> {
    const cache = new Map<string, string>();

    const uncachedItems = items.filter(item => !thumbnailCache.has(item.id) && String(item.ext).toLowerCase() !== 'svg');

    if (uncachedItems.length === 0) {
        return cache;
    }

    const results = await Promise.allSettled(
        uncachedItems.map(item => loadThumbnail(item.id))
    );

    uncachedItems.forEach((item, index) => {
        const result = results[index];
        if (result.status === 'fulfilled' && result.value) {
            cache.set(item.id, result.value);
        }
    });

    return cache;
}

async function loadSvgContent(id: string): Promise<string | null> {
    if (svgContentCache.has(id)) {
        return svgContentCache.get(id)!;
    }

    try {
        const pathResult = await fetchThumbnailPath(id);
        if (!pathResult) return null;

        const decodedPath = decodeURIComponent(pathResult);
        const svgBuffer = await promises.readFile(decodedPath);
        const svgString = svgBuffer.toString('utf-8');

        svgContentCache.set(id, svgString);
        return svgString;
    } catch (error) {
        console.warn(`Failed to load SVG for ${id}:`, error);
        return null;
    }
}

const EAGLE_SERVER_URL = 'http://example.invalid';

async function fetchEagleItemsByFolders(
    folders: EagleFolderID[],
    limit: number = INITIAL_LIMIT,
    offset: number = 0
): Promise<EagleItem[] | null> {
    try {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
        });
        folders.forEach(f => params.append('folders', f));

        const response = await fetch(`${EAGLE_SERVER_URL}/api/item/list?${params}`);
        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        if (result.status === 'success' && Array.isArray(result.data)) {
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
            items = [...items, ...newItems];
            currentOffset += newItems.length;

            const cache = await batchLoadThumbnails(newItems);
            if (cache.size) {
                thumbnailCache = new Map([...thumbnailCache, ...cache]);
            }

            // Load SVG content for any SVG items in the newly loaded batch
            const svgItems = newItems.filter(item => String(item.ext).toLowerCase() === 'svg');
            if (svgItems.length) {
                await Promise.all(svgItems.map(item => loadSvgContent(item.id)));
                // Trigger reactivity so GalleryItem picks up svgContent
                svgContentCache = new Map(svgContentCache);
            }
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

$effect(() => {
    _window = window;

    const handleResize = () => refreshLayout();
    const handleScroll = () => {
        if (!masonryElement) return;

        const rect = masonryElement.getBoundingClientRect();
        const bottomOffset = rect.bottom - window.innerHeight;

        if (bottomOffset < 300 && !isLoading && hasMore) {
            const folderIDMatch = content.match(EAGLE_FOLDER_URL_REGEX);
            if (folderIDMatch) {
                loadMoreItems(folderIDMatch[1]);
            }
        }
    };

    _window.addEventListener('resize', handleResize, false);
    _window.addEventListener('scroll', handleScroll, { passive: true });

    const cleanupEventListeners = () => {
        _window?.removeEventListener('resize', handleResize, false);
        _window?.removeEventListener('scroll', handleScroll);
    };

    const folderIDMatch = content.match(EAGLE_FOLDER_URL_REGEX);
    if (!folderIDMatch) {
        console.warn('No Eagle folder URL found in content');
        console.log('Content preview:', content.substring(0, 200));
        return cleanupEventListeners;
    }

    console.log('Found folder ID:', folderIDMatch[1]);

    fetchEagleItemsByFolders([folderIDMatch[1]], INITIAL_LIMIT).then(async itemsData => {
        if (!itemsData?.length) {
            console.warn('No items found in Eagle folder');
            return;
        }
        items = itemsData;
        currentOffset = itemsData.length;

        const cache = await batchLoadThumbnails(itemsData);
        if (cache.size) {
            thumbnailCache = new Map([...thumbnailCache, ...cache]);
        }

        const svgItems = itemsData.filter(item => String(item.ext).toLowerCase() === 'svg');
        svgItems.forEach(item => {
            loadSvgContent(item.id).then(content => {
                if (content) {
                    // Trigger reactivity
                    svgContentCache = new Map(svgContentCache);
                }
            });
        });

        if (masonryElement) {
            calcGrid([masonryElement]);
        }
    }).catch(error => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to load Eagle folder contents:', errorMessage);
    });

    return cleanupEventListeners;
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
    {#each items as item (item.id)}
        <GalleryItem 
            id={item.id} 
            src={thumbnailCache.get(item.id) || ''} 
            {settings}
            ext={item.ext}
            noThumbnail={item.noThumbnail ?? false}
            svgContent={String(item.ext).toLowerCase() === 'svg' ? svgContentCache.get(item.id) || null : null}
        />
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
