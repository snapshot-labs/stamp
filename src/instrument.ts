import { initLogger } from '@snapshot-labs/snapshot-sentry';

// Since @sentry/node v8+, Sentry relies on OpenTelemetry auto-instrumentation,
// which requires initLogger() to run before any instrumented module
// (http, express, pg, ...) is imported. Keep this import before express
// (and other instrumented modules) in the entry file (src/index.ts).
initLogger();
