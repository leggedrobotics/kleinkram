/**
 * zstd, lz4 and bz2 decompression in WebAssembly, the same builds Foxglove
 * and Lichtblick use (`@foxglove/wasm-zstd`, `-lz4`, `-bz2`).
 *
 * The pure-JS decoders this replaces (fzstd, lz4js) took up to ~65 ms for one
 * 8 MB zstd MCAP chunk. That now runs in the preview worker anyway, but the
 * WebAssembly builds are also several times faster, and bz2 -- which ROS 1
 * bags may use -- had no decoder at all before.
 *
 * The modules load once per thread. `loadDecompressors()` must have settled
 * before the first call: the bag and MCAP readers call their decompression
 * handlers synchronously.
 */
import bz2WasmUrl from '@foxglove/wasm-bz2/wasm/module.wasm?url';
import lz4WasmUrl from '@foxglove/wasm-lz4/dist/wasm-lz4.wasm?url';
import zstdWasmUrl from '@foxglove/wasm-zstd/dist/wasm-zstd.wasm?url';

/** Decompress `data` into exactly `size` bytes. */
export type Decompress = (data: Uint8Array, size: number) => Uint8Array;

export type Compression = 'zstd' | 'lz4' | 'bz2';

/** The part of an Emscripten module the decoders below call. */
interface EmscriptenModule {
    HEAPU8: Uint8Array;
    _malloc(size: number): number;
    _free(pointer: number): void;
}

interface ZstdModule extends EmscriptenModule {
    _decompress(
        destination: number,
        destinationSize: number,
        source: number,
        sourceSize: number,
    ): number;
}

interface Lz4Module extends EmscriptenModule {
    _createDecompressionContext(): number;
    _decompressFrame(
        context: number,
        destination: number,
        destinationSize: number,
        source: number,
        sourceSize: number,
    ): number;
}

interface Bz2Module extends EmscriptenModule {
    decompress(
        destination: number,
        destinationSize: number,
        source: number,
        sourceSize: number,
        small: number,
    ): { code: number; error?: string; buffer?: Uint8Array };
}

type ModuleFactory<T> = (overrides: {
    instantiateWasm: (
        imports: WebAssembly.Imports,
        receive: (instance: WebAssembly.Instance) => void,
    ) => object;
}) => Promise<T>;

async function instantiate(
    url: string,
    imports: WebAssembly.Imports,
): Promise<WebAssembly.Instance> {
    const response = fetch(url, { credentials: 'same-origin' });
    try {
        const { instance } = await WebAssembly.instantiateStreaming(
            response,
            imports,
        );
        return instance;
    } catch {
        // A server that does not send `application/wasm` fails the
        // streaming compile; the buffered one does not care.
        const retry = await fetch(url);
        const bytes = await retry.arrayBuffer();
        const { instance } = await WebAssembly.instantiate(bytes, imports);
        return instance;
    }
}

/**
 * Instantiate an Emscripten module from the given `.wasm` URL.
 *
 * The glue rejects its own ready-promise only for failures it sees; a failed
 * fetch inside `instantiateWasm` is ours to report, hence the race.
 */
async function loadModule<T>(
    factory: ModuleFactory<T>,
    url: string,
): Promise<T> {
    const { promise: failed, reject: fail } = Promise.withResolvers<never>();
    const ready = factory({
        instantiateWasm(imports, receive) {
            instantiate(url, imports).then(receive).catch(fail);
            return {};
        },
    });
    return Promise.race([ready, failed]);
}

/**
 * Copy `source` into the module heap, run `run` with a destination of
 * `size` bytes, and copy the result out. The heap is grown by `malloc` when
 * needed, which replaces `HEAPU8`, so it is read again after every call.
 */
function withBuffers(
    module: EmscriptenModule,
    source: Uint8Array,
    size: number,
    run: (destination: number, source: number) => number,
): Uint8Array {
    const sourcePointer = module._malloc(source.byteLength);
    const destinationPointer = module._malloc(size);
    try {
        module.HEAPU8.set(source, sourcePointer);
        const written = run(destinationPointer, sourcePointer);
        if (written < 0) throw new Error('Error during decompression');
        return module.HEAPU8.slice(
            destinationPointer,
            destinationPointer + written,
        );
    } finally {
        module._free(sourcePointer);
        module._free(destinationPointer);
    }
}

let loaded: Promise<void> | undefined;
const decoders: Partial<Record<Compression, Decompress>> = {};
let loadError: unknown;

async function loadAll(): Promise<void> {
    const [zstdFactory, lz4Factory, bz2Factory] = await Promise.all([
        import('virtual:foxglove-wasm/zstd'),
        import('virtual:foxglove-wasm/lz4'),
        import('virtual:foxglove-wasm/bz2'),
    ]);
    const [zstd, lz4, bz2] = await Promise.all([
        loadModule(
            zstdFactory.default as ModuleFactory<ZstdModule>,
            zstdWasmUrl,
        ),
        loadModule(lz4Factory.default as ModuleFactory<Lz4Module>, lz4WasmUrl),
        loadModule(bz2Factory.default as ModuleFactory<Bz2Module>, bz2WasmUrl),
    ]);

    decoders.zstd = (data, size): Uint8Array =>
        withBuffers(zstd, data, size, (destination, source) =>
            zstd._decompress(destination, size, source, data.byteLength),
        );

    // One decompression context serves every frame.
    const context = lz4._createDecompressionContext();
    decoders.lz4 = (data, size): Uint8Array =>
        withBuffers(lz4, data, size, (destination, source) =>
            lz4._decompressFrame(
                context,
                destination,
                size,
                source,
                data.byteLength,
            ),
        );

    decoders.bz2 = (data, size): Uint8Array => {
        const source = bz2._malloc(data.byteLength);
        const destination = bz2._malloc(size);
        try {
            bz2.HEAPU8.set(data, source);
            const result = bz2.decompress(
                destination,
                size,
                source,
                data.byteLength,
                0,
            );
            if (result.code !== 0 || result.buffer === undefined) {
                throw new Error(
                    `BZ2 decompression failed: ${String(result.code)} (${result.error ?? 'unknown'})`,
                );
            }
            // A view into the heap: copy it out before it is freed.
            return new Uint8Array(result.buffer);
        } finally {
            bz2._free(source);
            bz2._free(destination);
        }
    };
}

/**
 * Load the decoders. Never rejects: a recording without compressed chunks
 * still previews when WebAssembly is unavailable, and one with them reports
 * the reason the moment a chunk needs decoding.
 */
export function loadDecompressors(): Promise<void> {
    loaded ??= loadAll().catch((error: unknown) => {
        loadError = error;
        console.error('Could not load the WebAssembly decompressors', error);
    });
    return loaded;
}

const isCompression = (name: string): name is Compression =>
    name === 'zstd' || name === 'lz4' || name === 'bz2';

/** Looks the decoder up on every call, so it can be handed out before load. */
function lazyDecoder(compression: Compression): Decompress {
    return (data, size) => {
        const decode = decoders[compression];
        if (!decode) {
            const reason =
                loadError instanceof Error ? `: ${loadError.message}` : '';
            throw new Error(
                `The ${compression} decompressor (WebAssembly) is not available${reason}`,
            );
        }
        return decode(data, size);
    };
}

/** The decoder for `compression`, or undefined for a name nobody decodes. */
export function decompressorFor(compression: string): Decompress | undefined {
    return isCompression(compression) ? DECOMPRESSORS[compression] : undefined;
}

/** Decoders keyed by compression name, in the shape both readers take. */
export const DECOMPRESSORS: Record<Compression, Decompress> = {
    zstd: lazyDecoder('zstd'),
    lz4: lazyDecoder('lz4'),
    bz2: lazyDecoder('bz2'),
};

/**
 * The content size a zstd or LZ4 frame header declares, if it declares one.
 * Rosbag2 compresses single messages without storing their size anywhere
 * else.
 */
export function frameContentSize(
    compression: string,
    data: Uint8Array,
): number | undefined {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (compression === 'zstd' && data.byteLength >= 6) {
        if (view.getUint32(0, true) !== 0xfd_2f_b5_28) return undefined;
        const descriptor = view.getUint8(4);
        const sizeFlag = descriptor >> 6;
        const singleSegment = (descriptor >> 5) & 1;
        const dictionaryBytes = [0, 1, 2, 4][descriptor & 3] ?? 0;
        const at = 5 + (singleSegment ? 0 : 1) + dictionaryBytes;
        const sizeBytes = [singleSegment ? 1 : 0, 2, 4, 8][sizeFlag] ?? 0;
        if (sizeBytes === 0 || at + sizeBytes > data.byteLength) {
            return undefined;
        }
        if (sizeBytes === 1) return view.getUint8(at);
        if (sizeBytes === 2) return view.getUint16(at, true) + 256;
        if (sizeBytes === 4) return view.getUint32(at, true);
        return Number(view.getBigUint64(at, true));
    }
    if (compression === 'lz4' && data.byteLength >= 15) {
        if (view.getUint32(0, true) !== 0x18_4d_22_04) return undefined;
        const flags = view.getUint8(4);
        if ((flags & 0x08) === 0) return undefined;
        return Number(view.getBigUint64(6, true));
    }
    return undefined;
}

/**
 * Decompress a frame whose decompressed size is not known up front: the
 * size its header declares, or else successively larger guesses.
 */
export function decompressFrame(
    compression: string,
    data: Uint8Array,
): Uint8Array {
    const decode = decompressorFor(compression);
    if (!decode) throw new Error(`Unsupported compression ${compression}`);
    const declared = frameContentSize(compression, data);
    if (declared !== undefined) return decode(data, declared);

    const limit = 512 * 1024 * 1024;
    for (let size = Math.max(4096, data.byteLength * 4); ; size *= 4) {
        try {
            return decode(data, Math.min(size, limit));
        } catch (error) {
            if (size >= limit) throw error;
        }
    }
}
