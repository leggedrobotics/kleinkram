const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

module.exports = function (options, webpackOptions) {
    const isProd = webpackOptions.mode === 'production';

    const config = {
        ...options,
        entry: isProd
            ? path.resolve(__dirname, 'src/main.ts')
            : ['webpack/hot/poll?100', path.resolve(__dirname, 'src/main.ts')],
        externals: [
            nodeExternals({
                allowlist: [
                    'webpack/hot/poll?100',
                    /^@kleinkram/,
                    /^@backend-common/,
                ],
            }),
        ],
        module: {
            ...options.module,
            rules: [
                {
                    test: /\.node$/,
                    loader: 'node-loader',
                },
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'ts-loader',
                        options: {
                            transpileOnly: true,
                            configFile: path.resolve(
                                __dirname,
                                'tsconfig.json',
                            ),
                            logLevel: 'info',
                        },
                    },
                },
            ],
        },
        plugins: [
            ...options.plugins,
            !isProd && new webpack.HotModuleReplacementPlugin(),
            !isProd &&
                new webpack.WatchIgnorePlugin({
                    paths: [/\.js$/, /\.d\.ts$/],
                }),
            !isProd &&
                options.watch &&
                new RunScriptWebpackPlugin({
                    name: options.output.filename,
                    autoRestart: true,
                }),
        ].filter(Boolean),
        resolve: {
            ...options.resolve,
            alias: {
                ...options.resolve?.alias,
                '@backend-common': path.resolve(
                    __dirname,
                    '../packages/backend-common/src',
                ),
                '@kleinkram/shared': path.resolve(
                    __dirname,
                    '../packages/shared/src/index.ts',
                ),
                '@kleinkram/validation': path.resolve(
                    __dirname,
                    '../packages/validation/src/index.ts',
                ),
                '@kleinkram/api-dto': path.resolve(
                    __dirname,
                    '../packages/api-dto/src/index.ts',
                ),
            },
        },
    };

    return config;
};
