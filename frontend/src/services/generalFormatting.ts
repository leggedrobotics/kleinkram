export function formatSize(val: number): string {
    if (val < 1024) {
        return `${val} B`;
    } else if (val < 1024 * 1024) {
        return `${(val / 1024).toFixed(2)} KB`;
    } else if (val < 1024 * 1024 * 1024) {
        return `${(val / (1024 * 1024)).toFixed(2)} MB`;
    } else {
        return `${(val / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
}
