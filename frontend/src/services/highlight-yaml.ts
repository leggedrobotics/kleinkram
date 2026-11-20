/**
 * Minimal YAML highlighter for read-only previews.
 *
 * Not a parser. Metadata records and attachments carry block-style YAML that a
 * tool wrote (rosbag2's `serialized_metadata`, calibration files), which is one
 * `key: value` or `- item` per line. One pattern per line covers that; flow
 * collections and multi-line scalars are shown uncoloured rather than wrong.
 */

/** `indent`, any `- ` list markers, then `key:` followed by a space or the end. */
const ENTRY =
    /^(?<indent>\s*)(?<dashes>(?:-\s+)*)(?<key>[^\s#:-][^#]*?)(?<colon>:)(?<rest>\s.*|)$/;
const ITEM = /^(?<indent>\s*)(?<dashes>(?:-\s+)+|-$)(?<rest>.*)$/;

const NUMBER =
    /^[+-]?(?:\d+\.?\d*(?:[eE][+-]?\d+)?|0x[\da-fA-F]+|\.inf|\.nan)$/;
const CONSTANT = /^(?:true|false|null|~|yes|no)$/i;
const QUOTED = /^(?:"(?:\\.|[^"\\])*"|'(?:''|[^'])*')$/;

const escapeHtml = (value: string): string =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');

const wrap = (cls: string, text: string): string =>
    text === '' ? '' : `<span class="${cls}">${escapeHtml(text)}</span>`;

/** A scalar and whatever comment follows it. */
function highlightScalar(text: string): string {
    const lead = /^\s*/.exec(text)?.[0] ?? '';
    let value = text.slice(lead.length);
    let comment = '';

    // A `#` only starts a comment after whitespace, and not inside quotes.
    if (!value.startsWith('"') && !value.startsWith("'")) {
        const hash = value.search(/(?:^|\s)#/);
        if (hash !== -1) {
            comment = value.slice(hash);
            value = value.slice(0, hash);
        }
    }

    const trimmed = value.trimEnd();
    let cls = '';
    if (NUMBER.test(trimmed)) cls = 'tok-number';
    else if (CONSTANT.test(trimmed)) cls = 'tok-builtin';
    else if (QUOTED.test(trimmed)) cls = 'tok-string';

    return (
        escapeHtml(lead) +
        (cls === '' ? escapeHtml(trimmed) : wrap(cls, trimmed)) +
        escapeHtml(value.slice(trimmed.length)) +
        wrap('tok-comment', comment)
    );
}

function highlightLine(line: string): string {
    if (/^\s*#/.test(line)) return wrap('tok-comment', line);

    const entry = ENTRY.exec(line);
    if (entry) {
        const [, indent = '', dashes = '', key = '', colon = '', rest = ''] =
            entry;
        return (
            escapeHtml(indent) +
            wrap('tok-punctuation', dashes) +
            wrap('tok-key', key) +
            wrap('tok-punctuation', colon) +
            highlightScalar(rest)
        );
    }

    const item = ITEM.exec(line);
    if (item) {
        const [, indent = '', dashes = '', rest = ''] = item;
        return (
            escapeHtml(indent) +
            wrap('tok-punctuation', dashes) +
            highlightScalar(rest)
        );
    }

    return escapeHtml(line);
}

/**
 * Whether a string reads as a block of YAML: several lines, at least one of
 * them a `key: value` entry. A single line is just a value.
 */
export function looksLikeYaml(text: string): boolean {
    const lines = text.split('\n');
    return lines.length > 1 && lines.some((line) => ENTRY.test(line));
}

/**
 * Returns HTML with token spans. The input is HTML-escaped throughout, so the
 * result is safe to render with `v-html`.
 */
export function highlightYaml(source: string): string {
    return source
        .split('\n')
        .map((line) => highlightLine(line))
        .join('\n');
}
