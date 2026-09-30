import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { IconComponent } from '../shared/icon.component';
import { AdvisorService } from '../shared/advisor.service';
import { TopbarExtraService } from '../shared/topbar-extra.service';
import { NotificationBellComponent } from './notification-bell.component';
import { TranslatePipe } from '../shared/i18n';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, IconComponent, NotificationBellComponent, TranslatePipe],
  template: `
    <header class="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
      <button
        type="button"
        class="flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent md:hidden"
        [attr.aria-label]="'Open menu' | t"
        (click)="openMobile.emit()"
      >
        <app-icon name="menu" [size]="20" />
      </button>

      <div class="flex items-center gap-2">
        <h1 class="text-lg font-bold tracking-tight text-balance">{{ title | t }}</h1>
        @if (brand) {
          <span class="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{{ brand }}</span>
        }
      </div>

      @if (topbarExtra.content(); as extra) {
        <ng-container [ngTemplateOutlet]="extra"></ng-container>
      }

      <div class="ml-auto flex items-center gap-3">
        <span class="hidden text-sm text-muted-foreground sm:inline">
          {{ "Welcome," | t }} <span class="font-medium text-foreground">{{ advisor.profile().name }}</span>
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

  constructor(
    public advisor: AdvisorService,
    public topbarExtra: TopbarExtraService,
  ) {}
}
