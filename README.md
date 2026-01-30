# Obsidian Eagle

A plugin for [Obsidian](https://obsidian.md/) that integrates with [Eagle](https://eagle.cool/) asset manager, allowing you to view and browse your Eagle asset library directly in Obsidian.

## Features

- **Gallery View** - Display Eagle assets in a responsive masonry gallery
- **Quick Access** - Click any asset to open it in Eagle app
- **Infinite Scroll** - Load more assets as you scroll
- **Customizable** - Adjust column width to fit your needs
- **Fast Loading** - Parallel thumbnail loading with caching

## Usage

Add an Eagle folder ID to your note. The gallery will automatically appear in the sidebar.

**Frontmatter:**
```yaml
---
eagle_folder_id: "LYVR9BPYU1UO4"
---
```

**Inline (DataviewJS):**
```javascript
dv.paragraph(`eagle_folder_id: "LYVR9BPYU1UO4"`)
```

## Installation

### From Obsidian Community Plugins (Recommended)

1. Open Obsidian Settings → Community Plugins
2. Disable Safe Mode
3. Search for "Obsidian Eagle"
4. Install and enable

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/oleksiiluchnikov/obsidian-eagle/releases)
2. Extract the zip file to your Obsidian plugins folder:
   ```
   YourVault/.obsidian/plugins/obsidian-eagle/
   ```
3. Enable the plugin in Obsidian settings

### Development

```bash
# Clone and install dependencies
git clone https://github.com/oleksiiluchnikov/obsidian-eagle.git
cd obsidian-eagle
pnpm install

# Development build with watch mode
npm run dev

# Production build
npm run build

# Deploy to your vault (set OBSIDIAN_VAULT_PATH env variable)
OBSIDIAN_VAULT_PATH=$HOME/Documents/MyVault npm run deploy
```

## Requirements

- Obsidian v0.12.0+
- Eagle browser app or desktop app running with HTTP API enabled (port 41595)

## Settings

- **Server URL** - Eagle API endpoint (default: `http://example.invalid`)
- **Image Source Type** - Choose between base64 or URL mode for images
- **Image Base URL** - Custom base URL for URL mode
- **Default Column Width** - Gallery column width in pixels

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
