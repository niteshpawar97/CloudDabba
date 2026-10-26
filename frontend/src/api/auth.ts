import client from './client';
import { AuthResponse, LoginPayload, SignupPayload, User } from '../types/auth';

export const login = (data: LoginPayload) =>
  client.post<{ data: AuthResponse }>('/auth/login', data).then((r) => r.data.data);

export const signup = (data: SignupPayload) =>
  client.post<{ data: AuthResponse }>('/auth/signup', data).then((r) => r.data.data);

export const getMe = () =>
  client.get<{ data: User }>('/auth/me').then((r) => r.data.data);

export const storeGitHubPAT = (pat: string) =>
  client.put('/auth/github-pat', { pat });

export const removeGitHubPAT = () =>
  client.delete('/auth/github-pat');

export const forgotPassword = (email: string) =>
  client.post<{ message: string }>('/auth/forgot-password', { email }).then((r) => r.data);

export const resetPassword = (token: string, password: string) =>
  client.post<{ message: string }>('/auth/reset-password', { token, password }).then((r) => r.data);
