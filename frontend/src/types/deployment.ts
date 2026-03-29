export type DeploymentStatus = 'QUEUED' | 'CLONING' | 'BUILDING' | 'DEPLOYING' | 'LIVE' | 'FAILED' | 'STOPPED';

export interface Deployment {
  id: string;
  projectId: string;
  status: DeploymentStatus;
  commitHash?: string;
  dockerImageId?: string;
  containerId?: string;
  containerPort?: number;
  startedAt: string;
  finishedAt?: string;
}
