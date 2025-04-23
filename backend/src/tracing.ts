import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
    BatchSpanProcessor,
    ParentBasedSampler,
    TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import logger from './logger';

const exporter = new OTLPTraceExporter({
    url: 'http://tempo:4318/v1/traces',
    concurrencyLimit: 10, // an optional limit on pending requests
    timeoutMillis: 10_000,
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

    metricReader: new PrometheusExporter({
        prefix: 'backend_trace_',
    }),
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
            logger.error('Error terminating tracing', error),
        )
        .finally(() => process.exit(0));
});

export default sdk;
