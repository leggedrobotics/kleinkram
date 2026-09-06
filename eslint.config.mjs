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
                // `checkDirectories` was added (defaulting to true) in unicorn
                // v74; we only ever meant to constrain file names, and several
                // long-standing directories (queueConsumer, viewEntities, ...)
                // are camelCase.
                { cases: { kebabCase: true }, checkDirectories: false },
            ],
            'unicorn/no-null': 'off',
            'unicorn/import-style': [
                'error',
                { styles: { 'node:path': { namespace: true } } },
            ],
            // renamed from `unicorn/prevent-abbreviations` in unicorn v74
            'unicorn/name-replacements': [
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
                    // unicorn v74 grew its default replacement list. These
                    // entries would rename ~170 existing identifiers (mostly
                    // `xyzRepository` -> `xyzRepo`), so opt out of the new
                    // words instead of churning the codebase.
                    replacements: {
                        configuration: false,
                        dev: false,
                        params: false,
                        repository: false,
                        stmt: false,
                    },
                },
            ],

            // --- False Positive Fixes ---
            'unicorn/no-array-method-this-argument': 'off', // Often conflicts with ORMs
            '@typescript-eslint/ban-ts-comment': 'off',

            // `no-unnecessary-type-assertion` grew a second check ("the
            // receiver accepts the original type of the expression") in
            // typescript-eslint v8.6x, which flags ~70 pre-existing
            // assertions. Its autofix is not safe on them - dropping e.g.
            // `Number.parseInt(key) as AccessGroupRights` turns a checked enum
            // comparison into an unsafe one - and `pnpm lint` / the pre-commit
            // hook run with `--fix`, so this stays off rather than on `warn`.
            '@typescript-eslint/no-unnecessary-type-assertion': 'off',

            // --- Rules introduced by eslint-plugin-unicorn v74 ---
            // The v62 -> v74 jump added ~200 rules to `flat/recommended`. The
            // ones below report ~700 findings in pre-existing code; they are
            // switched off here so this dependency bump stays behaviour
            // neutral. Re-enable and fix them one rule at a time.
            'unicorn/consistent-boolean-name': 'off',
            'unicorn/consistent-class-member-order': 'off',
            'unicorn/consistent-compound-words': 'off',
            'unicorn/consistent-conditional-object-spread': 'off',
            'unicorn/logical-assignment-operators': 'off',
            'unicorn/max-nested-calls': 'off',
            'unicorn/no-break-in-nested-loop': 'off',
            'unicorn/no-computed-property-existence-check': 'off',
            'unicorn/no-confusing-array-splice': 'off',
            'unicorn/no-constant-zero-expression': 'off',
            'unicorn/no-declarations-before-early-exit': 'off',
            'unicorn/no-duplicate-if-branches': 'off',
            'unicorn/no-duplicate-loops': 'off',
            'unicorn/no-global-object-property-assignment': 'off',
            'unicorn/no-negated-array-predicate': 'off',
            'unicorn/no-non-function-verb-prefix': 'off',
            'unicorn/no-nonstandard-builtin-properties': 'off',
            'unicorn/no-this-outside-of-class': 'off',
            'unicorn/no-top-level-assignment-in-function': 'off',
            'unicorn/no-top-level-side-effects': 'off',
            'unicorn/no-unnecessary-boolean-comparison': 'off',
            'unicorn/no-unnecessary-fetch-options': 'off',
            'unicorn/no-unnecessary-global-this': 'off',
            'unicorn/no-unreadable-for-of-expression': 'off',
            'unicorn/no-unreadable-object-destructuring': 'off',
            'unicorn/no-unsafe-string-replacement': 'off',
            'unicorn/no-useless-coercion': 'off',
            'unicorn/no-useless-else': 'off',
            'unicorn/no-useless-logical-operand': 'off',
            'unicorn/no-useless-override': 'off',
            'unicorn/no-useless-recursion': 'off',
            'unicorn/no-useless-template-literals': 'off',
            'unicorn/operator-assignment': 'off',
            'unicorn/prefer-array-from-map': 'off',
            'unicorn/prefer-array-iterable-methods': 'off',
            // v74 also flags the `let x = a; if (c) { x = b; }` shape (17 places)
            'unicorn/prefer-ternary': 'off',
            'unicorn/prefer-await': 'off',
            'unicorn/prefer-boolean-return': 'off',
            'unicorn/prefer-continue': 'off',
            'unicorn/prefer-direct-iteration': 'off',
            'unicorn/prefer-early-return': 'off',
            'unicorn/prefer-else-if': 'off',
            'unicorn/prefer-flat-math-min-max': 'off',
            'unicorn/prefer-hoisting-branch-code': 'off',
            'unicorn/prefer-includes-over-repeated-comparisons': 'off',
            'unicorn/prefer-iterator-to-array': 'off',
            'unicorn/prefer-location-assign': 'off',
            'unicorn/prefer-number-coercion': 'off',
            'unicorn/prefer-number-is-safe-integer': 'off',
            'unicorn/prefer-object-iterable-methods': 'off',
            'unicorn/prefer-promise-try': 'off',
            'unicorn/prefer-simple-condition-first': 'off',
            'unicorn/prefer-smaller-scope': 'off',
            'unicorn/prefer-split-limit': 'off',
            'unicorn/prefer-unicode-code-point-escapes': 'off',
            'unicorn/prefer-url-href': 'off',
            'unicorn/require-array-sort-compare': 'off',
            'unicorn/single-line-block-comment-style': 'off',
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
