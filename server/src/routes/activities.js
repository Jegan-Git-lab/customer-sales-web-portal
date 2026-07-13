import { Router } from 'express';
import { requireStaff } from '../auth/middleware.js';
import { dataverseClient } from '../dataverse/client.js';

export const activitiesRouter = Router();

const ALLOWED_TYPES = ['phonecall', 'email', 'task'];
const ALLOWED_REGARDING = ['lead', 'opportunity'];

activitiesRouter.post('/', requireStaff, async (req, res, next) => {
  try {
    const { type, regardingEntity, regardingId, subject, notes } = req.body;

    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of ${ALLOWED_TYPES.join(', ')}` });
    }
    if (!ALLOWED_REGARDING.includes(regardingEntity)) {
      return res.status(400).json({ error: `regardingEntity must be one of ${ALLOWED_REGARDING.join(', ')}` });
    }

    const regardingSet = regardingEntity === 'lead' ? 'leads' : 'opportunities';
    const created = await dataverseClient.create(`${type}s`, {
      subject,
      description: notes,
      [`regardingobjectid_${regardingEntity}@odata.bind`]: `/${regardingSet}(${regardingId})`,
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});
