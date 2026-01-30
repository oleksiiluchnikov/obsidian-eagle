# AGENTS.md - Obsidian Eagle Plugin

This is an Obsidian plugin that integrates with the Eagle asset manager application.

## Build Commands

```bash
# Development build with watch mode and auto-deploy to local Obsidian
npm run dev

# Production build with type checking
npm run build

# Lint TypeScript and Svelte files
npm run lint

# Bump version and update manifest
npm run bumpversion
```

## Project Structure

- `src/main.ts` - Plugin entry point with settings, commands, and view registration
- `src/components/` - Svelte 5 components (Gallery.svelte, GalleryItem.svelte)
- `dist/` - Build output (main.js, styles.css)
- `manifest.json` - Obsidian plugin manifest
- `vite.config.mjs` - Vite build configuration

## Code Style Guidelines

### TypeScript
- Target: ES6, Module: ESNext
- Strict null checks enabled
- Use explicit types for function parameters and returns
- Prefer interfaces over type aliases for object shapes
- Use `const` for immutable values, `let` for mutable
- Enum values use UPPER_SNAKE_CASE (e.g., `ImageSourceType.BASE_URL`)

### Imports
- Group imports: external libs first, then internal modules
- Use named imports from Obsidian API: `import { App, Plugin } from 'obsidian'`
- Import Svelte components with default import: `import Gallery from './Gallery.svelte'`
- Import mount/unmount from svelte: `import { mount, unmount } from 'svelte'`
- Type imports use `import type { ... }` syntax

### Formatting
- 4-space indentation (no tabs)
- LF line endings
- UTF-8 encoding
- Insert final newline
- Max line length: follow existing patterns (~100 chars)

### Naming Conventions
- Classes: PascalCase (e.g., `EagleSettingTab`, `MyPlugin`)
- Interfaces: PascalCase with descriptive names
- Functions/methods: camelCase
- Variables: camelCase
- Constants: UPPER_SNAKE_CASE for true constants
- Private methods: prefix with underscore or use `private` keyword
- Svelte components: PascalCase filenames

### Error Handling
- Use try-catch for async operations
- Log errors with context: `console.error('Failed to load:', error)`
- Type guard errors: `error instanceof Error ? error.message : String(error)`
- Throw descriptive error messages
- Handle edge cases explicitly (null checks, empty arrays)

### Svelte Components (Svelte 5 Runes)
- Use `<script lang="ts">` for TypeScript support
- Define props with `$props()` rune: `let { content, settings }: Props = $props()`
- Use state with `$state()` rune: `let count = $state(0)`
- Use derived values with `$derived()` rune: `let doubled = $derived(count * 2)`
- Use effects with `$effect()` rune for lifecycle and side effects
- Cleanup in `$effect()` by returning a function
- Mount components with `mount()` from 'svelte', unmount with `unmount()`
- CSS in `<style>` tags, use Obsidian CSS variables

### Obsidian Plugin Patterns
- Extend `Plugin` class for main plugin
- Extend `PluginSettingTab` for settings UI
- Extend `ItemView` for custom views
- Use `this.registerEvent()` for event handlers
- Settings: load with `Object.assign({}, DEFAULTS, await this.loadData())`
- Save with `await this.saveData(this.settings)`

### ESLint Rules
- No unused variables (except function arguments)
- Allow @ts-ignore comments when necessary
- Allow empty functions for stubs
- Svelte files use `svelte-eslint-parser`

## Testing

This project currently has no test suite configured. When adding tests:
- Consider using Vitest for unit testing
- Test Svelte components with @testing-library/svelte
- Mock Obsidian API for tests

## Dependencies

Key dependencies:
- `obsidian` - Obsidian API
- `svelte` ^5.25.0 - Svelte 5 (runes-based)
- `@petamorikei/eagle-js` - Eagle API client
- `sharp` - Image processing

Dev dependencies:
- `vite` with `@sveltejs/vite-plugin-svelte`
- `typescript` 5.3.3
- `eslint` with TypeScript and Svelte plugins
- `svelte-check` for type checking Svelte files

## Image Loading Pattern

### How eagle-js getItemThumbnail Works

The `EagleClient.getItemThumbnail({ id })` method returns a file path (string), NOT base64 image data:

```typescript
const result = await EagleClient.instance.getItemThumbnail({ id });
// result.data = "/path/to/library/images/ITEM_ID.info/filename_thumbnail.png"
```

### The Correct Pattern (GalleryItem.svelte)

1. Call `getItemThumbnail(id)` to get the file path
2. Read the file using Node.js `fs.promises.readFile()`
3. Convert Buffer to base64 data URL

```typescript
import { promises } from 'fs';

class EagleItemCard {
    public base64Encode(buffer: Buffer): string {
        return `data:image/png;base64,${buffer.toString('base64')}`;
    }

    public async fetchItemThumbnail(id: string): Promise<string | null> {
        const result = await EagleClient.instance.getItemThumbnail({ id });
        return result?.status === 'success' ? result.data : null;
    }

    public async readImageBuffer(path: string, ext: string): Promise<Buffer> {
        try {
            return await promises.readFile(path);
        } catch (error) {
            // Fallback: try original extension if thumbnail not found
            const fallbackPath = path.replace('_thumbnail.png', `.${ext}`);
            return await promises.readFile(fallbackPath);
        }
    }
}
```

### Why fs.readFile Works

The plugin runs inside Obsidian's Electron context, which has access to:
- Network mounts (e.g., `/path/to/library/`)
- Local file system
- Same permissions as the Obsidian app

### Why HTTP API Fails

Calling `http://example.invalid/api/item/thumbnail?filePath=...` returns 500 errors because:
- The Eagle HTTP server runs as a separate process
- It cannot access network-mounted volumes
- It only has access to locally accessible paths

### Debugging Commands

```bash
# Test Eagle API connection
curl "http://example.invalid/api/item/list?limit=1"

# Get thumbnail path for an item
curl "http://example.invalid/api/item/thumbnail?id=ML1DAE41EIMWO"

# Try to fetch image via HTTP (will fail for network mounts)
curl "http://example.invalid/api/item/thumbnail?filePath=/path/to/library/..."
```
