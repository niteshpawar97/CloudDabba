import client from './client';

export const scanPublicRepo = (repoUrl: string, branch?: string) =>
  client.post<{ data: any }>('/source/public-repo', { repoUrl, branch }).then((r) => r.data.data);

export const uploadZip = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return client.post<{ data: any }>('/source/upload-zip', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data.data);
};
