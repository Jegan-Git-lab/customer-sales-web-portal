// Validates JWTs from EITHER of two Entra tenants:
//  - Entra ID (workforce) for Admin/Staff
//  - Entra External ID (CIAM) for End Customers
// The API is one app, but must trust two issuers, each with its own
// JWKS endpoint, audience and claim shape. Every request is verified here —
// the front end's routing is a UX convenience only, not a security boundary.
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';
import { config } from '../config.js';

const staffJWKS = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${config.staff.tenantId}/discovery/v2.0/keys`)
);

const customerJWKS = createRemoteJWKSet(
  new URL(
    //`https://${config.customer.tenantName}.ciamlogin.com/${config.customer.tenantId}/discovery/v2.0/keys`
  `https://0893b58c-2661-46a1-8391-4aaeee0834a8.ciamlogin.com/0893b58c-2661-46a1-8391-4aaeee0834a8/discovery/v2.0/keys`
  )
);

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

function isStaffIssuer(iss) {
  return typeof iss === 'string' && iss.includes(config.staff.tenantId);
}

/**
 * Verifies a bearer token against the correct tenant's JWKS/issuer/audience,
 * based on the `iss` claim. Returns a normalized user context.
 */
export async function verifyBearerToken(authorizationHeader) {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing bearer token');
  }
  const token = authorizationHeader.slice('Bearer '.length).trim();

  // Peek at the issuer WITHOUT trusting it yet, purely to pick which JWKS
  // and issuer string to verify against. jwtVerify() below still performs
  // full signature + issuer + audience validation.
  let unverifiedClaims;
  try {
    unverifiedClaims = decodeJwt(token);
  } catch {
    throw new AuthError('Malformed token');
  }

  const staff = isStaffIssuer(unverifiedClaims.iss);

  try {
    const { payload } = await jwtVerify(
      token,
      staff ? staffJWKS : customerJWKS,
      {
        audience: staff ? config.staff.apiAppIdUri : config.customer.apiAppIdUri,
        issuer: staff
          ? config.staff.issuer(config.staff.tenantId)
          :`https://0893b58c-2661-46a1-8391-4aaeee0834a8.ciamlogin.com/0893b58c-2661-46a1-8391-4aaeee0834a8/v2.0`, 
          //`https://${config.customer.tenantName}.ciamlogin.com/${config.customer.tenantId}/v2.0`,
      }
    );

    return {
      persona: staff ? 'staff' : 'customer',
      oid: payload.oid ?? payload.sub,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      raw: payload,
    };
  } catch (err) {
    throw new AuthError(`Token verification failed: ${err.message}`);
  }
}
