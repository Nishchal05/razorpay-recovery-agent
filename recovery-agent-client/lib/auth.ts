// Token management — works in browser only (no SSR access).
// The token is stored in localStorage and also read by the API client.

const TOKEN_KEY = 'ra_access_token';
const USER_KEY  = 'ra_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAuthHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isAuthenticated(): boolean {
  // If the bypass flag is set (dev mode without backend auth), always return true.
  if (process.env.NEXT_PUBLIC_AUTH_BYPASS === 'true') return true;
  return Boolean(getToken());
}
