import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Plugin } from 'vite';

/**
 * Serves the Emscripten glue of Foxglove's WebAssembly decompressors as plain
 * ES modules: `virtual:foxglove-wasm/zstd`, `.../lz4` and `.../bz2`.
 *
 * The packages are written for webpack. Their glue is CommonJS and finds its
 * `.wasm` with `require("./x.wasm")`, which webpack turns into a URL and Vite
 * cannot resolve at all. Their `index.js` also instantiates the module the
 * moment it is imported and copies every result into a Node `Buffer`.
 *
 * This plugin hands out only the glue's module factory. The caller passes
 * the `.wasm` itself (imported with `?url`, so Vite fingerprints and emits it
 * like any other asset) through Emscripten's `instantiateWasm` hook. The same
 * code then runs in the dev server and in the production build, on the main
 * thread and in a worker, without pre-bundling or Node polyfills.
 */
const GLUE: Record<string, string> = {
    zstd: '@foxglove/wasm-zstd/dist/wasm-zstd.js',
    lz4: '@foxglove/wasm-lz4/dist/wasm-lz4.js',
    bz2: '@foxglove/wasm-bz2/wasm/module.js',
};

const PREFIX = 'virtual:foxglove-wasm/';
const RESOLVED_PREFIX = '\0foxglove-wasm:';

/** The UMD tail that exports the factory, which an ES module cannot use. */
const UMD_EXPORT =
    /if \(typeof exports === 'object' && typeof module === 'object'\)[\s\S]*$/;

export function toEsModule(source: string): string {
    if (!UMD_EXPORT.test(source)) {
        throw new Error('foxglove-wasm: unexpected glue layout');
    }
    return (
        source
            // Only reached in Node; the browser never takes that branch.
            .replaceAll(/require\((["'])(?:fs|path)\1\)/g, '{}')
            // Only used to name the file for `locateFile`, which the
            // `instantiateWasm` hook makes irrelevant.
            .replaceAll(/require\("\.\/([\w-]+\.wasm)"\)/g, '"$1"')
            .replace(UMD_EXPORT, 'export default Module;\n')
    );
}

export function foxgloveWasm(): Plugin {
    const require = createRequire(import.meta.url);
    return {
        name: 'kleinkram-foxglove-wasm',
        enforce: 'pre',
        resolveId(id) {
            if (!id.startsWith(PREFIX)) return;
            const name = id.slice(PREFIX.length);
            if (!(name in GLUE)) return;
            return RESOLVED_PREFIX + name;
        },
        load(id) {
            if (!id.startsWith(RESOLVED_PREFIX)) return;
            const glue = GLUE[id.slice(RESOLVED_PREFIX.length)];
            if (glue === undefined) return;
            const file = require.resolve(glue);
            this.addWatchFile(file);
            return toEsModule(readFileSync(file, 'utf8'));
        },
    };
}
