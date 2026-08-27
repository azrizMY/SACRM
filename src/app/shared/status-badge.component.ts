import { Component, Input } from '@angular/core';
import { STATUS_BADGE_CLASS } from '../data/dashboard-data';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2 py-0.5 text-xs font-medium"
      [class]="toneClass"
    >
      <span class="size-1.5 rounded-full bg-current"></span>
      {{ status }}
    </span>
  `,
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: string;

  get toneClass(): string {
    return STATUS_BADGE_CLASS[this.status] ?? '';
  }
}
