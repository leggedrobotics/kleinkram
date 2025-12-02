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

const PREVIEW_WIDTH = 600;

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

    // Render based on encoding
    switch (message.encoding) {
        case 'rgb8':
        case 'bgr8': {
            renderRawColor(
                context,
                bytes,
                message.width,
                message.height,
                targetW,
                targetH,
                message.encoding === 'bgr8',
            );
            break;
        }
        case '16UC1':
        case 'mono16': {
            renderDepth(
                context,
                bytes,
                message.width,
                message.height,
                targetW,
                targetH,
                message.is_bigendian === 1,
            );
            break;
        }
        case '8UC1':
        case 'mono8': {
            renderMono8(
                context,
                bytes,
                message.width,
                message.height,
                targetW,
                targetH,
            );
            break;
        }
        case '32FC1': {
            renderFloat32Mono(
                context,
                bytes,
                message.width,
                message.height,
                targetW,
                targetH,
            );
            break;
        }
        case '32FC3': {
            renderFloat32Color(
                context,
                bytes,
                message.width,
                message.height,
                targetW,
                targetH,
            );
            break;
        }
        default: {
            // Throw error so the UI shows it instead of spinning forever
            throw new Error(`Unsupported encoding: ${message.encoding}`);
        }
    }
    onRender?.();
}

// --- Render Implementations ---

function renderCompressed(
    context: CanvasRenderingContext2D,
    bytes: Uint8Array,
    canvas: HTMLCanvasElement,
    onRender?: () => void,
): void {
    const blob = new Blob([bytes as any]);
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.addEventListener('load', () => {
        const scale = img.width > PREVIEW_WIDTH ? PREVIEW_WIDTH / img.width : 1;
        const targetW = Math.floor(img.width * scale);
        const targetH = Math.floor(img.height * scale);

        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
        }

        context.drawImage(img, 0, 0, targetW, targetH);
        URL.revokeObjectURL(url);
        onRender?.();
    });

    // eslint-disable-next-line unicorn/prefer-add-event-listener
    img.onerror = (): void => {
        URL.revokeObjectURL(url);
        console.error('Failed to decode compressed image blob');
    };

    img.src = url;
}

function renderRawColor(
    context: CanvasRenderingContext2D,
    raw: Uint8Array,
    sourceW: number,
    sourceH: number,
    destinationW: number,
    destinationH: number,
    isBgr: boolean,
): void {
    const imgData = context.createImageData(destinationW, destinationH);
    const data = imgData.data;
    const strideX = sourceW / destinationW;
    const strideY = sourceH / destinationH;

    // Pre-calculate constants to avoid re-allocation in loop
    const rawLength = raw.length;

    for (let y = 0; y < destinationH; y++) {
        for (let x = 0; x < destinationW; x++) {
            const sourceX = Math.floor(x * strideX);
            const sourceY = Math.floor(y * strideY);
            const sourceIndex = (sourceY * sourceW + sourceX) * 3;
            const destinationIndex = (y * destinationW + x) * 4;

            // Bounds check protects us logic-wise
            if (sourceIndex + 2 < rawLength) {
                if (isBgr) {
                    data[destinationIndex] = raw[sourceIndex + 2] ?? 0; // R
                    data[destinationIndex + 1] = raw[sourceIndex + 1] ?? 0; // G
                    data[destinationIndex + 2] = raw[sourceIndex] ?? 0; // B
                } else {
                    data[destinationIndex] = raw[sourceIndex] ?? 0; // R
                    data[destinationIndex + 1] = raw[sourceIndex + 1] ?? 0; // G
                    data[destinationIndex + 2] = raw[sourceIndex + 2] ?? 0; // B
                }
                data[destinationIndex + 3] = 255; // Alpha
            }
        }
    }
    context.putImageData(imgData, 0, 0);
}

function renderMono8(
    context: CanvasRenderingContext2D,
    raw: Uint8Array,
    sourceW: number,
    sourceH: number,
    destinationW: number,
    destinationH: number,
): void {
    const imgData = context.createImageData(destinationW, destinationH);
    const data = imgData.data;
    const strideX = sourceW / destinationW;
    const strideY = sourceH / destinationH;
    const rawLength = raw.length;

    for (let y = 0; y < destinationH; y++) {
        for (let x = 0; x < destinationW; x++) {
            const sourceX = Math.floor(x * strideX);
            const sourceY = Math.floor(y * strideY);
            const sourceIndex = sourceY * sourceW + sourceX;
            const destinationIndex = (y * destinationW + x) * 4;

            if (sourceIndex < rawLength) {
                const value = raw[sourceIndex] ?? 0;
                data[destinationIndex] = value;
                data[destinationIndex + 1] = value;
                data[destinationIndex + 2] = value;
                data[destinationIndex + 3] = 255;
            }
        }
    }
    context.putImageData(imgData, 0, 0);
}

function renderDepth(
    context: CanvasRenderingContext2D,
    raw: Uint8Array,
    sourceW: number,
    sourceH: number,
    destinationW: number,
    destinationH: number,
    isBigEndian: boolean,
): void {
    const imgData = context.createImageData(destinationW, destinationH);
    const data = imgData.data;
    const strideX = sourceW / destinationW;
    const strideY = sourceH / destinationH;
    const rawLength = raw.length;

    let min = 65_535;
    let max = 0;
    const temporaryBuffer = new Uint16Array(destinationW * destinationH);

    for (let y = 0; y < destinationH; y++) {
        for (let x = 0; x < destinationW; x++) {
            const sourceX = Math.floor(x * strideX);
            const sourceY = Math.floor(y * strideY);
            const byteIndex = (sourceY * sourceW + sourceX) * 2;

            if (byteIndex + 1 < rawLength) {
                const b1 = raw[byteIndex] ?? 0;
                const b2 = raw[byteIndex + 1] ?? 0;
                const value = isBigEndian ? (b1 << 8) | b2 : b1 | (b2 << 8);

                temporaryBuffer[y * destinationW + x] = value;
                if (value > 0) {
                    if (value < min) min = value;
                    if (value > max) max = value;
                }
            }
        }
    }

    if (max === 0) max = 255;
    if (min > max) min = 0;
    const range = max - min || 1;

    for (const [index, value] of temporaryBuffer.entries()) {
        let gray = 0;
        if (value > 0) gray = Math.floor(((value - min) / range) * 255);

        const tIndex = index * 4;
        data[tIndex] = gray;
        data[tIndex + 1] = gray;
        data[tIndex + 2] = gray;
        data[tIndex + 3] = 255;
    }

    context.putImageData(imgData, 0, 0);
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

function renderFloat32Mono(
    context: CanvasRenderingContext2D,
    bytes: Uint8Array,
    sourceW: number,
    sourceH: number,
    destinationW: number,
    destinationH: number,
): void {
    const imgData = context.createImageData(destinationW, destinationH);
    const data = imgData.data;
    const strideX = sourceW / destinationW;
    const strideY = sourceH / destinationH;

    // Create Float32 view of the data
    let floatData: Float32Array;
    if (bytes.byteOffset % 4 === 0) {
        floatData = new Float32Array(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength / 4,
        );
    } else {
        const alignedBuffer = new Uint8Array(bytes);
        floatData = new Float32Array(
            alignedBuffer.buffer,
            alignedBuffer.byteOffset,
            alignedBuffer.byteLength / 4,
        );
    }
    const floatLength = floatData.length;

    // Find min/max for scaling
    let min = Infinity;
    let max = -Infinity;
    for (let index = 0; index < floatLength; index++) {
        const value = floatData[index];
        if (
            value !== undefined &&
            !Number.isNaN(value) &&
            Number.isFinite(value)
        ) {
            if (value < min) min = value;
            if (value > max) max = value;
        }
    }

    if (max === min) {
        max = min + 1; // Avoid division by zero
    }
    const range = max - min;

    for (let y = 0; y < destinationH; y++) {
        for (let x = 0; x < destinationW; x++) {
            const sourceX = Math.floor(x * strideX);
            const sourceY = Math.floor(y * strideY);
            const sourceIndex = sourceY * sourceW + sourceX;
            const destinationIndex = (y * destinationW + x) * 4;

            if (sourceIndex < floatLength) {
                const value = floatData[sourceIndex];
                let gray = 0;
                if (
                    value !== undefined &&
                    !Number.isNaN(value) &&
                    Number.isFinite(value)
                ) {
                    gray = Math.floor(((value - min) / range) * 255);
                }

                data[destinationIndex] = gray;
                data[destinationIndex + 1] = gray;
                data[destinationIndex + 2] = gray;
                data[destinationIndex + 3] = 255;
            }
        }
    }
    context.putImageData(imgData, 0, 0);
}

function renderFloat32Color(
    context: CanvasRenderingContext2D,
    bytes: Uint8Array,
    sourceW: number,
    sourceH: number,
    destinationW: number,
    destinationH: number,
): void {
    const imgData = context.createImageData(destinationW, destinationH);
    const data = imgData.data;
    const strideX = sourceW / destinationW;
    const strideY = sourceH / destinationH;

    // Create Float32 view of the data
    // Ensure 4-byte alignment by copying if necessary
    let floatData: Float32Array;
    if (bytes.byteOffset % 4 === 0) {
        floatData = new Float32Array(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength / 4,
        );
    } else {
        const alignedBuffer = new Uint8Array(bytes);
        floatData = new Float32Array(
            alignedBuffer.buffer,
            alignedBuffer.byteOffset,
            alignedBuffer.byteLength / 4,
        );
    }
    const floatLength = floatData.length;

    for (let y = 0; y < destinationH; y++) {
        for (let x = 0; x < destinationW; x++) {
            const sourceX = Math.floor(x * strideX);
            const sourceY = Math.floor(y * strideY);
            const sourceIndex = (sourceY * sourceW + sourceX) * 3;
            const destinationIndex = (y * destinationW + x) * 4;

            if (sourceIndex + 2 < floatLength) {
                // Assume 0.0 - 1.0 range for float colors
                // Clamp and scale to 0-255
                const v1 = floatData[sourceIndex] ?? 0;
                const v2 = floatData[sourceIndex + 1] ?? 0;
                const v3 = floatData[sourceIndex + 2] ?? 0;

                const r = Math.max(0, Math.min(1, v1)) * 255;
                const g = Math.max(0, Math.min(1, v2)) * 255;
                const b = Math.max(0, Math.min(1, v3)) * 255;

                data[destinationIndex] = r;
                data[destinationIndex + 1] = g;
                data[destinationIndex + 2] = b;
                data[destinationIndex + 3] = 255; // Alpha
            }
        }
    }
    context.putImageData(imgData, 0, 0);
}
