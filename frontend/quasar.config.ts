// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-file

// @ts-ignore
import { defineConfig } from '#q-app/wrappers';

import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig((/* ctx */) => {
    return {
        // https://v2.quasar.dev/quasar-cli-vite/prefetch-feature
        // preFetch: true,

        // app boot file (/src/boot)
        // --> boot files are part of "main.js"
        // https://v2.quasar.dev/quasar-cli-vite/boot-files
        boot: ['router', 'query', 'wasm-polyfill'], // <--- Add it here

        // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#css
        css: ['app.scss'],

        // https://github.com/quasarframework/quasar/tree/dev/extras
        extras: [
            // 'ionicons-v4',
            // 'mdi-v7',
            // 'fontawesome-v6',
            // 'eva-icons',
            // 'themify',
            // 'line-awesome',
            // 'roboto-font-latin-ext', // this or either 'roboto-font', NEVER both!
            // 'roboto-font', // optional, you are not bound to it
            // 'material-symbols-outlined',
        ],

        build: {
            alias: {
                '@kleinkram/shared': path.resolve(
                    __dirname,
                    '../packages/shared/src/index.ts',
                ),
                '@kleinkram/api-dto': path.resolve(
                    __dirname,
                    '../packages/api-dto/src/index.ts',
                ),
                // Use frontend-safe validation (no @nestjs dependencies)
                '@kleinkram/validation/frontend': path.resolve(
                    __dirname,
                    '../packages/validation/src/frontend.ts',
                ),
                '@kleinkram/backend-common': path.resolve(
                    __dirname,
                    '../packages/backend-common/src/index.ts',
                ),
                // Alias to resolve class-transformer/storage issue
                'class-transformer/storage': path.resolve(
                    __dirname,
                    '../node_modules/class-transformer',
                ),
            },

            typescript: {
                strict: true,
                vueShim: true,
                extendTsConfig(tsConfig: any) {
                    if (tsConfig.compilerOptions === undefined) return;
                    tsConfig.compilerOptions.experimentalDecorators = true;
                },
            },

            vueRouterMode: 'history', // available values: 'hash', 'history'
            // vueRouterBase,
            // vueDevtools,
            // vueOptionsAPI: false,

            // rebuildCache: true, // rebuilds Vite/linter/etc cache on startup

            // publicPath: '/',
            // analyze: true,
            // rawDefine: {}
            // ignorePublicFolder: true,
            // minify: false,
            // polyfillModulePreload: true,
            // distDir

            extendViteConf(viteConfig) {
                viteConfig.optimizeDeps = viteConfig.optimizeDeps || {};
                viteConfig.optimizeDeps.include =
                    viteConfig.optimizeDeps.include || [];

                // FIX: Use the VALID package names
                viteConfig.optimizeDeps.include.push(
                    '@foxglove/rosmsg',
                    '@foxglove/rosmsg-serialization', // ROS 1
                    '@foxglove/rosmsg2-serialization', // ROS 2 (CDR)
                    '@mcap/core',
                    'fzstd',
                );

                viteConfig.optimizeDeps.exclude =
                    viteConfig.optimizeDeps.exclude || [];
                viteConfig.optimizeDeps.exclude.push(
                    '@kleinkram/shared',
                    '@kleinkram/api-dto',
                    '@kleinkram/validation/frontend',
                    '@kleinkram/backend-common',
                    // Exclude problematic paths
                    'class-transformer/storage',
                );

                // Add validation/frontend alias for runtime resolution
                viteConfig.resolve = viteConfig.resolve || {};
                viteConfig.resolve.alias = viteConfig.resolve.alias || {};
                viteConfig.resolve.alias['@kleinkram/validation/frontend'] =
                    path.resolve(
                        __dirname,
                        '../packages/validation/src/frontend.ts',
                    );
            },
            // viteVuePluginOptions: {},

            vitePlugins: [
                [
                    nodePolyfills,
                    {
                        globals: { global: true, Buffer: true, process: true },
                        protocolImports: true,
                    },
                ],
            ],
        },

        // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#devServer
        devServer: {
            // https: true
            open: false, // Don't auto-open browser in Docker
            host: '0.0.0.0', // Bind to all interfaces for Docker
            hmr: {
                // Use the client host for HMR WebSocket connection
                clientPort: 8003,
            },
        },

        // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#framework
        framework: {
            config: {},

            iconSet: 'material-symbols-outlined',
            // lang: 'en-US', // Quasar language pack

            // For special cases outside of where the auto-import strategy can have an impact
            // (like functional components as one of the examples),
            // you can manually specify Quasar components/directives to be available everywhere:
            //
            // components: [],
            // directives: [],

            // Quasar plugins
            plugins: ['Dialog', 'Notify', 'Screen'],
        },

        // animations: 'all', // --- includes all animations
        // https://v2.quasar.dev/options/animations
        animations: [],

        // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#sourcefiles
        sourceFiles: {
            rootComponent: 'src/app.vue',
            //   router: 'src/router/index',
            //   store: 'src/store/index',
            //   registerServiceWorker: 'src-pwa/register-service-worker',
            //   serviceWorker: 'src-pwa/custom-service-worker',
            //   pwaManifestFile: 'src-pwa/manifest.json',
            //   electronMain: 'src-electron/electron-main',
            //   electronPreload: 'src-electron/electron-preload'
        },

        // https://v2.quasar.dev/quasar-cli-vite/developing-ssr/configuring-ssr
        ssr: {
            // ssrPwaHtmlFilename: 'offline.html', // do NOT use index.html as name!
            // will mess up SSR

            // extendSSRWebserverConf (esbuildConf) {},
            // extendPackageJson (json) {},

            pwa: false,

            // manualStoreHydration: true,
            // manualPostHydrationTrigger: true,

            prodPort: 3000, // The default port that the production server should use
            // (gets superseded if process.env.PORT is specified at runtime)

            middlewares: [
                'render', // keep this as last one
            ],
        },

        // https://v2.quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa
        pwa: {
            workboxMode: 'GenerateSW', // or 'injectManifest'
            injectPwaMetaTags: true,
            swFilename: 'sw.js',
            manifestFilename: 'manifest.json',
            useCredentialsForManifestTag: false,
            // useFilenameHashes: true,
            // extendGenerateSWOptions (cfg) {}
            // extendInjectManifestOptions (cfg) {},
            // extendManifestJson (json) {}
            // extendPWACustomSWConf (esbuildConf) {}
        },

        // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-cordova-apps/configuring-cordova
        cordova: {
            // noIosLegacyBuildFlag: true, // uncomment only if you know what you are doing
        },

        // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-capacitor-apps/configuring-capacitor
        capacitor: {
            hideSplashscreen: true,
        },

        // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/configuring-electron
        electron: {
            // extendElectronMainConf (esbuildConf)
            // extendElectronPreloadConf (esbuildConf)

            inspectPort: 5858,

            bundler: 'packager', // 'packager' or 'builder'

            packager: {
                // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options
                // OS X / Mac App Store
                // appBundleId: '',
                // appCategoryType: '',
                // osxSign: '',
                // protocol: 'myapp://path',
                // Windows only
                // win32metadata: { ... }
            },

            builder: {
                // https://www.electron.build/configuration/configuration

                appId: 'frontend',
            },
        },
    };
});
