// Two separate MSAL configs because staff and customers authenticate
// against two different Entra tenants. The API validates whichever token
// arrives (see server/src/auth/verifyToken.js); the SPA just needs to know
// which authority to send the user to based on which login button they
// click on /login.
import { PublicClientApplication } from '@azure/msal-browser';
console.log('SCOPES CHECK:', import.meta.env.VITE_STAFF_API_SCOPE, import.meta.env.VITE_CUSTOMER_API_SCOPE);

export const staffMsalConfig = {
  auth: {
    clientId: import.meta.env.VITE_STAFF_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_STAFF_TENANT_ID}`,
    redirectUri: '/',
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
};

export const customerMsalConfig = {
  auth: {
    clientId: import.meta.env.VITE_CUSTOMER_CLIENT_ID,
    authority: `https://${import.meta.env.VITE_CUSTOMER_TENANT_NAME}.ciamlogin.com/${import.meta.env.VITE_CUSTOMER_TENANT_ID}`,
    redirectUri: '/',
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
};

export const staffLoginRequest = {
  scopes: [import.meta.env.VITE_STAFF_API_SCOPE],
};

export const customerLoginRequest = {
  scopes: [import.meta.env.VITE_CUSTOMER_API_SCOPE],
};

export const staffMsalInstance = new PublicClientApplication(staffMsalConfig);
export const customerMsalInstance = new PublicClientApplication(customerMsalConfig);
