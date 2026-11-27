/** Severity of a line in a text log, most severe first. */
export type LogLevel = 'FATAL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

const LEVEL_ALIASES: ReadonlyMap<string, LogLevel> = new Map([
    ['FATAL', 'FATAL'],
    ['CRITICAL', 'FATAL'],
    ['CRIT', 'FATAL'],
    ['ERROR', 'ERROR'],
    ['ERR', 'ERROR'],
    ['WARNING', 'WARN'],
    ['WARN', 'WARN'],
    ['INFO', 'INFO'],
    ['NOTICE', 'INFO'],
    ['DEBUG', 'DEBUG'],
    ['TRACE', 'DEBUG'],
]);

const GLOG_LEVELS: Record<string, LogLevel> = {
    F: 'FATAL',
    E: 'ERROR',
    W: 'WARN',
    I: 'INFO',
};

/** Where loggers put the level; past this it is part of the message. */
const LEVEL_SEARCH_CHARACTERS = 120;

/**
 * An uppercase keyword standing alone (`ERROR:`, `| WARN |`, `- INFO -`),
 * or any case in brackets (`[error]`, `[Warning]`).
 */
const UPPERCASE_LEVEL =
    /(?:^|[\s[(<|:,-])(FATAL|CRITICAL|CRIT|ERROR|ERR|WARNING|WARN|INFO|NOTICE|DEBUG|TRACE)(?=[\s\]):|,>-]|$)/;
const BRACKETED_LEVEL =
    /\[\s*(fatal|critical|crit|error|err|warning|warn|info|notice|debug|trace)\s*\]/i;
/** glog / ROS C++: `E1203 12:32:55.104 ...` */
const GLOG_PREFIX = /^([FEWI])\d{4} \d{2}:\d{2}:\d{2}/;

/** The level a single line announces, if any. */
export const detectLineLevel = (line: string): LogLevel | undefined => {
    const glog = GLOG_PREFIX.exec(line);
    if (glog?.[1]) return GLOG_LEVELS[glog[1]];

    const head = line.slice(0, LEVEL_SEARCH_CHARACTERS);
    const keyword =
        UPPERCASE_LEVEL.exec(head)?.[1] ??
        BRACKETED_LEVEL.exec(head)?.[1]?.toUpperCase();
    return keyword === undefined ? undefined : LEVEL_ALIASES.get(keyword);
};

/** A line opening a new entry starts with a timestamp (`2024-12-03`, `[12:00`). */
const STARTS_WITH_TIMESTAMP = /^\[?\d{2,4}[-/.:]\d/;

/**
 * Levels for a list of lines. A line without a level of its own that does not
 * start a new entry with a timestamp, such as a traceback, belongs to the
 * entry above and takes its level, so filtering for errors keeps the traceback
 * with the error.
 */
export const detectLineLevels = (lines: string[]): (LogLevel | undefined)[] => {
    const levels: (LogLevel | undefined)[] = [];
    let previous: LogLevel | undefined;
    for (const line of lines) {
        let level = detectLineLevel(line);
        if (
            level === undefined &&
            line.trim() !== '' &&
            !STARTS_WITH_TIMESTAMP.test(line)
        )
            level = previous;
        levels.push(level);
        previous = level;
    }
    return levels;
};
