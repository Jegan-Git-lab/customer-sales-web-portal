// IMPORTANT: telemetry must be imported/started before anything else so
// Application Insights can auto-instrument express/http.
import { startTelemetry } from './telemetry.js';
startTelemetry();

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { authenticate } from './auth/middleware.js';

import { opportunitiesRouter } from './routes/opportunities.js';
import { leadsRouter } from './routes/leads.js';
import { activitiesRouter } from './routes/activities.js';
import { segmentsRouter } from './routes/segments.js';
import { campaignsRouter } from './routes/campaigns.js';
import { ticketsRouter } from './routes/tickets.js';
import { profileRouter } from './routes/profile.js';

const app = express();

// 10mb accommodates a ~5MB ticket attachment (base64 inflates size ~33%,
// plus JSON overhead) — see MAX_ATTACHMENT_BYTES in routes/tickets.js, which
// is the actual enforced limit on the decoded file.
app.use(express.json({ limit: '10mb' }));

// Locked-down CORS — only the deployed Static Web App origin, no wildcards.
app.use(
  cors({
    origin: config.allowedOrigin,
    credentials: true,
  })
);

// Coarse rate limiting at the edge, ON TOP OF (not instead of) the
// Dataverse-aware 429 retry/backoff inside the dataverse client. This
// protects the API itself from abusive traffic before it ever reaches
// Dataverse.
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Every /api/* route requires a validated bearer token from one of the two
// trusted Entra issuers. Role/ownership enforcement happens per-router.
app.use('/api', authenticate);

app.use('/api/opportunities', opportunitiesRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/segments', segmentsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/profile', profileRouter);

// Centralized error handler — never leak stack traces to the client.
app.use((err, req, res, _next) => {
  console.error(err);
  const status = err.status ?? 500;
  res.status(status).json({ error: config.env === 'production' ? 'Internal server error' : err.message });
});

app.listen(config.port, () => {
  console.log(`[api] listening on port ${config.port} (${config.env})`);
});
