import { Router } from 'express';
import { requireStaff } from '../auth/middleware.js';
import { dataverseClient } from '../dataverse/client.js';
import { sendCampaignBatches } from '../services/acsEmail.js';

export const campaignsRouter = Router();

// Hard cap so a mis-scoped segment can't accidentally trigger a huge send.
const MAX_CAMPAIGN_RECIPIENTS = 5000;

campaignsRouter.post('/send', requireStaff, async (req, res, next) => {
  try {
    const { criteria, templateSubject, templateBody } = req.body;
    if (!templateSubject || !templateBody) {
      return res.status(400).json({ error: 'templateSubject and templateBody are required' });
    }

    const members = await dataverseClient.getSegmentMembers(criteria ?? {});
    if (members.length === 0) {
      return res.status(400).json({ error: 'Segment has no members' });
    }
    if (members.length > MAX_CAMPAIGN_RECIPIENTS) {
      return res.status(400).json({
        error: `Segment has ${members.length} members, exceeding the ${MAX_CAMPAIGN_RECIPIENTS} send cap. Narrow the segment.`,
      });
    }

    const campaignRun = await dataverseClient.createCampaignRun(
      criteria ?? {},
      templateSubject,
      members.length
    );

    const operations = await sendCampaignBatches(members, templateSubject, templateBody);

    // Fire-and-forget-ish: log each send as a campaign response row so the
    // basic status view has something to show even before Event Grid
    // delivery callbacks land. A production build would move this to a
    // background queue rather than awaiting inline.
    await Promise.all(
      operations.map((op) => dataverseClient.recordCampaignResponse(campaignRun.new_campaignrunid, op.contactId, 'Sent'))
    );

    res.status(201).json({
      campaignRunId: campaignRun.new_campaignrunid,
      targeted: members.length,
    });
  } catch (err) {
    next(err);
  }
});

campaignsRouter.get('/:id/status', requireStaff, async (req, res, next) => {
  try {
    const responses = await dataverseClient.retrieveMultiple(
      'new_campaignresponses',
      `$filter=_new_campaignrun_value eq ${req.params.id}&$select=new_eventtype,new_eventtimestamp`
    );

    const summary = responses.reduce((acc, r) => {
      acc[r.new_eventtype] = (acc[r.new_eventtype] ?? 0) + 1;
      return acc;
    }, {});

    res.json({ campaignRunId: req.params.id, summary, total: responses.length });
  } catch (err) {
    next(err);
  }
});
