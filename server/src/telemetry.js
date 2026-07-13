// Application Insights bootstrap. Must be imported FIRST, before any other
// module (including express), so auto-instrumentation can hook http/https.
import appInsights from 'applicationinsights';
import { config } from './config.js';

let client = null;

export function startTelemetry() {
  if (!config.appInsightsConnectionString) {
    console.warn('[telemetry] APPINSIGHTS_CONNECTION_STRING not set — telemetry disabled locally.');
    return null;
  }

  appInsights
    .setup(config.appInsightsConnectionString)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true) // captures outbound Dataverse / Graph / ACS calls
    .setAutoCollectConsole(true, true)
    .setSendLiveMetrics(false)
    .start();

  client = appInsights.defaultClient;
  return client;
}

// Named custom-metric helper so Dataverse 429s are queryable as their own
// signal in Log Analytics, separate from generic dependency failures.
export function trackDataverseThrottle(entitySet, retryAfterSeconds) {
  client?.trackMetric({ name: 'Dataverse429', value: retryAfterSeconds, properties: { entitySet } });
}

export function trackEvent(name, properties = {}) {
  client?.trackEvent({ name, properties });
}

export function getTelemetryClient() {
  return client;
}
