/**
 * Prepares decoded messages for `postMessage`.
 *
 * A decoded byte array is usually a view into the chunk it was read from --
 * an 8 MB decompressed MCAP chunk, or a block the HTTP reader caches.
 * Structured cloning a view copies its whole underlying buffer, so sending
 * one 60 kB image that way would copy 8 MB, and transferring the buffer
 * would detach the chunk and the cache under every other message pointing
 * into it.
 *
 * So every view that does not own its buffer outright is copied first, and
 * the copies of the large ones are transferred: one copy in the worker, none
 * on the main thread. Small arrays are left to the structured clone.
 */

/** Byte arrays below this are cloned; above, transferred. */
const TRANSFER_MIN_BYTES = 4096;

type TypedArrayConstructor = new (buffer: ArrayBuffer) => ArrayBufferView;

const TYPED_ARRAYS = new Set<unknown>([
    Int8Array,
    Uint8Array,
    Uint8ClampedArray,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array,
    BigInt64Array,
    BigUint64Array,
]);

/** A copy of `view` on a buffer of its own, of the same element type. */
function copyView(view: ArrayBufferView): ArrayBufferView {
    const bytes = new Uint8Array(view.byteLength);
    bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    if (view instanceof DataView) return new DataView(bytes.buffer);
    // Subclasses such as Node's `Buffer` (from the polyfill) come back as
    // their standard base type; `Buffer#slice` would not even copy.
    const constructor = TYPED_ARRAYS.has(view.constructor)
        ? (view.constructor as TypedArrayConstructor)
        : Uint8Array;
    return new constructor(bytes.buffer);
}

function owned(view: ArrayBufferView): boolean {
    return view.byteOffset === 0 && view.byteLength === view.buffer.byteLength;
}

/**
 * Walks `value`, replacing byte arrays as described above, and adds the
 * buffers to transfer to `transfer`. Mutates and returns `value`.
 */
export function detachForTransfer(
    value: unknown,
    transfer: Transferable[],
): unknown {
    if (value === null || typeof value !== 'object') return value;

    if (ArrayBuffer.isView(value)) {
        if (value.byteLength < TRANSFER_MIN_BYTES) {
            return owned(value) ? value : copyView(value);
        }
        const copy = copyView(value);
        transfer.push(copy.buffer as ArrayBuffer);
        return copy;
    }
    if (value instanceof ArrayBuffer) return value;

    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
            const item: unknown = value[index];
            if (item !== null && typeof item === 'object') {
                value[index] = detachForTransfer(item, transfer);
            }
        }
        return value;
    }

    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
        const item = record[key];
        if (item !== null && typeof item === 'object') {
            record[key] = detachForTransfer(item, transfer);
        }
    }
    return value;
}
