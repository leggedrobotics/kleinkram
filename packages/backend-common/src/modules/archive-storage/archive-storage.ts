import environment, { ArchiveSealMode } from '@backend-common/environment';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/** Bull queue that moves projects to and from the archive storage. */
export const ARCHIVE_QUEUE = 'archive-queue';

/** A write-once object that becomes visible under its key on commit. */
export interface ArchiveStorageUpload {
    stream: Writable;
    /** Moves the finished object to its final key. */
    commit(): Promise<void>;
    /** Removes whatever was written so far. */
    abort(): Promise<void>;
}

/**
 * What the archive needs from the storage it writes to. Anything that can be
 * mounted as a file system and behaves like cold, write-once storage fits,
 * for example ETH LTS (a tape library behind an NFSv3/SMB share):
 *
 * - **Write once:** an object can be written and renamed for a short while,
 *   then it is *sealed*: read-only for good, it can only be deleted. Sealing
 *   is signalled by the object losing its write permission bits. Until then
 *   Kleinkram keeps its own copy of the data.
 * - **Few, large objects:** data is handed over as tar files of a
 *   configurable size (tape libraries like 10-200 GB), never as many small
 *   files, and never modified in place.
 * - **Slow reads:** reading a sealed object may take minutes to hours (tape
 *   recall). Objects are only ever read sequentially, start to end, and copied
 *   to a local staging disk before they are unpacked.
 *
 * This is also why the object storage itself (SeaweedFS) cannot run on such a
 * share: it rewrites its volume files in place and reads them at random.
 */
export interface ArchiveStorage {
    exists(key: string): Promise<boolean>;
    upload(key: string): Promise<ArchiveStorageUpload>;
    writeFile(key: string, content: string): Promise<void>;
    /** Whether the storage made the object read-only for good. */
    isSealed(key: string): Promise<boolean>;
    /** Streams an object that was just written and is not sealed yet. */
    read(key: string): Readable;
    /** Copies an object to a local file; may be slow for sealed objects. */
    recall(
        key: string,
        destination: string,
        onProgress?: (bytes: number) => void,
    ): Promise<void>;
    remove(key: string): Promise<void>;
}

/**
 * {@link ArchiveStorage} on a mounted directory (NFS, SMB or local disk).
 *
 * With `ARCHIVE_SEAL_MODE=storage` the storage seals objects itself (ETH LTS
 * does so after its 1 h "delay action timer"). With `self`, for plain shares
 * that never do, objects are sealed by dropping their write bits on commit.
 */
export class FilesystemArchiveStorage implements ArchiveStorage {
    constructor(
        private readonly root: string = environment.ARCHIVE_ROOT,
        private readonly sealMode: ArchiveSealMode = environment.ARCHIVE_SEAL_MODE,
        private readonly simulatedRecallSeconds: number = environment.ARCHIVE_SIMULATED_RECALL_SECONDS,
    ) {}

    private resolve(key: string): string {
        const resolved = path.resolve(this.root, key);
        if (!resolved.startsWith(path.resolve(this.root) + path.sep)) {
            throw new Error(`Key ${key} escapes the archive storage root`);
        }
        return resolved;
    }

    async exists(key: string): Promise<boolean> {
        return fs
            .access(this.resolve(key))
            .then(() => true)
            .catch(() => false);
    }

    /**
     * Writes to `<key>.partial` and renames on commit, so that a crashed
     * upload never leaves an object that looks complete. The rename happens
     * right away, long before the storage seals the object.
     */
    async upload(key: string): Promise<ArchiveStorageUpload> {
        const target = this.resolve(key);
        if (await this.exists(key)) {
            throw new Error(`${key} already exists on the archive storage`);
        }
        await fs.mkdir(path.dirname(target), { recursive: true });
        const partial = `${target}.partial`;
        const stream = createWriteStream(partial, { flags: 'wx' });
        return {
            stream,
            commit: async () => {
                await fs.rename(partial, target);
                if (this.sealMode === 'self') await fs.chmod(target, 0o444);
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

    async isSealed(key: string): Promise<boolean> {
        const stat = await fs.stat(this.resolve(key));
        return (stat.mode & 0o222) === 0;
    }

    read(key: string): Readable {
        return createReadStream(this.resolve(key));
    }

    /**
     * On tape-backed storage the read itself triggers the recall and trickles
     * the data in. `ARCHIVE_SIMULATED_RECALL_SECONDS` lets a mock stand in for
     * mounting the tape.
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

    /** Sealed objects cannot change, but they can always be deleted. */
    async remove(key: string): Promise<void> {
        await fs.rm(this.resolve(key), { force: true });
    }
}

/**
 * Groups items into tar parts of at least `partSize` bytes, keeping their
 * order (files of a mission stay together).
 *
 * Cold storage wants few, large objects (ETH LTS: 10-200 GB, nothing below
 * 10 GB), so a part is only closed once it reached `partSize`. A remainder
 * of less than half of that is folded into the previous part instead of
 * becoming a small part of its own. Parts are therefore at least
 * `partSize / 2` (unless the whole project is smaller) and at most
 * `1.5 * partSize` plus the largest file. An item never spans two parts.
 */
export function planArchiveParts<T extends { size: number }>(
    items: T[],
    partSize: number = environment.ARCHIVE_PART_SIZE_BYTES,
): T[][] {
    const parts: T[][] = [];
    let current: T[] = [];
    let currentSize = 0;

    for (const item of items) {
        current.push(item);
        currentSize += item.size;
        if (currentSize >= partSize) {
            parts.push(current);
            current = [];
            currentSize = 0;
        }
    }

    if (current.length > 0) {
        const previous = parts.at(-1);
        if (previous && currentSize < partSize / 2) previous.push(...current);
        else parts.push(current);
    }
    return parts;
}
