// One-off seed: creates 3 sample new_policies records under the Account
// tied to a specific contact (Jegan Sankar -> Fourth Coffee), so the
// customer Profile page has realistic data to show.
import { config } from '../src/config.js';
import { getDataverseAccessToken } from '../src/dataverse/credential.js';

const ACCOUNT_ID = 'dbdd0b93-4a1b-4848-b83a-39352f6b2e7a'; // Fourth Coffee (Jegan Sankar's parent account)

const POLICIES = [
  {
    new_policynumber: 'POL-AU-10234',
    new_productcode: 'Auto',
    new_status: 'Active',
    new_premiumamount: 1240,
    new_effectivedate: '2026-07-15',
    new_expirydate: '2027-07-15',
  },
  {
    new_policynumber: 'POL-HM-20567',
    new_productcode: 'Home',
    new_status: 'Active',
    new_premiumamount: 2100,
    new_effectivedate: '2026-03-10',
    new_expirydate: '2027-03-10',
  },
  {
    new_policynumber: 'POL-LI-30891',
    new_productcode: 'Life',
    new_status: 'Pending Renewal',
    new_premiumamount: 860,
    new_effectivedate: '2025-10-01',
    new_expirydate: '2026-10-01',
  },
];

const token = await getDataverseAccessToken();
const baseUrl = `${config.dataverse.envUrl}/api/data/${config.dataverse.apiVersion}`;

for (const policy of POLICIES) {
  const res = await fetch(`${baseUrl}/new_policieses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      ...policy,
      'new_Account@odata.bind': `/accounts(${ACCOUNT_ID})`,
    }),
  });

  if (!res.ok) {
    console.error(`FAILED ${policy.new_policynumber}: ${res.status} ${await res.text()}`);
    continue;
  }

  const created = await res.json();
  console.log(`Created ${policy.new_policynumber} -> ${created.new_policiesid}`);
}
