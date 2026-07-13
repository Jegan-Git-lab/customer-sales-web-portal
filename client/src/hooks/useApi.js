import { useCallback } from 'react';
import { useAuth } from './AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * Returns a `call(path, options)` function that attaches the current
 * bearer token and base URL. All portal API calls should go through this
 * rather than raw fetch, so token attachment stays consistent everywhere.
 */
export function useApi() {
  const { getAccessToken } = useAuth();

  const call = useCallback(
    async (path, options = {}) => {
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed: ${response.status}`);
      }

      return response.status === 204 ? null : response.json();
    },
    [getAccessToken]
  );

  return { call };
}
