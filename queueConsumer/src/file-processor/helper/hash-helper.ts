import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { Transform, TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/**
 * Creates a Transform stream that calculates the hash of data flowing through it.
 * Respects backpressure.
 */
export function createHashingStream(algorithm = 'md5'): {
    stream: Transform;
    getHash: () => string;
} {
    const hash = createHash(algorithm);

    // A binary-mode Transform only ever emits Buffers (or strings when an
    // encoding is set), which is also all Hash.update() accepts: @types/node 26
    // widened BinaryLike to include ArrayBufferLike, which update() rejects.
    const stream = new Transform({
        transform(
            chunk: string | NodeJS.ArrayBufferView,
            _encoding: BufferEncoding,
            callback: TransformCallback,
        ): void {
            hash.update(chunk);
            callback(null, chunk);
        },
    });

    return {
        stream,
        getHash: () => hash.digest('base64'),
    };
}

/**
 * Calculates the hash of an existing file on disk using the streaming helper.
 * This ensures consistent hashing logic across the application.
 */
export async function calculateFileHash(
    filePath: string,
    algorithm = 'md5',
): Promise<string> {
    const { stream, getHash } = createHashingStream(algorithm);
    stream.resume();
    await pipeline(createReadStream(filePath), stream);
    return getHash();
}
