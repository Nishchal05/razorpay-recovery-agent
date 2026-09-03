import { AuthResponse, AuthUser, SigninPayload, SignupPayload } from '../types';
import { fetchClient } from './client';

export const signup = (data: SignupPayload): Promise<AuthResponse> =>
  fetchClient('/auth/signup', { method: 'POST', body: JSON.stringify(data) });

export const signin = (data: SigninPayload): Promise<AuthResponse> =>
  fetchClient('/auth/signin', { method: 'POST', body: JSON.stringify(data) });

export const getMe = (): Promise<AuthUser> =>
  fetchClient('/auth/me', { method: 'GET' });

export const logout = (): Promise<void> =>
  fetchClient('/auth/logout', { method: 'POST' }).catch(() => {});
