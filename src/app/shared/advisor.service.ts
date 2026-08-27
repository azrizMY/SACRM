import { Injectable, computed, signal } from '@angular/core';
import { DEFAULT_ADVISOR, type AdvisorProfile } from '../data/advisor-data';

const STORAGE_KEY = 'redline-advisor-profile';

function loadProfile(): AdvisorProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_ADVISOR, ...JSON.parse(raw) };
  } catch {
    /* ignore corrupt/unavailable storage, fall back to default */
  }
  return DEFAULT_ADVISOR;
}

/** Single reactive source of truth for the signed-in consultant's profile, editable from the Profile page. */
@Injectable({ providedIn: 'root' })
export class AdvisorService {
  profile = signal<AdvisorProfile>(loadProfile());

  initials = computed(() =>
    this.profile()
      .name.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join(''),
  );

  update(patch: Partial<AdvisorProfile>) {
    const next = { ...this.profile(), ...patch };
    this.profile.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* localStorage unavailable — edits still hold for this session */
    }
  }
}
