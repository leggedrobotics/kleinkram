import pluginVue from 'eslint-plugin-vue';
import vueTsEslintConfig from '@vue/eslint-config-typescript';
import progress from 'eslint-plugin-file-progress';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
    progress.configs.recommended,
    ...pluginVue.configs['flat/recommended'],
    {
        files: ['**/*.ts', '**/*.vue'],
        rules: {
            // additional rules
            '@typescript-eslint/require-array-sort-compare': 'error',
            'no-shadow': 'error',
            '@typescript-eslint/no-unused-vars': 'error',

            '@typescript-eslint/no-unsafe-assignment': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/no-unsafe-argument': 'error',
            '@typescript-eslint/no-unsafe-member-access': 'error',
            '@typescript-eslint/no-unsafe-return': 'error',

            '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
            '@typescript-eslint/prefer-promise-reject-errors': 'warn',
            '@typescript-eslint/naming-convention': 'warn',
        },
    },
    {
        files: ['backend/src/**/*.ts', 'queueConsumer/**/*.ts'],
        rules: {
            'no-console': 'error',
        },
    },
    ...vueTsEslintConfig({ extends: ['recommendedTypeChecked'] }),
    eslintPluginPrettierRecommended,
    {
        files: ['**/*.ts', '**/*.vue'],
        rules: {
            // override rules
            '@typescript-eslint/no-explicit-any': 'warn',
            'no-nested-ternary': 'warn',
            'no-control-regex': 'warn',
            'no-useless-escape': 'warn',
            'vue/no-v-text-v-html-on-component': 'warn',
        },
    },
    {
        ignores: [
            '**/node_modules',
            '**/dist/**',
            'cli/**',
            '**.py',
            '**/docs/.vitepress/**',
            '**/.venv/**',
            'Gruntfile.js',
            'backend/jest.config.js',
            '**/*.js',
            '**/*.cjs',
            '**/*.mjs',
            '**/env.d.ts',
        ],
    },
];
