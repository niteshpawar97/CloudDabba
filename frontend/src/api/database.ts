import client from './client';

export const getDatabaseStatus = (projectId: string) =>
  client.get<{ data: any }>(`/projects/${projectId}/database`).then((r) => r.data.data);

export const enablePostgres = (projectId: string) =>
  client.post<{ data: any }>(`/projects/${projectId}/database/postgres`).then((r) => r.data.data);

export const disablePostgres = (projectId: string) =>
  client.delete(`/projects/${projectId}/database/postgres`);

export const enableRedis = (projectId: string) =>
  client.post<{ data: any }>(`/projects/${projectId}/database/redis`).then((r) => r.data.data);

export const disableRedis = (projectId: string) =>
  client.delete(`/projects/${projectId}/database/redis`);
