import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import sveltePlugin from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';

export default tseslint.config(
    {
        ignores: ['dist/**', 'build/**', '.output/**', '.wxt/**', 'e2e/test-results/**', 'e2e/playwright-report/**']
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.webextensions,
            },
        }
    },
    {
        files: ['**/*.svelte'],
        plugins: { svelte: sveltePlugin },
        languageOptions: {
            parser: svelteParser,
            parserOptions: {
                parser: tseslint.parser,
            },
        },
        rules: {
            ...sveltePlugin.configs.recommended.rules,
        },
    },
    {
        files: ['e2e/**/*.ts'],
        rules: {
            'no-empty-pattern': 'off'
        }
    }
);
