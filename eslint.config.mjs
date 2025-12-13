import { includeIgnoreFile } from '@eslint/compat';
import eslintConfigPrettier from 'eslint-config-prettier';
import progress from 'eslint-plugin-file-progress';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import pluginVue from 'eslint-plugin-vue';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.resolve(__dirname, '.gitignore');

export default tseslint.config(
    // 1. Setup: File Progress & Git Ignores
    progress.configs.recommended,
    includeIgnoreFile(gitignorePath),
    {
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            '**/.quasar/**',
            '**/.venv/**',
            '**/generated/**',
            '**/src/build.ts',
            '**/*.js',
            '**/*.d.ts',
            'backend/migration/**',
        ],
    },

    // 2. Base TypeScript Configuration
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.vue'],
        extends: [
            ...tseslint.configs.strictTypeChecked,
            ...tseslint.configs.stylisticTypeChecked,
            eslintPluginUnicorn.configs['flat/recommended'],
        ],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
                extraFileExtensions: ['.vue'],
            },
        },
        rules: {
            // --- Strictness & Safety ---
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/no-misused-promises': [
                'error',
                { checksVoidReturn: { attributes: false } },
            ],

            // --- Naming Conventions ---
            '@typescript-eslint/naming-convention': [
                'warn',
                {
                    selector: 'default',
                    format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
                    leadingUnderscore: 'allow',
                },
                {
                    selector: 'parameter',
                    format: ['camelCase'],
                    leadingUnderscore: 'allow',
                },
                { selector: 'import', format: ['camelCase', 'PascalCase'] },
                { selector: 'typeLike', format: ['PascalCase'] },
            ],

            // --- Logic & Complexity ---
            eqeqeq: ['error', 'smart'],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            complexity: ['warn', { max: 20 }],
            'no-nested-ternary': 'warn',

            // --- Unicorn Overrides ---
            'unicorn/filename-case': [
                'error',
                // we use some-name-file.ts
                { cases: { kebabCase: true } },
            ],
            'unicorn/no-null': 'off',
            'unicorn/import-style': [
                'error',
                { styles: { 'node:path': { namespace: true } } },
            ],
            'unicorn/prevent-abbreviations': [
                'error',
                {
                    allowList: {
                        props: true,
                        db: true,
                        Db: true,
                        args: true,
                        params: true,
                        env: true,
                    },
                },
            ],

            // --- False Positive Fixes ---
            'unicorn/no-array-method-this-argument': 'off', // Often conflicts with ORMs
            '@typescript-eslint/ban-ts-comment': 'off',
        },
    },

    // 3. Vue Configuration
    {
        files: ['**/*.vue'],
        extends: [...pluginVue.configs['flat/recommended']],
        languageOptions: {
            parser: pluginVue.parser,
            parserOptions: {
                parser: tseslint.parser,
                extraFileExtensions: ['.vue'],
            },
        },
        rules: {
            'vue/multi-word-component-names': 'error',
            'vue/component-api-style': [
                'error',
                ['script-setup', 'composition'],
            ],
            'vue/block-order': [
                'error',
                { order: ['template', 'script', 'style'] },
            ],
            'vue/v-on-handler-style': 'error',
            'vue/attribute-hyphenation': 'error',
            'vue/no-v-text-v-html-on-component': 'warn',
        },
    },

    // 4. Backend Specific Overrides
    {
        files: ['backend/**/*.ts', 'queueConsumer/**/*.ts'],
        rules: {
            'no-console': 'error',
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['vue', 'pinia', 'quasar'],
                            message:
                                "Don't import frontend libraries in the backend.",
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['backend/tests/**/*.ts'],
        rules: {
            'no-console': 'off',
        },
    },

    // 5. Prettier (Disables all conflicting formatting rules)
    eslintConfigPrettier,
);
