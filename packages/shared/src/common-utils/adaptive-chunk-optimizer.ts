export class AdaptiveChunkOptimizer {
    private bandwidthEstimate = 1_000_000; // Initial estimate: 1 MB/s
    private rttEstimate = 50; // Initial estimate: 50ms
    private readonly targetDuration = 0.2; // Target request duration in seconds (200ms)
    private readonly minChunkSize = 256 * 1024; // 256 KB
    private readonly maxChunkSize = 20 * 1024 * 1024; // 20 MB
    private readonly smoothingFactor = 0.3; // EMA smoothing factor

    private isActive = false;

    /**
     * Updates network metrics based on a completed request.
     * @param bytesReceived Number of bytes received
     * @param durationMs Request duration in milliseconds
     */
    updateMetrics(bytesReceived: number, durationMs: number): void {
        if (durationMs <= 0) return;

        const durationSec = durationMs / 1000;

        // Simple bandwidth calculation: bytes / time
        // We could try to separate RTT, but for this purpose, effective throughput is enough.
        const currentBandwidth = bytesReceived / durationSec;

        // Update bandwidth estimate using Exponential Moving Average (EMA)
        this.bandwidthEstimate =
            this.bandwidthEstimate * (1 - this.smoothingFactor) +
            currentBandwidth * this.smoothingFactor;

        // Update RTT estimate (very rough, assuming small requests are dominated by RTT)
        if (bytesReceived < 1024 * 10) {
            // < 10KB
            this.rttEstimate =
                this.rttEstimate * (1 - this.smoothingFactor) +
                durationMs * this.smoothingFactor;
        }
    }

    startActivity(): void {
        if (this.isActive) return;
        this.isActive = true;
    }

    stopActivity(): void {
        if (!this.isActive) return;
        this.isActive = false;
    }

    public logStats(context: string): void {
        const bwMbps = ((this.bandwidthEstimate * 8) / 1_000_000).toFixed(2);
        const rtt = this.rttEstimate.toFixed(1);
        const optimalSizeKB = (this.getOptimalRequestSize(0) / 1024).toFixed(0);

        // eslint-disable-next-line no-console
        console.log(
            `[AdaptiveChunkOptimizer] ${context}: BW=${bwMbps} Mbps, RTT=${rtt}ms, OptimalChunk=${optimalSizeKB} KB`,
        );
    }

    /**
     * Calculates the optimal chunk size for the next request.
     * @param requestedSize The minimum size actually requested by the application
     * @returns The optimal size to fetch (>= requestedSize)
     */
    getOptimalRequestSize(requestedSize: number): number {
        // Calculate size that would take `targetDuration` to download
        const targetSize = this.bandwidthEstimate * this.targetDuration;

        // Clamp between min and max
        let optimalSize = Math.max(
            this.minChunkSize,
            Math.min(targetSize, this.maxChunkSize),
        );

        // Ensure we at least cover the requested size
        optimalSize = Math.max(optimalSize, requestedSize);

        // Align to 4KB blocks for good measure (optional)
        optimalSize = Math.ceil(optimalSize / 4096) * 4096;

        return optimalSize;
    }
}
