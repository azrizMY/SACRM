import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_ADVISOR, type AdvisorProfile } from '../data/advisor-data';

/** Single reactive source of truth for the signed-in consultant's profile, editable from the
 *  Profile page and persisted per-account via the Worker API (`/api/advisor`) — genuinely personal
 *  now, unlike the old single global profile every login used to overwrite. */
@Injectable({ providedIn: 'root' })
export class AdvisorService {
  profile = signal<AdvisorProfile>(DEFAULT_ADVISOR);

  constructor(private http: HttpClient) {}

  initials = computed(() =>
    this.profile()
      .name.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join(''),
  );

  /** Populates `profile` from the signed-in account — called once per login/session-restore by
   *  AuthService, never directly by components. */
  async load(): Promise<void> {
    try {
      const saved = await firstValueFrom(this.http.get<Partial<AdvisorProfile>>('/api/advisor'));
      this.profile.set({ ...DEFAULT_ADVISOR, ...saved });
    } catch {
      this.profile.set(DEFAULT_ADVISOR);
    }
  }

  /** Drops back to shipped defaults — called on logout so the next login on this tab never shows
   *  a flash of the previous account's profile. */
  reset() {
    this.profile.set(DEFAULT_ADVISOR);
  }

  update(patch: Partial<AdvisorProfile>) {
    const next = { ...this.profile(), ...patch };
    this.profile.set(next);
    firstValueFrom(this.http.put('/api/advisor', next)).catch((err) => {
      console.error('Failed to save advisor profile.', err);
    });
  }
}
