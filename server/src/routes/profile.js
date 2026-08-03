import { Router } from 'express';
import { requireCustomerContact } from '../auth/middleware.js';
import { dataverseClient } from '../dataverse/client.js';

export const profileRouter = Router();

profileRouter.get('/', requireCustomerContact, async (req, res, next) => {
  try {
    // Policies (new_policies) are related to the contact's parent Account,
    // not to the contact directly — there is no contact-level lookup on
    // this entity. A contact with no parent Account simply has no policies.
    const contact = await dataverseClient.retrieve(
      'contacts',
      req.user.contactId,
      '$select=fullname,emailaddress1,telephone1,address1_line1,address1_city,address1_stateorprovince' +
        '&$expand=parentcustomerid_account($select=accountid)'
    );

    const accountId = contact?.parentcustomerid_account?.accountid;
    const policies = accountId
      ? await dataverseClient.retrieveMultiple(
          'new_policieses',
          `$filter=_new_account_value eq ${accountId}` +
            '&$select=new_policynumber,new_productcode,new_status,new_premiumamount,new_effectivedate,new_expirydate'
        )
      : [];

    res.json({ profile: contact, policies });
  } catch (err) {
    next(err);
  }
});
