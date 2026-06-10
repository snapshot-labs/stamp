import 'dotenv/config';
import { initLogger } from '@snapshot-labs/snapshot-sentry';

// Since @sentry/node v8+, Sentry relies on OpenTelemetry auto-instrumentation,
// which requires initLogger() to run before any instrumented module
// (http, express, pg, ...) is imported. Keep this as the very first import
// in the entry file (src/index.ts).
initLogger();
