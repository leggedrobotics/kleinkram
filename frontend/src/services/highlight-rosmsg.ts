/**
 * Minimal highlighter for ROS message definitions, for read-only previews.
 *
 * A `.msg` file is line oriented: a field is `type name`, a constant is
 * `type NAME=value`, and a recording concatenates the definitions of every
 * nested type behind `===` separator lines and a `MSG: pkg/Type` header. That
 * is regular enough for one pattern per line, with no parser and no dependency.
 */

const BUILTIN_TYPES = new Set([
    'bool',
    'byte',
    'char',
    'float32',
    'float64',
    'int8',
    'uint8',
    'int16',
    'uint16',
    'int32',
    'uint32',
    'int64',
    'uint64',
    'string',
    'wstring',
    'time',
    'duration',
]);

/** `type[array] name rest`; the type may carry a bound such as `string<=10`. */
const FIELD =
    /^(?<indent>\s*)(?<type>[A-Za-z][\w/]*(?:<=\d+)?)(?<array>\[[^\]]*\])?(?<gap>\s+)(?<name>[A-Za-z_]\w*)(?<rest>.*)$/;

const SEPARATOR = /^\s*={3,}\s*$/;
const HEADER = /^(?<indent>\s*)MSG:(?<gap>\s*)(?<type>\S+)(?<rest>.*)$/;
const NUMBER = /^[+-]?(?:\d+\.?\d*(?:[eE][+-]?\d+)?|0[xX][\da-fA-F]+)$/;

const escapeHtml = (value: string): string =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');

const wrap = (cls: string, text: string): string =>
    text === '' ? '' : `<span class="${cls}">${escapeHtml(text)}</span>`;

/** A constant's or a default's value: numbers and booleans, else a string. */
function highlightValue(text: string): string {
    const lead = /^\s*=?\s*/.exec(text)?.[0] ?? '';
    const value = text.slice(lead.length);
    const trimmed = value.trimEnd();
    const kind =
        NUMBER.test(trimmed) || trimmed === 'true' || trimmed === 'false'
            ? 'tok-number'
            : 'tok-string';
    return (
        escapeHtml(lead) +
        wrap(kind, trimmed) +
        escapeHtml(value.slice(trimmed.length))
    );
}

/** One `type name [value] [# comment]` line, already split by `FIELD`. */
function highlightField(
    indent: string,
    type: string,
    array: string,
    gap: string,
    name: string,
    tail: string,
): string {
    // A string constant runs to the end of the line, `#` included, so only
    // the other types can carry a trailing comment after a value.
    const isStringConstant =
        type.startsWith('string') && tail.trimStart().startsWith('=');
    const hash = isStringConstant ? -1 : tail.indexOf('#');
    const value = hash === -1 ? tail : tail.slice(0, hash);
    const comment = hash === -1 ? '' : tail.slice(hash);
    const isBuiltin = BUILTIN_TYPES.has(type.split('<')[0] ?? '');

    return (
        escapeHtml(indent) +
        wrap(isBuiltin ? 'tok-keyword' : 'tok-builtin', type) +
        wrap('tok-number', array) +
        escapeHtml(gap + name) +
        (value.trim() === '' ? escapeHtml(value) : highlightValue(value)) +
        wrap('tok-comment', comment)
    );
}

function highlightLine(line: string): string {
    if (SEPARATOR.test(line)) return wrap('tok-comment', line);

    const header = HEADER.exec(line);
    if (header) {
        const [, indent = '', gap = '', type = '', rest = ''] = header;
        return (
            escapeHtml(indent) +
            wrap('tok-keyword', 'MSG:') +
            escapeHtml(gap) +
            wrap('tok-def', type) +
            escapeHtml(rest)
        );
    }

    const field = FIELD.exec(line);
    if (field) {
        const [
            ,
            indent = '',
            type = '',
            array = '',
            gap = '',
            name = '',
            tail = '',
        ] = field;
        return highlightField(indent, type, array, gap, name, tail);
    }

    const hash = line.indexOf('#');
    return hash === -1
        ? escapeHtml(line)
        : escapeHtml(line.slice(0, hash)) +
              wrap('tok-comment', line.slice(hash));
}

/** Schema encodings whose text is a ROS message definition. */
export const isRosMessageEncoding = (encoding: string): boolean =>
    encoding === 'ros1msg' || encoding === 'ros2msg';

/**
 * Returns HTML with token spans. The input is HTML-escaped throughout, so the
 * result is safe to render with `v-html`.
 */
export function highlightRosMessage(source: string): string {
    return source
        .split('\n')
        .map((line) => highlightLine(line))
        .join('\n');
}

/** Escapes a definition in an encoding this file has no grammar for. */
export const escapeDefinition = escapeHtml;
