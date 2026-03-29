import client from './client';
import { Repository, Branch } from '../types/github';

export const getRepos = () =>
  client.get<{ data: Repository[] }>('/github/repos').then((r) => r.data.data);

export const getBranches = (owner: string, repo: string) =>
  client.get<{ data: Branch[] }>(`/github/repos/${owner}/${repo}/branches`).then((r) => r.data.data);
