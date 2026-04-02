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

// Webhook / auto-deploy
export const getWebhookStatus = (id: string) =>
  client.get<{ data: { autoDeploy: boolean; webhookUrl: string | null; hasSecret: boolean } }>(`/projects/${id}/webhook`).then((r) => r.data.data);

export const enableWebhook = (id: string) =>
  client.post<{ data: { webhookUrl: string; secret: string; autoDeploy: boolean } }>(`/projects/${id}/webhook`).then((r) => r.data.data);

export const disableWebhook = (id: string) =>
  client.delete(`/projects/${id}/webhook`);
