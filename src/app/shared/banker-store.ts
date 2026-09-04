import type { BankerRecord } from '../data/banker-data';
import { apiRequest } from './api-client';

export async function putBanker(record: BankerRecord): Promise<void> {
  await apiRequest(`/api/bankers/${encodeURIComponent(record.id)}`, { method: 'PUT', body: JSON.stringify(record) });
}

export async function deleteBanker(id: string): Promise<void> {
  await apiRequest(`/api/bankers/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getAllBankers(): Promise<BankerRecord[]> {
  return apiRequest<BankerRecord[]>('/api/bankers');
}
