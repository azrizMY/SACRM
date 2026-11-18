import { Component, inject } from '@angular/core';
import { AppUpdateService } from './app-update.service';
import { TranslatePipe } from './i18n';
import { IconComponent } from './icon.component';

/** "A new version is ready" card with a Refresh button — shown once a deploy has downloaded. */
@Component({
  selector: 'app-update-banner',
  standalone: true,
  imports: [IconComponent, TranslatePipe],
  template: `
    @if (updates.updateReady() && !updates.dismissed()) {
      <div
        class="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:inset-x-auto md:right-4 md:top-4 md:p-0"
        role="status"
        aria-live="polite"
      >
        <div class="update-card pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-border bg-popover px-4 py-3 text-popover-foreground shadow-lg">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <app-icon name="sparkles" [size]="18" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold">{{ 'New version available' | t }}</p>
            <p class="text-xs text-muted-foreground">{{ 'Refresh to get the latest updates.' | t }}</p>
          </div>
          <button type="button" class="btn btn-primary shrink-0" [disabled]="reloading" (click)="refresh()">
            <app-icon name="refresh-cw" [size]="15" />
            {{ 'Refresh' | t }}
          </button>
          <button
            type="button"
            class="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            [attr.aria-label]="'Later' | t"
            [title]="'Later' | t"
            (click)="updates.dismissed.set(true)"
          >
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .update-card { animation: update-in 220ms ease-out; }
    @keyframes update-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .update-card { animation: none; } }
  `,
})
export class UpdateBannerComponent {
  updates = inject(AppUpdateService);
  reloading = false;

  refresh() {
    this.reloading = true;
    this.updates.reloadNow();
  }
}
