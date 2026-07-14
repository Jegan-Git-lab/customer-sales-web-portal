// Thin wrapper over the Dataverse Web API (OData v4). This is the ONLY
// module that should ever construct a Dataverse HTTP request — routes call
// through here so that auth, retry/429 handling, and headers stay
// consistent in one place.
import { config } from '../config.js';
import { getDataverseAccessToken } from './credential.js';
import { withDataverseRetry } from '../utils/retry.js';
import { dataverseLimit } from '../utils/concurrency.js';
 
const baseUrl = () => `${config.dataverse.envUrl}/api/data/${config.dataverse.apiVersion}`;
 
async function authorizedFetch(path, init = {}, label = path) {
  const token = await getDataverseAccessToken();
 
  const doFetch = () =>
    fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        Prefer: 'return=representation',
        ...init.headers,
      },
    });
 
  // Concurrency-limited AND retried — the two Dataverse service-protection
  // limits (requests-per-window and concurrent-requests) are both covered.
  const response = await dataverseLimit(() => withDataverseRetry(doFetch, { label }));
 
  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => '');
    throw new Error(`Dataverse ${label} failed: ${response.status} ${body}`);
  }
 
  return response;
}
 
async function parseJsonOrNull(response) {
  if (response.status === 404) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
 
// Maps Choice (Option Set) label -> underlying Edm.Int32 value stored in
// Dataverse for new_policystatus. Option set values are NOT quoted in
// OData filters — quoting them causes the
// "0x80060888 ... Edm.Int32 and Edm.String" error. Keep this map in sync
// with the actual Option Set definition in the Dataverse solution.
const POLICY_STATUS_MAP = {
  Active: 100000000,
  Lapsed: 100000001,
  Cancelled: 100000002,
  Expired: 100000003,
  'Pending Renewal': 100000004,
  Suspended: 100000005,
};
 
export const dataverseClient = {
  /**
   * Generic OData retrieveMultiple. `odataQuery` is a pre-validated query
   * string (e.g. "$filter=...&$select=...&$orderby=..."). Route handlers
   * are responsible for constructing filters using only server-trusted
   * values for row-level isolation (never pass through a raw client filter
   * for customer-scoped queries).
   */
  async retrieveMultiple(entitySet, odataQuery = '') {
    const response = await authorizedFetch(`/${entitySet}${odataQuery ? `?${odataQuery}` : ''}`, {
      method: 'GET',
    }, `retrieveMultiple:${entitySet}`);
    const json = await parseJsonOrNull(response);
    return json?.value ?? [];
  },
 
  async retrieve(entitySet, id, odataQuery = '') {
    const response = await authorizedFetch(
      `/${entitySet}(${id})${odataQuery ? `?${odataQuery}` : ''}`,
      { method: 'GET' },
      `retrieve:${entitySet}`
    );
    return parseJsonOrNull(response);
  },
 
  async create(entitySet, record) {
    const response = await authorizedFetch(
      `/${entitySet}`,
      { method: 'POST', body: JSON.stringify(record) },
      `create:${entitySet}`
    );
    return parseJsonOrNull(response);
  },
 
  async update(entitySet, id, patch) {
    const response = await authorizedFetch(
      `/${entitySet}(${id})`,
      { method: 'PATCH', body: JSON.stringify(patch) },
      `update:${entitySet}`
    );
    return parseJsonOrNull(response);
  },
 
  /**
   * Runs an aggregate/grouped FetchXML query (used for the pipeline
   * stage-wise summary, which OData alone can't express cleanly).
   */
  async fetchXmlQuery(entitySet, fetchXml) {
    const encoded = encodeURIComponent(fetchXml);
    const response = await authorizedFetch(
      `/${entitySet}?fetchXml=${encoded}`,
      { method: 'GET' },
      `fetchXml:${entitySet}`
    );
    const json = await parseJsonOrNull(response);
    return json?.value ?? [];
  },
 
  /**
   * Resolves the calling customer's Dataverse contact by the External ID
   * object id stored against the contact record (e.g. a custom
   * `new_externalobjectid` field populated at self-registration/invite
   * time). This is the row-level isolation anchor for every customer
   * request.
   */
  async getContactByExternalId(externalOid) {
    const results = await this.retrieveMultiple(
      'contacts',
      `$select=contactid,fullname,emailaddress1&$filter=new_externalobjectid eq '${externalOid}'`
    );
    return results[0] ?? null;
  },
 
  /**
   * Builds a segment member list from filter criteria (state, policy type,
   * status, etc). `criteria` is a plain object already validated by the
   * route layer against an allow-list of filterable fields — never
   * interpolated directly from unvalidated client input.
   *
   * NOTE on types:
   *  - address1_stateorprovince -> Edm.String  -> quoted
   *  - new_policytype           -> Edm.String  -> quoted
   *  - new_policystatus         -> Edm.Int32 (Choice/Option Set) -> NOT quoted
   *    Callers may pass either the numeric option value directly, or the
   *    human label (e.g. "Active"), which is resolved via POLICY_STATUS_MAP.
   */
  async getSegmentMembers(criteria) {
    const filterParts = [];
    if (criteria.state) filterParts.push(`address1_stateorprovince eq '${criteria.state}'`);
    if (criteria.policyType) filterParts.push(`new_policytype eq '${criteria.policyType}'`);
 
    if (criteria.status !== undefined && criteria.status !== null && criteria.status !== '') {
      const statusValue =
        typeof criteria.status === 'number'
          ? criteria.status
          : POLICY_STATUS_MAP[criteria.status];
 
      if (statusValue === undefined) {
        throw new Error(`Unknown new_policystatus label: "${criteria.status}"`);
      }
 
      // Option Set (Choice) values are Edm.Int32 — do NOT wrap in quotes.
      filterParts.push(`new_policystatus eq ${statusValue}`);
    }
 
    const filter = filterParts.length ? `$filter=${filterParts.join(' and ')}` : '';
    const odataQuery = `$select=contactid,fullname,emailaddress1&${filter}`;
    console.log('[getSegmentMembers] criteria:', criteria);
    console.log('[getSegmentMembers] odataQuery:', odataQuery);
    return this.retrieveMultiple('contacts', odataQuery);
  },
 
  async createCampaignRun(criteria, templateSubject, targetCount) {
    return this.create('contoso_campaignruns', {
      contoso_segmentcriteria: JSON.stringify(criteria ?? {}),
      contoso_templatesubject: templateSubject,
      contoso_targetcount: targetCount,
      contoso_status: 'Sending',
    });
  },

  async recordCampaignResponse(campaignRunId, contactId, eventType) {
    return this.create('contoso_campaignresponses', {
      'contoso_campaignrun@odata.bind': `/contoso_campaignruns(${campaignRunId})`,
      'contoso_contact@odata.bind': `/contacts(${contactId})`,
      contoso_eventtype: eventType,
      contoso_eventtimestamp: new Date().toISOString(),
    });
  },
};