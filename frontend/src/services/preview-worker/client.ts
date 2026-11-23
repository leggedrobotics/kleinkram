/**
 * Main-thread side of the preview worker: typed calls, streamed reads,
 * cancellation.
 *
 * If the worker cannot start (no module worker support, a blocked script),
 * the same host runs on the main thread over a `MessageChannel`. The preview
 * then works as before this worker existed -- decoding yields to the page
 * every few milliseconds, only a single large decompression still blocks.
 * That beats an error, and since both paths speak the same protocol there is
 * no second implementation to keep in step.
 */
import type { LogMessage } from '../decoding-strategies/utilities';
import type {
    CallName,
    Endpoint,
    PreviewCalls,
    PreviewRequest,
    PreviewResponse,
} from './protocol';

interface PendingCall {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    onBatch?: (messages: LogMessage[]) => void;
}

const abortError = (): DOMException =>
    new DOMException('The read was cancelled', 'AbortError');

/** Runs the host on this thread and returns the client's end of the channel. */
async function startInProcess(): Promise<Endpoint> {
    const channel = new MessageChannel();
    const { servePreview } = await import('./host');
    servePreview(channel.port2);
    return channel.port1;
}

export class PreviewClient {
    private readonly endpoint: Promise<Endpoint>;
    private readonly pending = new Map<number, PendingCall>();
    private worker: Worker | undefined;
    private nextId = 1;
    private disposed = false;

    constructor() {
        this.endpoint = this.start();
    }

    /** Whether the host runs in a worker; false after falling back. */
    get inWorker(): boolean {
        return this.worker !== undefined;
    }

    private start(): Promise<Endpoint> {
        let worker: Worker;
        try {
            // Vite only bundles a worker written exactly like this: inline,
            // and with the `./`.
            /* eslint-disable unicorn/relative-url-style */
            worker = new Worker(
                new URL('./preview.worker.ts', import.meta.url),
                { type: 'module', name: 'file-preview' },
            );
            /* eslint-enable unicorn/relative-url-style */
        } catch (error) {
            console.warn('Preview worker unavailable, decoding here', error);
            return this.listen(startInProcess());
        }

        return this.listen(
            new Promise<Endpoint>((resolve) => {
                let ready = false;
                worker.addEventListener('message', (event: MessageEvent) => {
                    if ((event.data as PreviewResponse).type !== 'ready') {
                        return;
                    }
                    ready = true;
                    this.worker = worker;
                    resolve(worker);
                });
                worker.addEventListener('error', (event) => {
                    // A script that fails to load reports no message.
                    const reason =
                        event.message === '' ||
                        typeof event.message !== 'string'
                            ? 'the worker script could not be loaded'
                            : event.message;
                    if (ready) {
                        // The worker died mid-session (out of memory, a
                        // crash): fail what is waiting rather than hang.
                        this.failAll(
                            new Error(`The preview worker stopped: ${reason}`),
                        );
                        return;
                    }
                    // It never got going, typically because the script
                    // could not load. Run the host here instead.
                    event.preventDefault();
                    console.warn(
                        `Preview worker failed to start (${reason}), decoding here`,
                    );
                    worker.terminate();
                    resolve(startInProcess());
                });
            }),
        );
    }

    private async listen(endpoint: Promise<Endpoint>): Promise<Endpoint> {
        const resolved = await endpoint;
        resolved.addEventListener('message', (event: MessageEvent): void => {
            this.receive(event.data as PreviewResponse);
        });
        resolved.start?.();
        return resolved;
    }

    private receive(response: PreviewResponse): void {
        if (response.type === 'ready') return;
        const call = this.pending.get(response.id);
        // A call that was cancelled or belongs to a file left behind.
        if (!call) return;
        switch (response.type) {
            case 'batch': {
                call.onBatch?.(response.messages);
                break;
            }
            case 'result': {
                this.pending.delete(response.id);
                call.resolve(response.value);
                break;
            }
            case 'error': {
                this.pending.delete(response.id);
                call.reject(new Error(response.message));
                break;
            }
        }
    }

    private failAll(error: Error): void {
        for (const call of this.pending.values()) call.reject(error);
        this.pending.clear();
    }

    private async send<K extends CallName>(
        call: K,
        params: PreviewCalls[K]['params'],
        options: {
            signal?: AbortSignal;
            onBatch?: (messages: LogMessage[]) => void;
            transfer?: Transferable[];
        } = {},
    ): Promise<PreviewCalls[K]['result']> {
        if (this.disposed) throw new Error('The preview was closed');
        const { signal, onBatch, transfer = [] } = options;
        if (signal?.aborted) throw abortError();
        const endpoint = await this.endpoint;
        if (signal?.aborted) throw abortError();

        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const pending: PendingCall = {
                resolve: resolve as (value: unknown) => void,
                reject,
            };
            if (onBatch) pending.onBatch = onBatch;
            this.pending.set(id, pending);
            signal?.addEventListener(
                'abort',
                () => {
                    if (!this.pending.delete(id)) return;
                    endpoint.postMessage(
                        { type: 'cancel', id } satisfies PreviewRequest,
                        [],
                    );
                    reject(abortError());
                },
                { once: true },
            );
            endpoint.postMessage(
                { type: 'call', id, call, params } as PreviewRequest,
                transfer,
            );
        });
    }

    open(
        params: PreviewCalls['open']['params'],
    ): Promise<PreviewCalls['open']['result']> {
        return this.send('open', params);
    }

    /**
     * Stream the messages of a read to `onBatch`, a batch at a time, until
     * the read ends or `signal` aborts.
     */
    async read(
        params: PreviewCalls['read']['params'],
        onBatch: (messages: LogMessage[]) => void,
        signal: AbortSignal,
    ): Promise<void> {
        const transfer: Transferable[] = [];
        const skipTimes = params.options.skipTimes;
        if (skipTimes) transfer.push(skipTimes.buffer as ArrayBuffer);
        await this.send('read', params, { signal, onBatch, transfer });
    }

    readAttachment(index: number): Promise<Uint8Array | undefined> {
        return this.send('readAttachment', { index });
    }

    readMetadata(): Promise<PreviewCalls['readMetadata']['result']> {
        return this.send('readMetadata', {});
    }

    dispose(): void {
        this.disposed = true;
        this.failAll(new Error('The preview was closed'));
        this.worker?.terminate();
        void this.endpoint.then((endpoint) => {
            if (endpoint instanceof MessagePort) endpoint.close();
            if (endpoint instanceof Worker) endpoint.terminate();
        });
    }
}
