import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            semi: 'error',
            'prefer-const': 'error',
        },
    },
    {
        ignores: [
            '**/node_modules',
            '**/dist/**',
            'CLI/**',
            '**.py',
            '**/docs/.vitepress/**',
            '**/.venv/**',
        ],
    },
);
