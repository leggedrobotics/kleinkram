import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import logger from '../../logger';

type WideLogValue = string | number | boolean | null | undefined;

export class WideLogger {
    private fields: Record<string, WideLogValue> = {};
    private start = Date.now();

    constructor(
        private eventName: string,
        initialFields: Record<string, WideLogValue> = {},
    ) {
        this.add(initialFields);
    }

    add(fields: Record<string, WideLogValue>): void {
        Object.assign(this.fields, fields);
        const span = trace.getSpan(context.active());
        if (span) {
            for (const [key, value] of Object.entries(fields)) {
                if (value !== null && value !== undefined) {
                    // Pass types directly to OTel
                    span.setAttribute(key, value);
                }
            }
        }
    }

    recordError(error: unknown): void {
        const span = trace.getSpan(context.active());

        if (error instanceof Error) {
            this.add({
                // eslint-disable-next-line @typescript-eslint/naming-convention
                error_name: error.name,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                error_message: error.message,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                error_stack: error.stack,
                outcome: 'failure',
            });
            span?.recordException(error);
            span?.setStatus({ code: SpanStatusCode.ERROR });
        } else {
            this.add({
                // eslint-disable-next-line @typescript-eslint/naming-convention
                error_message: String(error),
                outcome: 'failure',
            });
            span?.setStatus({
                code: SpanStatusCode.ERROR,
                message: String(error),
            });
        }
    }

    flush(level: 'info' | 'error' = 'info'): void {
        const durationMs = Date.now() - this.start;
        this.add({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            duration_ms: durationMs,
        });
        logger.log(level, this.eventName, this.fields);
    }
}
