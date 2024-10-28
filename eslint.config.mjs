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
            'no-shadow': 'warn',
            '@typescript-eslint/naming-convention': 'error',
            '@typescript-eslint/no-unused-vars': 'error',
            'no-nested-ternary': 'warn',
            'no-control-regex': 'warn',
            '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
            '@typescript-eslint/prefer-promise-reject-errors': 'warn',
            'no-useless-escape': 'warn',

            // currently we have to disable most rules
            // TODO: enforce these rules
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-misused-promises': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/restrict-template-expressions': 'off',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/await-thenable': 'off',
            '@typescript-eslint/no-base-to-string': 'off',
            '@typescript-eslint/restrict-plus-operands': 'off',
            '@typescript-eslint/no-unnecessary-condition': 'off',
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
            '**/*.js',
            '**/*.cjs',
            '**/*.mjs',
            '**/env.d.ts',
        ],
    },
);
