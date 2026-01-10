export interface SearchToken {
    original: string;
    key?: string;
    value: string;
}

export interface ParsedSearch {
    tokens: SearchToken[];
    freeText: string;
}

// Matches key:value or key:"value with spaces"
// The keys are dynamic: [a-zA-Z0-9_\-&]+:
const TOKEN_REGEX = /([a-zA-Z0-9_\-&]+:)(?:"([^"]*)"?|([^\s]+))/gi;

export function parseSearchString(input: string): ParsedSearch {
    const tokens: SearchToken[] = [];
    let freeText = input;

    // Reset lastIndex
    TOKEN_REGEX.lastIndex = 0;

    let match;
    while ((match = TOKEN_REGEX.exec(input)) !== null) {
        const fullMatch = match[0];
        const keyWithColon = match[1];
        const value = match[2] ?? match[3] ?? '';

        if (keyWithColon) {
            const key = keyWithColon.slice(0, -1).toLowerCase(); // remove colon
            tokens.push({
                original: fullMatch,
                key,
                value,
            });
            // Remove from free text
            freeText = freeText.replace(fullMatch, '');
        }
    }

    // Clean up free text (remove extra spaces)
    freeText = freeText.replaceAll(/\s+/g, ' ').trim();

    return {
        tokens,
        freeText,
    };
}

export function validateSearchSyntax(
    input: string,
    validKeys?: string[],
): string | null {
    // Check for unclosed quotes
    const quoteCount = (input.match(/"/g) ?? []).length;
    if (quoteCount % 2 !== 0) {
        const isAtEnd = /(?:^|\s)[a-zA-Z0-9_-]+:"[^"]*$/.test(input);
        if (!isAtEnd) {
            return 'Unclosed quote detected.';
        }
    }

    // Check for empty values e.g. "project: "
    const emptyKeywordRegex = /([a-zA-Z0-9_\-&]+:)(\s|$)/gi;
    const emptyMatch = emptyKeywordRegex.exec(input);
    if (emptyMatch) {
        const key = emptyMatch[1]?.replace(':', '') ?? 'unknown';
        if (!validKeys || validKeys.includes(key.toLowerCase())) {
            return `Missing value for ${key}.`;
        }
    }

    return null;
}
