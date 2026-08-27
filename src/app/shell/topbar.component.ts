import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../shared/icon.component';
import { AdvisorService } from '../shared/advisor.service';
import { NotificationBellComponent } from './notification-bell.component';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, IconComponent, NotificationBellComponent],
  template: `
    <header class="flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
      <button
        type="button"
        class="flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent md:hidden"
        aria-label="Open menu"
        (click)="openMobile.emit()"
      >
        <app-icon name="menu" [size]="20" />
      </button>

      <div class="flex items-center gap-2">
        <h1 class="text-lg font-semibold tracking-tight text-balance">{{ title }}</h1>
        @if (brand) {
          <span class="text-muted-foreground" aria-hidden="true">&middot;</span>
          <span class="text-sm font-medium text-muted-foreground">{{ brand }}</span>
        }
      </div>

      <div class="ml-auto flex items-center gap-3">
        <span class="hidden text-sm text-muted-foreground sm:inline">
          Welcome, <span class="font-medium text-foreground">{{ advisor.profile().name }}</span>
        </span>

        <app-notification-bell />
      </div>
    </header>
  `,
})
export class TopbarComponent {
  @Input({ required: true }) title!: string;
  @Input() brand?: string | null;
  @Output() openMobile = new EventEmitter<void>();

  constructor(public advisor: AdvisorService) {}
}
