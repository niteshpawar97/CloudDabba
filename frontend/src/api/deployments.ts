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

export const startDeployment = (id: string) =>
  client.post(`/deployments/${id}/start`);

export const restartDeployment = (id: string) =>
  client.post(`/deployments/${id}/restart`);

export const getDeploymentLogs = (id: string, page = 1) =>
  client.get<{ data: { logs: any[]; pagination: any } }>(`/deployments/${id}/logs?page=${page}`).then((r) => r.data.data);

export const getContainerLogs = (id: string, tail = 200) =>
  client.get<{ data: { logs: string } }>(`/deployments/${id}/container-logs?tail=${tail}`).then((r) => r.data.data);

export const getContainerStats = (id: string) =>
  client.get<{ data: { cpu: number; memory: { usage: number; limit: number; percent: number } } }>(`/deployments/${id}/stats`).then((r) => r.data.data);

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}
export const execInContainer = (id: string, command: string) =>
  client.post<{ data: ExecResult }>(`/deployments/${id}/exec`, { command }).then((r) => r.data.data);
