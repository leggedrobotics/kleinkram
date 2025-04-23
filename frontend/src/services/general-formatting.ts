export function formatSize(value: number, base = 1000, precision = 2): string {
    return `${formatGenericNumber(value, base, precision)}B`;
}

export function formatGenericNumber(
    value: number,
    base = 1000,
    precision = 2,
): string {
    const step = base === 2 ? 1024 : 1000;
    const units = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
    let unitIndex = 0;
    while (value >= step && unitIndex < units.length) {
        value /= step;
        unitIndex++;
    }
    return `${value.toFixed(precision)} ${units[unitIndex]}`;
}
