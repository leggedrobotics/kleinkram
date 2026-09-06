const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');
const path = require('path');
const webpack = require('webpack');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

/**
 * Nest v12 references its optional companion packages (`@nestjs/websockets`,
 * `@nestjs/microservices` and, from `@nestjs/swagger`, the Fastify-only
 * `@fastify/static`) with static specifiers, both bare and with a `.js`
 * extension. The Nest CLI ships its own `IgnorePlugin` for this, but its list
 * only covers a few extension-less specifiers, so webpack fails to resolve the
 * rest. None of them is used here, so drop every variant that is not installed.
 */
const ignoreOptionalNestPackages = () =>
    new webpack.IgnorePlugin({
        checkResource(resource) {
            const lazyImports = [
                '@fastify/static',
                '@nestjs/microservices',
                '@nestjs/microservices/microservices-module',
                '@nestjs/microservices/microservices-module.js',
                '@nestjs/websockets',
                '@nestjs/websockets/socket-module',
                '@nestjs/websockets/socket-module.js',
            ];

            if (!lazyImports.includes(resource)) {
                return false;
            }

            try {
                require.resolve(resource, { paths: [process.cwd()] });
            } catch {
                return true;
            }

            return false;
        },
    });

module.exports = function (options, webpackOptions) {
    const isProd =
        webpackOptions.mode === 'production' ||
        process.env.NODE_ENV === 'production';

    return {
        ...options,
        entry: isProd
            ? path.resolve(__dirname, 'src/main.ts')
            : ['webpack/hot/poll?100', path.resolve(__dirname, 'src/main.ts')],
        externals: [
            !isProd &&
                nodeExternals({
                    allowlist: [
                        'webpack/hot/poll?100',
                        /^@kleinkram/,
                        /^@backend-common/,
                    ],
                }),
        ].filter(Boolean),
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
            // The Nest CLI injects its own ForkTsCheckerWebpackPlugin with the
            // default 2 GB heap, which this project's type graph overruns; swap
            // it for an equivalent one that gets more memory.
            ...options.plugins.filter(
                (plugin) =>
                    plugin?.constructor?.name !== 'ForkTsCheckerWebpackPlugin',
            ),
            new ForkTsCheckerWebpackPlugin({
                typescript: {
                    configFile: path.resolve(__dirname, 'tsconfig.json'),
                    memoryLimit: 8192,
                },
            }),
            ignoreOptionalNestPackages(),
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
                '@kleinkram/backend-common': path.resolve(
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
                typeorm: path.resolve(__dirname, 'node_modules/typeorm'),
                '@nestjs/typeorm': path.resolve(
                    __dirname,
                    'node_modules/@nestjs/typeorm',
                ),
                '@nestjs/common': path.resolve(
                    __dirname,
                    'node_modules/@nestjs/common',
                ),
                '@nestjs/core': path.resolve(
                    __dirname,
                    'node_modules/@nestjs/core',
                ),
            },
        },
        watchOptions: {
            ignored: /node_modules/,
        },
        optimization: {
            minimize: false,
        },
    };
};
