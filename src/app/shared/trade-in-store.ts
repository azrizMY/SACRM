import type { TradeInContactRecord } from '../data/trade-in-data';
import { apiRequest } from './api-client';

export async function putTradeInContact(record: TradeInContactRecord): Promise<void> {
  await apiRequest(`/api/trade-in-contacts/${encodeURIComponent(record.id)}`, { method: 'PUT', body: JSON.stringify(record) });
}

export async function deleteTradeInContact(id: string): Promise<void> {
  await apiRequest(`/api/trade-in-contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getAllTradeInContacts(): Promise<TradeInContactRecord[]> {
  return apiRequest<TradeInContactRecord[]>('/api/trade-in-contacts');
}
