import client from './client';

export interface SetupStatus {
  setupCompleted: boolean;
  baseDomain?: string;
  installedAt?: string;
}

export const getSetupStatus = () =>
  client.get<{ data: SetupStatus }>('/setup/status').then((r) => r.data.data);

export const completeSetup = (data: { domain: string; email: string; password: string; name: string }) =>
  client.post<{ data: { user: any; token: string } }>('/setup/complete', data).then((r) => r.data.data);
