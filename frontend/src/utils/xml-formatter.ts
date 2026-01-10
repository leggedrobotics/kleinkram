/**
 * Wraps text to a specified maximum length, preserving indentation for subsequent lines.
 *
 * @param text - The text to wrap.
 * @param maxLength - The maximum length of a line.
 * @param indent - The indentation string to prepend to wrapped lines.
 * @returns The wrapped text.
 */
function wrapText(text: string, maxLength: number, indent: string): string {
    if (text.length <= maxLength) return text;

    const words = text.split(' ');
    let currentLine = '';
    const lines: string[] = [];

    for (const word of words) {
        // If adding the word exceeds max length...
        if ((currentLine + word).length > maxLength) {
            if (currentLine.length > 0) {
                lines.push(currentLine.trimEnd()); // Only trim end
            }

            // Start new line with indent
            currentLine = indent + word + ' ';
        } else {
            currentLine += word + ' ';
        }
    }
    if (currentLine.trim()) {
        lines.push(currentLine.trimEnd());
    }

    return lines.join('\n');
}

function formatTag(tag: string, maxLength: number, indent: string): string {
    // If tag is short enough, return as is
    if (tag.length + indent.length <= maxLength) return indent + tag;

    // 1. Extract tagName (and opening <)
    const match = /^<([^\s/>]+)/.exec(tag);
    if (!match) return indent + tag; // Can't parse, return as is

    const tagName = match[1];
    if (tagName === undefined) return indent + tag;

    const startPart = `<${tagName}`;
    const isSelfClosing = tag.endsWith('/>');
    const endPart = isSelfClosing ? '/>' : '>';

    // Get the rest: attributes
    // Remove <tagName and /> or >
    const attributeString = tag
        .slice(startPart.length, tag.length - endPart.length)
        .trim();

    if (!attributeString) return indent + tag;

    // Split attributes. Naive split by space respecting quotes would be best.
    // Regex to match attribute="value" or attribute='value'
    const attributeRegex = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')|([^\s=]+)/g;
    const attributes: string[] = [];
    let m;

    while ((m = attributeRegex.exec(attributeString)) !== null) {
        attributes.push(m[0]);
    }

    if (attributes.length === 0) return indent + tag;

    let formatted = indent + startPart;
    let currentLineLength = formatted.length;
    const attributeIndent = indent + '  ';

    for (const attribute of attributes) {
        if (currentLineLength + 1 + attribute.length > maxLength) {
            formatted += '\n' + attributeIndent + attribute;
            currentLineLength = attributeIndent.length + attribute.length;
        } else {
            formatted += ' ' + attribute;
            currentLineLength += 1 + attribute.length;
        }
    }

    formatted += endPart;
    return formatted;
}

/**
 * Custom XML Formatter
 *
 * A lightweight utility to format XML strings for display purposes.
 * It replaces the need for external dependencies like `xml-formatter`.
 *
 * Features:
 * - Basic indentation for nested tags.
 * - wraps long text content to improve readability.
 * - Wraps long lists of attributes to multiple lines.
 *
 * @param xml - The raw XML string to format.
 * @param _options - (Optional) Options object, currently unused but kept for compatibility.
 * @returns The formatted XML string.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function formatXml(xml: string, _options?: any): string {
    let formatted = '';
    let indentLevel = 0;
    const tab = '  ';
    const MAX_LINE_LENGTH = 120; // Target length for wrapping

    // Normalize XML string: remove whitespace between tags
    const normalized = xml.replaceAll(/>\s*</g, '><').trim();

    // Split by tags.
    // regex: split by (<[^>]+>) capturing the separators
    const tokens = normalized
        .split(/(<[^>]+>)/g)
        .filter((s) => s.trim().length > 0);

    for (const token of tokens) {
        if (token.startsWith('</')) {
            // Closing tag
            indentLevel = Math.max(0, indentLevel - 1);
            formatted += tab.repeat(indentLevel) + token + '\n';
        } else if (
            token.startsWith('<') &&
            (token.endsWith('/>') ||
                token.startsWith('<?') ||
                token.startsWith('<!'))
        ) {
            // Self-closing or special tags
            formatted +=
                formatTag(token, MAX_LINE_LENGTH, tab.repeat(indentLevel)) +
                '\n';
        } else if (token.startsWith('<')) {
            // Opening tag
            formatted +=
                formatTag(token, MAX_LINE_LENGTH, tab.repeat(indentLevel)) +
                '\n';
            indentLevel++;
        } else {
            // Content
            const currentIndent = tab.repeat(indentLevel);
            // Check if content needs wrapping.
            if (token.length + currentIndent.length > MAX_LINE_LENGTH) {
                const wrapped = wrapText(token, MAX_LINE_LENGTH, currentIndent);
                formatted += currentIndent + wrapped + '\n';
            } else {
                formatted += currentIndent + token + '\n';
            }
        }
    }

    return formatted.trim();
}
