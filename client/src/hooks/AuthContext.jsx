// Custom auth context (rather than <MsalProvider>) because the portal needs
// TWO independent MSAL instances — one per Entra tenant — and msal-react's
// provider is built around a single instance. This context tracks which
// flavor ("staff" | "customer") the user signed in as, persisted in
// sessionStorage so a page refresh doesn't lose it, and exposes a single
// getAccessToken() that always calls the correct instance/scope.
import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  staffMsalInstance,
  customerMsalInstance,
  staffLoginRequest,
  customerLoginRequest,
} from '../authConfig';

const AuthContext = createContext(null);
const PERSONA_KEY = 'portal.persona';

function instanceFor(persona) {
  return persona === 'staff' ? staffMsalInstance : customerMsalInstance;
}

function loginRequestFor(persona) {
  return persona === 'staff' ? staffLoginRequest : customerLoginRequest;
}

export function AuthProvider({ children }) {
  const [persona, setPersona] = useState(() => sessionStorage.getItem(PERSONA_KEY));
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const redirectInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      await Promise.all([staffMsalInstance.initialize(), customerMsalInstance.initialize()]);

    const [staffResult, customerResult] = await Promise.all([
  staffMsalInstance.handleRedirectPromise().catch((err) => { console.error('STAFF REDIRECT ERROR:', err); return null; }),
  customerMsalInstance.handleRedirectPromise().catch((err) => { console.error('CUSTOMER REDIRECT ERROR:', err); return null; }),
    ]);
      if (cancelled) return;

      if (staffResult?.account) {
        sessionStorage.setItem(PERSONA_KEY, 'staff');
        setPersona('staff');
        setAccount(staffResult.account);
      } else if (customerResult?.account) {
        sessionStorage.setItem(PERSONA_KEY, 'customer');
        setPersona('customer');
        setAccount(customerResult.account);
      } else {
        const storedPersona = sessionStorage.getItem(PERSONA_KEY);
        if (storedPersona) {
          const existing = instanceFor(storedPersona).getAllAccounts()[0];
          if (existing) {
            setPersona(storedPersona);
            setAccount(existing);
          } else {
            sessionStorage.removeItem(PERSONA_KEY);
          }
        }
      }

      setLoading(false);
    }

    init().catch((err) => {
      if (!cancelled) {
        setError(err.message);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((selectedPersona) => {
    const instance = instanceFor(selectedPersona);
    instance.loginRedirect(loginRequestFor(selectedPersona));
  }, []);

  const signOut = useCallback(() => {
    if (!persona) return;
    sessionStorage.removeItem(PERSONA_KEY);
    instanceFor(persona).logoutRedirect();
  }, [persona]);

  const getAccessToken = useCallback(async () => {
    if (!persona || !account) throw new Error('Not signed in');
    const instance = instanceFor(persona);
    try {
      const result = await instance.acquireTokenSilent({ ...loginRequestFor(persona), account });
      return result.accessToken;
    } catch {
      if (redirectInFlightRef.current) {
        return new Promise(() => {});
      }
      redirectInFlightRef.current = true;
      await instance.acquireTokenRedirect(loginRequestFor(persona));
      return null;
    }
  }, [persona, account]);

  const value = useMemo(
    () => ({ persona, account, loading, error, signIn, signOut, getAccessToken }),
    [persona, account, loading, error, signIn, signOut, getAccessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}