import { Router } from 'express';
import { requireStaff } from '../auth/middleware.js';
import { dataverseClient } from '../dataverse/client.js';

export const opportunitiesRouter = Router();

// Allow-listed stage transitions — the API enforces this, not just the UI,
// so a crafted PATCH can't skip validation.
const STAGE_ORDER = [
  { key: 1, label: '1-Qualify' },
  { key: 2, label: '2-Develop' },
  { key: 3, label: '3-Propose' },
  { key: 4, label: '4-Close' },
];

function isValidTransition(fromStage, toStage) {
  const fromIdx = STAGE_ORDER.findIndex((s) => s.label === fromStage);
  const toIdx = STAGE_ORDER.findIndex((s) => s.label === toStage);
  if (fromIdx === -1 || toIdx === -1) return false;
  // Allow moving forward any amount, or back exactly one stage (correcting a mistake).
  return toIdx >= fromIdx || toIdx === fromIdx - 1;
}

opportunitiesRouter.get('/', requireStaff, async (req, res, next) => {
  try {
    const { stage, top = 50, skip = 0 } = req.query;
    const filter = stage ? `$filter=stepname eq '${stage}'` : '';
    const query = [
      '$select=opportunityid,name,estimatedvalue,stepname,_ownerid_value,estimatedclosedate',
      filter,
      `$top=${Math.min(Number(top), 200)}`,
    ]
      .filter(Boolean)
      .join('&');

    const opportunities = await dataverseClient.retrieveMultiple('opportunities', query);
    res.json({ value: opportunities });
  } catch (err) {
    next(err);
  }
});

opportunitiesRouter.patch('/:id', requireStaff, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stepname: toStage, ...otherFields } = req.body;

    if (toStage) {
      const current = await dataverseClient.retrieve('opportunities', id, '$select=stepname');
      if (!current) return res.status(404).json({ error: 'Opportunity not found' });
      if (!isValidTransition(current.stepname, toStage)) {
        return res.status(400).json({
          error: `Invalid stage transition from '${current.stepname}' to '${toStage}'`,
        });
      }
    }

    const updated = await dataverseClient.update('opportunities', id, {
      ...(toStage ? { stepname: toStage } : {}),
      ...otherFields,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

opportunitiesRouter.get('/pipeline/summary', requireStaff, async (req, res, next) => {
  try {
    const fetchXml = `
      <fetch aggregate="true">
        <entity name="opportunity">
          <attribute name="estimatedvalue" alias="total_value" aggregate="sum" />
          <attribute name="opportunityid" alias="count" aggregate="count" />
          <attribute name="stepname" alias="stage" groupby="true" />
        </entity>
      </fetch>`.trim();

    const summary = await dataverseClient.fetchXmlQuery('opportunities', fetchXml);
    res.json({ value: summary });
  } catch (err) {
    next(err);
  }
});