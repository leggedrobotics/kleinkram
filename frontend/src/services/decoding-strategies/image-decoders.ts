export const PREVIEW_WIDTH = 600;

export function renderCompressed(
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

export class ImageRenderer {
    constructor(
        private context: CanvasRenderingContext2D,
        private bytes: Uint8Array,
        private sourceW: number,
        private sourceH: number,
        private destinationW: number,
        private destinationH: number,
    ) {}

    renderAsRawColor(isBgr: boolean, channels: number): void {
        const imgData = this.context.createImageData(
            this.destinationW,
            this.destinationH,
        );
        const data = imgData.data;
        const strideX = this.sourceW / this.destinationW;
        const strideY = this.sourceH / this.destinationH;

        // Pre-calculate constants to avoid re-allocation in loop
        const rawLength = this.bytes.length;
        const rIndex = isBgr ? 2 : 0;
        const gIndex = 1;
        const bIndex = isBgr ? 0 : 2;
        const aIndex = 3;

        for (let y = 0; y < this.destinationH; y++) {
            for (let x = 0; x < this.destinationW; x++) {
                const sourceX = Math.floor(x * strideX);
                const sourceY = Math.floor(y * strideY);
                const sourceIndex =
                    (sourceY * this.sourceW + sourceX) * channels;
                const destinationIndex = (y * this.destinationW + x) * 4;

                // Bounds check protects us logic-wise
                if (sourceIndex + (channels - 1) < rawLength) {
                    data[destinationIndex] =
                        this.bytes[sourceIndex + rIndex] ?? 0; // R
                    data[destinationIndex + 1] =
                        this.bytes[sourceIndex + gIndex] ?? 0; // G
                    data[destinationIndex + 2] =
                        this.bytes[sourceIndex + bIndex] ?? 0; // B
                    data[destinationIndex + 3] =
                        channels === 4
                            ? (this.bytes[sourceIndex + aIndex] ?? 255)
                            : 255; // Alpha
                }
            }
        }
        this.context.putImageData(imgData, 0, 0);
    }

    renderAsMono8(): void {
        const imgData = this.context.createImageData(
            this.destinationW,
            this.destinationH,
        );
        const data = imgData.data;
        const strideX = this.sourceW / this.destinationW;
        const strideY = this.sourceH / this.destinationH;
        const rawLength = this.bytes.length;

        for (let y = 0; y < this.destinationH; y++) {
            for (let x = 0; x < this.destinationW; x++) {
                const sourceX = Math.floor(x * strideX);
                const sourceY = Math.floor(y * strideY);
                const sourceIndex = sourceY * this.sourceW + sourceX;
                const destinationIndex = (y * this.destinationW + x) * 4;

                if (sourceIndex < rawLength) {
                    const value = this.bytes[sourceIndex] ?? 0;
                    data[destinationIndex] = value;
                    data[destinationIndex + 1] = value;
                    data[destinationIndex + 2] = value;
                    data[destinationIndex + 3] = 255;
                }
            }
        }
        this.context.putImageData(imgData, 0, 0);
    }

    renderAsDepth(isBigEndian: boolean): void {
        const imgData = this.context.createImageData(
            this.destinationW,
            this.destinationH,
        );
        const data = imgData.data;
        const strideX = this.sourceW / this.destinationW;
        const strideY = this.sourceH / this.destinationH;
        const rawLength = this.bytes.length;

        let min = 65_535;
        let max = 0;
        const temporaryBuffer = new Uint16Array(
            this.destinationW * this.destinationH,
        );

        for (let y = 0; y < this.destinationH; y++) {
            for (let x = 0; x < this.destinationW; x++) {
                const sourceX = Math.floor(x * strideX);
                const sourceY = Math.floor(y * strideY);
                const byteIndex = (sourceY * this.sourceW + sourceX) * 2;

                if (byteIndex + 1 < rawLength) {
                    const b1 = this.bytes[byteIndex] ?? 0;
                    const b2 = this.bytes[byteIndex + 1] ?? 0;
                    const value = isBigEndian ? (b1 << 8) | b2 : b1 | (b2 << 8);

                    temporaryBuffer[y * this.destinationW + x] = value;
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

        this.context.putImageData(imgData, 0, 0);
    }

    renderAsFloat32Mono(): void {
        const imgData = this.context.createImageData(
            this.destinationW,
            this.destinationH,
        );
        const data = imgData.data;
        const strideX = this.sourceW / this.destinationW;
        const strideY = this.sourceH / this.destinationH;

        // Create Float32 view of the data
        let floatData: Float32Array;
        if (this.bytes.byteOffset % 4 === 0) {
            floatData = new Float32Array(
                this.bytes.buffer,
                this.bytes.byteOffset,
                this.bytes.byteLength / 4,
            );
        } else {
            const alignedBuffer = new Uint8Array(this.bytes);
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

        for (let y = 0; y < this.destinationH; y++) {
            for (let x = 0; x < this.destinationW; x++) {
                const sourceX = Math.floor(x * strideX);
                const sourceY = Math.floor(y * strideY);
                const sourceIndex = sourceY * this.sourceW + sourceX;
                const destinationIndex = (y * this.destinationW + x) * 4;

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
        this.context.putImageData(imgData, 0, 0);
    }

    renderAsFloat32Color(): void {
        const imgData = this.context.createImageData(
            this.destinationW,
            this.destinationH,
        );
        const data = imgData.data;
        const strideX = this.sourceW / this.destinationW;
        const strideY = this.sourceH / this.destinationH;

        // Create Float32 view of the data
        // Ensure 4-byte alignment by copying if necessary
        let floatData: Float32Array;
        if (this.bytes.byteOffset % 4 === 0) {
            floatData = new Float32Array(
                this.bytes.buffer,
                this.bytes.byteOffset,
                this.bytes.byteLength / 4,
            );
        } else {
            const alignedBuffer = new Uint8Array(this.bytes);
            floatData = new Float32Array(
                alignedBuffer.buffer,
                alignedBuffer.byteOffset,
                alignedBuffer.byteLength / 4,
            );
        }
        const floatLength = floatData.length;

        for (let y = 0; y < this.destinationH; y++) {
            for (let x = 0; x < this.destinationW; x++) {
                const sourceX = Math.floor(x * strideX);
                const sourceY = Math.floor(y * strideY);
                const sourceIndex = (sourceY * this.sourceW + sourceX) * 3;
                const destinationIndex = (y * this.destinationW + x) * 4;

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
        this.context.putImageData(imgData, 0, 0);
    }
}
