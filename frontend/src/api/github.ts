import client from './client';
import { Repository, Branch } from '../types/github';

export const getRepos = () =>
  client.get<{ data: Repository[] }>('/github/repos').then((r) => r.data.data);

export const getBranches = (owner: string, repo: string) =>
  client.get<{ data: Branch[] }>(`/github/repos/${owner}/${repo}/branches`).then((r) => r.data.data);

export interface RepoScan {
  type: string;
  confidence: string;
  reason: string;
  structure?: {
    pattern: string;
    backendPath?: string;
    frontendPath?: string;
    backendFramework?: string;
    frontendFramework?: string;
  };
}

export const scanRepo = (owner: string, repo: string) =>
  client.get<{ data: RepoScan }>(`/github/repos/${owner}/${repo}/scan`).then((r) => r.data.data);
