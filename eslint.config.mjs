export default [
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
];
