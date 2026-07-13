import { Router } from 'express';
import { requireStaff } from '../auth/middleware.js';
import { dataverseClient } from '../dataverse/client.js';

export const segmentsRouter = Router();

// Allow-list of fields a segment can filter on — prevents arbitrary
// OData filter injection from client input.
const FILTERABLE_FIELDS = ['state', 'policyType', 'status'];

function pickCriteria(body) {
  return Object.fromEntries(
    Object.entries(body ?? {}).filter(([key]) => FILTERABLE_FIELDS.includes(key))
  );
}

segmentsRouter.post('/preview', requireStaff, async (req, res, next) => {
  try {
    const criteria = pickCriteria(req.body);
    const members = await dataverseClient.getSegmentMembers(criteria);

    res.json({
      criteria,
      count: members.length,
      sample: members.slice(0, 10),
    });
  } catch (err) {
    next(err);
  }
});
