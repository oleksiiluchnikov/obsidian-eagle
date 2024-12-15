<script lang="ts">
import { onMount } from 'svelte';
import { EagleClient } from '@petamorikei/eagle-js';
import type { GetItemThumbnailResult } from "@petamorikei/eagle-js/dist/types";
import { promises } from 'fs';

export let id: string;
export let settings: any;

interface EagleItemCardProps {
    id: string;
    src: string;
    alt: string;
    path: string;
    ext: string;
    url: string;
}

class EagleItemCard {
    public src: string;
    public alt: string;
    public id: string;
    public path: string;
    public ext: string;
    public url: string;

    constructor(props: Partial<EagleItemCardProps> = {}) {
        this.id = props.id ?? '';
        this.src = props.src ?? '';
        this.alt = props.alt ?? '';
        this.path = props.path ?? '';
        this.ext = props.ext ?? '';
        this.url = props.id ?? '';
    }

    public openItem() {
        window.open(this.url, '_blank');
    }

    public toURL(libraryUrl: string): string {
        // TODO: Handle '_thumbnail.png' or original if not found
        const encodedFilename = encodeURIComponent(this.path.split('/').pop() || '');
        return `${libraryUrl}/images/${this.id}.info/${encodedFilename}`;
    }

    public base64Encode(buffer: Buffer): string {
        return `data:image/png;base64,${buffer.toString('base64')}`;
    }

    public async fetchItemThumbnail(id: string): Promise<string | null> {
        try {
            const result: GetItemThumbnailResult | null = await EagleClient.instance.getItemThumbnail({ id });
            return result?.status === 'success' ? result.data : null;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to fetch Eagle item thumbnail: ${errorMessage}`);
        }
    }

    public async readImageBuffer(path: string, ext: string): Promise<Buffer> {
        try {
            return await promises.readFile(path);
        } catch (error) {
            try {
                const fallbackPath = path.replace('_thumbnail.png', `.${ext}`);
                return await promises.readFile(fallbackPath);
            } catch (fallbackError) {
                throw new Error('Failed to read image file from both paths');
            }
        }
    }
}

let item: EagleItemCard = new EagleItemCard();

onMount(async () => {
    try {
        const eagleCard = new EagleItemCard({
            id,
            src: '',
            alt: id,
            url: `eagle://item/${id}`
        });

        const path = await eagleCard.fetchItemThumbnail(id);
        if (!path) {
            console.warn(`No thumbnail found for item ${id}`);
            return;
        }

        const ext = path.split('.').pop() || '';
        eagleCard.path = path;
        eagleCard.ext = ext;

        const buffer = await eagleCard.readImageBuffer(path, ext);

        eagleCard.src = settings.imageSourceType === 'base64'
            ? eagleCard.base64Encode(buffer)
            : settings.imageSourceType === 'url'
                ? eagleCard.toURL(settings.imageBaseUrl)
                : (() => {
                    console.warn('Invalid image source type:', settings.imageSourceType);
                    return '';
                })();

        item = eagleCard;
    } catch (error) {
        console.error(`Failed to process item ${id}:`, error);
    }
});
</script>

{#if item.src}
    <a href="eagle://item/{id}" on:click|preventDefault={item.openItem}>
    <img
        src={item.src}
        alt={item.alt}
        style="width: 100%; height: auto;"
    />
    </a>
{/if}

<style>
    img {
        display: block;
        max-width: 100%;
        height: auto;
        border-radius: 4px;
    }
</style>
