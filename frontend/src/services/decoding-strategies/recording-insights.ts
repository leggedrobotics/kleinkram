import type { RecordingCoverage, RecordingStorage } from '@kleinkram/shared';

export interface RecordingSchema {
    name: string;
    encoding: string;
    /** Undefined for binary schemas (protobuf, flatbuffer). */
    definition: string | undefined;
}

export interface RecordingAttachment {
    name: string;
    mediaType: string;
    size: number;
    logTime: bigint;
}

export interface RecordingMetadata {
    name: string;
    values: Record<string, string>;
}

/**
 * What a recording says about itself in the index the preview reads anyway.
 *
 * Everything here is available as soon as the reader is initialised. Only
 * attachment bodies and metadata records need a further read each.
 */
export interface RecordingInsights {
    profile: string;
    library: string;
    storage: RecordingStorage;
    /** Undefined when the file has no chunk index to draw coverage from. */
    coverage: RecordingCoverage | undefined;
    schemasByTopic: Record<string, RecordingSchema>;
    attachments: RecordingAttachment[];
    metadataNames: string[];
}

/** Local time of day of a moment `offsetSeconds` into the recording. */
export function clockTime(startTime: bigint, offsetSeconds: number): string {
    const date = new Date(
        Number(startTime / 1_000_000n) + Math.round(offsetSeconds * 1000),
    );
    return [date.getHours(), date.getMinutes(), date.getSeconds()]
        .map((part) => String(part).padStart(2, '0'))
        .join(':');
}

/** A span length for a label: whole seconds once it is long enough to matter. */
export function formatSpan(seconds: number): string {
    if (seconds < 10) return `${seconds.toFixed(1)} s`;
    if (seconds < 120) return `${Math.round(seconds).toString()} s`;
    return `${Math.round(seconds / 60).toString()} min`;
}
