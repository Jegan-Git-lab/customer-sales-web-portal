import pLimit from 'p-limit';

// Dataverse service protection allows ~52 concurrent requests per user/app
// in most environments, but that's a ceiling to respect, not a target to
// hit. Capping the API's own concurrency to Dataverse keeps normal portal
// traffic from ever tripping the limit, even under load spikes (e.g. a
// campaign send iterating many contacts).
export const dataverseLimit = pLimit(15);
