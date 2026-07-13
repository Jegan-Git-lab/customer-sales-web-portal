import { verifyBearerToken, AuthError } from './verifyToken.js';
import { dataverseClient } from '../dataverse/client.js';

/**
 * Runs on every /api/* request. Populates req.user with { persona, oid, roles }.
 */
export async function authenticate(req, res, next) {
  try {
    req.user = await verifyBearerToken(req.headers.authorization);
    next();
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
}

/**
 * Gate for Staff-only routes (Sales workspace, EDM workspace).
 * Requires the Entra ID issuer AND the 'Staff' app role claim.
 */
export function requireStaff(req, res, next) {
  if (req.user?.persona !== 'staff' || !req.user.roles.includes('Staff')) {
    return res.status(403).json({ error: 'Forbidden: Staff role required' });
  }
  next();
}

/**
 * Gate for Customer-only routes. Resolves the caller's Dataverse contact
 * record from their Entra External ID object id (oid) and binds it to
 * req.user.contactId. All downstream ticket/profile queries MUST use
 * req.user.contactId — never a client-supplied id — to enforce row-level
 * isolation between customers.
 */
export async function requireCustomerContact(req, res, next) {
  if (req.user?.persona !== 'customer') {
    return res.status(403).json({ error: 'Forbidden: customer account required' });
  }
  try {
    const contact = await dataverseClient.getContactByExternalId(req.user.oid);
    if (!contact) {
      return res.status(403).json({ error: `${req.user.oid}: No linked customer profile found for this account` });
    }
    req.user.contactId = contact.contactid;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Allows either persona through (e.g. /api/tickets is shared), leaving
 * per-route logic to branch on req.user.persona. Still requires
 * authenticate() to have run first.
 */
export async function attachCustomerContactIfCustomer(req, res, next) {
  if (req.user?.persona !== 'customer') return next();
  return requireCustomerContact(req, res, next);
}
