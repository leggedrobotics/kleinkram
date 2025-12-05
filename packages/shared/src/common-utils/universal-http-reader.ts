import { IReadable } from '@mcap/core/dist/cjs/src/types';
import { AdaptiveChunkOptimizer } from './adaptive-chunk-optimizer';

interface CachedBlock {
    offset: bigint;
    data: Uint8Array;
}

export class UniversalHttpReader implements IReadable {
    private url: string;

    private _size: number | undefined;
    private additionalHeaders: Record<string, string>;

    private optimizer = new AdaptiveChunkOptimizer();
    private cachedBlocks: CachedBlock[] = [];
    private activeRequests = new Map<string, Promise<Uint8Array>>();
    private logInterval: ReturnType<typeof setInterval> | null = null;

    constructor(url: string, additionalHeaders: Record<string, string> = {}) {
        this.url = url;
        this.additionalHeaders = additionalHeaders;
    }

    async init(): Promise<void> {
        const response = await fetch(this.url, {
            headers: {
                Range: 'bytes=0-0',
                ...this.additionalHeaders,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to access file: ${response.statusText}`);
        }

        // Check for Content-Range header (206 Partial Content)
        const range = response.headers.get('Content-Range');
        if (range) {
            this._size = Number.parseInt(range.split('/')[1] || '0', 10);
            return;
        }

        // Fallback: If server ignores Range and returns 200, use Content-Length
        const length = response.headers.get('Content-Length');
        if (length) {
            this._size = Number.parseInt(length, 10);
        } else {
            throw new Error('Could not determine file size');
        }
    }

    async size(): Promise<bigint> {
        if (this._size === undefined) await this.init();
        return BigInt(this._size ?? 0);
    }

    get sizeBytes(): number {
        return this._size ?? 0;
    }

    prefetch(offset: bigint, length: bigint): void {
        // For prefetch, we might just want to ensure it's in cache or being fetched.
        // We can use the same read logic but ignore the result.
        this.read(offset, length).catch(() => {
            // Ignore prefetch errors
        });
    }

    private async fetchRange(
        offset: bigint,
        length: bigint,
    ): Promise<Uint8Array> {
        const start = Number(offset);
        const end = start + Number(length) - 1;
        const startTime = performance.now();

        const response = await fetch(this.url, {
            headers: {
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                Range: `bytes=${start}-${end}`,
                ...this.additionalHeaders,
            },
        });

        if (!response.ok) {
            throw new Error(`Read failed: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const duration = performance.now() - startTime;

        this.optimizer.updateMetrics(buffer.byteLength, duration);

        return new Uint8Array(buffer);
    }

    async read(offset: bigint, length: bigint): Promise<Uint8Array> {
        const end = offset + length;

        // 1. Check if fully covered by a cached block
        const cachedBlock = this.cachedBlocks.find(
            (b) =>
                offset >= b.offset && end <= b.offset + BigInt(b.data.length),
        );

        if (cachedBlock) {
            const relativeOffset = Number(offset - cachedBlock.offset);
            return cachedBlock.data.subarray(
                relativeOffset,
                relativeOffset + Number(length),
            );
        }

        // 2. Check active requests (simple deduplication)
        // Note: This simple key check might miss overlapping requests that could satisfy this one.
        // For a more robust solution, we'd check ranges of active requests too.
        // But for now, let's stick to the requested range key or maybe just proceed to fetch.

        // 3. Determine fetch size
        const optimalSize = this.optimizer.getOptimalRequestSize(
            Number(length),
        );
        const fetchLength = BigInt(optimalSize);

        // Align fetch to start at requested offset (or slightly before if we wanted to be fancy, but let's keep it simple)
        // We fetch [offset, offset + fetchLength)

        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        const key = `${offset}-${fetchLength}`;
        let promise = this.activeRequests.get(key);

        if (!promise) {
            if (this.activeRequests.size === 0) {
                this.optimizer.startActivity();
                this.startLogging();
            }

            promise = this.fetchRange(offset, fetchLength);
            this.activeRequests.set(key, promise);

            promise
                .then((data) => {
                    this.activeRequests.delete(key);
                    if (this.activeRequests.size === 0) {
                        this.optimizer.stopActivity();
                        this.stopLogging();
                    }
                    // Add to cache
                    this.cachedBlocks.push({ offset, data });
                    // Optional: Prune cache if too big
                    if (this.cachedBlocks.length > 50) {
                        this.cachedBlocks.shift(); // Remove oldest
                    }
                })
                .catch(() => {
                    this.activeRequests.delete(key);
                    if (this.activeRequests.size === 0) {
                        this.optimizer.stopActivity();
                        this.stopLogging();
                    }
                });
        }

        const data = await promise;

        // Return the requested slice
        // The data we got starts at `offset` and has length `fetchLength`
        // We want `length` bytes from it.
        if (data.length < Number(length)) {
            throw new Error(
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `Fetched data smaller than requested: ${data.length} < ${length}`,
            );
        }

        return data.subarray(0, Number(length));
    }

    private startLogging(): void {
        if (this.logInterval) return;
        this.logInterval = setInterval(() => {
            this.optimizer.logStats('Interval');
        }, 10_000);
    }

    private stopLogging(): void {
        if (this.logInterval) {
            clearInterval(this.logInterval);
            this.logInterval = null;
        }
        this.optimizer.logStats('End of period');
    }
}
