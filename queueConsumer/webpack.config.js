const nodeExternals = require('webpack-node-externals');
const path = require('path');

module.exports = function (options) {
    return {
        ...options,
        entry: path.resolve(__dirname, 'src/main.ts'),
        externals: [
            nodeExternals({
                allowlist: [/^@kleinkram/, /^@backend-common/],
            }),
        ],
        module: {
            ...options.module,
            rules: [
                ...(options.module?.rules || []),
                {
                    test: /\.node$/,
                    loader: 'node-loader',
                },
            ],
        },
    };
};
