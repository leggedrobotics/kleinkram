export function formatSize(val: number, base = 1000): string {
    return formatGenericNumber(val) + 'B';
}

export function formatGenericNumber(val: number, base = 1000): string {
    const step = base === 2 ? 1024 : 1000;
    const units = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
    let unitIndex = 0;
    while (val >= step && unitIndex < units.length) {
        val /= step;
        unitIndex++;
    }
    return val.toFixed(2) + units[unitIndex];
}
