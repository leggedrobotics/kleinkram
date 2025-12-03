/**
 * Low-level image manipulation service.
 * Optimized for direct Canvas manipulation to avoid base64 overhead.
 */

export interface RosImageMessage {
    width?: number; // Optional because CompressedImage lacks this
    height?: number;
    encoding?: string; // Optional because CompressedImage lacks this
    is_bigendian?: number;
    step?: number;
    data: Uint8Array | Record<string, number> | number[];
    format?: string; // Specific to CompressedImage
}

import {
    ImageRenderer,
    PREVIEW_WIDTH,
    renderCompressed,
} from './image-decoders';

/**
 * Renders a ROS message directly onto a specific HTML Canvas.
 */
export function renderMessageToCanvas(
    message: RosImageMessage,
    canvas: HTMLCanvasElement,
    onRender?: () => void,
): void {
    const context = canvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
    });
    if (!context) return;

    // Extract Bytes safely
    const bytes = getBytesFromPayload(message.data);
    if (!bytes || bytes.length === 0) return;

    // CHECK FOR COMPRESSED IMAGE
    // CompressedImage messages typically lack 'width', 'height', and 'encoding',
    // but have a 'format' field (e.g., "jpeg", "png").
    const isCompressed =
        'format' in message ||
        (!message.encoding && !message.width && !message.height);

    if (isCompressed) {
        // We cannot calculate scale yet because we don't know the dimensions.
        // Pass the canvas element directly to resize it after load.
        renderCompressed(context, bytes, canvas, onRender);
        return;
    }

    // --- RAW IMAGE PATH (sensor_msgs/Image) ---
    // For raw images, we MUST have width/height to interpret the bytes.
    if (!message.width || !message.height) return;

    // Calculate Dimensions & Scale (Only possible for Raw)
    const scale =
        message.width > PREVIEW_WIDTH ? PREVIEW_WIDTH / message.width : 1;
    const targetW = Math.floor(message.width * scale);
    const targetH = Math.floor(message.height * scale);

    if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
    }

    const renderer = new ImageRenderer(
        context,
        bytes,
        message.width,
        message.height,
        targetW,
        targetH,
    );

    // Render based on encoding
    switch (message.encoding) {
        case 'rgb8':
        case 'bgr8': {
            renderer.renderAsRawColor(message.encoding === 'bgr8', 3);
            break;
        }
        case 'bgra8':
        case 'rgba8': {
            renderer.renderAsRawColor(message.encoding === 'bgra8', 4);
            break;
        }
        case '16UC1':
        case 'mono16': {
            renderer.renderAsDepth(message.is_bigendian === 1);
            break;
        }
        case '8UC1':
        case 'mono8': {
            renderer.renderAsMono8();
            break;
        }
        case '32FC1': {
            renderer.renderAsFloat32Mono();
            break;
        }
        case '32FC3': {
            renderer.renderAsFloat32Color();
            break;
        }
        default: {
            // Throw error so the UI shows it instead of spinning forever
            throw new Error(`Unsupported encoding: ${message.encoding}`);
        }
    }
    onRender?.();
}

export function getBytesFromPayload(dataField: any): Uint8Array | undefined {
    if (!dataField) return;
    if (dataField instanceof Uint8Array) return dataField;
    if (Array.isArray(dataField)) return new Uint8Array(dataField);

    if (typeof dataField === 'object') {
        const keys = Object.keys(dataField)
            .map(Number)
            .filter((k) => !Number.isNaN(k));

        if (keys.length > 0) {
            keys.sort((a, b) => a - b);
            const bytes = new Uint8Array(keys.length);

            for (const [index, key] of keys.entries()) {
                bytes[index] = (dataField as Record<number, number>)[key] ?? 0;
            }
            return bytes;
        }
    }
    return undefined;
}
