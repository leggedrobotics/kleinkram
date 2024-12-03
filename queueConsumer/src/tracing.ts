import {
    BatchSpanProcessor,
    ParentBasedSampler,
    TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { Exception, trace } from '@opentelemetry/api';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import logger from './logger';

const exporter = new OTLPTraceExporter({
    url: 'http://tempo:4318/v1/traces',
    concurrencyLimit: 10, // an optional limit on pending requests
    timeoutMillis: 500,
});

const sdk = new NodeSDK({
    traceExporter: exporter,
    spanProcessors: [
        new BatchSpanProcessor(exporter, {
            exportTimeoutMillis: 20_000,
            maxQueueSize: 512,
            scheduledDelayMillis: 5000,
            maxExportBatchSize: 512,
        }),
    ],
    serviceName: 'backend',
    sampler: new ParentBasedSampler({
        // here you can adjust the sampling rate (currently 100%)
        root: new TraceIdRatioBasedSampler(1),
    }),
    autoDetectResources: true,
    instrumentations: [
        new NestInstrumentation(),
        new ExpressInstrumentation(),
        new HttpInstrumentation(),
        new FetchInstrumentation(),
        new WinstonInstrumentation(),
        new PgInstrumentation(),
    ],
});

// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
    sdk.shutdown()
        .then(() => logger.debug('Tracing terminated'))
        .catch((error: unknown) =>
            logger.debug('Error terminating tracing', error),
        )
        .finally(() => process.exit(0));
});

export default sdk;

const tracer = trace.getTracer('graphQL-backend');

/**
 *
 * A generic, typed wrapper for tracing functions using OpenTelemetry.
 *
 * @param fn - The function to be traced.
 * @param fnName - The name of the function to be traced.
 *
 * @returns The wrapped function result.
 *
 */
export const traceWrapper =
    <T extends unknown[], U>(
        function_: (..._: T) => U,
        functionName?: string,
    ): ((...__: T) => U) =>
    (...arguments_: T): U =>
        tracer.startActiveSpan(
            functionName || function_.name || 'traceWrapper',
            (span) => {
                let result: U | Promise<any>;

                // capture some metadata about the function call
                arguments_.forEach((argument: any) => {
                    // check if arg is of type Job or QueueEntity and add metadata
                    if (
                        argument?.constructor?.name === 'Job' &&
                        !!argument?.id
                    ) {
                        span.setAttribute(
                            'queue_processor_job_id',
                            argument?.id,
                        );
                    } else if (
                        argument?.constructor?.name === 'QueueEntity' &&
                        !!argument?.uuid
                    ) {
                        span.setAttribute('queue_uuid', argument?.uuid);
                    }
                });

                try {
                    result = function_(...arguments_);

                    // if the result is a promise, we need to catch any
                    // exceptions and record them before ending the span
                    if (result instanceof Promise)
                        result
                            .catch((error: unknown) => {
                                span.recordException(error as Exception);
                                span.setAttribute('error', true);
                            })
                            .finally(() => {
                                span.end();
                            });
                } catch (error) {
                    span.recordException(error as Exception);
                    span.setAttribute('error', true);
                    throw error;
                } finally {
                    // @ts-ignore
                    if (!(result instanceof Promise)) span.end();
                }

                return result;
            },
        );

/**
 *
 * A decorator to wrap a method with the traceWrapper function.
 *
 * based on https://stackoverflow.com/questions/76342240/methoddecorator-classdecorator-types-have-no-intersection-why-is-it-still-a-u
 *
 */

export function tracing<A extends unknown[], C>(
    traceName = '',
):
    | (MethodDecorator & ClassDecorator)
    | ((
          target: Record<string | symbol, any>,
          propertyKey?: string | symbol,
          descriptor?: TypedPropertyDescriptor<(...arguments_: A) => C>,
      ) => void) {
    // @ts-ignore
    return function (
        target: new (...arguments_: A) => C,
        propertyKey?: string | symbol,
        descriptor?: TypedPropertyDescriptor<(...arguments_: A) => C>,
    ): // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    | void
        | (new (...arguments_: A) => C)
        | TypedPropertyDescriptor<(...arguments_: A) => C> {
        const applyWrap = (
            methodName: string | symbol,
            originalMethod: (...arguments_: A) => C,
        ): ((...arguments_: A) => C) => {
            return function (...arguments_: A): C {
                return traceWrapper(
                    // @ts-ignore
                    originalMethod.bind(this),
                    traceName,
                )(...arguments_) as C;
            };
        };

        if (propertyKey === undefined) {
            // Decorator is applied to all methods of a class
            Reflect.ownKeys(target.prototype).forEach(
                (methodName: string | symbol): void => {
                    const originalMethod: (...arguments_: A) => C =
                        target.prototype[methodName];
                    if (typeof originalMethod === 'function') {
                        target.prototype[methodName] = applyWrap(
                            methodName,
                            originalMethod,
                        );
                    }
                },
            );
            return target;
        } else if (descriptor) {
            // Decorator is applied to a method
            // @ts-ignore
            const originalMethod: (...arguments_: A) => C = descriptor.value;
            if (typeof originalMethod === 'function') {
                descriptor.value = applyWrap(propertyKey, originalMethod);
            }
            return descriptor;
        }
        return;
    };
}
