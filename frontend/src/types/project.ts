import { Deployment } from './deployment';

export type ProjectType = 'NODE_BACKEND' | 'REACT_FRONTEND' | 'NEXTJS_APP' | 'STATIC_SITE' | 'FULLSTACK' | 'CUSTOM_DOCKERFILE' | 'DOCKER_COMPOSE' | 'ERPNEXT';
export type ProjectStatus = 'ACTIVE' | 'INACTIVE' | 'FAILED' | 'BUILDING';

export interface Project {
  id: string;
  name: string;
  repoUrl: string;
  subdomain: string;
  projectType: ProjectType;
  status: ProjectStatus;
  branch: string;
  envVars?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  deployments?: Deployment[];
}

export interface CreateProjectPayload {
  name: string;
  repoUrl: string;
  branch: string;
  projectType: ProjectType;
  subdomain?: string;
  envVars?: Record<string, string>;
}
