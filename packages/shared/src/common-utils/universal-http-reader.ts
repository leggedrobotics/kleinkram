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
                Range: 'bytes=0-', // Use open-ended range for better compatibility
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
        let end = start + Number(length) - 1;

        // Clamp to file size if known
        if (this._size !== undefined && end >= this._size) {
            end = this._size - 1;
        }

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

        let data = new Uint8Array(buffer);

        // If server returned 200 OK instead of 206 Partial Content, it returned the whole file
        if (response.status === 200) {
            // Update size if it was unknown
            this._size ??= data.length;

            // Cache the whole file to avoid future full downloads if range isn't supported
            if (
                this.cachedBlocks.length > 0 &&
                this.cachedBlocks[0].offset === 0n &&
                this.cachedBlocks[0].data.length === this._size
            ) {
                // Already cached
            } else {
                this.cachedBlocks.unshift({ offset: 0n, data });
                if (this.cachedBlocks.length > 50) {
                    this.cachedBlocks.pop();
                }
            }

            // Slice to the requested range
            data = data.subarray(start, start + Number(length));
        }

        return data;
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

        // 2. Determine fetch size
        const optimalSize = this.optimizer.getOptimalRequestSize(
            Number(length),
        );
        let fetchLength = BigInt(optimalSize);

        // Clamp fetchLength to file size
        if (
            this._size !== undefined &&
            offset + fetchLength > BigInt(this._size)
        ) {
            fetchLength = BigInt(this._size) - offset;
            if (fetchLength < length) fetchLength = length; // Ensure we at least get what's requested
        }

        // 3. Check active requests (simple deduplication)
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
                    // Add to cache if not already cached as part of a 200 response
                    if (
                        !this.cachedBlocks.some(
                            (b) =>
                                b.offset === offset &&
                                b.data.length === data.length,
                        )
                    ) {
                        this.cachedBlocks.push({ offset, data });
                        // Optional: Prune cache if too big
                        if (this.cachedBlocks.length > 50) {
                            this.cachedBlocks.shift(); // Remove oldest
                        }
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
        // The data we got starts at `offset`
        if (data.length < Number(length)) {
            // If we are at the end of the file, it's okay if it's smaller than requested
            if (
                this._size !== undefined &&
                offset + BigInt(data.length) === BigInt(this._size)
            ) {
                return data;
            }

            throw new Error(
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `Fetched data smaller than requested and not at EOF: ${data.length} < ${length} at offset ${offset}`,
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
