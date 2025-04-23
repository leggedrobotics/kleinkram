import pluginVue from 'eslint-plugin-vue';
import vueTsEslintConfig from '@vue/eslint-config-typescript';
import progress from 'eslint-plugin-file-progress';
import tseslint from 'typescript-eslint';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

export default tseslint.config(
    progress.configs.recommended,

    ...pluginVue.configs['flat/recommended'],
    // see https://dev.to/cyrilletuzi/typescript-strictly-typed-part-1-configuring-a-project-9ca

    // we do not use type checking locally (only in CI pipeline)
    // we trust the editor to show us type errors
    ...tseslint.configs.recommended,
    ...tseslint.configs.strict,
    ...tseslint.configs.stylistic,
    eslintPluginUnicorn.configs['flat/recommended'],
    {
        files: ['**/*.ts', '**/*.vue'],
        rules: {
            // additional rules
            'no-shadow': 'error',

            // off for local dev setup, requires type info which is very slow
            '@typescript-eslint/naming-convention': 'off',

            'no-undef': 'error',
            'no-unused-vars': 'warn',

            eqeqeq: 'error',
            'prefer-arrow-callback': 'error',
            'prefer-template': 'error',
            '@typescript-eslint/explicit-function-return-type': 'warn',
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/prefer-for-of': 'error',

            semi: 'error',
            'prefer-const': 'error',
            'no-nested-ternary': 'warn',
            'no-control-regex': 'warn',
            'no-useless-escape': 'warn',
        },
    },
    {
        files: ['backend/src/**/*.ts', 'queueConsumer/**/*.ts'],
        rules: {
            'no-console': 'error',
        },
    },
    ...vueTsEslintConfig({ extends: ['recommended'] }),
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
            'vue/component-definition-name-casing': 'error',
            'vue/require-name-property': 'error',
            'vue/require-prop-types': 'error',
            'vue/require-default-prop': 'error',
            'vue/require-explicit-emits': 'error',
            '@typescript-eslint/no-extraneous-class': 'off',
            '@typescript-eslint/ban-ts-comment': 'warn',
            'unicorn/no-null': 'warn',
            'unicorn/filename-case': 'error',

            // used as we have disabled prettier for the local dev setup
            'vue/html-indent': 'off',
            'vue/max-attributes-per-line': 'off',
            'vue/singleline-html-element-content-newline': 'off',

            // these rules are very slow, we thus disable it for the default config
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-confusing-void-expression': 'off',
            '@typescript-eslint/no-misused-promises': 'off',
            '@typescript-eslint/unbound-method': 'off',
            '@typescript-eslint/await-thenable': 'off',
            '@typescript-eslint/no-unnecessary-type-arguments': 'off',
            'vue/multi-word-component-names': 'off',
            'unicorn/no-array-method-this-argument': 'warn',
            '@typescript-eslint/restrict-template-expressions': 'off',
            complexity: 'off',
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
            '**/environment.d.ts',
            '**/backend/dist/**',
            'frontend/.quasar/**',
        ],
    },
);
