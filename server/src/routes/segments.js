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

segmentsRouter.get('/', requireStaff, async (req, res, next) => {
  try {
    const rows = await dataverseClient.listSavedSegments();
    res.json({
      value: rows.map((r) => ({
        id: r.new_segmentid,
        name: r.new_name,
        criteria: r.new_criteria ? JSON.parse(r.new_criteria) : {},
      })),
    });
  } catch (err) {
    next(err);
  }
});

segmentsRouter.post('/', requireStaff, async (req, res, next) => {
  try {
    const name = (req.body?.name ?? '').trim();
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const criteria = pickCriteria(req.body?.criteria);
    const created = await dataverseClient.createSavedSegment(name, criteria);
    res.status(201).json({ id: created.new_segmentid, name: created.new_name, criteria });
  } catch (err) {
    next(err);
  }
});

segmentsRouter.delete('/:id', requireStaff, async (req, res, next) => {
  try {
    await dataverseClient.deleteSavedSegment(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
