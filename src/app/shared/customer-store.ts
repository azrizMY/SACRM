import type { CustomerRecord } from '../data/customer-data';
import { apiRequest } from './api-client';

export async function putCustomer(record: CustomerRecord): Promise<void> {
  await apiRequest(`/api/customers/${encodeURIComponent(record.id)}`, { method: 'PUT', body: JSON.stringify(record) });
}

export async function deleteCustomer(id: string): Promise<void> {
  await apiRequest(`/api/customers/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function clearAllCustomers(): Promise<void> {
  await apiRequest('/api/customers', { method: 'DELETE' });
}

export async function getAllCustomers(): Promise<CustomerRecord[]> {
  return apiRequest<CustomerRecord[]>('/api/customers');
}
