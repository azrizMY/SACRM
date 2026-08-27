import { Injectable, computed, signal } from '@angular/core';
import type { EditTradeInContactInput, NewTradeInContactInput, TradeInContactRecord } from '../data/trade-in-data';
import { deleteTradeInContact, getAllTradeInContacts, putTradeInContact } from './trade-in-store';

@Injectable({ providedIn: 'root' })
export class TradeInService {
  contacts = signal<TradeInContactRecord[]>([]);

  favourites = computed(() => this.contacts().filter((c) => c.favourite));

  constructor() {
    getAllTradeInContacts().then((all) => {
      this.contacts.set(all.sort((a, b) => b.createdAt - a.createdAt));
    });
  }

  async addContact(input: NewTradeInContactInput): Promise<void> {
    const now = Date.now();
    const record: TradeInContactRecord = {
      id: crypto.randomUUID(),
      favourite: false,
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    await putTradeInContact(record);
    this.contacts.update((list) => [record, ...list]);
  }

  async editContact(id: string, input: EditTradeInContactInput): Promise<void> {
    await this.mutate(id, () => input);
  }

  async toggleFavourite(id: string): Promise<void> {
    const existing = this.contacts().find((c) => c.id === id);
    if (!existing) return;
    await this.mutate(id, () => ({ favourite: !existing.favourite }));
  }

  async deleteContact(id: string): Promise<void> {
    await deleteTradeInContact(id);
    this.contacts.update((list) => list.filter((c) => c.id !== id));
  }

  private async mutate(id: string, build: (existing: TradeInContactRecord) => Partial<TradeInContactRecord>): Promise<void> {
    const existing = this.contacts().find((c) => c.id === id);
    if (!existing) return;
    const updated: TradeInContactRecord = { ...existing, ...build(existing), updatedAt: Date.now() };
    await putTradeInContact(updated);
    this.contacts.update((list) => list.map((c) => (c.id === id ? updated : c)));
  }
}
