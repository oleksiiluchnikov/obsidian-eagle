import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';

export default tseslint.config(
    {
        files: ['**/*.svelte'],
        languageOptions: {
            parser: svelteParser,
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                parser: tseslint.parser,
            },
        },
        ignores: ['dist/', 'node_modules/'],
    },
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tseslint.parser,
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        ignores: ['dist/', 'node_modules/'],
    },
    ...tseslint.configs.recommended,
    ...svelte.configs['flat/recommended'],
);
