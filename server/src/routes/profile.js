import { Router } from 'express';
import { requireCustomerContact } from '../auth/middleware.js';
import { dataverseClient } from '../dataverse/client.js';

export const profileRouter = Router();

profileRouter.get('/', requireCustomerContact, async (req, res, next) => {
  try {
    const contact = await dataverseClient.retrieve(
      'contacts',
      req.user.contactId,
      '$select=fullname,emailaddress1,telephone1,address1_line1,address1_city,address1_stateorprovince'
    );

    const policies = await dataverseClient.retrieveMultiple(
      'contoso_policies',
      `$filter=_contoso_customerid_value eq ${req.user.contactId}&$select=contoso_policynumber,contoso_policytype,contoso_status,contoso_premium,contoso_renewaldate`
    );

    res.json({ profile: contact, policies });
  } catch (err) {
    next(err);
  }
});
