#!/usr/bin/env node

/**
 * Deploy script for Obsidian Eagle plugin
 *
 * Usage:
 *   node scripts/deploy.mjs [--vault-path PATH]
 *
 * Environment variables:
 *   OBSIDIAN_VAULT_PATH - Path to your Obsidian vault root
 *
 * Example:
 *   OBSIDIAN_VAULT_PATH=$HOME/Documents/MyVault node scripts/deploy.mjs
 */

import { cp, mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// Parse arguments
const args = process.argv.slice(2);
const vaultPathArg = args.find(arg => arg.startsWith('--vault-path='));
const vaultPath = vaultPathArg
    ? vaultPathArg.replace('--vault-path=', '').replace('~', process.env.HOME)
    : process.env.OBSIDIAN_VAULT_PATH;

const PLUGIN_DIR = vaultPath
    ? join(vaultPath, '.obsidian', 'plugins', 'obsidian-eagle')
    : join(process.env.HOME || '~', '.obsidian', 'plugins', 'obsidian-eagle');

async function deploy() {
    console.log('🚀 Deploying obsidian-eagle plugin...\n');

    // Read version from manifest
    const manifest = JSON.parse(await readFile(join(PROJECT_ROOT, 'manifest.json'), 'utf-8'));
    console.log(`📦 Version: ${manifest.version}`);
    console.log(`📁 Target: ${PLUGIN_DIR}\n`);

    if (!vaultPath && !process.env.OBSIDIAN_VAULT_PATH) {
        console.log('⚠️  No vault path set. Using default: ~/.obsidian/plugins/');
        console.log('💡 Set OBSIDIAN_VAULT_PATH env variable or use --vault-path argument');
        console.log('   Example: OBSIDIAN_VAULT_PATH=$HOME/Documents/MyVault npm run deploy\n');
    }

    // Create plugin directory if needed
    if (!existsSync(PLUGIN_DIR)) {
        console.log('📁 Creating plugin directory...');
        await mkdir(PLUGIN_DIR, { recursive: true });
    }

    // Copy dist files
    console.log('📋 Copying build files...');
    const distDir = join(PROJECT_ROOT, 'dist');

    await cp(join(distDir, 'main.js'), join(PLUGIN_DIR, 'main.js'), { force: true });
    await cp(join(distDir, 'styles.css'), join(PLUGIN_DIR, 'styles.css'), { force: true });

    // Copy manifest
    await cp(join(PROJECT_ROOT, 'manifest.json'), join(PLUGIN_DIR, 'manifest.json'), { force: true });

    // Touch .hotreload to trigger Hot Reload plugin (if installed)
    const hotreloadPath = join(PLUGIN_DIR, '.hotreload');
    await writeFile(hotreloadPath, String(Date.now()));

    console.log('✅ Deployment complete!');
    console.log('\n💡 Tip: Install the "Hot Reload" plugin in Obsidian for auto-reload on changes');
}

deploy().catch(err => {
    console.error('❌ Deployment failed:', err.message);
    process.exit(1);
});
