import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
    {
        ignores: ['dist/**', 'build/**', 'e2e/test-results/**', 'e2e/playwright-report/**', 'scripts/build.js']
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
        files: ['e2e/**/*.ts'],
        rules: {
            'no-empty-pattern': 'off'
        }
    }
);
