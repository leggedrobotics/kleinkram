export function formatDate(date: Date, accurate = false) {
    const year = date.getFullYear().toString();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // getMonth() is zero-based
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    if (accurate) {
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

export function parseDate(date: string) {
    const [dayMonthYear, time] = date.split(' ');
    if (dayMonthYear === undefined || time === undefined)
        throw new Error('Invalid date format');
    const [day, month, year] = dayMonthYear.split('.');
    const [hours, minutes] = time.split(':');
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return new Date(`${year}-${month}-${day}T${hours}:${minutes}`);
}

export const dateMask = 'DD.MM.YYYY HH:mm';

export function formatDuration(seconds: number): string {
    // Handle edge cases: NaN, Infinity, or negative values
    if (!Number.isFinite(seconds) || seconds < 0) {
        seconds = 0;
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours.toString()}h ${minutes.toString()}m`;
    }
    if (minutes > 0) {
        return `${minutes.toString()}m ${secs.toString()}s`;
    }
    return `${secs.toString()}s`;
}

export function isExpired(date: Date | string | null | undefined): boolean {
    if (!date) {
        return false;
    }
    return new Date(date) < new Date();
}
