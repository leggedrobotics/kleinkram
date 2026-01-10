import { Attributes, SpanKind } from '@opentelemetry/api';
import {
    ReadableSpan,
    Span,
    SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import logger from '../logger';

/**
 * WideLogSpanProcessor intercepts finished spans and logs ROOT/SERVER spans
 * as structured "Wide Events".
 */
export class WideLogSpanProcessor implements SpanProcessor {
    forceFlush(): Promise<void> {
        return Promise.resolve();
    }

    onStart(_span: Span): void {
        // No-op
    }

    shutdown(): Promise<void> {
        return Promise.resolve();
    }

    private attributeAccumulator = new Map<string, Attributes>();

    onEnd(span: ReadableSpan): void {
        const traceId = span.spanContext().traceId;
        const currentAttributes = this.attributeAccumulator.get(traceId) ?? {};

        // Accumulate attributes from ANY span in the trace.
        // This ensures identifiers set on INTERNAL spans (like NestJS controllers) are captured.
        Object.assign(currentAttributes, span.attributes);
        this.attributeAccumulator.set(traceId, currentAttributes);

        // We only log Wide Events for SERVER spans (incoming requests).
        if (span.kind !== SpanKind.SERVER) {
            return;
        }

        // De-duplication: Always log ONLY the root SERVER span.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        if ((span as any).parentSpanId) {
            return;
        }

        const accumulated =
            this.attributeAccumulator.get(traceId) ?? span.attributes;
        this.attributeAccumulator.delete(traceId);

        const method = String(
            span.attributes['http.method'] ??
                accumulated['http.method'] ??
                'UNKNOWN',
        );
        const target = String(
            span.attributes['http.target'] ??
                accumulated['http.target'] ??
                span.name,
        );
        const statusCode =
            span.attributes['http.status_code'] ??
            accumulated['http.status_code'] ??
            span.status.code;
        const normalizedTarget = this.normalizeUrl(target);

        /* eslint-disable @typescript-eslint/naming-convention */
        const wideEvent = {
            trace_id: traceId,
            span_id: span.spanContext().spanId,
            method,
            target,
            http_endpoint: target,
            normalized_target: normalizedTarget,
            status_code: statusCode,
            project_id: accumulated['project.id'],
            mission_id: accumulated['mission.id'],
            action_id: accumulated['action.id'],
            file_id: accumulated['file.id'],
            user_id: accumulated['user.id'],
            guard_enriched: accumulated['guard.enriched'],
            name: span.name,
            kind: SpanKind[span.kind],
            duration_ms: this.hrTimeToMs(span.duration),
            timestamp: new Date(this.hrTimeToMs(span.startTime)).toISOString(),
            span_status: span.status,
            accumulated_attributes: accumulated,
        };
        /* eslint-enable @typescript-eslint/naming-convention */

        // Log the wide event as a single JSON entry
        logger.info(wideEvent);
    }

    private normalizeUrl(url: string): string {
        // Remove all query parameters
        const pathOnly = url.split('?')[0];
        // Replace all UUIDs with :id in the path
        return pathOnly.replaceAll(
            /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
            ':id',
        );
    }

    private hrTimeToMs(hrTime: [number, number]): number {
        return hrTime[0] * 1000 + hrTime[1] / 1_000_000;
    }
}
