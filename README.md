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

## API contract summary

All routes are prefixed `/api` and require a bearer JWT (`authenticate`
middleware) except `/health`. "Auth" below is the additional per-route gate
on top of that.

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/health` | none | — | liveness check |
| GET | `/api/opportunities` | Staff | — | query: `stage`, `top` (≤200), `skip` |
| PATCH | `/api/opportunities/:id` | Staff | `{ stepname?, ...fields }` | `stepname` validated against allow-listed transitions, then mirrors the update into the Business Process Flow (`stageid`/`traversedpath`) |
| GET | `/api/opportunities/pipeline/summary` | Staff | — | FetchXML aggregate: value/count grouped by `stepname` |
| GET | `/api/leads` | Staff | — | query: `top` (≤200) |
| PATCH | `/api/leads/:id` | Staff | arbitrary fields | passed through to Dataverse as-is |
| POST | `/api/activities` | Staff | `{ type, regardingEntity, regardingId, subject, notes }` | `type` ∈ phonecall/email/task; `regardingEntity` ∈ lead/opportunity |
| POST | `/api/segments/preview` | Staff | `{ state?, policyType?, status? }` | returns `{ criteria, count, sample }`; fields are allow-listed |
| POST | `/api/campaigns/send` | Staff | `{ criteria, templateSubject, templateBody }` | capped at 5000 recipients; creates a campaign run + per-recipient ACS send |
| GET | `/api/campaigns/:id/status` | Staff | — | send-event counts by type for a campaign run |
| GET | `/api/tickets` | Customer or Staff | — | customer: hard-scoped server-side to own contact; staff: optional `status` filter |
| GET | `/api/tickets/:id` | Customer or Staff | — | customer gets **404** (not 403) if the ticket isn't theirs |
| POST | `/api/tickets` | Customer or Staff | `{ title, category?, description, customerId? }` | customer: `customerId` always resolved server-side, never client-supplied; staff: must supply `customerId` |
| POST | `/api/tickets/:id/comments` | Customer or Staff | `{ text }` | ownership re-checked before write |
| GET | `/api/profile` | Customer | — | own contact + linked `contoso_policies` |

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
- [x] 404 (not 403) on a customer's out-of-scope record access — see
      "Demonstrating row-level isolation" below
- [x] Managed Identity in Azure; SP + Key Vault only for local dev; secret
      never in code or a committed `.env` — see "Demonstrating Dataverse
      auth boundary" below
- [x] Least-privilege Dataverse security role on the Application User
- [x] 429 backoff + concurrency limiting in the API layer
- [x] Application Insights across both tiers, correlated trace IDs
- [x] Locked-down CORS, HTTPS-only, no wildcard origins

### Demonstrating the Dataverse auth boundary (no Dataverse creds/tokens in the browser)

**Acceptance criteria:** No Dataverse credentials or tokens in the
browser; managed-identity (or documented SP fallback) auth proven in
code.

**Enforced by construction — the browser and Dataverse never talk
directly:**
- The SPA only ever acquires tokens scoped to *this API's* App ID URI —
  `VITE_STAFF_API_SCOPE` / `VITE_CUSTOMER_API_SCOPE`
  (`client/src/authConfig.js:31-37`), via MSAL against the staff Entra ID
  tenant or the customer Entra External ID tenant. Neither scope is a
  Dataverse resource; the browser is structurally incapable of asking
  MSAL for a Dataverse-scoped token because no such scope is ever
  requested. `client/src/hooks/useApi.js:17-25` attaches only that token,
  as `Authorization: Bearer <api-token>`, to `/api/*` calls — nothing
  else leaves the browser.
- The Dataverse-scoped token is acquired **only** inside
  `server/src/dataverse/credential.js:64-70`
  (`getDataverseAccessToken`), which runs server-side and is never
  reachable from an Express route handler directly — every Dataverse call
  funnels through `dataverseClient` (`server/src/dataverse/client.js`),
  and route handlers only ever see the JSON *result* of a Dataverse call,
  never the token used to fetch it.
- **Production**: `getDataverseCredential()`
  (`credential.js:53-62`) resolves to `new DefaultAzureCredential()`,
  which on Azure App Service resolves to the System-Assigned Managed
  Identity — no secret exists anywhere in this path.
- **Local dev fallback (documented)**: `buildLocalDevCredential()`
  (`credential.js:27-51`) uses the developer's own `az login` session
  only to read one secret from Key Vault (`dataverse-dev-sp-secret`),
  into memory, at process start — never written to `.env`, never logged,
  never returned in any API response. `credential.js:35-37` comments
  this explicitly: that Key Vault credential "is ONLY used to fetch the
  secret, never used against Dataverse directly."

**To reproduce/verify:**
1. Sign in to either persona, open DevTools → Application →
   Session Storage. You'll find the MSAL token cache — decode the
   access token's JWT payload (e.g. at jwt.io) and check its `aud`
   claim: it will match `STAFF_API_APP_ID_URI` /
   `CUSTOMER_API_APP_ID_URI`, **not** the Dataverse environment URL.
   There is no Dataverse-audience token anywhere in browser storage.
2. In DevTools → Network, inspect any `/api/*` request/response pair:
   the request carries only the API-scoped bearer token; the response
   body is plain JSON data, never a token or credential.
3. Server-side, confirm `getDataverseAccessToken`/
   `getDataverseCredential` are only imported by
   `server/src/dataverse/client.js` (`grep -rn getDataverseAccessToken
   server/src`) — no route file acquires or forwards a Dataverse token
   itself.
4. For the local-dev path specifically: confirm `server/.env` has no
   `DEV_SP_CLIENT_SECRET`-style entry (only `DEV_SP_CLIENT_ID`/
   `DEV_TENANT_ID`/`KEYVAULT_NAME`) and that the secret only appears in
   Key Vault, never in the repo (`git log -p -- server/.env.example`
   never introduces a secret value).

### Demonstrating row-level isolation (customer tickets)

**Acceptance criteria:** Customer A cannot retrieve Customer B's ticket
by ID manipulation.

**Enforced by** (`server/src/routes/tickets.js`):
- `GET /api/tickets/:id` (lines 51-69) retrieves the ticket, then checks
  `ticket._customerid_value !== req.user.contactId` and returns **404**
  — never the record, never a 403 that would confirm the ID exists.
- `GET /api/tickets` (line 34) hard-filters to `_customerid_value eq
  req.user.contactId` server-side for the customer persona; any
  client-supplied filter is ignored for that persona.
- `POST /api/tickets/:id/comments` (lines 110-115) re-checks the same
  ownership before allowing a write, so ID manipulation can't be used to
  comment on someone else's case either.
- `req.user.contactId` is resolved from the caller's own verified token
  (`requireCustomerContact`, `server/src/auth/middleware.js:37-51`) via
  `getContactByExternalId` — never accepted from client input — so there
  is no parameter a caller can override to impersonate another contact.

**To reproduce:**
1. Seed two Entra External ID test accounts, each linked to a distinct
   Dataverse `contact`, each with at least one `incident` of its own.
2. Sign in as Customer A, open a ticket, note its `incidentid` (from the
   URL or the `GET /api/tickets` response).
3. Sign out, sign in as Customer B.
4. Request that same ticket — either navigate the SPA to
   `/tickets/<Customer A's ticket id>`, or call the API directly:
   ```
   curl -H "Authorization: Bearer <CustomerB_token>" \
     http://localhost:4000/api/tickets/<CustomerA_ticket_id>
   ```
5. Expect **404** `{"error":"Ticket not found"}` — not Customer A's data.
6. Control check: repeat step 4 with one of Customer B's own ticket IDs —
   expect **200** with the real ticket, confirming the 404 above is
   ownership-specific and not a blanket failure.

## Coexistence with the omnichannel case-intake design (Section A5)

Section A5 defines four case-intake channels: email-to-case, web-to-case,
a Copilot Studio/Bot Service chatbot, and unified routing tying them
together. This portal is not a competing intake path — it **is** the A5
web-to-case channel's "custom web" option, and the rest of this section
explains how it lines up with (and where it still needs to close gaps
with) the other three.

**Web-to-case — custom web vs. Power Pages.** A5 asks this to be
justified. This portal already authenticates end customers through Entra
External ID (CIAM) and resolves each caller to their own Dataverse
`contact` (`requireCustomerContact`, `server/src/auth/middleware.js`) —
the same identity the Sales/EDM staff workspaces share a codebase and API
with. Power Pages would introduce a second, parallel access-control model
(web roles/table permissions) and a second case-creation implementation
for the same authenticated-policyholder audience this app already serves
via `POST /api/tickets` (`server/src/routes/tickets.js`) and
`NewTicket.jsx`. Power Pages earns its keep when the audience is
**anonymous** (prospects, non-customers) — that's not this audience, so
custom web is the better fit here. A corollary: because every ticket
requires a valid CIAM-issued JWT, this channel has no anonymous
submission surface, so it doesn't need the spam/bot protection (CAPTCHA,
rate limiting on an open form) that a public Power Pages form would —
`express-rate-limit` on `/api` is sufficient defense-in-depth for an
already-authenticated caller.

**Status tracking for customers** — covered: `GET /api/tickets`,
`GET /api/tickets/:id`, and `POST /api/tickets/:id/comments` give
customers list/detail/comment access to their own cases, with row-level
isolation enforced server-side (404, not 403, on a mismatched
`_customerid_value`).

**Gaps closed:** `caseorigincode` is now stamped as "Web" (`CASE_ORIGIN_WEB`
in `tickets.js`) on every ticket this channel creates, so unified routing
and origin-based reporting can distinguish it from email-to-case and the
chatbot's escalation path.

**Unified routing — already compatible by omission.** This API never
sets `ownerid` or a queue on ticket creation (`tickets.js`, `POST /`) —
cases land unassigned, exactly what Unified Routing needs to pick them up
and apply the same sentiment/priority/classification rules it applies to
email- and chat-originated cases. No special-casing was needed here; the
main remaining consideration is that, if A5's priority/sentiment scoring
depends on case text, `title`/`description` are populated richly enough
for that classification step to work as well on a web-submitted case as
an emailed one.

**Chatbot escalation — reuse, don't duplicate.** A5's chatbot needs to
call a Function App/API for case creation on escalation. Rather than a
third, independent case-creation implementation, the chatbot's escalation
path is a candidate consumer of this same API (`POST /api/tickets`) or,
if it runs under its own service identity, the same
`dataverseClient.create('incidents', …)` pattern
(`server/src/dataverse/client.js`) — keeping category mapping,
required-field validation, and origin stamping in one place instead of
three.

## What's stubbed / left for you

- Table/entity/field logical names (`contoso_*` custom fields, `incidents`
  for cases, etc.) are illustrative — swap in your actual Dataverse schema.
- No IaC (Bicep/Terraform) included for provisioning the Azure resources
  themselves — add per your organization's standard.
- Event Grid webhook consuming ACS delivery/bounce callbacks isn't
  included; `campaigns.js` currently logs "Sent" immediately as a
  placeholder for that async status.
