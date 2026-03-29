import client from './client';
import { Deployment } from '../types/deployment';

export const triggerDeploy = (projectId: string) =>
  client.post<{ data: Deployment }>(`/projects/${projectId}/deploy`).then((r) => r.data.data);

export const getDeployments = (projectId: string) =>
  client.get<{ data: Deployment[] }>(`/projects/${projectId}/deployments`).then((r) => r.data.data);

export const getDeployment = (id: string) =>
  client.get<{ data: Deployment }>(`/deployments/${id}`).then((r) => r.data.data);

export const stopDeployment = (id: string) =>
  client.post(`/deployments/${id}/stop`);

export const getDeploymentLogs = (id: string, page = 1) =>
  client.get<{ data: { logs: any[]; pagination: any } }>(`/deployments/${id}/logs?page=${page}`).then((r) => r.data.data);
