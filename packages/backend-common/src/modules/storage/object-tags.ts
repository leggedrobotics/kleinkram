/**
 * S3 tag values may only contain letters, digits, spaces and `_ . : / = + - @`
 * (up to 256 characters); anything else makes `PutObjectTagging` fail. File
 * names from before the naming rules may contain `(`, `)`, `[` or `]`,
 * so the tag gets a sanitized copy. The tags are informational only,
 * the database keeps the real name.
 */
const DISALLOWED_TAG_CHARACTERS = /[^\p{L}\p{Z}\p{N}_.:/=+\-@]/gu;
const MAX_TAG_VALUE_LENGTH = 256;

export const toObjectTagValue = (value: string): string =>
    value
        .replaceAll(DISALLOWED_TAG_CHARACTERS, '_')
        .slice(0, MAX_TAG_VALUE_LENGTH);
