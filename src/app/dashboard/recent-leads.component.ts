import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CustomerService } from '../shared/customer.service';
import { CUSTOMER_STATUS_META } from '../data/customer-data';

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function relativeTime(ts: number): string {
  const minutes = Math.floor((Date.now() - ts) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

@Component({
  selector: 'app-recent-leads',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="flex h-full flex-col gap-6 rounded-xl border border-border bg-card py-6 text-card-foreground shadow-sm">
      <div class="flex flex-col gap-1 px-6">
        <h3 class="font-semibold leading-none">Recent leads</h3>
        <p class="text-sm text-muted-foreground">Latest activity across your pipeline</p>
      </div>
      <div class="flex flex-col gap-1 px-6">
        @for (r of recent(); track r.id) {
          <div class="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {{ initials(r.name) }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ r.name }}</p>
              <p class="truncate text-xs text-muted-foreground">{{ r.brand }} {{ r.model }}</p>
            </div>
            <div class="flex flex-col items-end gap-1">
              <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium" [ngClass]="statusMeta[r.status].tone">
                <span class="size-1.5 rounded-full" [ngClass]="statusMeta[r.status].dot"></span>
                {{ statusMeta[r.status].label }}
              </span>
              <span class="text-[11px] text-muted-foreground">{{ relativeTime(r.updatedAt) }}</span>
            </div>
          </div>
        } @empty {
          <p class="px-2 py-8 text-center text-sm text-muted-foreground">No leads yet — add one from the Calculator or Customer Manager.</p>
        }
        <a
          routerLink="/leads"
          class="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-transparent px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          View all leads
        </a>
      </div>
    </div>
  `,
})
export class RecentLeadsComponent {
  statusMeta = CUSTOMER_STATUS_META;
  initials = initials;
  relativeTime = relativeTime;

  constructor(private customers: CustomerService) {}

  recent = computed(() => [...this.customers.records()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5));
}
