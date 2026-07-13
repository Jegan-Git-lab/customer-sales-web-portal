// Acquires an access token for Dataverse.
//
// PRODUCTION (Azure App Service / Container Apps):
//   Uses the resource's System-Assigned Managed Identity via
//   DefaultAzureCredential. No secret is ever read, stored, or configured —
//   Azure AD issues the token to the platform identity directly.
//   The Managed Identity's Object ID must be registered as a Dataverse
//   "Application User" with a least-privilege security role (see README).
//
// LOCAL DEV (developer laptop):
//   Managed Identity doesn't exist outside Azure, so we fall back to a
//   service principal + client secret. The secret is NEVER stored in
//   .env, source, or on disk — it is fetched at process start from Key
//   Vault into memory only, using the developer's own `az login` identity
//   (which must be granted Key Vault "Get Secret" access, ideally
//   time-boxed via PIM). Rotating the secret means rotating it once in
//   Key Vault; no redistribution to laptops, no risk of an accidental
//   commit.
import { DefaultAzureCredential, ClientSecretCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { config } from '../config.js';

const DATAVERSE_SECRET_NAME = 'dataverse-dev-sp-secret';

let cachedCredential = null;

async function buildLocalDevCredential() {
  if (!config.keyVault.name) {
    throw new Error(
      'KEYVAULT_NAME is not set. Local dev requires Key Vault access to fetch the dev SP secret — ' +
        'see server/.env.example and the README "Local development" section.'
    );
  }

  // Uses the developer's own Azure CLI login (`az login`) to reach Key Vault.
  // This credential is ONLY used to fetch the secret, never used against
  // Dataverse directly.
  const kvCredential = new DefaultAzureCredential();
  const secretClient = new SecretClient(
    `https://${config.keyVault.name}.vault.azure.net`,
    kvCredential
  );

  const secret = await secretClient.getSecret(DATAVERSE_SECRET_NAME);

  return new ClientSecretCredential(
    config.devServicePrincipal.tenantId,
    config.devServicePrincipal.clientId,
    secret.value
  );
}

export async function getDataverseCredential() {
  if (cachedCredential) return cachedCredential;

  cachedCredential =
    config.env === 'production'
      ? new DefaultAzureCredential() // resolves to the App Service Managed Identity in Azure
      : await buildLocalDevCredential();

  return cachedCredential;
}

export async function getDataverseAccessToken() {
  const credential = await getDataverseCredential();
  const scope = `${config.dataverse.envUrl}/.default`;
  const token = await credential.getToken(scope);
  if (!token) throw new Error('Failed to acquire Dataverse access token');
  return token.token;
}
