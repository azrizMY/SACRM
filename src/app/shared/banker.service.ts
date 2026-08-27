import { Injectable, computed, signal } from '@angular/core';
import type { BankerRecord, EditBankerInput, NewBankerInput } from '../data/banker-data';
import { deleteBanker, getAllBankers, putBanker } from './banker-store';

@Injectable({ providedIn: 'root' })
export class BankerService {
  bankers = signal<BankerRecord[]>([]);

  favourites = computed(() => this.bankers().filter((b) => b.favourite));

  constructor() {
    getAllBankers().then((all) => {
      this.bankers.set(all.sort((a, b) => b.createdAt - a.createdAt));
    });
  }

  async addBanker(input: NewBankerInput): Promise<void> {
    const now = Date.now();
    const record: BankerRecord = {
      id: crypto.randomUUID(),
      favourite: false,
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    await putBanker(record);
    this.bankers.update((list) => [record, ...list]);
  }

  async editBanker(id: string, input: EditBankerInput): Promise<void> {
    await this.mutate(id, () => input);
  }

  async toggleFavourite(id: string): Promise<void> {
    const existing = this.bankers().find((b) => b.id === id);
    if (!existing) return;
    await this.mutate(id, () => ({ favourite: !existing.favourite }));
  }

  async deleteBanker(id: string): Promise<void> {
    await deleteBanker(id);
    this.bankers.update((list) => list.filter((b) => b.id !== id));
  }

  private async mutate(id: string, build: (existing: BankerRecord) => Partial<BankerRecord>): Promise<void> {
    const existing = this.bankers().find((b) => b.id === id);
    if (!existing) return;
    const updated: BankerRecord = { ...existing, ...build(existing), updatedAt: Date.now() };
    await putBanker(updated);
    this.bankers.update((list) => list.map((b) => (b.id === id ? updated : b)));
  }
}
