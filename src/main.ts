import { App, ItemView, Platform, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, TFile } from 'obsidian';
import Gallery from "./components/Gallery.svelte";
import { mount, unmount } from 'svelte';

const VIEW_TYPE = "svelte-view";

enum ImageSourceType {
    BASE_URL = 'url',
    BASE64 = 'base64'
}

interface EagleSyncSettings {
    serverUrl: string;
    imageSourceType: ImageSourceType;
    imageBaseUrl: string;
    defaultColWidth: number;
}

const DEFAULT_SETTINGS: EagleSyncSettings = {
    serverUrl: 'http://example.invalid',
    imageSourceType: ImageSourceType.BASE64,
    imageBaseUrl: '',
    defaultColWidth: 100,
};


class MySvelteView extends ItemView {
    private component: ReturnType<typeof mount> | null = null;
    private settings: EagleSyncSettings = DEFAULT_SETTINGS;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Eagle";
    }

    getIcon(): string {
        return "sync";
    }

    async clearGallery() {
        if (this.component) {
            unmount(this.component);
            this.component = null;
        }
        this.contentEl.empty();
    }

    private getImageSource(filename: string): string {
        switch (this.settings.imageSourceType) {
            case ImageSourceType.BASE_URL:
                return this.settings.imageBaseUrl.replace('{name}', filename);
            case ImageSourceType.BASE64:
                return `data:image/png;base64,${filename}`;
            default:
                return filename;
        }
    }

    async loadGallery({activeFile}: {activeFile?: TFile}) {
        await this.clearGallery();

        if (!activeFile) {
            this.component = mount(Gallery, {
                target: this.contentEl,
                props: {
                    content: "",
                    settings: this.settings,
                }
            });
            return;
        }

        const content = await this.app.vault.cachedRead(activeFile);
        this.component = mount(Gallery, {
            target: this.contentEl,
            props: {
                content: content || "",
                settings: this.settings,
            }
        });
    }

    async onOpen(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;

        await this.loadGallery({
            activeFile,
        });
    }
}

export default class MyPlugin extends Plugin {
    private view: MySvelteView | null = null;
    private reloadGalleryTimeout: ReturnType<typeof setTimeout> | null = null;
    settings: EagleSyncSettings = DEFAULT_SETTINGS;

    private async reloadGallery() {
        if (this.reloadGalleryTimeout) {
            clearTimeout(this.reloadGalleryTimeout);
        }

        this.reloadGalleryTimeout = setTimeout(async () => {
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                await this.view?.clearGallery();
                return;
            }

            await this.view?.loadGallery({
                activeFile,
            });
        }, 100);
    }

    async onload() {
        await this.loadSettings();

        this.registerView(
            VIEW_TYPE,
            (leaf: WorkspaceLeaf) => (this.view = new MySvelteView(leaf))
        );

        this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));

        this.addRibbonIcon('sync', 'Eagle', (evt: MouseEvent) => this.openMapView());

        this.addCommand({
            id: 'open-sample-modal-simple',
            name: 'Open sample modal (simple)',
            callback: () => this.openMapView(),
        });
        this.addSettingTab(new EagleSettingTab(this.app, this));

        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => this.reloadGallery())
        );

        this.registerEvent(
            this.app.workspace.on('file-open', () => this.reloadGallery())
        );

        await this.reloadGallery();
    }

    onLayoutReady(): void {
        if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length) {
            this.app.workspace.rightSplit.collapsed && this.app.workspace.rightSplit.toggle();
            return;
        }
        this.app.workspace.getRightLeaf(false)?.setViewState({
            type: VIEW_TYPE,
        });
        this.app.workspace.rightSplit.collapsed && this.app.workspace.rightSplit.toggle();
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async openMapView() {
        const workspace = this.app.workspace;
        workspace.detachLeavesOfType(VIEW_TYPE);
        const leaf = workspace.getLeaf(
            // @ts-ignore
            !Platform.isMobile
        );
        await leaf.setViewState({type: VIEW_TYPE});
        workspace.revealLeaf(leaf);
    }
}

class EagleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Eagle Sync Settings'});

        new Setting(containerEl)
            .setName('Server URL')
            .setDesc('The URL of the Eagle server.')
            .addText((text) => text
                .setPlaceholder('http://example.invalid')
                .setValue(this.plugin.settings.serverUrl)
                .onChange(async (value: string) => {
                    const trimmedValue = value.trim();
                    const isValidUrl = trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://');
                    if (!isValidUrl && trimmedValue.length > 0) {
                        console.warn('Invalid server URL format. Expected http:// or https://');
                        return;
                    }
                    this.plugin.settings.serverUrl = trimmedValue;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Image Source Type')
            .setDesc('How to load images in the gallery')
            .addDropdown((dropdown) => dropdown
                .addOption(ImageSourceType.BASE_URL, 'Website URL')
                .addOption(ImageSourceType.BASE64, 'Base64 Content')
                .setValue(this.plugin.settings.imageSourceType)
                .onChange(async (value: string) => {
                    if (value !== ImageSourceType.BASE_URL && value !== ImageSourceType.BASE64) {
                        console.warn('Invalid image source type');
                        return;
                    }
                    this.plugin.settings.imageSourceType = value;
                    await this.plugin.saveSettings();
                    baseUrlSetting.settingEl.style.display =
                        value === ImageSourceType.BASE_URL ? 'flex' : 'none';
                }));

        const baseUrlSetting = new Setting(containerEl)
            .setName('Image Base URL')
            .setDesc('Template URL for images. Use {name} as placeholder for the image filename')
            .addText((text) => text
                .setPlaceholder('https://your-website.com/images/eagle.library')
                .setValue(this.plugin.settings.imageBaseUrl)
                .onChange(async (value: string) => {
                    this.plugin.settings.imageBaseUrl = value.trim();
                    await this.plugin.saveSettings();
                }));

        const defaultColWidthSetting = new Setting(containerEl)
            .setName('Default Column Width')
            .setDesc('Default width of columns in the gallery')
            .addText((text) => text
                .setPlaceholder('100')
                .setValue(this.plugin.settings.defaultColWidth.toString())
                .onChange(async (value: string) => {
                    const parsedValue = parseInt(value, 10);
                    if (isNaN(parsedValue) || parsedValue < 20 || parsedValue > 500) {
                        console.warn('Invalid column width. Must be between 20 and 500');
                        return;
                    }
                    this.plugin.settings.defaultColWidth = parsedValue;
                    await this.plugin.saveSettings();
                }));

        defaultColWidthSetting.settingEl.createEl('span', {text: 'px'});
        baseUrlSetting.settingEl.style.display =
            this.plugin.settings.imageSourceType === ImageSourceType.BASE_URL ? 'flex' : 'none';
    }
}
