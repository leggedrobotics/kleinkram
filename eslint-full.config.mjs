import pluginVue from 'eslint-plugin-vue';
import vueTsEslintConfig from '@vue/eslint-config-typescript';
import progress from 'eslint-plugin-file-progress';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import tseslint from 'typescript-eslint';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

export default tseslint.config(
    progress.configs.recommended,
    ...pluginVue.configs['flat/recommended'],
    // see https://dev.to/cyrilletuzi/typescript-strictly-typed-part-1-configuring-a-project-9ca
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    eslintPluginUnicorn.configs['flat/recommended'],
    {
        languageOptions: {
            parser: '@typescript-eslint/parser',
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

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
            '@typescript-eslint/naming-convention': ['warn',
                {
                    'selector': 'default',
                    'format': ['camelCase', 'PascalCase', 'UPPER_CASE'],
                },
                {
                    'selector': 'parameter',
                    'format': ['camelCase'],
                    'leadingUnderscore': 'allow',
                },
            ],

            'no-undef': 'error',
            'no-unused-vars': 'warn',

            'eqeqeq': 'error',
            'prefer-arrow-callback': 'error',
            'prefer-template': 'error',
            '@typescript-eslint/explicit-function-return-type': 'warn',
            '@typescript-eslint/no-unnecessary-condition': 'warn',
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/no-unsafe-call': 'error',
            '@typescript-eslint/prefer-for-of': 'error',
            '@typescript-eslint/prefer-nullish-coalescing': 'warn',
            '@typescript-eslint/prefer-optional-chain': 'error',
            '@typescript-eslint/restrict-plus-operands': ['error', {
                'allowAny': false,
                'allowBoolean': false,
                'allowNullish': false,
                'allowNumberAndString': false,
                'allowRegExp': false,
            }],
            '@typescript-eslint/restrict-template-expressions': 'error',
            '@typescript-eslint/strict-boolean-expressions': ['warn', {
                'allowNumber': false,
                'allowString': false,
            }],
            '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',

            semi: 'error',
            'prefer-const': 'error',
            complexity: ['warn', { max: 4 }],
            'no-nested-ternary': 'warn',
            'no-control-regex': 'warn',
            'no-useless-escape': 'warn',
            '@typescript-eslint/no-deprecated': 'warn',
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
            'vue/v-on-handler-style': 'error',
            'vue/multi-word-component-names': 'error',
            'vue/component-definition-name-casing': 'error',
            'vue/require-name-property': 'error',
            'vue/require-prop-types': 'error',
            'vue/require-default-prop': 'error',
            'vue/require-explicit-emits': 'error',
            '@typescript-eslint/no-extraneous-class': 'off',
            '@typescript-eslint/ban-ts-comment': 'warn',
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
);
