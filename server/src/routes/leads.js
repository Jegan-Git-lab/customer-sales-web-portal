import { Router } from 'express';
import { requireStaff } from '../auth/middleware.js';
import { dataverseClient } from '../dataverse/client.js';

export const leadsRouter = Router();

leadsRouter.get('/', requireStaff, async (req, res, next) => {
  try {
    const { top = 50 } = req.query;
    const leads = await dataverseClient.retrieveMultiple(
      'leads',
      `$select=leadid,fullname,companyname,leadqualitycode,statuscode&$top=${Math.min(Number(top), 200)}`
    );
    res.json({ value: leads });
  } catch (err) {
    next(err);
  }
});

leadsRouter.patch('/:id', requireStaff, async (req, res, next) => {
  try {
    const updated = await dataverseClient.update('leads', req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
