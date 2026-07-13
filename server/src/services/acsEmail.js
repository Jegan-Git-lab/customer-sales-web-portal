// Azure Communication Services Email — chosen over Graph sendMail and
// Customer Insights - Journeys for bulk campaign sends. See README for the
// justification. Authenticates via the same Managed Identity as Dataverse
// (no separate secret to manage).
import { EmailClient } from '@azure/communication-email';
import { DefaultAzureCredential } from '@azure/identity';
import { config } from '../config.js';

let client = null;

function getClient() {
  if (!client) {
    if (!config.acs.endpoint) {
      throw new Error('ACS_ENDPOINT is not configured');
    }
    client = new EmailClient(config.acs.endpoint, new DefaultAzureCredential());
  }
  return client;
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

/** Very small {{token}} substitution — swap for a real template engine as needed. */
export function renderTemplate(templateBody, contact) {
  return templateBody.replace(/{{\s*(\w+)\s*}}/g, (_, field) => contact[field] ?? '');
}

/**
 * Sends `templateBody` to every member in `members`, batched to respect ACS
 * per-request recipient limits. Returns per-batch operation ids so the
 * caller can poll or wire up Event Grid delivery callbacks.
 */
export async function sendCampaignBatches(members, templateSubject, templateBody) {
  const emailClient = getClient();
  const batches = chunk(members, 50);
  const operations = [];

  for (const batch of batches) {
    // Each recipient gets individually rendered content, sent as separate
    // messages within the batch call so no member sees another's data.
    for (const member of batch) {
      const poller = await emailClient.beginSend({
        senderAddress: config.acs.senderAddress,
        content: {
          subject: templateSubject,
          html: renderTemplate(templateBody, member),
        },
        recipients: { to: [{ address: member.emailaddress1, displayName: member.fullname }] },
      });
      operations.push({ contactId: member.contactid, operationId: poller.getOperationState().id });
    }
  }

  return operations;
}
