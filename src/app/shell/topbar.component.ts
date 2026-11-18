import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { IconComponent } from '../shared/icon.component';
import { GuideService } from '../shared/guide.service';
import { TopbarExtraService } from '../shared/topbar-extra.service';
import { TranslatePipe } from '../shared/i18n';

/** The page title bar: the menu (hamburger) button on a phone, the page title, and Help. */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, IconComponent, TranslatePipe],
  template: `
    <header class="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 md:h-16 md:gap-3 md:px-6">
      <button
        type="button"
        class="-ml-1 flex size-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent md:hidden"
        [attr.aria-label]="'Open menu' | t"
        (click)="openMobile.emit()"
      >
        <app-icon name="menu" [size]="20" />
      </button>

      <h1 class="min-w-0 truncate text-lg font-bold tracking-tight md:text-xl">{{ title | t }}</h1>

      @if (topbarExtra.content(); as extra) {
        <div class="hidden md:block">
          <ng-container [ngTemplateOutlet]="extra"></ng-container>
        </div>
      }

      <!-- No "Welcome, name" here: the account button at the foot of the menu already shows who's signed in. -->
      <div class="ml-auto flex items-center gap-3">
        <button
          type="button"
          data-tour="nav-help"
          (click)="guide.openHelp()"
          class="relative flex h-9 items-center gap-1.5 rounded-full border border-control px-3 text-sm font-semibold transition-colors hover:bg-accent"
        >
          <app-icon name="help-circle" [size]="18" />
          {{ 'Help' | t }}
        </button>
      </div>
    </header>

    <!-- On a phone, a page's own switch (e.g. Brochures / Offers) sits under the bar. -->
    @if (topbarExtra.content(); as extra) {
      <div class="flex shrink-0 border-b border-border bg-background px-3 py-2 md:hidden">
        <ng-container [ngTemplateOutlet]="extra"></ng-container>
      </div>
    }
  `,
})
export class TopbarComponent {
  @Input({ required: true }) title!: string;
  @Output() openMobile = new EventEmitter<void>();

  topbarExtra = inject(TopbarExtraService);
  guide = inject(GuideService);
}
