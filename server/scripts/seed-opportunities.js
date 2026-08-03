// One-off seed: creates 5 demo opportunities on the Fourth Coffee account
// (same account used for the policy demo data), spread across all 4
// pipeline stages, so Sales Workspace has a realistic pipeline to show.
import { dataverseClient } from '../src/dataverse/client.js';

const ACCOUNT_ID = 'dbdd0b93-4a1b-4848-b83a-39352f6b2e7a'; // Fourth Coffee

const OPPORTUNITIES = [
  { name: 'Fourth Coffee - POS Upgrade', estimatedvalue: 15000, stepname: '1-Qualify', estimatedclosedate: '2026-11-01' },
  { name: 'Fourth Coffee - Loyalty Program Rollout', estimatedvalue: 42000, stepname: '2-Develop', estimatedclosedate: '2026-10-15' },
  { name: 'Fourth Coffee - Supply Chain Contract', estimatedvalue: 33000, stepname: '2-Develop', estimatedclosedate: '2026-12-05' },
  { name: 'Fourth Coffee - Regional Expansion', estimatedvalue: 78000, stepname: '3-Propose', estimatedclosedate: '2026-09-20' },
  { name: 'Fourth Coffee - Equipment Financing', estimatedvalue: 25000, stepname: '4-Close', estimatedclosedate: '2026-08-25' },
];

for (const opp of OPPORTUNITIES) {
  const { stepname, ...rest } = opp;
  const created = await dataverseClient.create('opportunities', {
    ...rest,
    stepname,
    'customerid_account@odata.bind': `/accounts(${ACCOUNT_ID})`,
  });
  console.log(`Created ${opp.name} -> ${created.opportunityid} (${stepname})`);

  // stepname alone won't move the BPF pill bar shown in the native CRM UI —
  // stage 1 is already correct at creation, so only move it for 2/3/4.
  if (stepname !== '1-Qualify') {
    await dataverseClient.moveOpportunityBpfStage(created.opportunityid, stepname);
  }
}
