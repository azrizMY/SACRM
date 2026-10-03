import { Component } from '@angular/core';
import { TranslatePipe } from './i18n';
import { ToastService } from './toast.service';

/** Renders ToastService's toasts — mounted once in the app shell. */
@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div class="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg">
          <span class="min-w-0 flex-1">{{ t.message | t }}</span>
          @if (t.actionLabel) {
            <button type="button" (click)="toasts.run(t)" class="shrink-0 rounded-md px-2 py-1 text-xs font-bold text-primary hover:bg-primary/10">{{ t.actionLabel | t }}</button>
          }
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  constructor(public toasts: ToastService) {}
}
