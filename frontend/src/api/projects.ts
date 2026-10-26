import client from './client';
import { Project, CreateProjectPayload } from '../types/project';

export const getProjects = () =>
  client.get<{ data: Project[] }>('/projects').then((r) => r.data.data);

export const getProject = (id: string) =>
  client.get<{ data: Project }>(`/projects/${id}`).then((r) => r.data.data);

export const createProject = (data: CreateProjectPayload) =>
  client.post<{ data: Project }>('/projects', data).then((r) => r.data.data);

export const updateProject = (id: string, data: Partial<CreateProjectPayload>) =>
  client.put<{ data: Project }>(`/projects/${id}`, data).then((r) => r.data.data);

export const deleteProject = (id: string) =>
  client.delete(`/projects/${id}`);

export const updateEnvVars = (id: string, envVars: Record<string, string>) =>
  client.put(`/projects/${id}/env`, { envVars });

export const transferProjectOwnership = (id: string, email: string) =>
  client.post<{ data: Project }>(`/projects/${id}/transfer`, { email }).then((r) => r.data.data);

// Custom domain
export const getDomainStatus = (id: string) =>
  client.get<{ data: any }>(`/projects/${id}/domain`).then((r) => r.data.data);

export const setCustomDomain = (id: string, customDomain: string) =>
  client.post<{ data: any }>(`/projects/${id}/domain`, { customDomain }).then((r) => r.data.data);

export const verifyCustomDomain = (id: string) =>
  client.post<{ data: any }>(`/projects/${id}/domain/verify`).then((r) => r.data.data);

export const removeCustomDomain = (id: string) =>
  client.delete(`/projects/${id}/domain`);

// Webhook / auto-deploy
export const getWebhookStatus = (id: string) =>
  client.get<{ data: { autoDeploy: boolean; webhookUrl: string | null; hasSecret: boolean } }>(`/projects/${id}/webhook`).then((r) => r.data.data);

export const enableWebhook = (id: string) =>
  client.post<{ data: { webhookUrl: string; secret: string; autoDeploy: boolean } }>(`/projects/${id}/webhook`).then((r) => r.data.data);

export const disableWebhook = (id: string) =>
  client.delete(`/projects/${id}/webhook`);

export interface MetricPoint {
  t: number;
  cpu: number;
  memUsage: number;
  memLimit: number;
  netRxRate: number;
  netTxRate: number;
}

export interface ProjectMetrics {
  current: MetricPoint | null;
  history: MetricPoint[];
  intervalSec: number;
  limits: {
    memoryMb: number;
    cpu: number;
    maxMemoryMb: number;
    minMemoryMb: number;
    minCpu: number;
    maxCpu: number;
    editable: boolean;
  };
}

export const getProjectMetrics = (id: string) =>
  client.get<{ data: ProjectMetrics }>(`/projects/${id}/metrics`).then((r) => r.data.data);

export const updateProjectLimits = (id: string, memoryMb: number, cpu: number) =>
  client.put<{ message: string; data: { memoryMb: number; cpu: number; appliedLive: boolean } }>(
    `/projects/${id}/limits`, { memoryMb, cpu },
  ).then((r) => r.data);

// ---- Database backups ----
export interface BackupEntry {
  id: string;
  scope: 'PROJECT' | 'PLATFORM';
  engine: 'POSTGRES' | 'MARIADB';
  trigger: 'AUTO' | 'MANUAL' | 'PRE_RESTORE';
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  sizeBytes: number;
  error: string | null;
  createdAt: string;
}
export interface BackupList {
  backups: BackupEntry[];
  restoring: boolean;
  lastRestore: { backupId: string; ok: boolean; error?: string; at: number } | null;
}
export const getBackups = (projectId: string) =>
  client.get<{ data: BackupList }>(`/projects/${projectId}/backups`).then((r) => r.data.data);
export const createBackup = (projectId: string, engine: 'POSTGRES' | 'MARIADB') =>
  client.post(`/projects/${projectId}/backups`, { engine });
export const restoreBackup = (projectId: string, backupId: string) =>
  client.post<{ message: string }>(`/projects/${projectId}/backups/${backupId}/restore`).then((r) => r.data);
export const deleteBackup = (projectId: string, backupId: string) =>
  client.delete(`/projects/${projectId}/backups/${backupId}`);
