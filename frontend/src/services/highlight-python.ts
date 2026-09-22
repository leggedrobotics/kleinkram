/**
 * Minimal Python syntax highlighter for read-only previews.
 *
 * Deliberately not a parser and not a dependency: submitted action scripts are
 * short files shown for reading, so a single left-to-right tokenizer is enough.
 *
 * The one property that matters for correctness is that comments and strings
 * are matched *before* keywords in the alternation below. That is what stops
 * `# not a def` or `"import this"` from being coloured as code, which is the
 * failure mode naive highlighters have.
 */

const KEYWORDS = new Set([
    'and',
    'as',
    'assert',
    'async',
    'await',
    'break',
    'class',
    'continue',
    'def',
    'del',
    'elif',
    'else',
    'except',
    'finally',
    'for',
    'from',
    'global',
    'if',
    'import',
    'in',
    'is',
    'lambda',
    'nonlocal',
    'not',
    'or',
    'pass',
    'raise',
    'return',
    'try',
    'while',
    'with',
    'yield',
    'match',
    'case',
]);

const CONSTANTS = new Set(['True', 'False', 'None']);

const BUILTINS = new Set([
    'abs',
    'all',
    'any',
    'bool',
    'bytes',
    'dict',
    'dir',
    'enumerate',
    'filter',
    'float',
    'format',
    'frozenset',
    'getattr',
    'hasattr',
    'int',
    'isinstance',
    'len',
    'list',
    'map',
    'max',
    'min',
    'next',
    'open',
    'print',
    'range',
    'repr',
    'reversed',
    'round',
    'self',
    'set',
    'setattr',
    'sorted',
    'str',
    'sum',
    'super',
    'tuple',
    'type',
    'zip',
]);

/**
 * Ordered alternation. Triple-quoted strings come before single-quoted ones so
 * the longer form wins, and both come before identifiers.
 */
const TOKEN = new RegExp(
    [
        String.raw`(?<comment>#[^\n]*)`,
        String.raw`(?<string>(?:[rRbBuUfF]{0,2})(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'))`,
        String.raw`(?<decorator>^[ \t]*@[\w.]+)`,
        String.raw`(?<number>\b\d(?:[eE][+-](?=\d)|[\w.])*\b)`,
        String.raw`(?<word>\b[A-Za-z_]\w*\b)`,
    ].join('|'),
    'gm',
);

const escapeHtml = (value: string): string =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');

const wrap = (cls: string, text: string): string =>
    `<span class="${cls}">${escapeHtml(text)}</span>`;

/**
 * Returns HTML with token spans. The input is HTML-escaped throughout, so the
 * result is safe to render with `v-html`.
 */
export function highlightPython(source: string): string {
    let out = '';
    let last = 0;

    // `previousWord` lets `def foo` / `class Foo` colour the declared name,
    // which is the one piece of context a flat tokenizer still needs.
    let previousWord: string | undefined;

    for (const match of source.matchAll(TOKEN)) {
        const groups = match.groups ?? {};
        const index = match.index;

        out += escapeHtml(source.slice(last, index));
        last = index + match[0].length;

        if (groups.comment !== undefined) {
            out += wrap('tok-comment', match[0]);
            continue;
        }
        if (groups.string !== undefined) {
            out += wrap('tok-string', match[0]);
            continue;
        }
        if (groups.decorator !== undefined) {
            // The match includes the leading indentation; keep it unstyled.
            const text = match[0];
            const at = text.indexOf('@');
            out +=
                escapeHtml(text.slice(0, at)) +
                wrap('tok-decorator', text.slice(at));
            continue;
        }
        if (groups.number !== undefined) {
            out += wrap('tok-number', match[0]);
            continue;
        }

        const word = match[0];
        if (previousWord === 'def' || previousWord === 'class') {
            out += wrap('tok-def', word);
        } else if (KEYWORDS.has(word) || CONSTANTS.has(word)) {
            out += wrap('tok-keyword', word);
        } else if (BUILTINS.has(word)) {
            out += wrap('tok-builtin', word);
        } else {
            out += escapeHtml(word);
        }
        previousWord = word;
    }

    out += escapeHtml(source.slice(last));
    return out;
}
