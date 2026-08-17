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

export const enableMariadb = (projectId: string) =>
  client.post<{ data: any }>(`/projects/${projectId}/database/mariadb`).then((r) => r.data.data);

export const disableMariadb = (projectId: string) =>
  client.delete(`/projects/${projectId}/database/mariadb`);

export const testDbConnection = (projectId: string) =>
  client.post<{ data: any }>(`/projects/${projectId}/database/test`).then((r) => r.data.data);

export const listDbTables = (projectId: string, engine: 'postgres' | 'mariadb') =>
  client.get<{ data: any }>(`/projects/${projectId}/database/${engine}/tables`).then((r) => r.data.data);

export const getDbTableRows = (
  projectId: string,
  engine: 'postgres' | 'mariadb',
  table: string,
  params?: { limit?: number; offset?: number }
) =>
  client
    .get<{ data: any }>(`/projects/${projectId}/database/${engine}/tables/${encodeURIComponent(table)}`, { params })
    .then((r) => r.data.data);
