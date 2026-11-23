/**
 * The file preview's data source: HTTP range reads, index parsing,
 * decompression and message decoding, answering `protocol.ts` requests.
 *
 * Runs in the preview worker (`preview.worker.ts`), so none of that work
 * lands on the main thread -- the same split Foxglove and Lichtblick make
 * with their worker-hosted iterable sources. Should the worker not start, the
 * client runs this same code on the main thread over a `MessageChannel`.
 */
import { UniversalHttpReader } from '@kleinkram/shared';
import { DecodingStrategy } from '../decoding-strategies';
import { Db3Strategy } from '../decoding-strategies/db3-strategy';
import { loadDecompressors } from '../decoding-strategies/decompress';
import { McapStrategy } from '../decoding-strategies/mcap-strategy';
import { RosbagStrategy } from '../decoding-strategies/rosbag-strategy';
import type {
    LogMessage,
    ReadOptions,
    SampleCostModel,
} from '../decoding-strategies/utilities';
import type {
    Endpoint,
    FileKind,
    OpenedFile,
    PreviewCalls,
    PreviewRequest,
    PreviewResponse,
    ReadRequest,
} from './protocol';
import { detachForTransfer } from './transfer';

/**
 * How long decoded messages wait in the worker before they are posted.
 * The UI commits at most every 100 ms anyway; this keeps the number of
 * `postMessage` calls -- each one a task on the main thread -- small.
 */
const BATCH_INTERVAL_MS = 50;

function createStrategy(kind: FileKind): DecodingStrategy {
    if (kind === 'mcap') return new McapStrategy();
    if (kind === 'db3') return new Db3Strategy();
    return new RosbagStrategy();
}

export function servePreview(endpoint: Endpoint): void {
    // Starts compiling the WebAssembly while the file's index is fetched.
    const decompressors = loadDecompressors();
    let strategy: DecodingStrategy | undefined;
    /** Counts `open` calls, so a slow one cannot replace a newer file. */
    let generation = 0;
    const reads = new Map<number, AbortController>();

    const post = (response: PreviewResponse, transfer: Transferable[] = []) => {
        endpoint.postMessage(response, transfer);
    };

    /** Forget the current file: stop its reads and drop its caches. */
    function close(): void {
        for (const controller of reads.values()) controller.abort();
        reads.clear();
        strategy = undefined;
        generation++;
    }

    async function open({
        url,
        kind,
    }: PreviewCalls['open']['params']): Promise<OpenedFile> {
        // A new file: nothing of the previous one is wanted any more.
        close();
        const current = generation;

        const reader = new UniversalHttpReader(url);
        await Promise.all([reader.init(), decompressors]);
        const opened = createStrategy(kind);
        await opened.init(reader);
        if (current !== generation) {
            throw new Error('Another file was opened in the meantime');
        }
        strategy = opened;
        return {
            insights: opened.getInsights(),
            schema: opened.getSchema(),
            sampleCostModels: opened.sampleCostModels(),
            supportsWindow: opened.supportsWindow,
        };
    }

    async function read(id: number, request: ReadRequest): Promise<void> {
        const current = strategy;
        if (!current) return;
        const controller = new AbortController();
        reads.set(id, controller);
        const { signal } = controller;

        let pending: LogMessage[] = [];
        let transfer: Transferable[] = [];
        let timer: ReturnType<typeof setTimeout> | undefined;
        let first = true;
        const flush = (): void => {
            if (timer !== undefined) clearTimeout(timer);
            timer = undefined;
            if (signal.aborted || pending.length === 0) return;
            post({ type: 'batch', id, messages: pending }, transfer);
            pending = [];
            transfer = [];
        };

        const { skipTimes, ...wire } = request.options;
        const options: ReadOptions = { ...wire };
        if (skipTimes) {
            const skip = new Set(skipTimes);
            options.skip = (logTime): boolean => skip.has(logTime);
        }

        try {
            await current.getMessages(
                request.topic,
                request.limit,
                (message) => {
                    if (signal.aborted) return;
                    message.data = detachForTransfer(message.data, transfer);
                    pending.push(message);
                    // The first message goes out at once: it is what the
                    // viewer waits on to show anything.
                    if (first) {
                        first = false;
                        flush();
                    } else {
                        timer ??= setTimeout(flush, BATCH_INTERVAL_MS);
                    }
                },
                signal,
                request.startTime,
                options,
            );
        } finally {
            // Also after an error: what was decoded before it still shows,
            // as it did when every message reached the page at once.
            flush();
            if (timer !== undefined) clearTimeout(timer);
            reads.delete(id);
        }
    }

    async function call(
        request: Extract<PreviewRequest, { type: 'call' }>,
    ): Promise<{ value: unknown; transfer: Transferable[] }> {
        switch (request.call) {
            case 'open': {
                const value = await open(request.params);
                const transfer: Transferable[] = [];
                for (const model of Object.values(value.sampleCostModels)) {
                    if (model) transfer.push(...costModelBuffers(model));
                }
                return { value, transfer };
            }
            case 'read': {
                await read(request.id, request.params);
                return { value: undefined, transfer: [] };
            }
            case 'readAttachment': {
                const transfer: Transferable[] = [];
                const bytes = await strategy?.readAttachment(
                    request.params.index,
                );
                return {
                    value: detachForTransfer(bytes, transfer),
                    transfer,
                };
            }
            case 'close': {
                close();
                return { value: undefined, transfer: [] };
            }
            case 'readMetadata': {
                return {
                    value: (await strategy?.readMetadata()) ?? [],
                    transfer: [],
                };
            }
        }
    }

    endpoint.addEventListener('message', (event: MessageEvent): void => {
        const request = event.data as PreviewRequest;
        if (request.type === 'cancel') {
            reads.get(request.id)?.abort();
            reads.delete(request.id);
            return;
        }
        call(request)
            .then(({ value, transfer }) => {
                post({ type: 'result', id: request.id, value }, transfer);
            })
            .catch((error: unknown) => {
                post({
                    type: 'error',
                    id: request.id,
                    message:
                        error instanceof Error ? error.message : String(error),
                });
            });
    });
    endpoint.start?.();

    post({ type: 'ready' });
}

function costModelBuffers(model: SampleCostModel): ArrayBuffer[] {
    return [model.first, model.next, model.bytes].map(
        (array) => array.buffer as ArrayBuffer,
    );
}
