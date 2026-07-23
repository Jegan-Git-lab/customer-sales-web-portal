import { Router } from 'express';
import { requireStaff, attachCustomerContactIfCustomer } from '../auth/middleware.js';
import { dataverseClient } from '../dataverse/client.js';

export const ticketsRouter = Router();

const ALLOWED_CATEGORIES = ['Billing', 'Claims', 'PolicyChange', 'General'];

// Dataverse's org-wide default max attachment size is 5MB — matches that so
// uploads that would be rejected by Dataverse anyway fail fast client-side.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

// Choice (Option Set) label -> underlying Edm.Int32 value for
// incidents.casetypecode. Dataverse rejects the string label directly
// (0x80048d19 "Cannot convert the literal ... to the expected type
// 'Edm.Int32'") — the Web API needs the numeric option value. These are
// placeholder values following the standard custom-option-set numbering
// (100000000+); confirm the real values against the Option Set definition
// in the Dataverse solution and update this map before relying on it.
const CASE_TYPE_MAP = {
  Billing: 1,
  Claims: 2,
  PolicyChange: 3,
  General: 4,
};

// incidents.caseorigincode is the standard Dataverse global option set
// (not a custom one), where 3 = "Web" out of the box (1 = Phone, 2 = Email).
// Stamped on every ticket this API creates so unified routing and
// origin-based reporting can distinguish this channel from email-to-case
// and the chatbot's escalation path — confirm the value hasn't been
// customized in this environment before relying on it.
const CASE_ORIGIN_WEB = 3;

// GET /api/tickets
// Staff: can see a broader (still server-validated) view.
// Customer: hard-scoped to their own contact — client-supplied filters are
// ignored entirely for this persona.
ticketsRouter.get('/', attachCustomerContactIfCustomer, async (req, res, next) => {
  try {
    let filter;
    if (req.user.persona === 'staff') {
      const { status } = req.query;
      filter = status ? `$filter=statuscode eq '${status}'` : '';
    } else {
      filter = `$filter=_customerid_value eq ${req.user.contactId}`;
    }

    const query = ['$select=incidentid,title,casetypecode,statuscode,createdon', filter]
      .filter(Boolean)
      .join('&');

    const tickets = await dataverseClient.retrieveMultiple('incidents', query);
    res.json({ value: tickets });
  } catch (err) {
    next(err);
  }
});

// GET /api/tickets/:id
// Returns 404 (not 403) when a customer requests a ticket that isn't theirs,
// so the API never confirms whether a given id exists to someone unauthorized.
ticketsRouter.get('/:id', attachCustomerContactIfCustomer, async (req, res, next) => {
  try {
    const ticket = await dataverseClient.retrieve(
      'incidents',
      req.params.id,
      '$select=incidentid,title,description,casetypecode,statuscode,createdon,_customerid_value'
    );

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (req.user.persona === 'customer' && ticket._customerid_value !== req.user.contactId) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

// POST /api/tickets — customers raise a new ticket against themselves only.
ticketsRouter.post('/', attachCustomerContactIfCustomer, async (req, res, next) => {
  try {
    const { title, category, description, attachment } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }
    if (category && !ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of ${ALLOWED_CATEGORIES.join(', ')}` });
    }
    if (attachment) {
      if (!attachment.filename || !attachment.body) {
        return res.status(400).json({ error: 'attachment requires filename and body' });
      }
      // Decoded (raw) size, not the inflated base64 length, is what
      // actually counts against Dataverse's attachment size limit.
      const decodedBytes = Buffer.byteLength(attachment.body, 'base64');
      if (decodedBytes > MAX_ATTACHMENT_BYTES) {
        return res.status(400).json({
          error: `attachment exceeds maximum size of ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB`,
        });
      }
    }

    // Staff creating on behalf of a customer must pass an explicit
    // customerId; a customer can only ever create against their own
    // resolved contact — never a client-supplied id.
    const customerId = req.user.persona === 'customer' ? req.user.contactId : req.body.customerId;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const created = await dataverseClient.create('incidents', {
      title,
      casetypecode: CASE_TYPE_MAP[category ?? 'General'],
      caseorigincode: CASE_ORIGIN_WEB,
      description,
      'customerid_contact@odata.bind': `/contacts(${customerId})`,
    });

    if (attachment) {
      await dataverseClient.create('annotations', {
        subject: `Attachment: ${attachment.filename}`,
        filename: attachment.filename,
        documentbody: attachment.body,
        mimetype: attachment.contentType ?? 'application/octet-stream',
        'objectid_incident@odata.bind': `/incidents(${created.incidentid})`,
      });
    }

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// POST /api/tickets/:id/comments — ownership re-checked before any write.
ticketsRouter.post('/:id/comments', attachCustomerContactIfCustomer, async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const ticket = await dataverseClient.retrieve('incidents', req.params.id, '$select=_customerid_value');
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (req.user.persona === 'customer' && ticket._customerid_value !== req.user.contactId) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const comment = await dataverseClient.create('incidentresolutions', {
      subject: 'Customer comment',
      description: text,
      'incidentid@odata.bind': `/incidents(${req.params.id})`,
    });

    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
});
