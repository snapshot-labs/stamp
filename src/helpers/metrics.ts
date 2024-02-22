import init, { client } from '@snapshot-labs/snapshot-metrics';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { Express } from 'express';
import constants from '../constants.json';

const TYPE_CONSTRAINTS = Object.keys(constants.resolvers).join('|');

export default function initMetrics(app: Express) {
  init(app, {
    normalizedPath: [
      [`^/clear/(${TYPE_CONSTRAINTS})/.+`, '/clear/$1/#id'],
      [`^/(${TYPE_CONSTRAINTS})/.+`, '/$1/#id']
    ],
    whitelistedPath: [
      /^\/$/,
      new RegExp(`^/clear/(${TYPE_CONSTRAINTS})/.+$`),
      new RegExp(`^/(${TYPE_CONSTRAINTS})/.+$`)
    ],
    errorHandler: (e: any) => capture(e)
  });
}

export const timeAddressResolverResponse = new client.Histogram({
  name: 'address_resolver_response_duration_seconds',
  help: "Duration in seconds of each address resolver's response.",
  labelNames: ['provider', 'method', 'status']
});

export const timeImageResolverResponse = new client.Histogram({
  name: 'image_resolver_response_duration_seconds',
  help: "Duration in seconds of each image resolver's response.",
  labelNames: ['provider', 'status']
});

export const addressResolversCacheHitCount = new client.Counter({
  name: 'address_resolvers_cache_hit_count',
  help: 'Number of hit/miss of the address resolvers cache layer',
  labelNames: ['status']
});
