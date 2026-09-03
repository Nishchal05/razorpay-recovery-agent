import { getAuthHeader, removeToken } from '../auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchClient(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers as Record<string, string> | undefined),
  };

  const config: RequestInit = { ...options, headers };

  try {
    const response = await fetch(url, config);

    if (response.status === 401) {
      // Token expired or invalid — clear auth and redirect to sign-in
      removeToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/signin';
      }
      throw new Error('Session expired. Please sign in again.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.detail || `Error: ${response.status} ${response.statusText}`);
    }

    // Some endpoints return 204 No Content
    if (response.status === 204) return null;

    return response.json();
  } catch (error) {
    console.error(`API Client Error (${endpoint}):`, error);
    throw error;
  }
}

