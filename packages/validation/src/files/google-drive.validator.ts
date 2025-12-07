/**
 * Checks if the provided URL is a valid Google Drive or Google Docs URL.
 * Strictly enforces google.com domain to prevent malicious links.
 *
 * @param url - The URL to validate.
 * @returns true if valid, false otherwise.
 */
export function isValidGoogleDriveUrl(url: string | undefined | null): boolean {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        // Allow drive.google.com and docs.google.com
        if (
            parsed.hostname !== 'drive.google.com' &&
            parsed.hostname !== 'docs.google.com' &&
            parsed.hostname !== 'www.drive.google.com' &&
            parsed.hostname !== 'www.docs.google.com'
        ) {
            return false;
        }

        // Must contain an ID pattern we recognize or be a standard file/folder path
        return extractGoogleDriveId(url) !== null;
    } catch {
        // Invalid URL format
        // Check if it's a direct ID (fallback for legacy/ID-only inputs if we want to support them,
        // but the prompt asked for separate ID validation or link validation.
        // Let's assume this validator is strictly for URLs.
        // However, the previous frontend code supported IDs.
        // Let's separate URL validation from ID validation if needed, or make this function handle IDs too?
        // The previous frontend code had: `idPattern = /^([a-zA-Z0-9_-]+)$/;`
        // Let's support that too for backward compatibility if "url" is just an ID.
        const idPattern = /^([a-zA-Z0-9_-]+)$/;
        return idPattern.test(url);
    }
}

/**
 * Extracts the file or folder ID from a Google Drive URL.
 * Also returns the ID if the input is just the ID itself.
 *
 * @param url - The URL or ID.
 * @returns The extracted ID or null if not found.
 */
export function extractGoogleDriveId(
    url: string | undefined | null,
): string | null {
    if (!url) return null;

    // Direct ID check
    const idPattern = /^([a-zA-Z0-9_-]+)$/;
    const idMatch = idPattern.exec(url);
    if (idMatch?.[1]) return idMatch[1]; // It was just an ID

    try {
        // Try parsing as URL to verify domain for security check,
        // but regex extraction is usually robust enough if we include domain in regex?
        // The user asked to "only allow links to Google drive not ot any third party service".
        // Use URL parsing for domain check first.
        const parsed = new URL(url);
        const validDomains = [
            'drive.google.com',
            'docs.google.com',
            'www.drive.google.com',
            'www.docs.google.com',
        ];
        if (!validDomains.includes(parsed.hostname)) {
            return null;
        }
    } catch {
        // Not a valid URL and not a simple ID (already checked).
        return null;
    }

    // Extraction Regexes
    // 1. /file/d/ID
    const filePattern = /\/file(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/;
    let match = filePattern.exec(url);
    if (match?.[1]) return match[1];

    // 2. /folders/ID
    const folderPattern = /\/drive(?:\/u\/\d+)?\/folders\/([a-zA-Z0-9_-]+)/;
    match = folderPattern.exec(url);
    if (match?.[1]) return match[1];

    // 3. open?id=ID or uc?id=ID
    const queryPattern = /[?&]id=([a-zA-Z0-9_-]+)/;
    match = queryPattern.exec(url);
    if (match?.[1]) return match[1];

    return null;
}
