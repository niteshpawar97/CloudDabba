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

export const getSettings = () =>
  client.get<{ data: any }>('/admin/settings').then((r) => r.data.data);

export const getImages = () =>
  client.get<{ data: any[] }>('/admin/images').then((r) => r.data.data);

export const deleteImage = (id: string) =>
  client.delete(`/admin/images/${id}`);

export const cleanupImages = () =>
  client.post<{ data: any }>('/admin/images/cleanup').then((r) => r.data.data);

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
