import { ref, Ref, watch } from 'vue';
import { renderMessageToCanvas } from '../services/decoding-strategies/image-utilities';

// Maximum number of attempts before aborting compressed image loading
const MAX_COMPRESSED_ATTEMPTS = 1000;
// Maximum parallel image load requests to avoid flooding
const MAX_PARALLEL_REQUESTS = 100;

export function useImageDecoder(
    canvasReference: Ref<HTMLCanvasElement | null>,
    messageData: Ref,
): {
    draw: () => void;
    renderError: Ref<string | undefined, string>;
    isDecoded: Ref<boolean>;
    isUltraWide: Ref<boolean>;
} {
    const renderError = ref<string | undefined>(undefined);
    const isDecoded = ref(false);
    const isUltraWide = ref(false);
    // Track total attempts for compressed images
    const compressedAttempts = ref(0);
    // Track currently pending image load requests
    const parallelRequests = ref(0);
    const draw = (): void => {
        if (!canvasReference.value || !messageData.value) return;

        // Determine if this is a compressed image
        const isCompressed =
            'format' in messageData.value ||
            (!('encoding' in messageData.value) &&
                !('width' in messageData.value) &&
                !('height' in messageData.value));

        // Abort if too many attempts for compressed images
        if (
            isCompressed &&
            compressedAttempts.value >= MAX_COMPRESSED_ATTEMPTS
        ) {
            renderError.value = 'Loading aborted after too many attempts';
            return;
        }
        // Abort if too many parallel requests are ongoing
        if (isCompressed && parallelRequests.value >= MAX_PARALLEL_REQUESTS) {
            renderError.value = 'Too many parallel image requests';
            return;
        }

        // Increment counters for compressed images
        if (isCompressed) {
            compressedAttempts.value++;
            parallelRequests.value++;
        }

        renderError.value = undefined;
        const canvas = canvasReference.value;
        const targetWidth = 600;
        const targetHeight = 400;

        renderMessageToCanvas(messageData.value, canvas, () => {
            // Callback after rendering (async for compressed images)
            const aspectRatio = canvas.width / canvas.height;
            isUltraWide.value = aspectRatio > 2.5;

            // Resize logic
            let newWidth = canvas.width;
            let newHeight = canvas.height;
            let needsResize = false;

            if (isUltraWide.value) {
                if (canvas.height > targetHeight) {
                    const ratio = targetHeight / canvas.height;
                    newWidth = Math.round(canvas.width * ratio);
                    newHeight = targetHeight;
                    needsResize = true;
                }
            } else {
                if (
                    canvas.width > targetWidth ||
                    canvas.height > targetHeight
                ) {
                    const ratio = Math.min(
                        targetWidth / canvas.width,
                        targetHeight / canvas.height,
                    );
                    newWidth = Math.round(canvas.width * ratio);
                    newHeight = Math.round(canvas.height * ratio);
                    needsResize = true;
                }
            }

            if (needsResize) {
                const temporaryCanvas = document.createElement('canvas');
                temporaryCanvas.width = canvas.width;
                temporaryCanvas.height = canvas.height;
                const temporaryContext = temporaryCanvas.getContext('2d');
                temporaryContext?.drawImage(canvas, 0, 0);

                canvas.width = newWidth;
                canvas.height = newHeight;
                const context = canvas.getContext('2d');
                context?.drawImage(temporaryCanvas, 0, 0, newWidth, newHeight);
            }

            isDecoded.value = true;
            if (isCompressed) {
                // Decrement parallel request count after completion
                parallelRequests.value--;
            }
        });
    };

    // Automatically redraw when data changes
    watch(messageData, draw, { deep: false });

    // Expose manual draw if needed (e.g. on mount)
    return {
        draw,
        renderError,
        isDecoded,
        isUltraWide,
    };
}
