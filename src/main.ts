import { App, ItemView, Platform, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, TFile } from 'obsidian';
import Gallery from "./components/Gallery.svelte";

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
    serverUrl: 'http://localhost:41595',
    imageSourceType: ImageSourceType.BASE64,
    imageBaseUrl: '',
    defaultColWidth: 100,
};


class MySvelteView extends ItemView {
    private component: Gallery | null = null;
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
		// Destroy the existing component if it exists
		if (this.component) {
		    this.component.$destroy();
		    this.component = null;
		}
		// Clear the content element
		this.contentEl.empty();
    }

    private getImageSource(filename: string): string {
        switch (this.settings.imageSourceType) {
            case ImageSourceType.BASE_URL:
                return this.settings.imageBaseUrl.replace('{name}', filename);
            case ImageSourceType.BASE64:
                // For base64, the filename should actually be the base64 content
                return `data:image/png;base64,${filename}`;
            default:
                return filename;
        }
    }

    async loadGallery({activeFile}: {activeFile?: TFile}) {
        await this.clearGallery();

        if (!activeFile) return;

        this.app.vault.cachedRead(activeFile).then(async (content: string) => {
            this.component = new Gallery({
                target: this.contentEl,
                props: {
                    content,
                    settings: this.settings,
                }
            });
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
    settings: EagleSyncSettings = DEFAULT_SETTINGS;

    private async reloadGallery() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            await this.view?.clearGallery();
            return;
        }

        await this.view?.loadGallery({
            activeFile,
        });
    }

    async onload() {
        await this.loadSettings();

        this.registerView(
            VIEW_TYPE,
            (leaf: WorkspaceLeaf) => (this.view = new MySvelteView(leaf))
        );

        this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));

        // This creates an icon in the left ribbon.
        this.addRibbonIcon('sync', 'Eagle', (evt: MouseEvent) => this.openMapView());

        // This adds a simple command that can be triggered anywhere
        this.addCommand({
            id: 'open-sample-modal-simple',
            name: 'Open sample modal (simple)',
            callback: () => this.openMapView(),
        });
        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new EagleSettingTab(this.app, this));

        // Register event handlers for file changes
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => this.reloadGallery())
        );

        this.registerEvent(
            this.app.workspace.on('file-open', () => this.reloadGallery())
        );

        // Initial load
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
            .addText(text => text
                .setPlaceholder('http://localhost:41595')
                .setValue(this.plugin.settings.serverUrl)
                .onChange(async (value) => {
                    this.plugin.settings.serverUrl = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Image Source Type')
            .setDesc('How to load images in the gallery')
            .addDropdown(dropdown => dropdown
                .addOption(ImageSourceType.BASE_URL, 'Website URL')
                .addOption(ImageSourceType.BASE64, 'Base64 Content')
                .setValue(this.plugin.settings.imageSourceType)
                .addOption(ImageSourceType.BASE_URL, 'Website URL')
                .addOption(ImageSourceType.BASE64, 'Base64 Content')
                .setValue(this.plugin.settings.imageSourceType)
                .onChange(async (value: string) => {
                    this.plugin.settings.imageSourceType = value as ImageSourceType;
                    await this.plugin.saveSettings();
                    // Show/hide base URL setting based on selection
                    baseUrlSetting.settingEl.style.display =
                        value === ImageSourceType.BASE_URL ? 'flex' : 'none';
                }));

        const baseUrlSetting = new Setting(containerEl)
            .setName('Image Base URL')
            .setDesc('Template URL for images. Use {name} as placeholder for the image filename')
            .addText(text => text
                .setPlaceholder('https://your-website.com/images/eagle.library')
                .setValue(this.plugin.settings.imageBaseUrl)
                .onChange(async (value) => {
                    this.plugin.settings.imageBaseUrl = value;
                    await this.plugin.saveSettings();
                }));

        const defaultColWidthSetting = new Setting(containerEl)
            .setName('Default Column Width')
            .setDesc('Default width of columns in the gallery')
            .addText(text => text
                .setPlaceholder('100')
                .setValue(this.plugin.settings.defaultColWidth.toString())
                .onChange(async (value) => {
                    this.plugin.settings.defaultColWidth = parseInt(value);
                    await this.plugin.saveSettings();
                }));

        defaultColWidthSetting.settingEl.createEl('span', {text: 'px'});
        // Show/hide base URL setting based on current selection
        baseUrlSetting.settingEl.style.display =
            this.plugin.settings.imageSourceType === ImageSourceType.BASE_URL ? 'flex' : 'none';
    }
}
