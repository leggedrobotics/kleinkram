const inRange = (value: string, min: number, max: number): boolean => {
    if (value === '*') return true;

    // Step values (e.g. */5, 0-23/2)
    if (value.includes('/')) {
        const [base, step] = value.split('/');
        if (!step || Number.isNaN(Number(step))) return false;
        if (base !== '*' && !inRange(base, min, max)) return false;
        return true;
    }

    // List (e.g. 1,2,3)
    if (value.includes(',')) {
        return value.split(',').every((v) => inRange(v, min, max));
    }

    // Range (e.g. 1-5)
    if (value.includes('-')) {
        const parts = value.split('-');
        if (parts.length !== 2) return false;
        const [startString, endString] = parts;
        if (!/^\d+$/.test(startString) || !/^\d+$/.test(endString))
            return false;
        const start = Number(startString);
        const end = Number(endString);
        return start >= min && end <= max && start <= end;
    }

    // Simple number
    const number_ = Number(value);
    return !Number.isNaN(number_) && number_ >= min && number_ <= max;
};

export const isValidCron = (cron: string): boolean => {
    if (!cron) return false;

    // Standard cron: 5 fields separated by space
    // minute hour day(month) month day(week)

    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    // 0. Minute (0-59)
    if (!inRange(parts[0], 0, 59)) return false;

    // 1. Hour (0-23)
    if (!inRange(parts[1], 0, 23)) return false;

    // 2. Day of Month (1-31)
    if (!inRange(parts[2], 1, 31)) return false;

    // 3. Month (1-12)
    if (!inRange(parts[3], 1, 12)) return false;

    // 4. Day of Week (0-7, 0/7=Sun)
    if (!inRange(parts[4], 0, 7)) return false;

    return true;
};

const translateTime = (m: string, h: string) => {
    if (m === '*' && h === '*') return 'Every minute';
    if (m !== '*' && h === '*') return `Every hour at minute ${m}`;
    if (m !== '*' && h !== '*') {
        const pad = (v: string) => v.padStart(2, '0');
        return `At ${pad(h)}:${pad(m)}`;
    }
    return 'Every minute';
};

const translateDom = (d: string) => (d === '*' ? '' : `on day-of-month ${d}`);
const translateMonth = (m: string) => (m === '*' ? '' : `in month ${m}`);
const translateDow = (d: string) => {
    if (d === '*') return '';
    const days = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
    ];
    // Only handle simple numeric day-of-week values (0-7) here.
    // For more complex cron expressions (e.g. ranges, lists, steps),
    // fall back to a generic description to avoid incorrect or undefined output.
    if (/^[0-7]$/.test(d)) {
        return `on ${days[Number(d)]}`;
    }
    return `on day-of-week ${d}`;
};

export const cronToHuman = (cron: string): string => {
    if (!isValidCron(cron)) return 'Invalid cron expression';

    const parts = cron.trim().split(/\s+/);
    const [min, hour, dom, month, dow] = parts;

    const timeString = translateTime(min, hour);
    const domString = translateDom(dom);
    const monthString = translateMonth(month);
    const dowString = translateDow(dow);

    const partsSorted = [timeString, domString, monthString, dowString].filter(
        (s) => s !== '',
    );

    let result = partsSorted.join(' ');

    // Some common refinements
    if (dom !== '*' && dow !== '*') {
        result += ' (if both are set, it runs on either)';
    }

    return result;
};
