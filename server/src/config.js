// Central, typed-ish access to configuration. Everything here is NON-SECRET.
// In Azure this all comes from App Service Application Settings.
// The one secret path (dev SP client secret) is handled separately in
// dataverse/credential.js and is never read through this module.
import 'dotenv/config';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required config: ${name}`);
  }
  return value;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  allowedOrigin: required('ALLOWED_ORIGIN', 'http://localhost:5173'),

  staff: {
    tenantId: required('STAFF_TENANT_ID'),
    apiAppIdUri: required('STAFF_API_APP_ID_URI'),
    issuer: (tenantId) => `https://login.microsoftonline.com/${tenantId}/v2.0`,
  },

  customer: {
    tenantName: required('CUSTOMER_TENANT_NAME'),
    tenantId: required('CUSTOMER_TENANT_ID'),
    apiAppIdUri: required('CUSTOMER_API_APP_ID_URI'),
  },

  dataverse: {
    envUrl: required('DATAVERSE_ENV_URL'),
    apiVersion: process.env.DATAVERSE_API_VERSION ?? 'v9.2',
  },

  keyVault: {
    name: process.env.KEYVAULT_NAME,
  },

  devServicePrincipal: {
    clientId: process.env.DEV_SP_CLIENT_ID,
    tenantId: process.env.DEV_TENANT_ID,
  },

  acs: {
    endpoint: process.env.ACS_ENDPOINT,
    senderAddress: process.env.ACS_SENDER_ADDRESS,
  },

  appInsightsConnectionString: process.env.APPINSIGHTS_CONNECTION_STRING,
};
