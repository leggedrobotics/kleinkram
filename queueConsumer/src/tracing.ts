import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { Resource } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { context, Exception, trace } from '@opentelemetry/api';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { QUEUE_CONSUMER_LABEL } from './logger';

// Export the tracing
const contextManager = new AsyncHooksContextManager().enable();
context.setGlobalContextManager(contextManager);

// Initialize provider and identify this particular service
// (in this case, we're implementing a federated gateway)
const provider = new NodeTracerProvider({
    resource: Resource.default().merge(
        new Resource({
            // Replace with any string to identify this service in your system
            'service.name': QUEUE_CONSUMER_LABEL,
            job: QUEUE_CONSUMER_LABEL,
        }),
    ),
});

const exporter = new OTLPTraceExporter({
    url: 'http://tempo:4318/v1/traces',
    concurrencyLimit: 10, // an optional limit on pending requests
});

// Configure how spans are processed and exported. In this case we're sending spans
// as we receive them to the console
provider.addSpanProcessor(
    new BatchSpanProcessor(exporter, {
        maxQueueSize: 1000,
        scheduledDelayMillis: 1000,
    }),
);

// Register the provider
provider.register();

const sdk = new NodeSDK({
    traceExporter: exporter,
    instrumentations: [
        new NestInstrumentation(),
        new ExpressInstrumentation(),
        new FetchInstrumentation(),
        new WinstonInstrumentation(),
        new PgInstrumentation(),
    ],
});

// initialize the SDK and register with the OpenTelemetry API
// this enables the API to record telemetry
sdk.start();

// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
    sdk.shutdown()
        .then(() => console.log('Tracing terminated'))
        .catch((error) => console.log('Error terminating tracing', error))
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
        fn: (..._: T) => U,
        fnName?: string,
    ): ((...__: T) => U) =>
    (...args: T): U =>
        tracer.startActiveSpan(fnName || fn.name || 'traceWrapper', (span) => {
            let result: U | Promise<any>;

            // capture some metadata about the function call
            args.forEach((arg: any) => {
                // check if arg is of type Job or QueueEntity and add metadata
                if (arg?.constructor?.name === 'Job' && !!arg?.id) {
                    span.setAttribute('queue_processor_job_id', arg?.id);
                } else if (
                    arg?.constructor?.name === 'QueueEntity' &&
                    !!arg?.uuid
                ) {
                    span.setAttribute('queue_uuid', arg?.uuid);
                }
            });

            try {
                result = fn(...args);

                // if the result is a promise, we need to catch any
                // exceptions and record them before ending the span
                if (result instanceof Promise)
                    result
                        .catch((e) => {
                            span.recordException(e);
                            span.setAttribute('error', true);
                        })
                        .finally(() => span.end());
            } catch (e) {
                span.recordException(e as Exception);
                span.setAttribute('error', true);
                throw e;
            } finally {
                if (!(result instanceof Promise)) span.end();
            }

            return result;
        });

/**
 *
 * A decorator to wrap a method with the traceWrapper function.
 *
 * based on https://stackoverflow.com/questions/76342240/methoddecorator-classdecorator-types-have-no-intersection-why-is-it-still-a-u
 *
 */
export function tracing<A extends unknown[], C>(
    trace_name: string = undefined,
):
    | (MethodDecorator & ClassDecorator)
    | ((
          target: Record<string | symbol, any>,
          propertyKey?: string | symbol,
          descriptor?: TypedPropertyDescriptor<(...args: A) => C>,
      ) => void) {
    return function (
        target: new (...args: A) => C,
        propertyKey?: string | symbol,
        descriptor?: TypedPropertyDescriptor<(...args: A) => C>,
    ):
        | void
        | (new (...args: A) => C)
        | TypedPropertyDescriptor<(...args: A) => C> {
        const applyWrap = (
            methodName: string | symbol,
            originalMethod: (...args: A) => C,
        ): ((...args: A) => C) => {
            return function (...args: A): C {
                return traceWrapper(
                    originalMethod.bind(this),
                    trace_name,
                )(...args) as C;
            };
        };

        if (typeof propertyKey === 'undefined') {
            // Decorator is applied to all methods of a class
            Reflect.ownKeys(target.prototype).forEach(
                (methodName: string | symbol): void => {
                    const originalMethod: (...args: A) => C =
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
            const originalMethod: (...args: A) => C = descriptor.value;
            if (typeof originalMethod === 'function') {
                descriptor.value = applyWrap(propertyKey, originalMethod);
            }
            return descriptor;
        }
        return;
    };
}
