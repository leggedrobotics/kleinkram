import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { Resource } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { context } from '@opentelemetry/api';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { TypeormInstrumentation } from 'opentelemetry-instrumentation-typeorm';

// Export the tracing
const contextManager = new AsyncHooksContextManager().enable();
context.setGlobalContextManager(contextManager);

// Initialize provider and identify this particular service
// (in this case, we're implementing a federated gateway)
const provider = new NodeTracerProvider({
  resource: Resource.default().merge(
    new Resource({
      // Replace with any string to identify this service in your system
      'service.name': 'backend',
      job: 'backend',
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
    new HttpInstrumentation(),
    new FetchInstrumentation(),
    new WinstonInstrumentation(),
    new TypeormInstrumentation(),
  ],
});

// initialize the SDK and register with the OpenTelemetry API
// this enables the API to record telemetry
sdk.start();

// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});

export default sdk;
