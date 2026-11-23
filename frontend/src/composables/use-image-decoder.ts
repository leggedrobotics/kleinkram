import { ref, Ref, watch } from 'vue';
import { FrameDecoder } from '../services/decoding-strategies/image-decoders';
import {
    getBytesFromPayload,
    renderMessageToCanvas,
    RosImageMessage,
} from '../services/decoding-strategies/image-utilities';

/**
 * Compressed frames that may fail to decode in a row before the preview gives
 * up. Counting only failures in a row matters for playback: a long sequence
 * draws thousands of frames, and counting every draw stopped it part-way.
 */
const MAX_FAILED_IN_A_ROW = 1000;
// Maximum parallel image load requests to avoid flooding
const MAX_PARALLEL_REQUESTS = 100;

/** Decoded frames held ahead of the one shown. */
const DECODE_AHEAD = 6;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isCompressedImage = (data: any): boolean =>
    'format' in data ||
    (!('encoding' in data) && !('width' in data) && !('height' in data));

export function useImageDecoder(
    canvasReference: Ref<HTMLCanvasElement | null>,
    messageData: Ref,
): {
    draw: () => void;
    /** Start decoding frames that are about to be shown. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prefetch: (upcoming: any[]) => void;
    renderError: Ref<string | undefined, string>;
    isDecoded: Ref<boolean>;
    isUltraWide: Ref<boolean>;
} {
    const renderError = ref<string | undefined>(undefined);
    const isDecoded = ref(false);
    const isUltraWide = ref(false);
    const failedInARow = ref(0);
    // Track currently pending image load requests
    const parallelRequests = ref(0);
    const decoder = new FrameDecoder(DECODE_AHEAD + 2);
    // Identifies the latest draw request; older decodes are dropped
    let drawSequence = 0;

    const draw = (): void => {
        if (!canvasReference.value || !messageData.value) return;

        const isCompressed = isCompressedImage(messageData.value);

        // Abort if too many compressed frames failed in a row
        if (isCompressed && failedInARow.value >= MAX_FAILED_IN_A_ROW) {
            renderError.value = 'Loading aborted after too many attempts';
            return;
        }
        // Abort if too many parallel requests are ongoing
        if (isCompressed && parallelRequests.value >= MAX_PARALLEL_REQUESTS) {
            renderError.value = 'Too many parallel image requests';
            return;
        }

        if (isCompressed) parallelRequests.value++;
        const sequence = ++drawSequence;
        const settle = (): void => {
            if (isCompressed) parallelRequests.value--;
        };

        renderError.value = undefined;
        const canvas = canvasReference.value;

        const onError = (error: Error): void => {
            settle();
            if (isCompressed) failedInARow.value++;
            renderError.value = error.message;
        };

        try {
            renderMessageToCanvas(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                messageData.value,
                canvas,
                {
                    onRender: () => {
                        settle();
                        failedInARow.value = 0;
                        onRendered(canvas);
                    },
                    onError,
                    isCurrent: () => sequence === drawSequence,
                    onStale: settle,
                },
                decoder,
            );
        } catch (error) {
            onError(error instanceof Error ? error : new Error(String(error)));
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prefetch = (upcoming: any[]): void => {
        if (!FrameDecoder.supported) return;
        const frames: Uint8Array[] = [];
        for (const data of upcoming.slice(0, DECODE_AHEAD)) {
            if (!data || !isCompressedImage(data)) continue;
            const bytes = getBytesFromPayload((data as RosImageMessage).data);
            if (bytes && bytes.length > 0) frames.push(bytes);
        }
        decoder.prefetch(frames);
    };

    // Callback after rendering (async for compressed images). The canvas is
    // already sized for the preview by the renderer.
    const onRendered = (canvas: HTMLCanvasElement): void => {
        isUltraWide.value = canvas.width / canvas.height > 2.5;
        isDecoded.value = true;
    };

    // Automatically redraw when data changes
    watch(messageData, draw, { deep: false });

    // Expose manual draw if needed (e.g. on mount)
    return {
        draw,
        prefetch,
        renderError,
        isDecoded,
        isUltraWide,
    };
}
