import environment from '@backend-common/environment';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/** Bull queue that moves projects to and from the long term storage. */
export const ARCHIVE_QUEUE = 'archive-queue';

/** A write-once object that becomes visible under its key on commit. */
export interface LongTermStorageUpload {
    stream: Writable;
    /** Moves the finished object to its final key. */
    commit(): Promise<void>;
    /** Removes whatever was written so far. */
    abort(): Promise<void>;
}

/**
 * Tape-backed, write-once storage mounted as a file system, modelled after
 * ETH LTS (StrongLink HSM behind an NFSv3/SMB share):
 *
 * - Objects can be written and changed during the "delay action timer" (1h
 *   by default). Afterwards they are sealed (read-only), written to tape at
 *   two sites, and only a 4 MB stub stays on disk.
 * - Reading a sealed object recalls it from tape, which takes minutes. The
 *   docs ask to copy objects to a local disk instead of opening them in place.
 * - Objects should be packed archives of 10-200 GB (max. 2 TB).
 *
 * The data store (SeaweedFS) cannot live on such a share: it keeps changing
 * its volume files in place and reads them at random offsets.
 */
export class FilesystemLongTermStorage {
    constructor(
        private readonly root: string = environment.LTS_ROOT,
        private readonly simulatedRecallSeconds: number = environment.LTS_SIMULATED_RECALL_SECONDS,
    ) {}

    private resolve(key: string): string {
        const resolved = path.resolve(this.root, key);
        if (!resolved.startsWith(path.resolve(this.root) + path.sep)) {
            throw new Error(`Key ${key} escapes the long term storage root`);
        }
        return resolved;
    }

    async exists(key: string): Promise<boolean> {
        return fs
            .access(this.resolve(key))
            .then(() => true)
            .catch(() => false);
    }

    async size(key: string): Promise<number> {
        const stat = await fs.stat(this.resolve(key));
        return stat.size;
    }

    /**
     * Writes to `<key>.partial` and renames on commit, so that a crashed
     * upload never leaves an object that looks complete. Renaming is allowed
     * because it happens well within the delay action timer.
     */
    async upload(key: string): Promise<LongTermStorageUpload> {
        const target = this.resolve(key);
        if (await this.exists(key)) {
            throw new Error(`${key} already exists on the long term storage`);
        }
        await fs.mkdir(path.dirname(target), { recursive: true });
        const partial = `${target}.partial`;
        const stream = createWriteStream(partial, { flags: 'wx' });
        return {
            stream,
            commit: async () => {
                await fs.rename(partial, target);
            },
            abort: async () => {
                stream.destroy();
                await fs.rm(partial, { force: true });
            },
        };
    }

    async writeFile(key: string, content: string): Promise<void> {
        const upload = await this.upload(key);
        await pipeline(Readable.from([content]), upload.stream);
        await upload.commit();
    }

    /**
     * Whether the storage sealed the object, i.e. its delay action timer ran
     * out and it is on its way to tape. Only then is it safe to drop other
     * copies of the data.
     */
    async isSealed(key: string): Promise<boolean> {
        const stat = await fs.stat(this.resolve(key));
        return (stat.mode & 0o222) === 0;
    }

    /**
     * Reads an object that was just written and is still in the disk cache.
     * Do not use this for sealed objects, use {@link recall} instead.
     */
    read(key: string): Readable {
        return createReadStream(this.resolve(key));
    }

    /**
     * Copies an object to a local disk. On the real LTS the read itself
     * triggers the tape recall and trickles the data in; the mock waits
     * `LTS_SIMULATED_RECALL_SECONDS` to stand in for mounting the tape.
     */
    async recall(
        key: string,
        destination: string,
        onProgress?: (bytes: number) => void,
    ): Promise<void> {
        if (this.simulatedRecallSeconds > 0 && (await this.isSealed(key))) {
            await new Promise((resolve) =>
                setTimeout(resolve, this.simulatedRecallSeconds * 1000),
            );
        }
        await fs.mkdir(path.dirname(destination), { recursive: true });
        let copied = 0;
        const counter = new Transform({
            transform(chunk: Buffer, _encoding, callback): void {
                copied += chunk.length;
                onProgress?.(copied);
                callback(null, chunk);
            },
        });
        await pipeline(
            createReadStream(this.resolve(key)),
            counter,
            createWriteStream(destination),
        );
    }
}

/**
 * Groups items into tar parts of roughly `partSize` bytes, in order. An item
 * never spans two parts, so one larger than `partSize` gets a part of its own
 * (LTS accepts objects of up to 2 TB).
 */
export function planArchiveParts<T extends { size: number }>(
    items: T[],
    partSize: number = environment.LTS_PART_SIZE_BYTES,
): T[][] {
    const parts: T[][] = [];
    let current: T[] = [];
    let currentSize = 0;
    for (const item of items) {
        if (current.length > 0 && currentSize + item.size > partSize) {
            parts.push(current);
            current = [];
            currentSize = 0;
        }
        current.push(item);
        currentSize += item.size;
    }
    if (current.length > 0) parts.push(current);
    return parts;
}
