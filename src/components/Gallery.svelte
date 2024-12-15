<script lang="ts">
import { onMount } from 'svelte';
import type { GetItemListResult} from "@petamorikei/eagle-js/dist/types";
import { EagleClient } from '@petamorikei/eagle-js';
import GalleryItem from './GalleryItem.svelte';

type EagleFolderID = string;

export let content: string;
export let settings: any;

const EAGLE_FOLDER_ID_REGEX = /[A-Z0-9]{13}/;
const DEFAULT_LIMIT = 300;

async function fetchEagleItemsByFolders(folders: EagleFolderID[], limit: number = DEFAULT_LIMIT): Promise<any[] | null> {
    try {
        const result: GetItemListResult | null = await EagleClient.instance.getItemList({ limit, folders });
        return result?.status === 'success' ? result.data : null;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to fetch Eagle items: ${errorMessage}`);
    }
}


let itemIds: string[] = [];

onMount(async () => {
    const startTime = performance.now();
    const folderIDMatch = content.match(EAGLE_FOLDER_ID_REGEX);
    if (!folderIDMatch) {
        console.warn('No Eagle folder ID found in content');
        return;
    }

    try {
        itemIds = await fetchEagleItemsByFolders(folderIDMatch).then((items) => {
            if (!items?.length) {
                console.warn('No items found in Eagle folder');
                return [];
            }
            return items.map((item) => item.id);
        });

    } catch (error) {
        console.error('Failed to load Eagle folder contents:', error);
    }
    const endTime = performance.now();
	console.log('Time taken to load gallery:', endTime - startTime)
});
</script>

<div class="masonry-gallery">
  {#each itemIds as id}
        <GalleryItem {settings} {id} />
  {/each}
</div>

<style>
  .masonry-gallery {
    columns: 3;
    column-gap: 1rem;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
  }

  @media (max-width: 768px) {
    .masonry-gallery {
      columns: 2;
    }
  }

  @media (max-width: 480px) {
    .masonry-gallery {
      columns: 1;
    }
  }
</style>
