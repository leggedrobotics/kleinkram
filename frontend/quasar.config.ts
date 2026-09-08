// Configuration for your app
// https://quasar.dev/quasar-cli-vite/quasar-config-file

import { defineConfig } from '#q-app';

import path from 'node:path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const appDirectory = import.meta.dirname;

// An unset docker build ARG / CI variable arrives as an empty string; treat
// that (and whitespace) as "not provided" so the code fallback still applies.
const backendUrlFromProcess = (() => {
    const raw = (process.env.BACKEND_URL ?? '').trim();
    return raw === '' ? undefined : raw;
})();

export default defineConfig((/* ctx */) => {
    return {
        // https://quasar.dev/quasar-cli-vite/prefetch-feature
        // preFetch: true,

        // app boot file (/src/boot)
        // --> boot files are part of "main.js"
        // https://quasar.dev/quasar-cli-vite/boot-files
        boot: ['router', 'query', 'wasm-polyfill'], // <--- Add it here

        // https://quasar.dev/quasar-cli-vite/quasar-config-file#css
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
                // @quasar/app-vite v3 only injects `@/` (-> /src) and `#q-app`.
                // The codebase still uses the v2 folder aliases in ~660 import
                // statements, so we keep them registered explicitly here.
                // Quasar mirrors these into .quasar/tsconfig.json > paths.
                src: path.resolve(appDirectory, 'src'),
                app: appDirectory,
                components: path.resolve(appDirectory, 'src/components'),
                layouts: path.resolve(appDirectory, 'src/layouts'),
                pages: path.resolve(appDirectory, 'src/pages'),
                assets: path.resolve(appDirectory, 'src/assets'),
                boot: path.resolve(appDirectory, 'src/boot'),
                stores: path.resolve(appDirectory, 'src/stores'),

                // eslint-disable-next-line @typescript-eslint/naming-convention
                '@kleinkram/shared': path.resolve(
                    appDirectory,
                    '../packages/shared/src',
                ),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                '@kleinkram/api-dto': path.resolve(
                    appDirectory,
                    '../packages/api-dto/src',
                ),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                '@kleinkram/validation': path.resolve(
                    appDirectory,
                    '../packages/validation/src',
                ),
                // Use frontend-safe validation (no @nestjs dependencies)
                // eslint-disable-next-line @typescript-eslint/naming-convention
                '@kleinkram/validation/frontend': path.resolve(
                    appDirectory,
                    '../packages/validation/src/frontend.ts',
                ),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                '@kleinkram/backend-common': path.resolve(
                    appDirectory,
                    '../packages/backend-common/src',
                ),
                // Alias to resolve class-transformer/storage issue
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'class-transformer/storage': path.resolve(
                    appDirectory,
                    '../node_modules/class-transformer',
                ),
            },

            typescript: {
                strict: true,
                vueShim: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                extendTsConfig(tsConfig: any) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    if (tsConfig.compilerOptions === undefined) return;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    tsConfig.compilerOptions.experimentalDecorators = true;
                },
            },

            // app-vite v3 owns .env loading (v2 relied on Vite's own
            // `envDir`/`envPrefix`, set from `extendViteConf`). The repo keeps
            // a single .env at the monorepo root and the docker build passes
            // BACKEND_URL / VITE_* through process.env.
            env: {
                clientPrefix: ['VITE_', 'BACKEND_URL'],
                folder: path.resolve(appDirectory, '..'),
            },

            // app-vite v3 only picks up prefixed variables from dotenv files;
            // a bare `BACKEND_URL` set in process.env (the docker build ARG,
            // no .env file in the image) is not exposed. Define it explicitly
            // so production images do not silently fall back to localhost.
            defineEnv: {
                ...(backendUrlFromProcess === undefined
                    ? {}
                    : { BACKEND_URL: backendUrlFromProcess }),
            },

            vueRouterMode: 'history', // available values: 'hash', 'history'
            // vueRouterBase,
            // vueDevtools,

            // app-vite v3 changed the default to `false`. We still have a few
            // components declared as plain options objects (e.g.
            // src/dialogs/base-dialog.vue, src/components/rename-files-dialog.vue),
            // so keep the v2 behaviour.
            vueOptionsAPI: true,

            // rebuildCache: true, // rebuilds Vite/linter/etc cache on startup

            // publicPath: '/',
            // ignorePublicFolder: true,
            // minify: false,
            // distDir

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            extendViteConf(viteConfig: any) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                viteConfig.optimizeDeps = viteConfig.optimizeDeps ?? {};
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                viteConfig.optimizeDeps.include =
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    viteConfig.optimizeDeps.include ?? [];

                // FIX: Use the VALID package names
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                viteConfig.optimizeDeps.include.push(
                    '@foxglove/rosmsg',
                    '@foxglove/rosmsg-serialization', // ROS 1
                    '@foxglove/rosmsg2-serialization', // ROS 2 (CDR)
                    '@mcap/core',
                    'fzstd',
                );

                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                viteConfig.optimizeDeps.exclude =
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    viteConfig.optimizeDeps.exclude ?? [];
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                viteConfig.optimizeDeps.exclude.push(
                    '@kleinkram/shared',
                    '@kleinkram/api-dto',
                    '@kleinkram/validation',
                    '@kleinkram/validation/frontend',
                    '@kleinkram/backend-common',
                    // Exclude problematic paths
                    'class-transformer/storage',
                );

                // Add validation/frontend alias for runtime resolution
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                viteConfig.resolve = viteConfig.resolve ?? {};
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                viteConfig.resolve.alias = viteConfig.resolve.alias ?? {};
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                viteConfig.resolve.alias['@kleinkram/validation/frontend'] =
                    path.resolve(
                        appDirectory,
                        '../packages/validation/src/frontend.ts',
                    );
            },
            // viteVuePluginOptions: {},

            // `nodePolyfills()` returns an array of Vite plugins, which does
            // not match app-vite v3's `[pluginFactory, options]` tuple form
            // (that one is typed as `(options?) => Plugin`), so instantiate it
            // here and spread the resulting plugins.
            vitePlugins: [
                ...nodePolyfills({
                    globals: { global: true, Buffer: true, process: true },
                    protocolImports: true,
                }),
            ],
        },

        // Full list of options: https://quasar.dev/quasar-cli-vite/quasar-config-file#devserver
        devServer: {
            // https: true
            open: false, // Don't auto-open browser in Docker
            host: '0.0.0.0', // Bind to all interfaces for Docker
            hmr: {
                // Use the client host for HMR WebSocket connection
                clientPort: 8003,
            },
        },

        // https://quasar.dev/quasar-cli-vite/quasar-config-file#framework
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
        // https://quasar.dev/options/animations
        animations: [],

        // https://quasar.dev/quasar-cli-vite/quasar-config-file#sourcefiles
        sourceFiles: {
            rootComponent: 'src/app.vue',
            //   router: 'src/router/index',
            //   store: 'src/store/index',
            //   pwaRegisterServiceWorker: 'src-pwa/register-service-worker',
            //   pwaServiceWorker: 'src-pwa/sw/custom-sw',
            //   pwaManifestFile: 'src-pwa/manifest.json',
            //   electronMain: 'src-electron/electron-main',
            //   electronPreload: 'src-electron/electron-preload'
        },

        // https://quasar.dev/quasar-cli-vite/developing-ssr/configuring-ssr
        ssr: {
            // ssrPwaHtmlFilename: 'offline.html', // do NOT use index.html as name!
            // will mess up SSR

            // extendSSRWebserverConf (rolldownConf) {},
            // extendSSRPackageJson (json) {},

            pwa: false,

            // manualStoreHydration: true,
            // manualPostHydrationTrigger: true,

            prodPort: 3000, // The default port that the production server should use
            // (gets superseded if process.env.PORT is specified at runtime)

            middlewares: [
                'render', // keep this as last one
            ],
        },

        // https://quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa
        pwa: {
            workboxMode: 'GenerateSW', // or 'injectManifest'
            injectPWAMetaTags: true,
            swFilename: 'sw.js',
            manifestFilename: 'manifest.json',
            useCredentialsForManifestTag: false,
            // useFilenameHashes: true,
        },

        // Full list of options: https://quasar.dev/quasar-cli-vite/developing-cordova-apps/configuring-cordova
        cordova: {},

        // Full list of options: https://quasar.dev/quasar-cli-vite/developing-capacitor-apps/configuring-capacitor
        capacitor: {
            hideSplashscreen: true,
        },

        // Full list of options: https://quasar.dev/quasar-cli-vite/developing-electron-apps/configuring-electron
        electron: {
            inspectPort: 5858,

            bundler: 'packager', // 'packager' or 'builder'

            packager: {
                // https://github.com/electron/packager/blob/main/docs/api.md#options
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
