import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
// import pluginVue from 'eslint-plugin-vue';

export default tseslint.config(
    eslint.configs.recommended,
    // ...pluginVue.configs['flat/recommended'],
    ...tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        rules: {
            semi: 'error',
            'prefer-const': 'error',
            complexity: ['warn', { max: 4 }],
            '@typescript-eslint/no-unnecessary-condition': 'warn',
            '@typescript-eslint/no-floating-promises': 'warn',
            'no-shadow': 'warn',
            '@typescript-eslint/naming-convention': 'warn',
            'no-nested-ternary': 'warn',
        },
    },
    {
        files: ['backend/**/*.ts', 'queueConsumer/**/*.ts'],
        rules: {
            'no-console': 'warn',
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
            'Gruntfile.js',
            'backend/jest.config.js',
        ],
    },
);
