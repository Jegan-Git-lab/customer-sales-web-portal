import { ApplicationInsights } from '@microsoft/applicationinsights-web';

export const appInsights = new ApplicationInsights({
  config: {
    connectionString: import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING,
    enableAutoRouteTracking: true,
    // Correlates front-end traces with the API's dependency/request
    // telemetry in the same Log Analytics workspace, via distributed
    // tracing headers on fetch/XHR calls.
    enableCorsCorrelation: true,
    correlationHeaderExcludedDomains: [],
  },
});

if (import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING) {
  appInsights.loadAppInsights();
}
