import client from './client';

interface AppConfig {
  baseDomain: string;
  protocol: string;
}

let cachedConfig: AppConfig | null = null;

export const getConfig = async (): Promise<AppConfig> => {
  if (cachedConfig) return cachedConfig;
  const res = await client.get<{ data: AppConfig }>('/config');
  cachedConfig = res.data.data;
  return cachedConfig;
};

export const getSubdomainUrl = (subdomain: string, config: AppConfig): string => {
  return `${config.protocol}://${subdomain}.${config.baseDomain}`;
};

export const checkSubdomain = (subdomain: string) =>
  client.get<{ data: { available: boolean; subdomain: string } }>(`/projects/check-subdomain/${subdomain}`).then((r) => r.data.data);

export const updateSubdomain = (projectId: string, subdomain: string) =>
  client.put(`/projects/${projectId}/subdomain`, { subdomain });
