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
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

const DAY = 24 * 60 * 60 * 1000;

const ago = (count: number, unit: string): string =>
    `${String(count)} ${unit}${count === 1 ? '' : 's'} ago`;

/**
 * How long ago a date was, in words: "today", "yesterday", "2 days ago",
 * "3 weeks ago", "2 months ago", "1 year ago"
 */
export function formatTimeAgo(date: Date | string, now = new Date()): string {
    const days = Math.floor((now.getTime() - new Date(date).getTime()) / DAY);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return ago(days, 'day');
    if (days < 60) return ago(Math.floor(days / 7), 'week');
    if (days < 365) return ago(Math.floor(days / 30), 'month');
    return ago(Math.floor(days / 365), 'year');
}
