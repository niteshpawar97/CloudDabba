import client from '../api/client';

/** Authenticated file download (a plain link cannot send the Bearer token). */
export async function downloadFile(url: string, fallbackName: string) {
  const res = await client.get(url, { responseType: 'blob' });
  const header: string = res.headers['content-disposition'] || '';
  const match = /filename="?([^";]+)"?/i.exec(header);
  const name = match ? match[1] : fallbackName;
  const href = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
