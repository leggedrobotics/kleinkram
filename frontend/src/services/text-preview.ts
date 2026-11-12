import { decodeTextSample } from '@kleinkram/shared';

/**
 * Uploads can be tens of gigabytes, so a text preview never pulls the whole
 * object: it asks for a range and stops reading at the cap even if the storage
 * backend ignores the header.
 */
const TEXT_PREVIEW_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Bytes read past the cap. Asking for more than we render is what separates
 * "the file ends here" from "the file continues" — without it, a file exactly
 * `TEXT_PREVIEW_MAX_BYTES` long looks truncated, and a CSV without a trailing
 * newline would lose its last row. The extra bytes also carry the continuation
 * of a character sitting on the boundary, so the decoder never has to guess
 * whether a trailing high byte starts a cut-off UTF-8 sequence or is latin-1.
 */
const TEXT_PREVIEW_LOOKAHEAD_BYTES = 4;

const TEXT_PREVIEW_FETCH_BYTES =
    TEXT_PREVIEW_MAX_BYTES + TEXT_PREVIEW_LOOKAHEAD_BYTES;

export interface TextPreview {
    text: string;
    truncated: boolean;
}

export async function fetchTextPreview(
    url: string,
): Promise<TextPreview | undefined> {
    const response = await fetch(url, {
        headers: { Range: `bytes=0-${String(TEXT_PREVIEW_FETCH_BYTES - 1)}` },
    });
    // 206 for an honoured range, 200 when the backend serves the whole object.
    if (!response.ok) return undefined;

    const chunks: Uint8Array[] = [];
    let received = 0;
    const reader = response.body?.getReader();

    if (reader) {
        while (received < TEXT_PREVIEW_FETCH_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
        }
        await reader.cancel();
    } else {
        const whole = new Uint8Array(await response.arrayBuffer());
        chunks.push(whole);
        received = whole.length;
    }

    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }

    // Getting no further than the cap means the response reached end of file.
    const truncated = received > TEXT_PREVIEW_MAX_BYTES;
    return {
        // Ingestion accepts latin-1 alongside UTF-8, so decode the same way it
        // validated rather than forcing UTF-8 and showing replacement chars.
        text: decodeTextSample(bytes, truncated),
        truncated,
    };
}
