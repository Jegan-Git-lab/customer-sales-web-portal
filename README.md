# Contoso Insurance Portal

A D365/Dataverse-backed portal for two personas — internal Sales/EDM staff
and self-service end customers — served from a single React codebase and a
single Node.js API layer.

```
browser (React SPA) --HTTPS+JWT--> Node.js API --Managed Identity--> Dataverse Web API
                                        |--Managed Identity--> Azure Communication Services (campaign email)
                                        |--Key Vault (local dev only)
                                        |--Application Insights
```

## Repository layout

```
client/   React SPA (Vite) — staff & customer workspaces, role-based routing
server/   Node.js/Express API — owns all Dataverse calls, JWT validation, RBAC
.github/workflows/deploy.yml   CI/CD to Static Web Apps + App Service
```

This is a working scaffold: routes, middleware, auth, retry/429 handling,
and the ACS email integration are real, runnable code. The Dataverse client
calls a real Dataverse environment once you configure `.env` — there is no
mock/in-memory Dataverse here, so you'll need an actual environment (or a
sandbox) to see live data.

## Personas at a glance

| Persona | Sign-in | Front end | Key API routes |
|---|---|---|---|
| Admin / Staff | Entra ID | Sales workspace, EDM workspace | `/api/opportunities`, `/api/leads`, `/api/activities`, `/api/segments`, `/api/campaigns` |
| End Customer | Entra External ID (CIAM) | Self-service profile & tickets | `/api/profile`, `/api/tickets` |

Both personas hit the **same API**, which validates JWTs from either tenant
(`server/src/auth/verifyToken.js`) and enforces role (staff) or ownership
(customer) on every request (`server/src/auth/middleware.js`).

## Getting started (local dev)

### Prerequisites
- Node.js 18+
- An Azure subscription with a Dataverse environment, two Entra app
  registrations (staff tenant + external tenant) exposing a custom API
  scope, and an Azure Key Vault (for the local-dev Dataverse credential —
  see below)
- Azure CLI, logged in (`az login`) as an identity with Key Vault "Get
  Secret" access

### 1. Server

```bash
cd server
cp .env.example .env      # fill in tenant IDs, Dataverse URL, Key Vault name, etc.
npm install
npm run dev                # http://localhost:4000
```

### 2. Client

```bash
cd client
cp .env.example .env      # fill in the two app registrations' client IDs/scopes
npm install
npm run dev                # http://localhost:5173, proxies /api to :4000
```

Open http://localhost:5173, choose "Sign in as Staff" or "Sign in as
Customer" — each goes through its own Entra tenant.

## Identity & Managed Identity

- **Staff** sign in against Entra ID; their JWT must carry a `Staff` app
  role, checked in `requireStaff` middleware.
- **Customers** sign in against Entra External ID; the API resolves their
  Dataverse `contact` record from the token's `oid` claim
  (`getContactByExternalId`) and binds it to every subsequent query —
  a customer can never see another customer's records, and out-of-scope
  requests return **404, not 403**, so record existence isn't leaked.
- **API → Dataverse**: in Azure (App Service/Container Apps), the API uses
  its **System-Assigned Managed Identity** via `DefaultAzureCredential` —
  no secret anywhere. That identity must be registered in Dataverse as an
  **Application User** with a least-privilege custom security role (not
  System Administrator).
- **Local dev fallback**: Managed Identity doesn't exist on a laptop, so
  the API falls back to a service-principal + client-secret credential —
  but the secret itself is **fetched from Key Vault at process start, into
  memory only**, using the developer's own `az login` session. It is never
  written to `.env`, never committed, and rotates centrally in Key Vault
  without touching any laptop. See `server/src/dataverse/credential.js`.

## Azure services

| Service | Used for |
|---|---|
| Key Vault | The one residual secret (dev SP client secret) — nothing else |
| Application Insights | API (`applicationinsights` SDK, auto dependency tracking) + front end (`@microsoft/applicationinsights-web`), correlated via the same connection string/workspace |
| Azure Communication Services | Campaign email send (see justification below) |
| App Service | Hosts the Node API, System-Assigned Managed Identity enabled |
| Static Web Apps | Hosts the React build, CDN + SPA fallback routing |

### Why Azure Communication Services for campaign email (not Graph or CI-Journeys)

- **Customer Insights – Journeys**: built for marketer-authored journeys in
  its own UI; heavyweight and licensed separately for a "filter → template →
  send" flow driven entirely from a custom portal.
- **Graph `sendMail`**: sends as a mailbox user, subject to per-mailbox
  throttling, no built-in delivery/bounce analytics — not built for bulk.
- **ACS Email (chosen)**: built for transactional/bulk send at scale,
  authenticates via the same Managed Identity as Dataverse, and its
  delivery/bounce events can be wired to Event Grid to update send status
  in Dataverse. See `server/src/services/acsEmail.js` and
  `server/src/routes/campaigns.js`.

## Dataverse service-protection (429) handling

Dataverse enforces per-user/app request-rate and concurrency limits. The
API handles this at the one place all Dataverse calls funnel through
(`server/src/dataverse/client.js`):

- **Retry with backoff**, honoring the `Retry-After` header
  (`server/src/utils/retry.js`)
- **Concurrency capping** via `p-limit`, so the API itself never issues
  more than 15 simultaneous Dataverse calls (`server/src/utils/concurrency.js`)
- A separate, coarser Express rate limiter (`express-rate-limit`) protects
  the API's own edge from abusive traffic before it ever reaches Dataverse
- Every 429 is logged as a named Application Insights custom metric
  (`Dataverse429`) for capacity alerting

## Hosting & deployment

- **Client**: Azure Static Web Apps. `staticwebapp.config.json` handles SPA
  fallback routing. Build output is `client/dist`.
- **API**: Azure App Service (Linux, Node 20), System-Assigned Managed
  Identity enabled in the portal (or via Bicep/ARM/Terraform — not included
  here, add per your IaC standard).
- **CORS**: the API only allows the deployed Static Web App origin
  (`ALLOWED_ORIGIN` in `server/.env` / App Service Application Settings) —
  no wildcards.
- **Environment configuration**: in Azure, all non-secret config becomes
  App Service Application Settings (not a deployed `.env` file); anything
  that must stay secret uses a Key Vault reference
  (`@Microsoft.KeyVault(...)`) in that same settings blade.
- **CI/CD**: `.github/workflows/deploy.yml` deploys the client to Static
  Web Apps and the API to App Service. Prefer OIDC/federated credentials
  for the deploy identity over a stored publish profile or client secret.

## Security checklist

- [x] Two-issuer JWT validation (signature, issuer, audience all checked)
- [x] Server-side role/ownership enforcement on every route — client
      routing is UX only
- [x] 404 (not 403) on a customer's out-of-scope record access
- [x] Managed Identity in Azure; SP + Key Vault only for local dev; secret
      never in code or a committed `.env`
- [x] Least-privilege Dataverse security role on the Application User
- [x] 429 backoff + concurrency limiting in the API layer
- [x] Application Insights across both tiers, correlated trace IDs
- [x] Locked-down CORS, HTTPS-only, no wildcard origins

## What's stubbed / left for you

- Ticket attachment upload isn't wired to Dataverse `annotations` yet —
  the form field is present in `NewTicket.jsx` as a placeholder.
- Table/entity/field logical names (`contoso_*` custom fields, `incidents`
  for cases, etc.) are illustrative — swap in your actual Dataverse schema.
- No IaC (Bicep/Terraform) included for provisioning the Azure resources
  themselves — add per your organization's standard.
- Event Grid webhook consuming ACS delivery/bounce callbacks isn't
  included; `campaigns.js` currently logs "Sent" immediately as a
  placeholder for that async status.
