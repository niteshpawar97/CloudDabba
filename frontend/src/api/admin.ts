import client from './client';

export const getStats = () =>
  client.get<{ data: any }>('/admin/stats').then((r) => r.data.data);

export const getActivity = () =>
  client.get<{ data: any[] }>('/admin/activity').then((r) => r.data.data);

export const getUsers = (page = 1, search = '') =>
  client.get<{ data: any }>(`/admin/users?page=${page}&search=${search}`).then((r) => r.data.data);

export const updateUserRole = (id: string, role: string) =>
  client.put(`/admin/users/${id}/role`, { role });

export const deleteUser = (id: string) =>
  client.delete(`/admin/users/${id}`);

export const getAllProjects = (page = 1) =>
  client.get<{ data: any }>(`/admin/projects?page=${page}`).then((r) => r.data.data);

export const getAllDeployments = (page = 1, status = '') =>
  client.get<{ data: any }>(`/admin/deployments?page=${page}${status ? `&status=${status}` : ''}`).then((r) => r.data.data);

export const getContainers = () =>
  client.get<{ data: any[] }>('/admin/containers').then((r) => r.data.data);

export const stopContainer = (id: string) =>
  client.post(`/admin/containers/${id}/stop`);

export const removeContainer = (id: string) =>
  client.delete(`/admin/containers/${id}`);

export const cleanupContainers = () =>
  client.post<{ data: { removed: number } }>('/admin/containers/cleanup').then((r) => r.data.data);

export interface PlatformSettingsResponse {
  editable: {
    platformName: string;
    baseDomain: string;
    adminEmail: string;
    sslEmail: string;
    corsOrigins: string;
    allowSignup: boolean;
    defaultBranch: string;
  };
  infrastructure: {
    port: number;
    environment: string;
    portRange: string;
    nginxSitesPath: string;
    dockerSocket: string;
  };
  installedAt: string | null;
  sslEnabled: boolean;
}

export const getSettings = () =>
  client.get<{ data: PlatformSettingsResponse }>('/admin/settings').then((r) => r.data.data);

export const updateSettings = (data: Partial<PlatformSettingsResponse['editable']>) =>
  client.patch<{ data: any }>('/admin/settings', data).then((r) => r.data.data);

export const restartServer = () =>
  client.post<{ data: { scheduled: boolean; delayMs: number } }>('/admin/restart').then((r) => r.data.data);

export interface ServerInfo { ip: string; panelPort: number; }
export const getServerInfo = () =>
  client.get<{ data: ServerInfo }>('/admin/server-info').then((r) => r.data.data);

export interface DnsTestResult {
  ok: boolean;
  domain?: string;
  serverIp?: string;
  apex?: { resolved: string[]; matches: boolean; error?: string };
  wildcard?: { resolved: string[]; matches: boolean; error?: string };
  error?: string;
}
export const testDns = (domain: string) =>
  client.post<{ data: DnsTestResult }>('/admin/test-dns', { domain }).then((r) => r.data.data);

export interface SslStatus {
  installed: boolean;
  certs: Array<{ name: string; subject?: string; issuer?: string; expiresAt?: string | null; daysLeft?: number | null; sans?: string[]; wildcardCovered?: boolean; error?: string }>;
  active?: any;
  error?: string;
}
export const getSslStatus = (domain?: string) =>
  client.get<{ data: SslStatus }>(`/admin/ssl-status${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`).then((r) => r.data.data);

export interface PortRangeStatus {
  start: number;
  end: number;
  total: number;
  used: number;
  free: number | null;
  kernelAvailable: Array<{ port: number; free: boolean }>;
}
export const getPortRangeStatus = () =>
  client.get<{ data: PortRangeStatus }>('/admin/port-range-status').then((r) => r.data.data);

export interface DomainChangeStep { name: string; ok: boolean; detail?: string; skipped?: boolean; }
export interface DomainChangeResult {
  ok: boolean;
  steps: DomainChangeStep[];
  domain: string;
  panelUrl?: string;
  error?: string;
}
export const changeDomain = (data: { domain: string; sslEmail?: string; skipDns?: boolean; skipSsl?: boolean }) =>
  client.post<{ data: DomainChangeResult }>('/admin/change-domain', data).then((r) => r.data.data);

export const installSsl = (data: { domain: string; email?: string; includeWww?: boolean }) =>
  client.post<{ data: DomainChangeResult }>('/admin/install-ssl', data).then((r) => r.data.data);

export interface CloudflareStatus {
  tokenConfigured: boolean;
  pluginInstalled: boolean;
  iniExists: boolean;
}
export const getCloudflareStatus = () =>
  client.get<{ data: CloudflareStatus }>('/admin/cloudflare/status').then((r) => r.data.data);

export const saveCloudflareToken = (token: string) =>
  client.post('/admin/cloudflare/token', { token });

export const removeCloudflareToken = () =>
  client.delete('/admin/cloudflare/token');

export const installWildcardSsl = (data: { domain: string; email?: string }) =>
  client.post<{ data: DomainChangeResult }>('/admin/install-wildcard-ssl', data).then((r) => r.data.data);

export const getImages = () =>
  client.get<{ data: any[] }>('/admin/images').then((r) => r.data.data);

export const deleteImage = (id: string) =>
  client.delete(`/admin/images/${id}`);

export const cleanupImages = () =>
  client.post<{ data: any }>('/admin/images/cleanup').then((r) => r.data.data);

export interface DockerPruneResult {
  removed?: number;
  reclaimed?: number;
  containersRemoved?: number;
  imagesRemoved?: number;
  networksRemoved?: number;
}
export const pruneContainers = () =>
  client.post<{ data: DockerPruneResult; message: string }>('/admin/docker/prune/containers').then((r) => r.data);
export const pruneImages = () =>
  client.post<{ data: DockerPruneResult; message: string }>('/admin/docker/prune/images').then((r) => r.data);
export const pruneSystem = () =>
  client.post<{ data: DockerPruneResult; message: string }>('/admin/docker/prune/system').then((r) => r.data);

export const getChangelog = () =>
  client.get<{ data: any[] }>('/admin/changelog').then((r) => r.data.data);

export const getDatabases = () =>
  client.get<{ data: any[] }>('/admin/databases').then((r) => r.data.data);

export const adminDeletePostgres = (projectId: string) =>
  client.delete(`/admin/databases/${projectId}/postgres`);

export const adminDeleteMariadb = (projectId: string) =>
  client.delete(`/admin/databases/${projectId}/mariadb`);

export const adminDeleteRedis = (projectId: string) =>
  client.delete(`/admin/databases/${projectId}/redis`);
